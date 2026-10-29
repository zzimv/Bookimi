import { db } from "./db";
import { deleteFile } from "./storage";
import { cfg } from "./settings";

/**
 * Удаление фото (дублирует lifecycle бакета photos), каждые 30 минут:
 *  • срок вышел (expiresAt): с книгой — 7 дней (limits.photoTtlDays), без книги — 24 часа (limits.photoTtlNoBookHours);
 *  • фото черновика анкеты (герой без книги) старше photoTtlNoBookHours — даже если срок записан длиннее
 *    (настройку уменьшили после загрузки).
 * Удаляются и портрет, и исходник.
 */
export async function purgeExpiredPhotos(now = new Date()) {
  const limits = await cfg("limits");
  const noBookBefore = new Date(now.getTime() - (limits.photoTtlNoBookHours ?? 24) * 3600_000);
  const expired = await db.photo.findMany({
    where: { deletedAt: null, OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: noBookBefore }, hero: { bookId: null } }] },
    take: 500,
  });
  for (const p of expired) {
    await deleteFile("photos", p.storageKey).catch(() => {});
    if (p.originalKey) await deleteFile("photos", p.originalKey).catch(() => {});
    await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  }
  return expired.length;
}

/** Срок хранения фото: без книги — часы, с книгой — дни (от загрузки). */
export function photoExpiry(createdAt: Date, withBook: boolean, limits: { photoTtlDays: number; photoTtlNoBookHours?: number }) {
  return new Date(createdAt.getTime() + (withBook ? limits.photoTtlDays * 86400_000 : (limits.photoTtlNoBookHours ?? 24) * 3600_000));
}
