import { db } from "./db";
import { readToken } from "./crypto";

/** Кому принадлежит ссылка отписки (подписанный токен «unsub:<userId>»). */
export function unsubscribeUser(t: string | null | undefined) {
  const payload = t ? readToken(t) : null;
  return payload?.startsWith("unsub:") ? payload.slice(6) : null;
}

/**
 * Отписка от рассылки. Повторное нажатие ничего не дублирует: запись об отзыве согласия и событие «unsubscribe»
 * (для автоостановки триггеров) — только если согласие ещё действовало.
 */
export async function unsubscribe(t: string): Promise<"ok" | "already" | "bad"> {
  const userId = unsubscribeUser(t);
  if (!userId) return "bad";
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.deletedAt) return "bad";
  const activePrefs = await db.notificationPref.count({ where: { userId, marketing: true } });
  if (!u.marketingOk && !activePrefs) return "already";
  await db.user.update({ where: { id: userId }, data: { marketingOk: false } });
  await db.notificationPref.updateMany({ where: { userId }, data: { marketing: false } });
  await db.consent.create({ data: { userId, type: "MARKETING", docVersion: "unsubscribe", granted: false } });
  const lastRun = await db.auditLog.findFirst({ where: { action: "trigger.sent", entityId: userId }, orderBy: { createdAt: "desc" } });
  const ruleName = (lastRun?.details as { rule?: string } | null)?.rule;
  const rule = ruleName ? await db.triggerRule.findFirst({ where: { name: ruleName } }) : null;
  await db.auditLog.create({ data: { action: "unsubscribe", entity: "user", entityId: userId, details: { ruleId: rule?.id ?? null } } });
  return "ok";
}
