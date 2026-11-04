import { z } from "zod";
import { CUSTOM_STORY_ENABLED } from "@/content/sections";
import { DEFAULT_ART_STYLE } from "@/content/profiles";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { AnswersV2 } from "@/lib/quiz";
import { plotBySlug } from "@/content/registry";
import { moodsFor } from "@/content/moods";
import { visibleArtStyleIds } from "@/content/art/index";
import { anonId, clientIp, currentUser } from "@/lib/auth";
import { body, deviceKey, err, json, throttle, utmCookie, verifyCaptcha } from "@/lib/api";
import { hit, ipSubnet } from "@/lib/limits";
import { cfg } from "@/lib/settings";
import { checkInputs } from "@/lib/moderation";
import { enqueue, QUEUES } from "@/lib/queue";
import { track } from "@/lib/events";
import { attachPhotosToBook } from "@/lib/draft";
import { ensureBulkCopies } from "@/lib/bulk-server";
import { isStaff } from "@/lib/staff";
import { groupMembersMax } from "@/content/registry";
import { soonAudiences, soonCreateError } from "@/lib/shelf";

const Input = z.object({
  answers: z.unknown(),
  captcha: z.string().optional(),
  /** «Сделать книгу для каждого ребёнка группы» — копии создаются сразу, тексты первых — в очереди. */
  bulk: z.object({ dedication: z.string().trim().max(300).optional() }).optional(),
});

// Создать книгу из анкеты и поставить в очередь сочинение сказки (без фото).
export async function POST(req: Request) {
  const t = await throttle("books", 10, 60_000);
  if (t) return t;
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  const parsed = AnswersV2.safeParse(b.answers);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Заполните обязательные шаги");
  const a = parsed.data;
  // Аудитория «скоро» (storefront.soon): книги не создаём
  const soonList = soonAudiences((await cfg("storefront")).soon);
  if (soonList.includes(a.audience)) return err(soonCreateError(a.audience), 403);
  // Сюжет должен подходить аудитории; доп. героев — не меньше, чем требует сюжет (пара, хозяева питомца…)
  const plot = a.story.slug ? plotBySlug(a.story.slug) : null;
  if (plot && plot.audience !== a.audience) return err("Этот сюжет для другой аудитории — выберите сюжет из списка");
  if (plot && a.extras.length < plot.extras.min) return err(plot.extras.note ?? `Для этого сюжета нужно добавить героев: не меньше ${plot.extras.min}`);
  if (plot && a.extras.length > plot.extras.max) a.extras = a.extras.slice(0, plot.extras.max);
  // Группа — только для сюжетов с группой и не больше, чем помещается в книгу
  if (!plot?.group) a.group = undefined;
  else if (a.group) a.group = { members: a.group.members.slice(0, groupMembersMax(plot)), adults: a.group.adults.slice(0, plot.group.includeAdults?.max ?? 0) };
  // Стиль картинок и настроение — только из каталога; иначе — по сюжету / без настроения
  // Пробные стили (status "trial") — только если владелец включил art.showTrialStyles
  const styles = visibleArtStyleIds((await cfg("art")).showTrialStyles);
  if (!styles.some((x) => x.id === a.artStyle)) a.artStyle = plot?.artStyles[0] ?? DEFAULT_ART_STYLE;
  if (a.mood && !moodsFor(a.audience, a.hero.age).some((m) => m.id === a.mood)) a.mood = "";
  if (!(await verifyCaptcha(b.captcha))) return err("Подтвердите, что вы не робот", 400);
  const bad = checkInputs([
    a.hero.name,
    a.hero.nickname,
    a.dedication,
    a.story.idea,
    a.appearance.custom,
    a.adult.howMet,
    a.adult.profession,
    ...a.adult.memories,
    a.pet.breed,
    a.pet.traits,
    a.occasion.custom,
    ...a.extras.map((e) => `${e.name} ${e.description} ${e.what}`),
    ...(a.group?.members ?? []).map((m) => `${m.name} ${m.description}`),
    ...(a.group?.adults ?? []).map((m) => m.name),
  ]);
  if (bad) return err("Пожалуйста, уберите из анкеты недопустимые слова или ссылки");
  // rev 20: «Своя история» убрана из пути покупателя (CUSTOM_STORY_ENABLED) — только книги каталога
  if (!a.story.slug && !CUSTOM_STORY_ENABLED) return err("Выберите книгу из каталога", 400);
  if (!a.story.slug && !a.story.idea) return err("Выберите сюжет или опишите свою идею");
  // rev 20: фото «в книгу» с первого шага — только своё фото героя (иначе — без фото на странице)
  if (a.layout.photoId && !(a.hero.photoIds ?? []).includes(a.layout.photoId)) a.layout = { ...a.layout, photoId: undefined };
  // Подростковые книги — для 11–17 лет (как обещано в анкете)
  if (a.audience === "TEEN" && (a.hero.age === undefined || a.hero.age < 11 || a.hero.age > 17)) return err("Укажите возраст: от 11 до 17 лет");

  const limits = await cfg("limits");
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  // Сотрудники тестируют без лимитов устройства и сети (расходы на сервисы — в свой суточный лимит, src/lib/staff.ts)
  const staff = isStaff(user?.role);
  if (!staff && !(await hit(await deviceKey(), "text", limits.textsPerDevice))) {
    return err(`Сегодня можно сочинить не больше ${limits.textsPerDevice} сказок. Возвращайтесь завтра — черновик сохранится.`, 429);
  }
  // Второй, более высокий лимит — по подсети IP: сброс cookie устройства его не обходит
  if (!staff && !(await hit(`textip:${ipSubnet(await clientIp())}`, "text-ip", limits.textsPerIp))) {
    return err(`Сегодня с вашей сети сочинили уже много сказок. Возвращайтесь завтра — черновик сохранится.`, 429);
  }

  const story = await db.story.findUnique({ where: { slug: a.story.slug || "svoya-ideya" } });
  if (!story) return err("Сюжет не найден");
  const book = await db.book.create({
    data: {
      userId: user?.id,
      anonId: anon,
      storyId: story.id,
      styleKey: a.artStyle,
      mood: a.mood || null,
      dedication: a.dedication,
      params: a as object,
      status: "TEXT_QUEUED",
    },
  });
  const main = await db.hero.create({
    data: {
      bookId: book.id,
      userId: user?.id,
      role: "main",
      name: a.hero.name,
      nickname: a.hero.nickname,
      gender: a.hero.gender,
      ageGroup: a.hero.ageGroup,
      birthDate: a.hero.birthDate ? new Date(a.hero.birthDate) : undefined,
      appearance: (a.audience === "PET" ? { ...a.appearance, pet: a.pet } : a.audience === "ADULT" ? { ...a.appearance, adult: a.adult } : a.appearance) as object,
      interests: a.interests,
    },
  });
  // Фото, загруженные на шаге «Герои», переезжают к героям книги (срок — 7 дней от загрузки вместо 24 часов)
  const photoHero = new Map<string, string>();
  for (const id of a.hero.photoIds ?? []) photoHero.set(id, main.id);
  for (const e of a.extras) {
    const h = await db.hero.create({
      data: { bookId: book.id, userId: user?.id, role: e.role, name: e.name, gender: e.gender, appearance: { custom: e.description, what: e.what, species: e.species, ...(e.look ? { look: e.look } : {}) }, interests: [] },
    });
    if (e.photoId) photoHero.set(e.photoId, h.id);
  }
  for (const m of a.group?.members ?? []) {
    if (!m.photoId) continue;
    const h = await db.hero.create({ data: { bookId: book.id, userId: user?.id, role: "member", name: m.name, gender: m.gender, appearance: { custom: m.description }, interests: [] } });
    photoHero.set(m.photoId, h.id);
  }
  if (photoHero.size) {
    await attachPhotosToBook({ anonId: anon, userId: user?.id }, (id) => photoHero.get(id), [...photoHero.keys()], limits.photoTtlDays);
    const mainPhotos = await db.photo.count({ where: { heroId: main.id, deletedAt: null } });
    if (mainPhotos) await db.book.update({ where: { id: book.id }, data: { withPhoto: true } });
  }
  await db.quizDraft.updateMany({ where: { anonId: anon, bookId: null }, data: { bookId: book.id } });
  await enqueue(QUEUES.generateText, { bookId: book.id });
  if (b.bulk && plot?.group && a.group?.members.length) await ensureBulkCopies(book, { dedication: b.bulk.dedication || undefined });
  const utm = await utmCookie();
  await track("quiz_step", { anonId: anon, userId: user?.id, props: { step: "submit", bookId: book.id }, source: utm?.utm_source });
  return json({ bookId: book.id });
}
