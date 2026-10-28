import { db } from "@/lib/db";
import { readToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Отписка", robots: { index: false } };

// Отписка в один клик из любого сообщения.
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const payload = t ? readToken(t) : null;
  let ok = false;
  if (payload?.startsWith("unsub:")) {
    const userId = payload.slice(6);
    const u = await db.user.findUnique({ where: { id: userId } });
    if (u) {
      await db.user.update({ where: { id: userId }, data: { marketingOk: false } });
      await db.notificationPref.updateMany({ where: { userId }, data: { marketing: false } });
      await db.consent.create({ data: { userId, type: "MARKETING", docVersion: "unsubscribe", granted: false } });
      const lastRun = await db.auditLog.findFirst({ where: { action: "trigger.sent", entityId: userId }, orderBy: { createdAt: "desc" } });
      const ruleName = (lastRun?.details as { rule?: string } | null)?.rule;
      const rule = ruleName ? await db.triggerRule.findFirst({ where: { name: ruleName } }) : null;
      await db.auditLog.create({ data: { action: "unsubscribe", entity: "user", entityId: userId, details: { ruleId: rule?.id ?? null } } });
      ok = true;
    }
  }
  return (
    <div className="flow" style={{ maxWidth: 520 }}>
      <h1>{ok ? "Вы отписались" : "Ссылка устарела"}</h1>
      <p>{ok ? "Больше не будем присылать новости и скидки. Сообщения о ваших заказах продолжат приходить." : "Отписаться можно в личном кабинете, в разделе «Уведомления»."}</p>
    </div>
  );
}
