// «Приведи друга»: новичок по ссылке получает −10% на первый заказ (один раз на человека);
// приглашающий — промокод −10% за каждого оплатившего друга, через 14 дней после оплаты.
// Нельзя пригласить себя: совпадение телефона, email или устройства.
import { db } from "./db";
import { cfg } from "./settings";
import { hmac } from "./crypto";

export async function attachReferral(userId: string, code: string, device?: string) {
  const inviter = await db.user.findUnique({ where: { referralCode: code.toUpperCase() } });
  const invitee = await db.user.findUnique({ where: { id: userId } });
  if (!inviter || !invitee || inviter.id === invitee.id) return false;
  const sameDevice = device && inviter.deviceHashes.includes(device);
  const sameContact =
    (inviter.email && inviter.email === invitee.email) || (inviter.phone && inviter.phone === invitee.phone);
  if (sameDevice || sameContact) return false;
  const exists = await db.referral.findUnique({ where: { inviteeId: userId } });
  if (exists) return false;
  await db.referral.create({ data: { inviterId: inviter.id, inviteeId: userId } });
  await db.user.update({ where: { id: userId }, data: { referredById: inviter.id } });
  return true;
}

/** Скидка новичка: есть приглашение и ещё нет оплаченных заказов. */
export async function newbieDiscountPct(userId: string) {
  const ref = await db.referral.findUnique({ where: { inviteeId: userId } });
  if (!ref || ref.paidAt) return 0;
  const paid = await db.order.count({ where: { userId, paidAt: { not: null } } });
  if (paid > 0) return 0;
  return (await cfg("referral")).newbiePct;
}

export async function onOrderPaid(userId: string, orderId: string) {
  const ref = await db.referral.findUnique({ where: { inviteeId: userId } });
  if (!ref || ref.paidAt) return;
  const days = (await cfg("referral")).delayDays;
  await db.referral.update({
    where: { id: ref.id },
    data: { orderId, paidAt: new Date(), bonusIssueAt: new Date(Date.now() + days * 86400_000) },
  });
}

/** Задача воркера: выдать бонусы, у которых прошли 14 дней и заказ не возвращён. */
export async function issueDueBonuses() {
  const due = await db.referral.findMany({ where: { bonusIssueAt: { lte: new Date() }, bonusPromoId: null } });
  const pct = (await cfg("referral")).bonusPct;
  const { notifyUser } = await import("./notify");
  for (const r of due) {
    const order = r.orderId ? await db.order.findUnique({ where: { id: r.orderId } }) : null;
    if (!order || order.status === "REFUNDED" || order.status === "CANCELLED") {
      await db.referral.update({ where: { id: r.id }, data: { bonusIssueAt: null } });
      continue;
    }
    const code = `DRUG-${hmac(r.id).replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}`;
    const promo = await db.promoCode.create({
      data: { code, percentOff: pct, ownerId: r.inviterId, source: "referral_bonus", maxUses: 1 },
    });
    await db.referral.update({ where: { id: r.id }, data: { bonusPromoId: promo.id } });
    await notifyUser(r.inviterId, "referral_bonus", { pct, code });
  }
}
