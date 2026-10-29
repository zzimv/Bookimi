// Согласия спрашиваем один раз — в первой точке сбора данных (фото или вход), дальше только показываем «дано ✓».
// Действует последняя запись по типу (отзыв согласия — запись с granted: false).
import { db } from "./db";

type ConsentKind = "PERSONAL_DATA" | "CHILD_PHOTO" | "MARKETING";

export async function hasConsent(type: ConsentKind, who: { userId?: string | null; anonId?: string | null }) {
  const or = [...(who.userId ? [{ userId: who.userId }] : []), ...(who.anonId && who.anonId !== "no-anon" ? [{ anonId: who.anonId }] : [])];
  if (!or.length) return false;
  const last = await db.consent.findFirst({ where: { type, OR: or }, orderBy: { createdAt: "desc" }, select: { granted: true } });
  return Boolean(last?.granted);
}

export async function consentState(who: { userId?: string | null; anonId?: string | null }) {
  const [pd, photo] = await Promise.all([hasConsent("PERSONAL_DATA", who), hasConsent("CHILD_PHOTO", who)]);
  return { pd, photo };
}

/** Согласия, данные до входа (по анонимной cookie), закрепляются за аккаунтом. */
export async function attachAnonConsents(userId: string, anonId: string) {
  if (!anonId || anonId === "no-anon") return;
  await db.consent.updateMany({ where: { anonId, userId: null }, data: { userId } });
}
