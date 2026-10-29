// Вспомогательные функции воркера — отдельно от main(), чтобы проверять тестами без запуска pg-boss.
import { db } from "../lib/db";

/** Неоплаченные: истёк срок выбранного способа (QR — 1 ч, перевод — 24 ч) или способ не выбран 48 часов. */
export const NO_METHOD_CANCEL_HOURS = 48;

export async function cancelUnpaid(now = new Date()) {
  const a = await db.order.updateMany({ where: { status: "PENDING_PAYMENT", expiresAt: { lt: now } }, data: { status: "CANCELLED" } });
  const b = await db.order.updateMany({
    where: { status: "PENDING_PAYMENT", expiresAt: null, createdAt: { lt: new Date(now.getTime() - NO_METHOD_CANCEL_HOURS * 3600_000) } },
    data: { status: "CANCELLED" },
  });
  return a.count + b.count;
}

/** Каждая задача пачки — отдельно: ошибка или отложенная задача не прерывают остальные. */
export async function runBatch<J>(jobs: J[], fn: (j: J) => Promise<void>) {
  const errors: unknown[] = [];
  for (const j of jobs) {
    try {
      await fn(j);
    } catch (e) {
      errors.push(e);
      console.error("[worker]", (e as Error).message);
    }
  }
  return errors;
}
