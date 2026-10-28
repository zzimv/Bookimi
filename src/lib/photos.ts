import { db } from "./db";
import { deleteFile } from "./storage";

/** Удаление фото старше срока хранения (7 дней). Дублирует lifecycle бакета photos. */
export async function purgeExpiredPhotos(now = new Date()) {
  const expired = await db.photo.findMany({ where: { expiresAt: { lt: now }, deletedAt: null }, take: 500 });
  for (const p of expired) {
    await deleteFile("photos", p.storageKey).catch(() => {});
    await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  }
  return expired.length;
}
