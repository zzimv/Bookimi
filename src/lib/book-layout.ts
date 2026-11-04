// Вёрстка книги, общая для экрана (src/components/book/BookPreview.tsx) и PDF (src/lib/pdf.ts), rev 13.
// Книга листается как настоящая: обложка (3 варианта оформления) → «Приветствие» (имя, автор) →
// «Фото и посвящение» → сказка по плану страниц группы (rev 20, src/lib/page-plan.ts), текст прямо на картинке → финал.
// Настройки вёрстки хранятся в ответах анкеты книги: params.layout (src/content/answers.ts) — без миграции БД.
// Без React и Node API: работает на сервере, в браузере и в демо-стенде.
import { normalizeName } from "./declension";
import { activityLabel, boardVariant, PAGE_PLANS, pairPages, planPages, type BookPageRef, type PagePlan } from "./page-plan";

export const AUTHOR_MAX = 60;

export interface BookLayout {
  /** Оформление обложки: 0 — классика, 1 — звёздная ночь, 2 — светлая рамка. */
  coverVariant: 0 | 1 | 2;
  /** «Автор: мама и папа» на первой странице; пусто — строки нет. */
  author: string;
  /** Фото на странице «Фото и посвящение» (id фото книги); нет — иллюстрация. */
  photoId?: string;
  /** rev 20: картонная книга 0–3 — 9 или 12 страниц (выбирает покупатель; влияет на план страниц и формат печати). */
  board?: 9 | 12;
}

export const DEFAULT_LAYOUT: BookLayout = { coverVariant: 0, author: "" };

/** Варианты обложки: название, цвета страницы и надписи (экран — классы bk-cover--v*, PDF — те же цвета). */
export const COVER_VARIANTS = [
  { id: 0, title: "Классика", hint: "Иллюстрация на всю обложку", bg: "#fbf8f1", ink: "#143628", band: "rgba(252,251,247,.88)" },
  { id: 1, title: "Звёздная ночь", hint: "Тёмно-синяя обложка со звёздами", bg: "#1d2550", ink: "#f3d27a", band: "transparent" },
  { id: 2, title: "Светлая рамка", hint: "Светлая рамка и мягкая виньетка", bg: "#fbf6ea", ink: "#143628", band: "transparent" },
] as const;

export function layoutOf(params: unknown): BookLayout {
  const l = (params as { layout?: Partial<BookLayout> } | null)?.layout ?? {};
  const v = Number(l.coverVariant);
  return {
    coverVariant: v === 1 || v === 2 ? v : 0,
    author: typeof l.author === "string" ? l.author.trim().slice(0, AUTHOR_MAX) : "",
    ...(typeof l.photoId === "string" && l.photoId ? { photoId: l.photoId } : {}),
    ...(l.board !== undefined && l.board !== null ? { board: boardVariant(l.board) } : {}),
  };
}

/** Первая страница: обращение к герою. */
export function welcomeText(name: string) {
  return `${normalizeName(name) || "Дорогой читатель"}, добро пожаловать в твою единственную такую книгу!`;
}

/** Финальная страница: тёплая строка с именем. */
export function finalText(name: string, gender?: string) {
  const n = normalizeName(name);
  const girl = gender === "girl";
  return `${n}, эта книга — только твоя. Второй такой нет ни у кого на свете: в ней ты — ${girl ? "главная героиня" : "главный герой"}. Возвращайся сюда, когда захочется чуда.`;
}

/**
 * «Сказочная» вёрстка страниц-обращений (rev 19): строки из кусков разного начертания — общие для экрана и PDF.
 * name — имя крупно декоративным шрифтом (Yeseva One), lead — курсив книжного шрифта (Lora), key — ключевое слово
 * цветом акцента и декоративным шрифтом, text — обычный книжный текст; строка [{k:"div"}] — звёздочка-разделитель.
 * Склеенный текст кусков = welcomeText / finalText (экранный диктор читает ту же фразу).
 */
export type FairySeg = { k: "name" | "lead" | "key" | "text" | "div"; t: string };
export type FairyLine = FairySeg[];

export function welcomeLines(name: string): FairyLine[] {
  const n = normalizeName(name) || "Дорогой читатель";
  return [[{ k: "name", t: `${n},` }], [{ k: "lead", t: "добро пожаловать в твою" }], [{ k: "key", t: "единственную" }], [{ k: "lead", t: "такую книгу!" }]];
}

export function finalLines(name: string, gender?: string): FairyLine[] {
  const n = normalizeName(name);
  const girl = gender === "girl";
  return [
    [{ k: "name", t: `${n},` }],
    [{ k: "lead", t: "эта книга — только твоя." }],
    [{ k: "div", t: "" }],
    [{ k: "text", t: "Второй такой нет ни у кого на свете:" }],
    [{ k: "text", t: "в ней ты — " }, { k: "key", t: `${girl ? "главная героиня" : "главный герой"}.` }],
    [{ k: "text", t: "Возвращайся сюда, когда захочется " }, { k: "key", t: "чуда." }],
  ];
}

export function backLines(name: string): FairyLine[] {
  return [[{ k: "name", t: `${normalizeName(name)},` }], [{ k: "lead", t: "эта книга — только твоя." }]];
}

/** Текст строк одной фразой (для проверки и экранного диктора). */
export const fairyText = (lines: FairyLine[]) =>
  lines.filter((l) => l[0]?.k !== "div").map((l) => l.map((x) => x.t).join("")).join(" ");

/** Цвета «сказочных» страниц по оформлению обложки: чернила (глубокий синий / бордо) и акцент. */
export function fairyPalette(variant: number) {
  if (variant === 1) return { ink: "#1d2a5c", accent: "#9a2f45", orn: "#b8892c" };
  if (variant === 2) return { ink: "#5e1f2e", accent: "#1f3f78", orn: "#b8892c" };
  return { ink: "#1f3566", accent: "#8f2a3e", orn: "#c39a4a" };
}

/** Строка автора: «Автор: мама и папа» (пусто — без строки). */
export function authorLine(author: string | undefined | null) {
  const a = (author ?? "").replace(/\s+/g, " ").trim().slice(0, AUTHOR_MAX);
  return a ? `Автор: ${a}` : "";
}

/** Конец предложения: . ! ? … (с кавычкой или скобкой) перед пробелом и началом нового предложения или реплики. */
const SENTENCE_END = /[.!?…][»"”)]?\s+(?=[—–-]?\s*[«"„(]?[А-ЯЁA-Z0-9])/gu;

/** Предложения прозы; внутри «кавычек» не режем (записка, реплика из двух предложений). */
function sentences(raw: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of raw.matchAll(SENTENCE_END)) {
    const end = (m.index ?? 0) + m[0].trimEnd().length;
    const head = raw.slice(0, end);
    if ((head.match(/«/g)?.length ?? 0) > (head.match(/»/g)?.length ?? 0)) continue;
    out.push(raw.slice(start, end).trim());
    start = (m.index ?? 0) + m[0].length;
  }
  out.push(raw.slice(start).trim());
  return out.filter(Boolean);
}

/** Делит части на две стороны: длины как можно ближе; у стихов — чётное число строк слева (рифма парой). */
function balance(parts: string[], sep: string, pairs = false): [string, string] {
  const len = parts.map((p) => p.length);
  const total = len.reduce((a, b) => a + b, 0);
  let best = 1;
  let bestScore = Infinity;
  let acc = 0;
  for (let k = 1; k < parts.length; k++) {
    acc += len[k - 1];
    const score = Math.abs(total - 2 * acc) + (pairs && k % 2 === 1 && parts.length % 2 === 0 ? total * 0.35 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return [parts.slice(0, best).join(sep), parts.slice(best).join(sep)];
}

/**
 * Текст разворота → [левая страница, правая страница]. Разметка (строки, [подписи], ЗВУКИ!) сохраняется.
 * Стихи — по строфам (пустая строка), иначе по строкам; проза — по предложениям, поровну по длине.
 */
export function splitSpread(text: string | null | undefined): [string, string] {
  const raw = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return ["", ""];
  const stanzas = raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (stanzas.length >= 2) return balance(stanzas, "\n\n");
  const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) return balance(lines, "\n", lines.length >= 4);
  const sent = sentences(raw);
  if (sent.length >= 2) return balance(sent, " ");
  return [raw, ""];
}

/**
 * Страницы книги по порядку — по плану страниц (rev 20, src/lib/page-plan.ts). Без плана — прежний «classic»:
 * обложка, форзац, приветствие, фото, посвящение, развороты (по две страницы), финал, задняя обложка.
 */
export type { BookPageKind, BookPageRef } from "./page-plan";

export function bookPages(spreads: number, plan: PagePlan = PAGE_PLANS.classic): BookPageRef[] {
  return planPages(plan, spreads);
}

/** Развороты для показа «Разворотом»: обложка одна, дальше парами (форзац + приветствие, фото + посвящение, …). */
export function bookSpreads(spreads: number | BookPageRef[], plan?: PagePlan): BookPageRef[][] {
  return pairPages(typeof spreads === "number" ? bookPages(spreads, plan) : spreads);
}

/** Показ «Одна страница»: без пустого форзаца. */
export function singlePages(spreads: number | BookPageRef[], plan?: PagePlan): BookPageRef[] {
  return (typeof spreads === "number" ? bookPages(spreads, plan) : spreads).filter((p) => p.kind !== "endpaper");
}

export function pageLabel(p: BookPageRef): string {
  switch (p.kind) {
    case "cover":
      return "Обложка";
    case "endpaper":
      return "Форзац";
    case "welcome":
      return "Приветствие";
    case "photo":
      return "Фото";
    case "dedication":
      return "Посвящение";
    case "story":
      return p.side === "page" ? `Страница сказки ${p.spread}` : `Разворот ${p.spread}, ${p.side === "left" ? "левая" : "правая"} страница`;
    case "activity":
      return activityLabel(p.activity);
    case "final":
      return "Последняя страница";
    case "back":
      return "Задняя обложка";
  }
}
