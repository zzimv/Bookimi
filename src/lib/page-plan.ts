// План страниц книги (rev 20) — общий для превью (BookPreview), PDF (src/lib/pdf.ts), печати и админки.
// До rev 20 книга была одна на всех: обложка, приветствие, фото, посвящение, ровно 12 разворотов, финал (28 страниц блока).
// Теперь у каждой возрастной группы детских книг свой план (решение владелицы 03.11.2026):
//   0–3 — картонная книга: «9 страниц, двойной картон» или «12 страниц, плотный картон» (выбирает покупатель),
//         сказка — 8 страниц (одна большая картинка и очень крупный короткий текст на странице);
//   4–6 — 30 страниц: 11 разворотов сказки и 2 разворота (4 страницы), где ребёнок рисует сам;
//   7–9 — 40 страниц: 16 разворотов сказки и 4 страницы «Мои заметки» / «Нарисуй…».
// Подростки, взрослые и питомцы — прежний план «classic».
// Текст сюжета не переписывается автоматически: пока владелица не выбрала книги и тексты не переписаны под новый
// объём, раскладка подгоняет то, что есть (fitStory): лишние развороты сливаются по два (самые короткие соседние),
// недостающие заполняются страницами «Нарисуй…» / «Мои заметки» (у малышей — страницей-картинкой). Пустых страниц нет.
// Чистый модуль без React и Node API: работает на сервере, в браузере и в демо-стенде.
import type { KidAgeKey } from "../content/ages";

export type PlanId = "classic" | "board-9" | "board-12" | "kids-4-6" | "kids-7-9";
/** Размер текста сказки: board — очень крупно (0–3), large — крупно с большим интерлиньяжем (4–6), comfort — удобно крупно (7–9). */
export type TextScale = "board" | "large" | "comfort" | "normal";
export type ActivityKind = "draw" | "notes" | "art";

export interface ActivityPage {
  kind: ActivityKind;
  /** Подсказка на странице: «Нарисуй, что было дальше». У «art» (страница-картинка малышам) — пусто. */
  prompt: string;
}

export interface PagePlan {
  id: PlanId;
  /** Подпись для покупателя и админки. */
  title: string;
  group?: KidAgeKey;
  /** Единица сказки: разворот (две страницы, картинка через обе) или страница картонной книги (своя картинка). */
  storyUnit: "spread" | "page";
  /** Сколько единиц сказки в плане. */
  story: number;
  /** Страницы перед сказкой. */
  front: ("welcome" | "photo" | "dedication")[];
  /** Последняя страница «эта книга — только твоя». */
  final: boolean;
  /** Страницы-задания: после `after` единиц сказки (у разворотов — всегда парами, чтобы сказка начиналась слева). */
  activities: { after: number; pages: ActivityPage[] }[];
  /** Страниц блока (без обложки и форзаца) — то, что печатает типография. */
  innerPages: number;
  textScale: TextScale;
  /** Картонная книга: число страниц и картон (печать — форматы board9-* / board12-*). */
  board?: { pages: 9 | 12; board: string };
}

const FRONT_ALL: PagePlan["front"] = ["welcome", "photo", "dedication"];

export const PAGE_PLANS: Record<PlanId, PagePlan> = {
  classic: { id: "classic", title: "Книга 28 страниц", storyUnit: "spread", story: 12, front: FRONT_ALL, final: true, activities: [], innerPages: 28, textScale: "normal" },
  // 0–3: 9 страниц = приветствие (с фото в рамке, если добавлено) + 8 страниц сказки
  "board-9": {
    id: "board-9",
    title: "Картонная книга: 9 страниц, двойной картон",
    group: "0-3",
    storyUnit: "page",
    story: 8,
    front: ["welcome"],
    final: false,
    activities: [],
    innerPages: 9,
    textScale: "board",
    board: { pages: 9, board: "двойной картон" },
  },
  // 0–3: 12 страниц = приветствие + фото + посвящение + 8 страниц сказки + финал
  "board-12": {
    id: "board-12",
    title: "Картонная книга: 12 страниц, плотный картон",
    group: "0-3",
    storyUnit: "page",
    story: 8,
    front: FRONT_ALL,
    final: true,
    activities: [],
    innerPages: 12,
    textScale: "board",
    board: { pages: 12, board: "плотный картон" },
  },
  // 4–6: 3 + 22 (11 разворотов) + 4 (рисуем сами) + финал = 30
  "kids-4-6": {
    id: "kids-4-6",
    title: "Книга 30 страниц: сказка и страницы, где рисуешь ты",
    group: "4-6",
    storyUnit: "spread",
    story: 11,
    front: FRONT_ALL,
    final: true,
    activities: [
      { after: 5, pages: [{ kind: "draw", prompt: "Нарисуй себя рядом с новым другом из сказки" }, { kind: "draw", prompt: "Нарисуй самое волшебное место этой сказки" }] },
      { after: 11, pages: [{ kind: "draw", prompt: "Нарисуй, что было дальше" }, { kind: "draw", prompt: "Нарисуй свою обложку для этой сказки" }] },
    ],
    innerPages: 30,
    textScale: "large",
  },
  // 7–9: 3 + 32 (16 разворотов) + 4 (заметки и рисунки) + финал = 40
  "kids-7-9": {
    id: "kids-7-9",
    title: "Книга 40 страниц: большая история, заметки и рисунки",
    group: "7-9",
    storyUnit: "spread",
    story: 16,
    front: FRONT_ALL,
    final: true,
    activities: [
      { after: 8, pages: [{ kind: "notes", prompt: "Мои заметки: что я уже знаю об этой тайне?" }, { kind: "draw", prompt: "Нарисуй самый интересный момент" }] },
      { after: 16, pages: [{ kind: "notes", prompt: "Мои заметки: придумай, что случится в следующей истории" }, { kind: "draw", prompt: "Нарисуй карту своего приключения" }] },
    ],
    innerPages: 40,
    textScale: "comfort",
  },
};

export const PLAN_IDS = Object.keys(PAGE_PLANS) as PlanId[];
export const pagePlan = (id?: string | null): PagePlan => PAGE_PLANS[(id ?? "classic") as PlanId] ?? PAGE_PLANS.classic;
export const isBoardPlan = (id?: string | null) => Boolean(pagePlan(id).board);

/** Вариант картонной книги из вёрстки (layout.board): 9 или 12 (по умолчанию 12). */
export const boardVariant = (v: unknown): 9 | 12 => (Number(v) === 9 ? 9 : 12);

/**
 * План книги: детская книга — по группе её текста (сегмент сюжета) или по группе анкеты; картонная 0–3 — по выбору
 * покупателя (layout.board). Остальные аудитории — classic.
 */
export function planIdFor(o: { audience?: string | null; group?: string | null; board?: unknown }): PlanId {
  if (o.audience && o.audience !== "CHILD") return "classic";
  if (o.group === "0-3") return boardVariant(o.board) === 9 ? "board-9" : "board-12";
  if (o.group === "4-6") return "kids-4-6";
  if (o.group === "7-9") return "kids-7-9";
  return "classic";
}

// ---------------------------------------------------------------------------
// Подгонка сказки под план
// ---------------------------------------------------------------------------

/** Единица сказки в плане: исходные развороты сюжета (1..n; слитые — несколько) или заполнитель. */
export type StorySlot = { src: number[] } | { fill: ActivityPage[] };

const FILL_SPREADS: ActivityPage[][] = [
  [{ kind: "draw", prompt: "Нарисуй героя этой сказки" }, { kind: "notes", prompt: "Мои заметки: что бы ты сделал на месте героя?" }],
  [{ kind: "notes", prompt: "Мои заметки: самые смешные слова из сказки" }, { kind: "draw", prompt: "Нарисуй, кого ещё можно позвать в эту историю" }],
  [{ kind: "draw", prompt: "Нарисуй, где живёт твой герой" }, { kind: "notes", prompt: "Мои заметки: вопросы, которые хочется задать героям" }],
  [{ kind: "notes", prompt: "Мои заметки: чему меня научила эта история" }, { kind: "draw", prompt: "Нарисуй подарок для героя" }],
];
const FILL_SPREADS_YOUNG: ActivityPage[][] = [
  [{ kind: "draw", prompt: "Нарисуй героя этой сказки" }, { kind: "draw", prompt: "Нарисуй, кто ещё живёт рядом" }],
  [{ kind: "draw", prompt: "Нарисуй свой любимый момент" }, { kind: "draw", prompt: "Нарисуй подарок для героя" }],
];

/** Длина текста слота (для выбора, что сливать). */
type Len = (i: number) => number;

/**
 * Развороты сюжета → единицы плана. n = plan.story — один к одному. n больше — сливаем соседние пары с самым коротким
 * общим текстом (картинка — первого из пары). n меньше — недостающие единицы равномерно между разворотами сказки:
 * страницы «Нарисуй…» / «Мои заметки» (у картонной книги — страница-картинка без текста).
 */
export function fitStory(plan: PagePlan, n: number, len: Len = () => 1): StorySlot[] {
  const target = plan.story;
  let groups: number[][] = Array.from({ length: Math.max(0, n) }, (_, i) => [i + 1]);
  while (groups.length > target && groups.length > 1) {
    let best = 0;
    let bestLen = Infinity;
    for (let i = 0; i < groups.length - 1; i++) {
      const l = [...groups[i], ...groups[i + 1]].reduce((s, k) => s + len(k), 0);
      if (l < bestLen) {
        bestLen = l;
        best = i;
      }
    }
    groups = [...groups.slice(0, best), [...groups[best], ...groups[best + 1]], ...groups.slice(best + 2)];
  }
  const slots: StorySlot[] = groups.map((src) => ({ src }));
  const missing = target - slots.length;
  if (missing <= 0) return slots;
  // Заполнители — равномерно: после разворотов round((k+1)·n/(missing+1)), не первым и не последним
  const fills = plan.storyUnit === "page" ? null : plan.group === "4-6" ? FILL_SPREADS_YOUNG : FILL_SPREADS;
  const out: StorySlot[] = [];
  const at = Array.from({ length: missing }, (_, k) => Math.max(1, Math.round(((k + 1) * slots.length) / (missing + 1))));
  let fi = 0;
  slots.forEach((s, i) => {
    out.push(s);
    while (fi < missing && at[fi] === i + 1) {
      out.push({ fill: fills ? fills[fi % fills.length] : [{ kind: "art", prompt: "" }] });
      fi++;
    }
  });
  for (; fi < missing; fi++) out.push({ fill: fills ? fills[fi % fills.length] : [{ kind: "art", prompt: "" }] });
  return out;
}

/** Подходит ли текст сюжета под план: «ok», «short» (меньше разворотов) или «long» (больше — сливаются). */
export function planFit(plan: PagePlan, n: number): "ok" | "short" | "long" {
  return n === plan.story ? "ok" : n < plan.story ? "short" : "long";
}
/** Подпись для админки, если текст ещё не под объём группы. */
export const PLAN_FIT_NOTE = "текст ещё не под новый объём";

// ---------------------------------------------------------------------------
// Страницы книги
// ---------------------------------------------------------------------------

export type BookPageKind = "cover" | "endpaper" | "welcome" | "photo" | "dedication" | "story" | "activity" | "final" | "back";
export interface BookPageRef {
  kind: BookPageKind;
  /** Номер единицы сказки в плане (1..plan.story) для story. */
  spread?: number;
  /** Сторона разворота; «page» — страница картонной книги (своя картинка целиком). */
  side?: "left" | "right" | "page";
  /** Исходные развороты сюжета (1..n) для story: текст — подряд, картинка — первого. */
  src?: number[];
  /** Страница-задание. */
  activity?: ActivityPage;
  /** Номер страницы-задания по порядку (для подписей и ключей). */
  n?: number;
}

/**
 * Все страницы книги по плану: обложка, форзац, страницы перед сказкой, сказка (с заданиями по плану и заполнителями),
 * финал, задняя обложка. n — сколько разворотов в тексте книги.
 */
export function planPages(plan: PagePlan, n: number, len?: Len): BookPageRef[] {
  const out: BookPageRef[] = [{ kind: "cover" }, { kind: "endpaper" }];
  for (const f of plan.front) out.push({ kind: f });
  let act = 0;
  const pushActs = (pages: ActivityPage[]) => {
    for (const a of pages) out.push({ kind: "activity", activity: a, n: ++act });
  };
  const slots = fitStory(plan, n, len);
  let unit = 0;
  for (const s of slots) {
    if ("fill" in s) {
      pushActs(plan.storyUnit === "spread" && s.fill.length === 1 ? [s.fill[0], s.fill[0]] : s.fill);
      continue;
    }
    unit++;
    if (plan.storyUnit === "page") out.push({ kind: "story", spread: unit, side: "page", src: s.src });
    else out.push({ kind: "story", spread: unit, side: "left", src: s.src }, { kind: "story", spread: unit, side: "right", src: s.src });
    for (const a of plan.activities) if (a.after === unit) pushActs(a.pages);
  }
  // Задания «после последнего разворота» при короткой сказке — всё равно в книге (перед финалом)
  for (const a of plan.activities) if (a.after > unit) pushActs(a.pages);
  if (plan.final) out.push({ kind: "final" });
  out.push({ kind: "back" });
  return out;
}

/** Страниц блока по факту раскладки (без обложек и форзаца) — должно совпасть с plan.innerPages. */
export const innerCount = (pages: BookPageRef[]) => pages.filter((p) => !["cover", "endpaper", "back"].includes(p.kind)).length;

/** Развороты для показа «Разворотом»: обложка одна, дальше парами (форзац + приветствие, …). */
export function pairPages(pages: BookPageRef[]): BookPageRef[][] {
  const out: BookPageRef[][] = [[pages[0]]];
  for (let i = 1; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
  return out;
}

/** Текст единицы сказки: исходные развороты подряд (слитые — через пустую строку, так splitSpread делит их по сторонам). */
export function slotText(src: number[] | undefined, textOf: (i: number) => string | null | undefined): string {
  return (src ?? []).map((i) => (textOf(i) ?? "").trim()).filter(Boolean).join("\n\n");
}

/**
 * Множитель размера текста на картинке: короткий — как задумано, длинный (слитые развороты до переписывания текста)
 * — мельче, чтобы влез и остался читаемым. Общий для экрана (--tf) и PDF.
 */
export function textFit(scale: TextScale, len: number): number {
  const room = { board: 70, large: 170, comfort: 300, normal: 260 }[scale];
  if (len <= room) return 1;
  return Math.max(scale === "board" ? 0.5 : 0.62, Math.sqrt(room / len));
}

/** Базовый размер текста сказки (pt при странице 210 мм; экран — тот же масштаб через CSS). */
export const TEXT_PT: Record<TextScale, number> = { board: 30, large: 19, comfort: 16.5, normal: 14 };
/** Интерлиньяж по группе: 4–6 — щедрый, чтобы ребёнок не терял строку. */
export const TEXT_LEADING: Record<TextScale, number> = { board: 1.25, large: 1.75, comfort: 1.6, normal: 1.5 };

/** Подпись страницы-задания. */
export function activityLabel(a: ActivityPage | undefined): string {
  if (!a) return "Страница";
  return a.kind === "notes" ? "Мои заметки" : a.kind === "draw" ? "Рисуем сами" : "Картинка";
}

/** Форматы печати плана: картонная книга — только board*-*, остальные — обычные. PDF — всем. */
export function formatFitsPlan(key: string, plan: PagePlan): boolean {
  if (key === "pdf") return true;
  const board = key.startsWith("board");
  if (!plan.board) return !board;
  return key.startsWith(`board${plan.board.pages}-`);
}
/** Картонные форматы обоих вариантов (выбор 9 / 12 страниц в оформлении — тоже переключает план). */
export function formatFitsGroup(key: string, plan: PagePlan): boolean {
  if (key === "pdf") return true;
  const board = key.startsWith("board");
  return plan.board ? board : !board;
}
