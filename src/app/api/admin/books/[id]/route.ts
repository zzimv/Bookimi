import { db } from "@/lib/db";
import { err, json } from "@/lib/api";
import { adminApi } from "@/lib/admin";
import { can } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import type { StoryText } from "@/lib/gen/text";

export const dynamic = "force-dynamic";

// Книга покупателя для поддержки (владелец, оператор — PERMS.books): статус, текст, иллюстрации, список файлов.
// Исходные фото детей — только с правом photos (по умолчанию — владелец). Маркетологу — 404 (ПДн).
// Только чтение: правка, перерисовка и превью — из карточки заказа (с записью в журнал).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await adminApi("books");
  if (!u || !/^[0-9a-f-]{36}$/.test(id)) return err("Не найдено", 404);
  const book = await db.book.findUnique({ where: { id }, include: { pages: { orderBy: { index: "asc" } }, files: { select: { kind: true, createdAt: true } } } });
  if (!book) return err("Не найдено", 404);
  const photos = can(u.role, "photos") ? await db.photo.findMany({ where: { hero: { bookId: id }, deletedAt: null }, select: { id: true, storageKey: true } }) : [];
  await db.auditLog.create({ data: { actorId: u.id, action: "admin.book.view", entity: "book", entityId: id } });
  return json({
    id: book.id,
    status: book.status,
    paid: book.paidFull,
    text: book.text as StoryText | null,
    pages: await Promise.all(book.pages.map(async (p) => ({ index: p.index, text: p.text, url: p.imageKey ? await signedUrl("books", p.imageKey) : p.previewKey ? await signedUrl("books", p.previewKey) : null }))),
    files: book.files.map((f) => f.kind),
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, url: await signedUrl("photos", p.storageKey) }))),
  });
}
