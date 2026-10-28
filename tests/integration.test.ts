// Интеграционные тесты на настоящей PostgreSQL (DATABASE_URL). Без БД — пропускаются.
// Проверяют: удаление фото через 7 дней, лимиты превью, подтверждение оплаты (QR-вебхук и
// ручной перевод), идемпотентность, чек НПД и его аннулирование, реферальные скидки.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("интеграция с БД", async () => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  const { db } = await import("@/lib/db");
  const { purgeExpiredPhotos } = await import("@/lib/photos");
  const { hit } = await import("@/lib/limits");
  const { saveSetting } = await import("@/lib/settings");
  const orders = await import("@/lib/orders");
  const { attachReferral, newbieDiscountPct } = await import("@/lib/referral");
  const tag = randomUUID().slice(0, 8);

  async function user(email: string, device = "dev-" + email) {
    return db.user.create({ data: { email: `${email}-${tag}@test.local`, referralCode: `R${tag}${email}`.slice(0, 12).toUpperCase(), deviceHashes: [device] } });
  }
  async function book(userId: string) {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true } });
    return db.book.create({
      data: {
        userId,
        storyId: story.id,
        styleKey: "watercolor-air",
        params: { hero: { name: "Тест", gender: "boy" } },
        status: "PREVIEW_READY",
        text: { title: "Тестовая сказка", spreads: [] },
      },
    });
  }

  beforeAll(async () => {
    await saveSetting("seller", { fullName: "Тестов Тест Тестович", inn: "770012345606", status: "плательщик НПД", email: "", phone: "" });
    await saveSetting("payments", { sbpQr: { enabled: true, provider: "demo" }, transfer: { enabled: true, phone: "+79000000000", card: "", bank: "", holder: "", cancelHours: 24 }, yookassa: { enabled: false } });
  });

  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  it("фото удаляется через 7 дней", async () => {
    const u = await user("photo");
    const b = await book(u.id);
    const h = await db.hero.create({ data: { bookId: b.id, role: "main", name: "Тест", appearance: {}, interests: [] } });
    const old = await db.photo.create({ data: { heroId: h.id, storageKey: `${b.id}/old.jpg`, expiresAt: new Date(Date.now() - 1000) } });
    const fresh = await db.photo.create({ data: { heroId: h.id, storageKey: `${b.id}/new.jpg`, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    await purgeExpiredPhotos();
    expect((await db.photo.findUnique({ where: { id: old.id } }))!.deletedAt).not.toBeNull();
    expect((await db.photo.findUnique({ where: { id: fresh.id } }))!.deletedAt).toBeNull();
  });

  it("лимит превью: 1 в сутки на контакт", async () => {
    const subj = `limit-${tag}@test.local`;
    expect(await hit(subj, "preview", 1)).toBe(true);
    expect(await hit(subj, "preview", 1)).toBe(false);
  });

  it("оплата по QR: вебхук идемпотентен, чек выдаётся один раз", async () => {
    const u = await user("qr");
    const b = await book(u.id);
    const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Тест" } });
    expect(o.totalRub).toBe(990);
    await orders.startPayment(o, "sbp_qr");
    const pay = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    await orders.markPaid(pay.id);
    await orders.markPaid(pay.id); // повторное уведомление
    const after = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { receipts: true } });
    expect(after.status).toBe("PAID");
    expect(after.receipts.filter((r) => r.status === "issued")).toHaveLength(1);
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).paidFull).toBe(true);
  });

  it("перевод: «Я оплатил(а)» → подтверждение оператором", async () => {
    const u = await user("transfer");
    const op = await user("operator");
    const b = await book(u.id);
    const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Тест" } });
    await orders.startPayment(o, "transfer");
    await orders.claimTransfer(o.id, u.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("AWAITING_CONFIRMATION");
    await orders.confirmTransfer(o.id, op.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
    expect(await db.auditLog.count({ where: { action: "transfer.confirm", entityId: o.id } })).toBe(1);
  });

  it("возврат аннулирует чек", async () => {
    const u = await user("refund");
    const b = await book(u.id);
    const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Тест" } });
    await orders.startPayment(o, "sbp_qr");
    await orders.markPaid((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).id);
    await orders.refundOrder(o.id, u.id, "тест");
    const r = await db.receipt.findFirstOrThrow({ where: { orderId: o.id } });
    expect(r.status).toBe("cancelled");
  });

  it("приведи друга: −10% новичку один раз, себя пригласить нельзя", async () => {
    const inviter = await user("inviter", "same-device");
    const friend = await user("friend");
    const self = await user("selfinvite", "same-device");
    expect(await attachReferral(self.id, inviter.referralCode, "same-device")).toBe(false);
    expect(await attachReferral(friend.id, inviter.referralCode, "friend-device")).toBe(true);
    expect(await newbieDiscountPct(friend.id)).toBe(10);
    const b = await book(friend.id);
    const o = await orders.createOrder(friend.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Друг" } });
    expect(o.discountRub).toBe(99);
    await orders.startPayment(o, "sbp_qr");
    await orders.markPaid((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).id);
    expect(await newbieDiscountPct(friend.id)).toBe(0);
    const ref = await db.referral.findUniqueOrThrow({ where: { inviteeId: friend.id } });
    expect(ref.bonusIssueAt!.getTime()).toBeGreaterThan(Date.now() + 13 * 86400_000);
  });
});
