import "server-only";
// Бонусы на сервере (rev 10): журнал BonusEntry, начисление за отзыв, списание обратно при отклонённом отзыве.
// Правила — чистые функции src/lib/bonuses.ts. Таблицы новые (миграция 0010): до `prisma generate` в сборке
// типы клиента их не знают — узкий типизированный доступ ниже.
import { db } from "./db";
import { cfg } from "./settings";
import { bonusBalance, reviewBonusAllowed, reviewCredit, type BonusEntryLike } from "./bonuses";

type Row = BonusEntryLike & { id?: string; userId: string; reviewId?: string | null };
interface BonusTable {
  findMany(a: { where: Record<string, unknown>; orderBy?: Record<string, string> }): Promise<Row[]>;
  create(a: { data: Record<string, unknown> }): Promise<Row>;
}
const table = () => (db as unknown as { bonusEntry: BonusTable }).bonusEntry;

export async function bonusEntries(userId: string) {
  return table().findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

export async function bonusFor(userId: string) {
  const [list, s] = await Promise.all([bonusEntries(userId), cfg("bonus")]);
  return { ...bonusBalance(list), settings: s };
}

/** Отзыв о заказе сохранён: начислить reviewRub бонусов, если заказ получен и за него ещё не начисляли. */
export async function creditReviewBonus(userId: string, order: { id: string; status: string }, reviewId: string): Promise<number> {
  const s = await cfg("bonus");
  const list = await bonusEntries(userId);
  const can = reviewBonusAllowed(order, list, order.id, s);
  if (!can.ok) return 0;
  const e = reviewCredit(order.id, s);
  // @@unique([kind, orderId]) — второй раз за тот же заказ не начислится даже при гонке запросов
  await table()
    .create({ data: { userId, kind: e.kind, amountRub: e.amountRub, orderId: order.id, reviewId, createdAt: new Date(e.createdAt), expiresAt: new Date(e.expiresAt) } })
    .catch(() => null);
  return can.rub;
}

/** Отзыв отклонён как спам: бонусы за него списываются (один раз). */
export async function revokeReviewBonus(review: { userId: string | null; orderId: string | null }) {
  if (!review.userId || !review.orderId) return;
  const list = await bonusEntries(review.userId);
  const credit = list.find((e) => e.kind === "review" && e.orderId === review.orderId);
  if (!credit || list.some((e) => e.kind === "revoke" && e.orderId === review.orderId)) return;
  await table().create({ data: { userId: review.userId, kind: "revoke", amountRub: -credit.amountRub, orderId: review.orderId } }).catch(() => null);
}
