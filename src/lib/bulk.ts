// «Книга для каждого в группе»: один заказ на N книг — в каждой главный герой свой ребёнок группы, остальные — рядом.
// Здесь чистая логика (клиент, сервер, демо): скидки по количеству, расчёт суммы, анкета каждой копии.
// Скидки — настройка bulk.tiers (по умолчанию 5+ −20%, 15+ −30%, 25+ −35%; ждут решения владельца, ASSUMPTIONS.md).
import type { AnswersV2T, GroupMemberV2T } from "../content/answers";
import { guessGender } from "./declension";
import type { CatalogFormat, Quote, QuoteLine } from "./pricing";

export interface BulkTier {
  /** От скольких книг в заказе. */
  min: number;
  /** Скидка, % от суммы книг. */
  pct: number;
}

export const DEFAULT_BULK_TIERS: BulkTier[] = [
  { min: 5, pct: 20 },
  { min: 15, pct: 30 },
  { min: 25, pct: 35 },
];

/** Посвящение по умолчанию — одно на все книги, имя и род подставляются в каждой. */
export const DEFAULT_BULK_DEDICATION = "{Р:Дорогому|Дорогой} {ГЕРОЙ.дат} — на память о нашей группе. Мы всегда будем рядом!";

/** Скидка за количество: самый большой порог, который набран. */
export function bulkPct(copies: number, tiers: BulkTier[] = DEFAULT_BULK_TIERS): number {
  return [...tiers].sort((a, b) => a.min - b.min).reduce((pct, t) => (copies >= t.min ? t.pct : pct), 0);
}

/** Следующий порог: «ещё 3 книги — и скидка 30%». */
export function nextTier(copies: number, tiers: BulkTier[] = DEFAULT_BULK_TIERS): BulkTier | null {
  return [...tiers].sort((a, b) => a.min - b.min).find((t) => t.min > copies) ?? null;
}

export interface BulkQuoteInput {
  whoPrints: "self" | "bookimi";
  formatKey?: string;
  /** Имена героев копий — по строке на книгу (для чека и заказа). */
  heroes: string[];
  shippingMethod?: string;
  shippingRub?: number;
  /** Промокод или скидка новичка: не суммируются со скидкой за количество — берётся большая. */
  discountPct?: number;
  discountRub?: number;
  freeShippingBooks?: number;
  tiers?: BulkTier[];
}

export interface BulkQuote extends Quote {
  copies: number;
  bulkPct: number;
  /** Скидка за количество победила промокод/скидку новичка. */
  bulkApplied: boolean;
}

/**
 * Сумма заказа «для каждого»: строка на каждую книгу (PDF или печатный формат), одна доставка на всех
 * (бесплатная до пункта СДЭК от shipping.freeShippingBooks книг — как обычно), скидки не суммируются.
 * Допы в таком заказе не продаются (их можно докупить к каждой книге потом).
 */
export function bulkQuote(input: BulkQuoteInput, formats: CatalogFormat[]): BulkQuote {
  const errors: string[] = [];
  const lines: QuoteLine[] = [];
  const copies = input.heroes.length;
  const fmt = input.whoPrints === "self" ? formats.find((f) => f.kind === "PDF") : formats.find((f) => f.key === input.formatKey && f.kind === "PRINT");
  if (!fmt) errors.push(input.whoPrints === "self" ? "PDF недоступен" : "Выберите формат книги");
  if (copies < 2) errors.push("Для заказа «для каждого» нужно хотя бы двое детей в группе");
  if (fmt) for (const name of input.heroes) lines.push({ kind: "format", key: fmt.key, title: `${fmt.title} — герой книги: ${name}`, priceRub: fmt.priceRub });
  const subtotalRub = lines.reduce((s, l) => s + l.priceRub, 0);
  const pct = bulkPct(copies, input.tiers);
  const byBulk = Math.round((subtotalRub * pct) / 100);
  const byOther = Math.max(input.discountPct ? Math.round((subtotalRub * input.discountPct) / 100) : 0, input.discountRub ?? 0);
  const discountRub = Math.min(subtotalRub, Math.max(byBulk, byOther));
  const books = input.whoPrints === "bookimi" ? copies : 0;
  let shippingRub = input.whoPrints === "bookimi" ? Math.max(0, Math.round(input.shippingRub ?? 0)) : 0;
  if (input.shippingMethod === "cdek_pvz" && input.freeShippingBooks && books >= input.freeShippingBooks) shippingRub = 0;
  if (input.shippingMethod === "pickup") shippingRub = 0;
  return {
    lines,
    subtotalRub,
    pdfCreditRub: 0,
    discountRub,
    shippingRub,
    totalRub: Math.max(0, subtotalRub - discountRub + shippingRub),
    books,
    errors,
    copies,
    bulkPct: pct,
    bulkApplied: byBulk > 0 && byBulk >= byOther,
  };
}

/** Все дети книги: герой + группа, в порядке списка. */
export function groupChildren(a: AnswersV2T): { name: string; gender: "boy" | "girl" }[] {
  return [{ name: a.hero.name, gender: a.hero.gender }, ...(a.group?.members ?? []).map((m) => ({ name: m.name, gender: (m.gender ?? guessGender(m.name)) as "boy" | "girl" }))];
}

/**
 * Анкета копии i (1..N−1) из анкеты основной книги: герой — i-й ребёнок группы (его пол, описание и фото),
 * в группе — все остальные, включая героя основной книги; взрослые группы, повод, сюжет, стиль и настроение — те же.
 * Личные доп. герои основной книги (мама, игрушка) в копии не переносятся. Посвящение — общий шаблон.
 */
export function bulkCopyAnswers(a: AnswersV2T, i: number, dedication = DEFAULT_BULK_DEDICATION): AnswersV2T {
  const members = a.group?.members ?? [];
  const m = members[i - 1];
  if (!m) throw new Error(`Нет ребёнка №${i} в группе`);
  const heroAsMember: GroupMemberV2T = {
    name: a.hero.name,
    gender: a.hero.gender,
    photo: false,
    description: [a.appearance.hair && `${a.appearance.hair} волосы`, a.appearance.hairstyle, a.appearance.glasses && "очки"].filter(Boolean).join(", "),
  };
  const rest = members.filter((_, j) => j !== i - 1);
  return {
    ...a,
    hero: {
      ...a.hero,
      name: m.name,
      nickname: "",
      gender: (m.gender ?? guessGender(m.name)) as "boy" | "girl",
      birthDate: "",
      photoIds: m.photoId ? [m.photoId] : [],
    },
    appearance: { hair: "", hairstyle: "", skin: "", glasses: false, freckles: false, beard: false, clothes: "", custom: m.description ?? "" },
    interests: [],
    interestCustom: "",
    extras: [],
    group: { members: [heroAsMember, ...rest], adults: a.group?.adults ?? [] },
    dedication,
  };
}

/** Сколько первых книг показываем превью до оплаты (остальные дорисуются после). */
export const BULK_PREVIEW_COPIES = 3;
