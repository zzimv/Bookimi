// Бонусы за отзыв (rev 10, решение владелицы): 1 бонус = 1 ₽. Чистые функции — общие для сервера и демо-стенда.
//  • начисление: отзыв на заказ после статуса «получен» (DELIVERED), один раз на заказ, reviewRub бонусов (300);
//    начисляем сразу, без ожидания модерации; если отзыв отклонён как спам — те же бонусы списываются (revoke);
//  • срок: каждое начисление сгорает через expiryDays (180) дней; тратятся сначала те, что сгорят раньше;
//  • списание при оформлении: не больше maxSharePct (30 %) суммы заказа и не больше остатка.
// Журнал — записи BonusEntry (+начисление, −списание); остаток считается по журналу, отдельного поля нет.

export interface BonusSettings {
  enabled: boolean;
  reviewRub: number;
  maxSharePct: number;
  expiryDays: number;
}

export const BONUS_DEFAULTS: BonusSettings = { enabled: true, reviewRub: 300, maxSharePct: 30, expiryDays: 180 };

export type BonusKind = "review" | "spend" | "revoke" | "return";

export interface BonusEntryLike {
  kind: BonusKind | string;
  /** +начисление / −списание, ₽. */
  amountRub: number;
  createdAt: Date | number | string;
  /** Для начислений: когда сгорает. */
  expiresAt?: Date | number | string | null;
  orderId?: string | null;
}

const ms = (d: Date | number | string | null | undefined) => (d == null ? Infinity : typeof d === "number" ? d : new Date(d).getTime());

/**
 * Остаток на момент now: начисления — «партии» со сроком, списания гасят партии, которые сгорят раньше всех.
 * Возвращает остаток и ближайшее сгорание (для подсказки «200 бонусов сгорят 12 апреля»).
 */
export function bonusBalance(entries: BonusEntryLike[], now: Date | number = Date.now()): { balance: number; nextExpiry: { rub: number; at: number } | null } {
  const t = ms(now);
  const lots: { rub: number; exp: number }[] = [];
  const sorted = [...entries].sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  for (const e of sorted) {
    const at = ms(e.createdAt);
    if (at > t) continue;
    if (e.amountRub > 0) {
      lots.push({ rub: e.amountRub, exp: ms(e.expiresAt) });
      continue;
    }
    let left = -e.amountRub;
    // Гасим действующие на момент списания партии: сначала те, что сгорят раньше
    for (const lot of lots.filter((l) => l.rub > 0 && l.exp > at).sort((x, y) => x.exp - y.exp)) {
      const take = Math.min(lot.rub, left);
      lot.rub -= take;
      left -= take;
      if (!left) break;
    }
  }
  const alive = lots.filter((l) => l.rub > 0 && l.exp > t);
  const balance = alive.reduce((s, l) => s + l.rub, 0);
  const soon = alive.filter((l) => Number.isFinite(l.exp)).sort((x, y) => x.exp - y.exp)[0];
  return { balance, nextExpiry: soon ? { rub: alive.filter((l) => l.exp === soon.exp).reduce((s, l) => s + l.rub, 0), at: soon.exp } : null };
}

/** Сколько бонусов можно списать в заказ на totalRub (сумма до бонусов): ≤ остатка и ≤ maxSharePct % заказа. */
export function maxBonusSpend(totalRub: number, balance: number, s: Pick<BonusSettings, "enabled" | "maxSharePct">): number {
  if (!s.enabled || totalRub <= 0 || balance <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(balance), Math.floor((totalRub * s.maxSharePct) / 100)));
}

/** Применить бонусы к сумме: просили want (или «сколько можно» при want = true). */
export function applyBonus(totalRub: number, balance: number, s: Pick<BonusSettings, "enabled" | "maxSharePct">, want: number | boolean | undefined): { bonusRub: number; totalRub: number } {
  const cap = maxBonusSpend(totalRub, balance, s);
  const ask = want === true ? cap : typeof want === "number" && want > 0 ? Math.floor(want) : 0;
  const bonusRub = Math.min(cap, ask);
  return { bonusRub, totalRub: totalRub - bonusRub };
}

/** Можно ли начислить бонусы за отзыв на этот заказ. */
export function reviewBonusAllowed(
  order: { status: string; paidAt?: Date | number | string | null },
  entries: BonusEntryLike[],
  orderId: string,
  s: Pick<BonusSettings, "enabled" | "reviewRub">,
): { ok: true; rub: number } | { ok: false; reason: string } {
  if (!s.enabled || s.reviewRub <= 0) return { ok: false, reason: "Бонусы за отзыв сейчас не начисляются" };
  if (order.status !== "DELIVERED") return { ok: false, reason: "Бонусы за отзыв — после получения книги" };
  if (entries.some((e) => e.kind === "review" && e.orderId === orderId)) return { ok: false, reason: "Бонусы за отзыв на этот заказ уже начислены" };
  return { ok: true, rub: s.reviewRub };
}

/** Запись начисления за отзыв (createdAt = now, срок — expiryDays). */
export function reviewCredit(orderId: string, s: Pick<BonusSettings, "reviewRub" | "expiryDays">, now = Date.now()) {
  return { kind: "review" as const, amountRub: s.reviewRub, orderId, createdAt: now, expiresAt: now + s.expiryDays * 86400_000 };
}

/** «300 бонусов», «1 бонус», «2 бонуса». */
export function bonusWord(n: number) {
  const a = Math.abs(n) % 10;
  const b = Math.abs(n) % 100;
  return `${n.toLocaleString("ru-RU")} ${a === 1 && b !== 11 ? "бонус" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "бонуса" : "бонусов"}`;
}
