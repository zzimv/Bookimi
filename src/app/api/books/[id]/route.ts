import { z } from "zod";
import { db } from "@/lib/db";
import { body, err, json, ownBook } from "@/lib/api";
import { signedUrl } from "@/lib/storage";
import { checkText } from "@/lib/moderation";
import type { StoryText } from "@/lib/gen/text";
import { anonId } from "@/lib/auth";
import { consentState } from "@/lib/consent";

export const dynamic = "force-dynamic";

// Состояние книги для страницы создания: статус, прогресс, текст, превью (только с водяным знаком до оплаты).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  const { book } = own;
  const pages = await db.bookPage.findMany({ where: { bookId: id }, orderBy: { index: "asc" } });
  const photos = await db.photo.findMany({
    where: { hero: { bookId: id }, deletedAt: null },
    select: { id: true, heroId: true, storageKey: true, moderation: true },
  });
  const full = book.paidFull && book.status === "FULL_READY";
  const consent = await consentState({ userId: own.user?.id, anonId: await anonId() });
  return json({
    id: book.id,
    status: book.status,
    progress: book.progress,
    error: book.error,
    text: book.text as StoryText | null,
    rewritesLeft: book.rewritesLeft,
    redrawsLeft: book.redrawsLeft,
    mood: book.mood ?? "",
    moodChanges: { preview: book.moodChangesPreview, full: book.moodChangesFull },
    withPhoto: book.withPhoto,
    paid: book.paidFull,
    loggedIn: Boolean(own.user),
    consent,
    pages: await Promise.all(
      pages.map(async (p) => ({
        index: p.index,
        text: p.text,
        url: full ? (p.imageKey ? await signedUrl("books", p.imageKey) : null) : p.previewKey ? await signedUrl("books", p.previewKey) : null,
      })),
    ),
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, url: await signedUrl("photos", p.storageKey) }))),
  });
}

const Edit = z.object({ spreads: z.array(z.object({ index: z.number().int().min(1).max(12), text: z.string().trim().min(1).max(600) })).max(12) });

// Ручная правка текста — бесплатно, без ограничений (до печати).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  const b = await body(req, Edit);
  if (!b) return err("Некорректный текст");
  if (checkText(b.spreads.map((s) => s.text).join("\n"))) return err("Уберите недопустимые слова или ссылки");
  const text = own.book.text as unknown as StoryText;
  if (!text) return err("Текст ещё не готов");
  for (const s of b.spreads) {
    const sp = text.spreads.find((x) => x.index === s.index);
    if (sp) sp.text = s.text;
    await db.bookPage.updateMany({ where: { bookId: id, index: s.index }, data: { text: s.text } });
  }
  await db.book.update({ where: { id }, data: { text: text as object } });
  if (own.book.paidFull) {
    const { enqueue, QUEUES } = await import("@/lib/queue");
    // Перевёрстка PDF после правки (без перерисовки картинок)
    await enqueue(QUEUES.redraw, { bookId: id, index: -1 });
  }
  return json({ ok: true });
}
