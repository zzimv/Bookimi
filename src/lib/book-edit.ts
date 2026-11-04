// Правки книги прямо в превью (rev 13): имя героя, обложка, автор, фото, посвящение. Общая логика сайта
// (/api/books/[id]/action, action: "layout") и демо-стенда. Имя меняет текст через personalize (те же метки и падежи).
import { z } from "zod";
import "./zod-ru";
import { nameError, normalizeName } from "./names";
import { checkText } from "./moderation";
import { AUTHOR_MAX, layoutOf } from "./book-layout";
import type { AnswersV2T } from "../content/answers";

export const LayoutEdit = z.object({
  action: z.literal("layout"),
  coverVariant: z.number().int().min(0).max(2).optional(),
  author: z.string().trim().max(AUTHOR_MAX).optional(),
  /** null — убрать фото (страница с иллюстрацией). */
  photoId: z.string().uuid().nullable().optional(),
  dedication: z.string().trim().max(300).optional(),
  name: z.string().trim().max(30).optional(),
  /** rev 20: картонная книга 0–3 — 9 или 12 страниц. */
  board: z.union([z.literal(9), z.literal(12)]).optional(),
});
export type LayoutEditT = z.infer<typeof LayoutEdit>;

export const NAME_AFTER_PAY = "Имя в оплаченной книге меняем через поддержку — напишите нам, всё поправим";

/**
 * rev 19: после оплаты книга не правится вовсе — ни имя, ни обложка, фото, посвящение, автор, ни текст, «Переписать»,
 * настроение и перерисовка. Книга уже передана в работу (иллюстрации, PDF, типография); исправления — через поддержку.
 * Сервер отказывает понятным текстом (409), в превью кнопок правок после оплаты нет.
 */
export const PAID_LOCKED = "Книга оплачена и передана в работу. Если нужно что-то исправить — напишите в поддержку";
/** Действия, которые меняют книгу (текст, вёрстку, иллюстрации). */
export const EDIT_ACTIONS = ["rewrite", "approve", "mood", "redraw", "layout", "text", "photo"] as const;
export type EditAction = (typeof EDIT_ACTIONS)[number];
/** Можно ли править книгу: null — можно, иначе — текст отказа. */
export function editLocked(book: { paidFull: boolean }, action: string): string | null {
  return book.paidFull && (EDIT_ACTIONS as readonly string[]).includes(action) ? PAID_LOCKED : null;
}

/**
 * Новые ответы книги после правки. Ошибка — текстом для покупателя. nameChanged — нужно заново подставить имя в текст.
 * Фото проверяет вызывающий (фото должно принадлежать книге и быть не удалённым).
 */
export function applyLayoutEdit(a: AnswersV2T, e: LayoutEditT): { ok: true; answers: AnswersV2T; nameChanged: boolean } | { ok: false; error: string } {
  const layout = { ...layoutOf(a) };
  if (e.coverVariant !== undefined) layout.coverVariant = e.coverVariant as 0 | 1 | 2;
  if (e.author !== undefined) {
    const author = e.author.replace(/\s+/g, " ").trim();
    if (author && checkText(author)) return { ok: false, error: "Уберите из строки автора ссылки или недопустимые слова" };
    layout.author = author;
  }
  if (e.board !== undefined) layout.board = e.board;
  if (e.photoId !== undefined) {
    if (e.photoId) layout.photoId = e.photoId;
    else delete layout.photoId;
  }
  let dedication = a.dedication ?? "";
  if (e.dedication !== undefined) {
    if (e.dedication && checkText(e.dedication)) return { ok: false, error: "Уберите из посвящения ссылки или недопустимые слова" };
    dedication = e.dedication;
  }
  let hero = a.hero;
  let nameChanged = false;
  if (e.name !== undefined) {
    const name = normalizeName(e.name);
    if (!name) return { ok: false, error: "Как зовут героя?" };
    const bad = nameError(name, "free");
    if (bad) return { ok: false, error: bad };
    if (name !== normalizeName(a.hero.name)) {
      nameChanged = true;
      // Ласковое имя было тем же, что имя, — меняем вместе
      const nick = a.hero.nickname && normalizeName(a.hero.nickname) !== normalizeName(a.hero.name) ? a.hero.nickname : "";
      hero = { ...a.hero, name, nickname: nick };
    }
  }
  return { ok: true, nameChanged, answers: { ...a, hero, dedication, layout } };
}
