// Витрина (главная, каталог, страницы аудиторий): сезон, «Для кого книга?», подписка, рейтинг.
// Только сервер: читает настройки и БД. Данные для клиента передаются пропсами.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, hasDatabase } from "./db";
import { cfg } from "./settings";
import { sampleUrl } from "./obrazec";
import { getApprovedReviews, type PublicStory } from "./catalog";
import { OCCASIONS as OCCASION_KEYS, SEGMENTS, type AudienceKey } from "../content/profiles";
import { getNearestHoliday } from "./holidays";
import { dayFromIso, dayOf, fmtDay, mskToday, orderDeadline, type Day } from "./holidays-core";

/** Посадочные аудиторий: /dlya/<slug>. ?dlya= в каталоге и анкете принимает и slug, и ключ (CHILD). */
export const AUDIENCE_PAGES: { slug: string; key: AudienceKey; nav: string; h1: string; lead: string; title: string; description: string; hero: string }[] = [
  {
    slug: "detyam",
    key: "CHILD",
    nav: "Детям",
    h1: "Сказки, где ваш ребёнок — главный герой",
    lead: "Для малышей 2–4 лет — тихие сказки на ночь и повторялки, для 5–10 лет — приключения, загадки и стихи. Имя, внешность и любимые игрушки ребёнка — на каждой странице.",
    title: "Персональные сказки для детей 2–10 лет",
    description: "Именная книга, где ребёнок — главный герой: сказки на ночь, приключения, стихи. Бесплатное превью, PDF 990 ₽, печать от 2 490 ₽.",
    hero: "ребёнок",
  },
  {
    slug: "podrostkam",
    key: "TEEN",
    nav: "Подросткам",
    h1: "Книга, в которой подросток узнаёт себя",
    lead: "Квесты с юмором, детективы, космос и шуточная былина — без сюсюканья. Для 11–17 лет: на день рождения, выпускной или просто так.",
    title: "Персональные книги для подростков 11–17 лет",
    description: "Приключение, где подросток — главный герой: квест, детектив, фантастика, комикс. Бесплатное превью, PDF 990 ₽.",
    hero: "подросток",
  },
  {
    slug: "vzroslym",
    key: "ADULT",
    nav: "Взрослым",
    h1: "Книга-подарок о любимом человеке",
    lead: "История вашей пары, былина о домашних подвигах мамы или папы, сказка для бабушки и дедушки от внуков, эпос о коллеге. Подарок, который перечитывают.",
    title: "Персональные книги для взрослых: паре, родителям, бабушке и дедушке, коллеге",
    description: "Книга-подарок, где главный герой — ваш близкий: история любви, былина для папы, сказка для бабушки от внуков. Превью бесплатно.",
    hero: "близкий человек",
  },
  {
    slug: "pitomcam",
    key: "PET",
    nav: "Питомцам",
    h1: "Книга, где герой — ваша собака или кошка",
    lead: "Смешные истории от лица питомца: «мой человек», носочный клад, сказание о диване. Кличка, порода и окрас — как в жизни, хозяева — рядом на страницах.",
    title: "Книга о вашем питомце: собаке или кошке",
    description: "Персональная книга, где главный герой — ваша собака или кошка: кличка, порода, окрас и привычки. Превью бесплатно, PDF 990 ₽.",
    hero: "питомец",
  },
];

export function audienceFromParam(v?: string | null): AudienceKey | undefined {
  if (!v) return undefined;
  const up = v.toUpperCase();
  const byKey = AUDIENCE_PAGES.find((a) => a.key === up);
  if (byKey) return byKey.key;
  const low = v.toLowerCase();
  const aliases: Record<string, AudienceKey> = { deti: "CHILD", podrostki: "TEEN", vzroslye: "ADULT", pitomcy: "PET" };
  return AUDIENCE_PAGES.find((a) => a.slug === low)?.key ?? aliases[low];
}
export const audiencePage = (key: AudienceKey) => AUDIENCE_PAGES.find((a) => a.key === key)!;

/** Карточки «Для кого книга?» на главной — ведут в каталог с фильтром по сегменту. */
export const FOR_WHOM: { title: string; sub: string; href: string; audience: AudienceKey; img: string }[] = [
  { title: "Малыши", sub: "2–4 года", href: "/skazki?dlya=detyam&segment=kids-2-4", audience: "CHILD", img: sampleUrl({ slug: "sonnaya-strana", age: 3, gender: "girl", hairstyle: "хвостик", style: "soft-gouache" }) },
  { title: "Дети", sub: "5–10 лет", href: "/skazki?dlya=detyam&segment=kids-5-7,kids-8-10", audience: "CHILD", img: sampleUrl({ slug: "imya-i-zvyozdnyj-drakonchik", age: 7, gender: "boy" }) },
  { title: "Подростки", sub: "11–17 лет", href: "/skazki?dlya=podrostkam", audience: "TEEN", img: sampleUrl({ slug: "stazher-orbity", gender: "girl" }) },
  { title: "Для двоих", sub: "Любимому человеку", href: "/skazki?dlya=vzroslym&segment=adult-couple", audience: "ADULT", img: sampleUrl({ slug: "dve-planety" }) },
  { title: "Маме и папе", sub: "От детей", href: "/skazki?dlya=vzroslym&segment=adult-parent", audience: "ADULT", img: sampleUrl({ slug: "bylina-o-domashnih-podvigah", gender: "girl", age: 38 }) },
  { title: "Бабушке и дедушке", sub: "От внуков", href: "/skazki?dlya=vzroslym&segment=adult-grandparent", audience: "ADULT", img: sampleUrl({ slug: "skazka-pro-carya-nesmeyana", gender: "boy", age: 68, hair: "седые", glasses: true }) },
  { title: "Коллеге и другу", sub: "Юбилей, пенсия", href: "/skazki?dlya=vzroslym&segment=adult-friend", audience: "ADULT", img: sampleUrl({ slug: "bylina-o-bogatyre-otdela", gender: "boy", beard: true }) },
  { title: "Собаке", sub: "Книга о псе", href: "/skazki?dlya=pitomcam&segment=pet-dog", audience: "PET", img: sampleUrl({ slug: "bolshaya-progulka", species: "dog", fur: "рыжий" }) },
  { title: "Кошке", sub: "Книга о кошке", href: "/skazki?dlya=pitomcam&segment=pet-cat", audience: "PET", img: sampleUrl({ slug: "skazanie-o-divane", species: "cat", fur: "серый" }) },
];

/** Сегменты аудитории для чипсов фильтра (короткие подписи). */
const SEGMENT_SHORT: Record<string, string> = {
  "kids-2-4": "2–4 года",
  "kids-5-7": "5–7 лет",
  "kids-8-10": "8–10 лет",
  "teens-11-13": "11–13 лет",
  "teens-14-17": "14–17 лет",
  "adult-couple": "Любимому",
  "adult-parent": "Маме и папе",
  "adult-grandparent": "Бабушке и дедушке",
  "adult-friend": "Другу и коллеге",
  "pet-dog": "Собаке",
  "pet-cat": "Кошке",
};
export const segmentChips = (audience: AudienceKey) => SEGMENTS.filter((s) => s.audience === audience).map((s) => ({ id: s.id, label: SEGMENT_SHORT[s.id] ?? s.title, title: s.title }));
export const segmentTitle = (id: string) => SEGMENTS.find((s) => s.id === id)?.title ?? id;

// ───────── Сезон ─────────

export interface Season {
  occasion: string;
  label: string;
  /** Пункт меню: «Новый год». */
  nav: string;
  /** Кнопка первого экрана. */
  cta: string;
  href: string;
  /** Строка о сроках печати к празднику (или null, если праздник прошёл / не нужен). */
  printLine: string | null;
}

const SEASON_COPY: Record<string, { nav: string; cta: string; holiday?: [number, number] }> = {
  "novyj-god": { nav: "Новый год", cta: "Выбрать новогоднюю книгу", holiday: [12, 31] },
  rozhdestvo: { nav: "Рождество", cta: "Выбрать книгу к Рождеству", holiday: [1, 7] },
  "staryj-novyj-god": { nav: "Старый Новый год", cta: "Выбрать книгу к Старому Новому году", holiday: [1, 14] },
  "den-vlyublennyh": { nav: "14 февраля", cta: "Выбрать книгу ко Дню влюблённых", holiday: [2, 14] },
  "23-fevralya": { nav: "23 Февраля", cta: "Выбрать книгу к 23 Февраля", holiday: [2, 23] },
  "8-marta": { nav: "8 Марта", cta: "Выбрать книгу к 8 Марта", holiday: [3, 8] },
  "vypusknoj-v-sadu": { nav: "Выпускной", cta: "Выбрать книгу к выпускному", holiday: [5, 31] },
  "pervyj-klass": { nav: "1 сентября", cta: "Выбрать книгу первокласснику", holiday: [9, 1] },
  "den-materi": { nav: "День матери", cta: "Выбрать книгу ко Дню матери" },
};

/** Повод по дате: с 15 октября по декабрь — Новый год (печатной книге нужно время), 1–14 февраля — День влюблённых и т. д. */
export function seasonByDate(d = new Date()): string | null {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 11 || m === 12 || (m === 10 && day >= 15)) return "novyj-god";
  if (m === 2 && day <= 14) return "den-vlyublennyh";
  if (m === 2) return "23-fevralya";
  if (m === 3 && day <= 8) return "8-marta";
  if (m === 5) return "vypusknoj-v-sadu";
  if (m === 8) return "pervyj-klass";
  return null;
}

/** Строка о сроке печати к празднику по готовой дате и последнему дню заказа (дни — по Москве, holidays-core). */
function deadlineLine(occasion: string, deadline: Day, now: Date): string {
  const label = OCCASION_KEYS.find((o) => o.key === occasion)?.label ?? "празднику";
  if (mskToday(now) > deadline) return `Печатная книга к празднику может не успеть — PDF придёт сразу после оплаты, его можно распечатать дома.`;
  const what = occasion === "novyj-god" ? "к Новому году" : `к празднику «${label}»`;
  return `Чтобы печатная книга успела ${what}, закажите до ${fmtDay(deadline)}. PDF — сразу после оплаты.`;
}

/**
 * Срок печати для повода с известной датой (SEASON_COPY): ручная дата из настроек или расчёт —
 * доставка 7 дней + печать 5 рабочих дней (выходные и праздники РФ не считаются).
 */
export function printDeadlineLine(occasion: string, manual = "", now = new Date()): string | null {
  const copy = SEASON_COPY[occasion];
  if (!copy?.holiday) return null;
  const [hm, hd] = copy.holiday;
  const today = mskToday(now);
  let year = new Date(today * 86400_000).getUTCFullYear();
  if (dayOf(year, hm, hd) < today) year++;
  const deadline = dayFromIso(manual) ?? orderDeadline(dayOf(year, hm, hd), null);
  return deadlineLine(occasion, deadline, now);
}

export async function getSeason(now = new Date()): Promise<Season | null> {
  const s = await cfg("season");
  if (s.mode === "off") return null;
  // auto: ближайший праздник из раздела «Праздники» (в окне «показывать за N дней»), иначе — по дате, как раньше
  const near = s.mode === "auto" ? await getNearestHoliday(now).catch(() => null) : null;
  const key = s.mode === "manual" ? s.occasion : (near?.calc.holiday.occasionKey ?? seasonByDate(now));
  if (!key) return null;
  const o = OCCASION_KEYS.find((x) => x.key === key);
  if (!o && !near) return null;
  const label = near?.calc.holiday.title ?? o!.label;
  const copy = SEASON_COPY[key] ?? { nav: label, cta: `Выбрать книгу: ${label.toLowerCase()}` };
  const manual = dayFromIso(s.printDeadline);
  const printLine = near?.calc.deadline != null ? deadlineLine(key, manual ?? near.calc.deadline, now) : printDeadlineLine(key, s.printDeadline, now);
  return { occasion: key, label, nav: copy.nav, cta: copy.cta, href: o ? `/povod/${key}` : "/prazdniki", printLine };
}

// ───────── Рейтинг и подписка ─────────

/** Рейтинг — только по реальным опубликованным отзывам; нет отзывов — null. */
export async function getRating() {
  const reviews = await getApprovedReviews();
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  let count = reviews.length;
  if (hasDatabase) count = await db.review.count({ where: { status: "approved" } }).catch(() => reviews.length);
  return { avg: Math.round(avg * 10) / 10, count, reviews };
}

/** Подписка показывается, только если в настройках указан активный промокод. */
export async function getNewsletter() {
  const n = await cfg("newsletter");
  const code = n.promoCode.trim().toUpperCase();
  if (!code || !hasDatabase) return null;
  try {
    const p = await db.promoCode.findUnique({ where: { code } });
    if (!p || !p.isActive || (p.validTo && p.validTo < new Date())) return null;
    return { code, text: n.discountText || "Скидка на первый заказ" };
  } catch {
    return null;
  }
}

// ───────── «Самые любимые» ─────────

/** 4 книги для главной: сначала сезонные, не больше двух на аудиторию, без «Своей идеи». */
export function pickFavorites(stories: PublicStory[], occasion?: string | null, n = 4) {
  const list = stories.filter((s) => s.slug !== SVOYA_IDEYA);
  const rank = (s: PublicStory) => (occasion && s.occasions.includes(occasion) ? s.occasions.indexOf(occasion) : 100);
  const sorted = list.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
  const out: PublicStory[] = [];
  const per: Record<string, number> = {};
  for (const s of sorted) {
    if ((per[s.audience] ?? 0) >= 2) continue;
    per[s.audience] = (per[s.audience] ?? 0) + 1;
    out.push(s);
    if (out.length === n) break;
  }
  return out;
}

/** Служебный сюжет «своя идея» не показывается в каталоге как книга. */
export const SVOYA_IDEYA = "svoya-ideya";
export const catalogStories = (list: PublicStory[]) => list.filter((s) => s.slug !== SVOYA_IDEYA);

// ───────── Витрина «фото → иллюстрация» ─────────

export interface ShowcaseManifest {
  photo: string;
  alt: string;
  styles: { src: string; title: string }[];
}

/**
 * Настоящие пары «фото → иллюстрация» от владельца: public/showcase/showcase.json (см. README там же).
 * Показываются, только если в файле стоит "consent": true — письменное согласие родителей/изображённых.
 */
export function getShowcase(): ShowcaseManifest | null {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "public", "showcase", "showcase.json"), "utf8"));
    if (raw?.consent !== true || typeof raw.photo !== "string" || !Array.isArray(raw.styles) || !raw.styles.length) return null;
    return { photo: raw.photo, alt: String(raw.alt ?? "Фото героя"), styles: raw.styles.slice(0, 3).map((s: { src: string; title: string }) => ({ src: String(s.src), title: String(s.title ?? "") })) };
  } catch {
    return null;
  }
}
