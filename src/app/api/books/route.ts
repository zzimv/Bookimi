import { z } from "zod";
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

const Input = z.object({ answers: z.unknown(), captcha: z.string().optional() });

// Создать книгу из анкеты и поставить в очередь сочинение сказки (без фото).
export async function POST(req: Request) {
  const t = await throttle("books", 10, 60_000);
  if (t) return t;
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  const parsed = AnswersV2.safeParse(b.answers);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Заполните обязательные шаги");
  const a = parsed.data;
  // Сюжет должен подходить аудитории; доп. героев — не меньше, чем требует сюжет (пара, хозяева питомца…)
  const plot = a.story.slug ? plotBySlug(a.story.slug) : null;
  if (plot && plot.audience !== a.audience) return err("Этот сюжет для другой аудитории — выберите сюжет из списка");
  if (plot && a.extras.length < plot.extras.min) return err(plot.extras.note ?? `Для этого сюжета нужно добавить героев: не меньше ${plot.extras.min}`);
  if (plot && a.extras.length > plot.extras.max) a.extras = a.extras.slice(0, plot.extras.max);
  // Стиль картинок и настроение — только из каталога; иначе — по сюжету / без настроения
  // Пробные стили (status "trial") — только если владелец включил art.showTrialStyles
  const styles = visibleArtStyleIds((await cfg("art")).showTrialStyles);
  if (!styles.some((x) => x.id === a.artStyle)) a.artStyle = plot?.artStyles[0] ?? "watercolor-air";
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
  ]);
  if (bad) return err("Пожалуйста, уберите из анкеты недопустимые слова или ссылки");
  if (!a.story.slug && !a.story.idea) return err("Выберите сюжет или опишите свою идею");

  const limits = await cfg("limits");
  if (!(await hit(await deviceKey(), "text", limits.textsPerDevice))) {
    return err(`Сегодня можно сочинить не больше ${limits.textsPerDevice} сказок. Возвращайтесь завтра — черновик сохранится.`, 429);
  }
  // Второй, более высокий лимит — по подсети IP: сброс cookie устройства его не обходит
  if (!(await hit(`textip:${ipSubnet(await clientIp())}`, "text-ip", limits.textsPerIp))) {
    return err(`Сегодня с вашей сети сочинили уже много сказок. Возвращайтесь завтра — черновик сохранится.`, 429);
  }

  const story = await db.story.findUnique({ where: { slug: a.story.slug || "svoya-ideya" } });
  if (!story) return err("Сюжет не найден");
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
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
  await db.hero.create({
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
  for (const e of a.extras) {
    await db.hero.create({
      data: { bookId: book.id, userId: user?.id, role: e.role, name: e.name, gender: e.gender, appearance: { custom: e.description, what: e.what, species: e.species }, interests: [] },
    });
  }
  await db.quizDraft.updateMany({ where: { anonId: anon, bookId: null }, data: { bookId: book.id } });
  await enqueue(QUEUES.generateText, { bookId: book.id });
  const utm = await utmCookie();
  await track("quiz_step", { anonId: anon, userId: user?.id, props: { step: "submit", bookId: book.id }, source: utm?.utm_source });
  return json({ bookId: book.id });
}
