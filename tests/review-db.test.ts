// Регрессия по ревью на настоящей PostgreSQL (DATABASE_URL). Без БД — пропускается.
// Промокод «−300 ₽» против скидки новичка, атомарный учёт промокода (maxUses), гонки лимитов
// смены настроения и перерисовок, суточный лимит расходов для текста.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setupSellerAndPayments } from "./helpers/db-setup";

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("ревью: БД", async () => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const { attachReferral } = await import("@/lib/referral");
  const { takePreviewMood, takeRedraw, takeFullMood, takeRewrite } = await import("@/lib/book-limits");
  const { saveSetting, cfg } = await import("@/lib/settings");
  const tag = randomUUID().slice(0, 8);

  async function user(name: string, device = `dev-${name}-${tag}`) {
    return db.user.create({ data: { email: `${name}-${tag}@test.local`, referralCode: `Q${tag}${name}`.slice(0, 12).toUpperCase(), deviceHashes: [device] } });
  }
  async function book(userId: string, data: Record<string, unknown> = {}) {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true } });
    return db.book.create({
      data: { userId, storyId: story.id, styleKey: "watercolor-air", params: { hero: { name: "Тест", gender: "boy" } }, status: "PREVIEW_READY", text: { title: "Тест", spreads: [] }, ...data },
    });
  }
  async function pay(orderId: string) {
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await orders.startPayment(o, "sbp_qr");
    await orders.markPaid((await db.payment.findFirstOrThrow({ where: { orderId } })).id);
  }

  // Свои реквизиты продавца и способы оплаты: без них приём оплаты выключен (раньше их задавал другой файл)
  beforeAll(setupSellerAndPayments);

  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  it("фиксированный промокод против скидки новичка: побеждает больший в рублях, промокод записан и засчитан", async () => {
    const inviter = await user("inv");
    const friend = await user("fr");
    expect(await attachReferral(friend.id, inviter.referralCode, `fr-dev-${tag}`)).toBe(true);
    const promo = await db.promoCode.create({ data: { code: `FIX300${tag}`.toUpperCase(), amountOffRub: 300, source: "manual", maxUses: 5 } });
    const b = await book(friend.id);
    const o = await orders.createOrder(friend.id, { bookId: b.id, whoPrints: "self", addons: [], promo: promo.code, contact: { name: "Друг" } });
    expect(o.discountRub).toBe(300); // не 99 (−10%) и не 399 (сумма)
    expect(o.promoCodeId).toBe(promo.id);
    await pay(o.id);
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(1);
  });

  it("maxUses соблюдается атомарно при одновременных оплатах", async () => {
    const promo = await db.promoCode.create({ data: { code: `ONE${tag}`.toUpperCase(), percentOff: 20, source: "manual", maxUses: 1 } });
    const res = await Promise.all(Array.from({ length: 6 }, () => orders.usePromo(promo.id)));
    expect(res.filter(Boolean)).toHaveLength(1);
    expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(1);
    const unlimited = await db.promoCode.create({ data: { code: `ANY${tag}`.toUpperCase(), percentOff: 5, source: "manual" } });
    expect((await Promise.all([orders.usePromo(unlimited.id), orders.usePromo(unlimited.id)])).every(Boolean)).toBe(true);
  });

  it("смена настроения до оплаты: параллельные запросы не превышают лимит", async () => {
    const u = await user("mood");
    const b = await book(u.id);
    // Первый проходит и переводит превью в очередь; остальные — нет (одна задача, счётчик не растёт)
    const r1 = await Promise.all(Array.from({ length: 5 }, () => takePreviewMood(b.id, "cozy", 2)));
    expect(r1.filter(Boolean)).toHaveLength(1);
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).moodChangesPreview).toBe(1);
    // Превью снова готово — ещё одна попытка из двух; третья — уже нет
    await db.book.update({ where: { id: b.id }, data: { status: "PREVIEW_READY" } });
    expect(await takePreviewMood(b.id, "warm", 2)).toBe(true);
    await db.book.update({ where: { id: b.id }, data: { status: "PREVIEW_READY" } });
    expect(await takePreviewMood(b.id, "cold", 2)).toBe(false);
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).moodChangesPreview).toBe(2);
  });

  it("перерисовки и смена настроения после оплаты: счётчик не уходит в минус", async () => {
    const u = await user("redraw");
    const b = await book(u.id, { paidFull: true, status: "FULL_READY", redrawsLeft: 3 });
    const r = await Promise.all(Array.from({ length: 8 }, () => takeRedraw(b.id)));
    expect(r.filter(Boolean)).toHaveLength(3);
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).redrawsLeft).toBe(0);
    const b2 = await book(u.id, { paidFull: true, status: "FULL_READY", redrawsLeft: 1 });
    const free = await Promise.all(Array.from({ length: 4 }, () => takeFullMood(b2.id, "cozy", true)));
    expect(free.filter(Boolean)).toHaveLength(1);
    const after = await db.book.findUniqueOrThrow({ where: { id: b2.id } });
    expect(after.moodChangesFull).toBe(1);
    expect(after.redrawsLeft).toBe(1);
    const b3 = await book(u.id, { status: "TEXT_READY", rewritesLeft: 1 });
    expect((await Promise.all([takeRewrite(b3.id), takeRewrite(b3.id), takeRewrite(b3.id)])).filter(Boolean)).toHaveLength(1);
    expect((await db.book.findUniqueOrThrow({ where: { id: b3.id } })).rewritesLeft).toBe(0);
  });

  it("текст: суточный лимит расходов действует и для YandexGPT (демо — бесплатно)", async () => {
    const { runText, LimitReached } = await import("@/lib/gen/pipeline");
    const ai = await cfg("ai");
    const limits = await cfg("limits");
    const u = await user("text");
    const b = await book(u.id, { status: "TEXT_QUEUED", params: { hero: { name: "Тест", gender: "boy", ageGroup: "4-5" }, story: { slug: "sonnaya-strana" } } });
    try {
      await saveSetting("ai", { ...ai, text: "yandexgpt" });
      await saveSetting("limits", { ...limits, dailySpendRub: 0 });
      await expect(runText(b.id)).rejects.toBeInstanceOf(LimitReached);
      expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).error).toBe("limit");
      await saveSetting("ai", { ...ai, text: "demo" });
      await runText(b.id);
      expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("TEXT_READY");
    } finally {
      await saveSetting("ai", ai);
      await saveSetting("limits", limits);
    }
  });
});
