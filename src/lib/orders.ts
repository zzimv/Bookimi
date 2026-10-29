// Заказы: расчёт, создание, оплата, подтверждение перевода, возврат, статусы, передача в печать.
import type { Order, OrderStatus, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { cfg, canAcceptPayments } from "./settings";
import { pickDiscount, type CatalogAddon, type CatalogFormat, etaDate, ruDate } from "./pricing";
import { SbpQrProvider, TransferProvider, YooKassaProvider, idempotencyKey, type PaymentProvider, type PaymentView } from "./payments";
import { issueReceipt, cancelReceipts } from "./npd";
import { newbieDiscountPct, onOrderPaid } from "./referral";
import { notifyUser, alertOwner, orderHeroAcc } from "./notify";
import { track } from "./events";
import { shipQuote, type ShipAddress, type ShipMethod } from "./shipping";
import { hmac } from "./crypto";
import { addToAddressBook, cleanAddress, parseAddressBook } from "./delivery";

export async function catalogForPricing(): Promise<{ formats: CatalogFormat[]; addons: CatalogAddon[] }> {
  const [formats, addons, audio, flags] = await Promise.all([
    db.productFormat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    cfg("audio"),
    cfg("flags"),
  ]);
  return {
    formats: formats.filter((f) => f.kind === "PDF" || flags.printEnabled) as CatalogFormat[],
    addons: (addons as CatalogAddon[])
      .filter((a) => flags.printEnabled || !a.requiresPrint)
      .filter((a) => a.key !== "audio-self" || audio.selfReadEnabled)
      .map((a) => (a.key === "audiobook" ? { ...a, priceRub: audio.ttsPriceRub } : a.key === "audio-self" ? { ...a, priceRub: audio.selfReadPriceRub } : a)),
  };
}

export async function findPromo(code: string, userId?: string) {
  if (!code) return null;
  const p = await db.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!p || !p.isActive) return null;
  const now = new Date();
  if (p.validFrom > now || (p.validTo && p.validTo < now)) return null;
  if (p.maxUses != null && p.usedCount >= p.maxUses) return null;
  if (p.ownerId && p.ownerId !== userId) return null;
  return p;
}

/**
 * Засчитать использование промокода: +1 к usedCount, только если лимит не исчерпан (одним условным UPDATE).
 * false — лимит уже исчерпан (счётчик не меняется).
 */
export async function usePromo(promoId: string, client: Pick<PrismaClient, "promoCode"> = db) {
  const r = await client.promoCode.updateMany({
    where: { id: promoId, OR: [{ maxUses: null }, { usedCount: { lt: client.promoCode.fields.maxUses } }] },
    data: { usedCount: { increment: 1 } },
  });
  return r.count > 0;
}

/** Сколько уже заплачено за PDF этой книги (для зачёта при заказе печати). */
export async function pdfPaidFor(bookId: string, userId: string) {
  const items = await db.orderItem.findMany({
    where: { bookId, kind: "format", refKey: "pdf", order: { userId, paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] } } },
  });
  return items.reduce((s, i) => s + i.priceRub, 0);
}

export interface CheckoutInput {
  bookId: string;
  whoPrints: "self" | "bookimi";
  formatKey?: string;
  addons: string[];
  shipping?: { method: ShipMethod; address: ShipAddress };
  promo?: string;
  contact: { name: string; phone?: string; email?: string };
  utm?: Record<string, string>;
  /** Сохранить адрес и получателя в адресной книге профиля (по умолчанию — да). */
  saveAddress?: boolean;
}

export async function priceCheckout(userId: string, input: CheckoutInput) {
  const { formats, addons } = await catalogForPricing();
  const ship = await cfg("shipping");
  let shippingRub = 0;
  let shipInfo: Awaited<ReturnType<typeof shipQuote>> | null = null;
  const books = input.whoPrints === "bookimi" ? 1 + (input.addons.includes("second-copy") ? 1 : 0) : 0;
  if (input.whoPrints === "bookimi" && input.shipping) {
    shipInfo = await shipQuote(input.shipping.method, cleanAddress(input.shipping.method, input.shipping.address), books);
    shippingRub = shipInfo.priceRub;
  }
  const promo = input.promo ? await findPromo(input.promo, userId) : null;
  const newbie = await newbieDiscountPct(userId);
  // Промокод и скидка новичка не суммируются — побеждает большая в рублях (pickDiscount)
  const picked = pickDiscount(
    {
      whoPrints: input.whoPrints,
      formatKey: input.formatKey,
      addons: input.addons,
      shippingMethod: input.shipping?.method,
      shippingRub,
      pdfPaidRub: input.whoPrints === "bookimi" ? await pdfPaidFor(input.bookId, userId) : 0,
      freeShippingBooks: ship.freeShippingBooks,
    },
    promo,
    newbie,
    formats,
    addons,
  );
  const q = picked.quote;
  const printHouse = await db.printHouse.findFirst({ where: { isActive: true } });
  const urgent = input.addons.includes("urgent");
  const eta =
    input.whoPrints === "bookimi" ? etaDate(new Date(), printHouse?.leadDaysMax ?? 5, shipInfo?.daysMax ?? 0, urgent) : null;
  return {
    quote: q,
    promo: picked.promoApplied ? promo : null,
    newbieApplied: picked.newbieApplied,
    ship: shipInfo,
    eta: eta ? { ready: eta.ready, eta: eta.eta, readyText: ruDate(eta.ready), etaText: ruDate(eta.eta) } : null,
  };
}

const publicCode = () => `BK-${hmac(`${Date.now()}-${Math.random()}`).replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}`;

export async function createOrder(userId: string, input: CheckoutInput) {
  const priced = await priceCheckout(userId, input);
  if (priced.quote.errors.length) throw new Error(priced.quote.errors.join("; "));
  const book = await db.book.findFirst({ where: { id: input.bookId, userId } });
  if (!book) throw new Error("Книга не найдена");
  const q = priced.quote;
  const title = (book.text as { title?: string } | null)?.title ?? "Персональная книга";
  const ship = input.shipping ? { method: input.shipping.method, address: cleanAddress(input.shipping.method, input.shipping.address) } : null;
  const order = await db.order.create({
    data: {
      publicCode: publicCode(),
      userId,
      whoPrints: input.whoPrints,
      subtotalRub: q.subtotalRub,
      discountRub: q.discountRub,
      pdfCreditRub: q.pdfCreditRub,
      shippingRub: q.shippingRub,
      totalRub: q.totalRub,
      promoCodeId: priced.promo?.id,
      utm: input.utm,
      contactName: input.contact.name,
      contactPhone: input.contact.phone,
      contactEmail: input.contact.email,
      readyDate: priced.eta?.ready,
      items: {
        create: q.lines.map((l) => ({
          bookId: book.id,
          kind: l.kind,
          refKey: l.key,
          // Для чека: услуга изготовления на заказ, а не перепродажа товара
          title: l.kind === "format" ? `Изготовление персонализированной книги «${title}» на заказ: ${l.title}` : `Изготовление на заказ: ${l.title}`,
          priceRub: l.priceRub,
        })),
      },
      shipment:
        input.whoPrints === "bookimi" && ship
          ? {
              create: {
                method: ship.method,
                // noPrefill: покупатель снял «Сохранить адрес» — этот заказ не подставляется в следующие
                address: { ...ship.address, ...(input.saveAddress === false ? { noPrefill: true } : {}) } as object,
                cityCode: ship.address.cityCode,
                pvzCode: ship.method === "cdek_pvz" ? ship.address.pvzCode : undefined,
                pvzAddress: ship.method === "cdek_pvz" ? ship.address.pvzAddress : undefined,
                priceRub: q.shippingRub,
                etaDate: priced.eta?.eta,
              },
            }
          : undefined,
    },
  });
  if (ship && input.saveAddress !== false) await saveToAddressBook(userId, ship.method, ship.address, input.contact);
  await track("checkout", { userId, props: { orderId: order.id, total: order.totalRub, whoPrints: order.whoPrints } });
  return order;
}

/** Адресная книга покупателя: этот адрес — первым, не больше трёх. Только на сервере, в профиле (выгрузка — /api/me). */
export async function saveToAddressBook(userId: string, method: string, address: ReturnType<typeof cleanAddress>, contact: { name: string; phone?: string }) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { savedAddresses: true } });
  const list = addToAddressBook(parseAddressBook(u?.savedAddresses), {
    ...address,
    id: hmac(`${userId}-${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 12),
    savedAt: new Date().toISOString(),
    method,
    name: contact.name,
    phone: contact.phone ?? "",
  });
  await db.user.update({ where: { id: userId }, data: { savedAddresses: list as object[] } });
}

export async function availableProviders(): Promise<PaymentProvider[]> {
  const p = await cfg("payments");
  const demo = process.env.DEMO_MODE === "1";
  const list: PaymentProvider[] = [];
  if (p.sbpQr.enabled) list.push(new SbpQrProvider(demo || p.sbpQr.provider === "demo"));
  if (p.transfer.enabled && (p.transfer.phone || p.transfer.card)) list.push(new TransferProvider(p.transfer));
  if (p.yookassa.enabled) list.push(new YooKassaProvider());
  return list;
}

/** Создаёт платёж выбранным способом. Повторный вызов возвращает уже созданный (идемпотентность). */
export async function startPayment(order: Order, method: string): Promise<PaymentView> {
  if (!(await canAcceptPayments())) throw new Error("Приём оплаты пока выключен");
  if (order.status !== "PENDING_PAYMENT") throw new Error("Заказ не ожидает оплаты");
  const provider = (await availableProviders()).find((p) => p.name === method);
  if (!provider) throw new Error("Способ оплаты недоступен");
  const pay = await db.payment.create({
    data: { orderId: order.id, provider: provider.name, idempotencyKey: idempotencyKey(), amountRub: order.totalRub, status: "created" },
  });
  const res = await provider.create(order, pay);
  await db.payment.update({ where: { id: pay.id }, data: { externalId: res.externalId, raw: res.raw as object | undefined, status: "pending" } });
  const p = await cfg("payments");
  const ttl = provider.name === "transfer" ? p.transfer.cancelHours * 60 : 60;
  await db.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() + ttl * 60_000) } });
  return res.view;
}

/** Покупатель нажал «Я оплатил(а)» — заказ ждёт подтверждения оператором. */
export async function claimTransfer(orderId: string, userId: string) {
  const o = await db.order.findFirst({ where: { id: orderId, userId, status: "PENDING_PAYMENT" } });
  if (!o) return null;
  const up = await db.order.update({ where: { id: o.id }, data: { status: "AWAITING_CONFIRMATION" } });
  await notifyUser(userId, "transfer_waiting", { code: o.publicCode });
  await alertOwner("Перевод на подтверждении", `Заказ ${o.publicCode}, ${o.totalRub} ₽. Проверьте поступление и подтвердите в админке.`);
  return up;
}

/**
 * Оплата прошла (вебхук QR или подтверждение оператором). Идемпотентно: повторный вызов ничего не меняет.
 * Дальше: чек НПД, уведомление, реферал, полная генерация книги, триггеры (конверсия).
 */
export async function markPaid(paymentId: string, opts: { receiptUrl?: string; confirmedBy?: string; client?: PrismaClient } = {}) {
  const res = await db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!p) throw new Error("Платёж не найден");
    if (p.status === "succeeded") return { already: true, order: p.order };
    await tx.payment.update({ where: { id: p.id }, data: { status: "succeeded", confirmedById: opts.confirmedBy } });
    if (!["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED"].includes(p.order.status)) return { already: true, order: p.order };
    const order = await tx.order.update({ where: { id: p.orderId }, data: { status: "PAID", paidAt: new Date() } });
    // Промокод засчитывается атомарно и не сверх maxUses (два заказа с одним промокодом оплачены одновременно)
    const promoOverLimit = order.promoCodeId ? !(await usePromo(order.promoCodeId, tx)) : false;
    return { already: false, order, promoOverLimit };
  });
  if (res.already) return res.order;
  const order = res.order;
  if ("promoOverLimit" in res && res.promoOverLimit) {
    await alertOwner("Промокод сверх лимита", `Заказ ${order.publicCode} оплачен со скидкой по промокоду, у которого уже исчерпан лимит использований.`);
  }
  const receipt = await issueReceipt(order.id, { urlFromPayment: opts.receiptUrl });
  await notifyUser(order.userId, "payment_received", { code: order.publicCode, orderId: order.id, whoPrints: order.whoPrints, heroAcc: await orderHeroAcc(order.id) });
  if (receipt?.url) await notifyUser(order.userId, "receipt", { code: order.publicCode, url: receipt.url });
  await onOrderPaid(order.userId, order.id);
  await track("pay", { userId: order.userId, props: { orderId: order.id, total: order.totalRub } });
  // Конверсия триггеров: последняя рассылка этому покупателю за 7 дней
  const run = await db.triggerRun.findFirst({
    where: { subjectId: order.userId, sentAt: { gte: new Date(Date.now() - 7 * 86400_000) }, converted: false },
    orderBy: { sentAt: "desc" },
  });
  if (run) await db.triggerRun.update({ where: { id: run.id }, data: { converted: true, revenueRub: order.totalRub } });
  const items = await db.orderItem.findMany({ where: { orderId: order.id } });
  const bookIds = [...new Set(items.map((i) => i.bookId).filter(Boolean))] as string[];
  const { getBoss, QUEUES } = await import("./queue");
  const boss = await getBoss();
  for (const id of bookIds) {
    await db.book.update({ where: { id }, data: { paidFull: true } });
    await boss.send(QUEUES.generateFull, { bookId: id, orderId: order.id }, { retryLimit: 3, retryDelay: 120, singletonKey: `full-${id}` });
  }
  await checkNpdLimit();
  return order;
}

export async function confirmTransfer(orderId: string, operatorId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  let pay = await db.payment.findFirst({ where: { orderId, provider: "transfer" }, orderBy: { createdAt: "desc" } });
  if (!pay) {
    pay = await db.payment.create({
      data: { orderId, provider: "transfer", idempotencyKey: idempotencyKey(), amountRub: order.totalRub, status: "pending" },
    });
  }
  await audit(operatorId, "transfer.confirm", "order", orderId, { amount: order.totalRub });
  return markPaid(pay.id, { confirmedBy: operatorId });
}

export async function refundOrder(orderId: string, operatorId: string, reason: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  const pay = order.payments.find((p) => p.status === "succeeded");
  if (pay?.provider === "yookassa") await new YooKassaProvider().refund(pay, order.totalRub);
  // СБП-QR — возврат через сервис; перевод — обратный перевод вручную (в карточке заказа — напоминание)
  await db.order.update({ where: { id: orderId }, data: { status: "REFUNDED", refundedAt: new Date(), comment: reason } });
  if (pay) await db.payment.update({ where: { id: pay.id }, data: { status: "refunded" } });
  await cancelReceipts(orderId);
  await notifyUser(order.userId, "refund", { code: order.publicCode, amount: order.totalRub });
  await audit(operatorId, "order.refund", "order", orderId, { reason, provider: pay?.provider });
}

export const STATUS_FLOW: OrderStatus[] = ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"];

export async function setStatus(orderId: string, status: OrderStatus, operatorId?: string, track_?: string) {
  const order = await db.order.update({ where: { id: orderId }, data: { status }, include: { shipment: true } });
  if (track_ && order.shipment) await db.shipment.update({ where: { orderId }, data: { trackNumber: track_, status: "in_transit" } });
  if (operatorId) await audit(operatorId, "order.status", "order", orderId, { status, track: track_ });
  await notifyUser(order.userId, track_ ? "track" : "status", {
    code: order.publicCode,
    orderId,
    status,
    track: track_,
    service: order.shipment?.method,
    eta: order.shipment?.etaDate ? ruDate(order.shipment.etaDate) : "",
    ready: order.readyDate ? ruDate(order.readyDate) : "",
  });
  if (status === "DELIVERED") await track("delivered", { userId: order.userId, props: { orderId } });
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, details?: object) {
  await db.auditLog.create({ data: { actorId: actorId ?? undefined, action, entity, entityId, details: details as object | undefined } });
}

/** Лимит НПД: письмо владельцу при 80% и 95% (один раз на порог). */
export async function checkNpdLimit() {
  const { incomeThisYear } = await import("./npd");
  const tax = await cfg("tax");
  if (tax.regime !== "npd") return;
  const a = await cfg("alerts");
  const income = await incomeThisYear();
  const pct = (income / tax.npdYearLimitRub) * 100;
  for (const t of a.npdPct) {
    if (pct < t) continue;
    const key = `npd-alert-${new Date().getFullYear()}-${t}`;
    const sent = await db.auditLog.findFirst({ where: { action: key } });
    if (sent) continue;
    await db.auditLog.create({ data: { action: key, entity: "alert" } });
    await alertOwner(`Лимит НПД: ${Math.floor(pct)}%`, `Доход с 1 января — ${income.toLocaleString("ru-RU")} ₽ из ${tax.npdYearLimitRub.toLocaleString("ru-RU")} ₽. Пора готовить переход на ИП.`);
  }
}
