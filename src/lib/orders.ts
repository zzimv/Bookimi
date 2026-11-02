// Заказы: расчёт, создание, оплата, подтверждение перевода, возврат, статусы, передача в печать.
import type { Order, OrderStatus, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { cfg, canAcceptPayments } from "./settings";
import { pickDiscount, type CatalogAddon, type CatalogFormat, etaDate, ruDate } from "./pricing";
import { SbpQrProvider, TransferProvider, YooKassaProvider, idempotencyKey, type PaymentProvider, type PaymentView } from "./payments";
import { issueReceipt, cancelReceipts } from "./npd";
import { newbieDiscountPct, onOrderPaid } from "./referral";
import { notifySafe, alertOwner, orderHeroAcc } from "./notify";
import { track } from "./events";
import { shipQuote, shippingMethodError, verifyPvz, type ShipAddress, type ShipMethod } from "./shipping";
import { hmac } from "./crypto";
import { addToAddressBook, cleanAddress, parseAddressBook } from "./delivery";
import { addonFits, audienceOfParams } from "./addons-core";
import type { AudienceKey } from "../content/profiles";

/** Аудитория книги (из анкеты): от неё зависит набор допов. Нет книги или анкеты — детская. */
export async function bookAudience(bookId: string): Promise<AudienceKey> {
  const b = await db.book.findUnique({ where: { id: bookId }, select: { params: true } }).catch(() => null);
  return audienceOfParams(b?.params);
}

/** Каталог для расчёта: включённые форматы и допы; с аудиторией — только допы для книг этой аудитории. */
export async function catalogForPricing(audience?: string): Promise<{ formats: CatalogFormat[]; addons: CatalogAddon[] }> {
  const [formats, addons, audio, flags, cartoon] = await Promise.all([
    db.productFormat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    cfg("audio"),
    cfg("flags"),
    cfg("cartoon"),
  ]);
  return {
    formats: formats.filter((f) => f.kind === "PDF" || flags.printEnabled) as CatalogFormat[],
    addons: (addons as CatalogAddon[])
      .filter((a) => addonFits(a, audience))
      .filter((a) => flags.printEnabled || !a.requiresPrint)
      .filter((a) => a.key !== "audio-self" || audio.selfReadEnabled)
      .filter((a) => !a.key.startsWith("cartoon") || cartoon.enabled)
      .map((a) => (a.key === "audiobook" ? { ...a, priceRub: audio.ttsPriceRub } : a.key === "audio-self" ? { ...a, priceRub: audio.selfReadPriceRub } : a))
      .map((a) => (a.key === "cartoon" ? { ...a, priceRub: cartoon.priceRub } : a.key === "cartoon-own-voice" ? { ...a, priceRub: cartoon.ownVoiceRub } : a)),
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

/** Мультфильм этой книги уже оплачен (любым заказом, не возвращён). */
export async function cartoonPaidFor(bookId: string) {
  const n = await db.orderItem.count({ where: { bookId, refKey: "cartoon", order: { paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] } } } });
  return n > 0;
}

/** Допы этой книги из оплаченных (не возвращённых) заказов. */
export async function paidAddonKeys(bookId: string) {
  const items = await db.orderItem.findMany({
    where: { bookId, kind: "addon", order: { paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] } } },
    select: { refKey: true },
  });
  return [...new Set(items.map((i) => i.refKey))];
}

/**
 * Кабинет → «Добавить к книге»: цифровые допы для аудитории книги, которые ещё не куплены
 * (мультфильм и «своим голосом» — своя панель, физические — только с заказом печати).
 */
export async function laterAddonsFor(bookId: string) {
  const [{ addons }, paid] = await Promise.all([catalogForPricing(await bookAudience(bookId)), paidAddonKeys(bookId)]);
  return addons
    .filter((a) => a.kind === "DIGITAL" && !a.requiresPrint && !a.key.startsWith("cartoon") && !paid.includes(a.key))
    .map((a) => ({ key: a.key, title: a.title, description: a.description && a.description !== a.title ? a.description : "", priceRub: a.priceRub ?? 0 }));
}

/**
 * Сколько фактически заплачено за PDF этой книги (для зачёта при заказе печати): цена PDF минус его доля
 * скидки заказа (промокод, скидка новичка), за вычетом зачёта, уже использованного в оплаченных заказах печати.
 */
export async function pdfPaidFor(bookId: string, userId: string) {
  const live = { userId, paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] as OrderStatus[] } };
  const items = await db.orderItem.findMany({
    where: { bookId, kind: "format", refKey: "pdf", order: live },
    include: { order: { select: { subtotalRub: true, pdfCreditRub: true, discountRub: true } } },
  });
  const paid = items.reduce((sum, i) => sum + pdfPaidShare(i.priceRub, i.order), 0);
  const used = await db.order.aggregate({ where: { ...live, whoPrints: "bookimi", items: { some: { bookId, kind: "format" } } }, _sum: { pdfCreditRub: true } });
  return Math.max(0, paid - (used._sum.pdfCreditRub ?? 0));
}

/** Доля строки заказа после скидки: скидка распределяется пропорционально цене строк (без зачёта PDF). */
export function pdfPaidShare(priceRub: number, o: { subtotalRub: number; pdfCreditRub: number; discountRub: number }) {
  const goods = o.subtotalRub - o.pdfCreditRub;
  if (goods <= 0) return 0;
  return Math.max(0, Math.round(priceRub - (o.discountRub * priceRub) / goods));
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
  /** Докупка цифровых допов к оплаченной книге из кабинета (мультфильм, «своим голосом»). */
  addonsOnly?: boolean;
  /** «Книга для каждого в группе»: N книг одним заказом (src/lib/bulk.ts), строка на каждую книгу. */
  bulk?: boolean;
}

/** Сумма заказа «для каждого»: скидка за количество (bulk.tiers) не суммируется с промокодом и скидкой новичка. */
async function priceBulk(userId: string, input: CheckoutInput) {
  const { formats } = await catalogForPricing();
  const [ship, bulkCfg] = await Promise.all([cfg("shipping"), cfg("bulk")]);
  const book = await db.book.findUnique({ where: { id: input.bookId } });
  const { AnswersV2 } = await import("./quiz");
  const { bulkQuote, groupChildren } = await import("./bulk");
  const a = book ? AnswersV2.safeParse(book.params) : null;
  const heroes = a?.success ? groupChildren(a.data).map((c) => c.name) : [];
  let shipInfo: Awaited<ReturnType<typeof shipQuote>> | null = null;
  if (input.whoPrints === "bookimi" && input.shipping) shipInfo = await shipQuote(input.shipping.method, cleanAddress(input.shipping.method, input.shipping.address), heroes.length);
  const promo = input.promo ? await findPromo(input.promo, userId) : null;
  const newbie = await newbieDiscountPct(userId);
  const promoPct = promo?.percentOff ?? 0;
  const q = bulkQuote(
    {
      whoPrints: input.whoPrints,
      formatKey: input.formatKey,
      heroes: bulkCfg.enabled && !book?.parentBookId ? heroes : [],
      shippingMethod: input.shipping?.method,
      shippingRub: shipInfo?.priceRub ?? 0,
      discountPct: Math.max(promoPct, newbie),
      discountRub: promo?.amountOffRub ?? 0,
      freeShippingBooks: ship.freeShippingBooks,
      tiers: bulkCfg.tiers,
    },
    formats,
  );
  const printHouse = await db.printHouse.findFirst({ where: { isActive: true } });
  if (input.whoPrints === "bookimi" && input.shipping) {
    const e = await shippingMethodError(input.shipping.method, printHouse?.pickupAddress);
    if (e) q.errors.push(e);
  }
  const promoWins = !q.bulkApplied && !!promo && (promoPct >= newbie || (promo.amountOffRub ?? 0) > 0);
  const eta = input.whoPrints === "bookimi" ? etaDate(new Date(), printHouse?.leadDaysMax ?? 5, shipInfo?.daysMax ?? 0) : null;
  return {
    quote: q,
    promo: promoWins ? promo : null,
    newbieApplied: !q.bulkApplied && !promoWins && newbie > 0 && q.discountRub > 0,
    ship: shipInfo,
    eta: eta ? { ready: eta.ready, eta: eta.eta, readyText: ruDate(eta.ready), etaText: ruDate(eta.eta) } : null,
  };
}

export async function priceCheckout(userId: string, input: CheckoutInput) {
  if (input.bulk) return priceBulk(userId, input);
  // Каталог целиком, аудитория — в quote: доп чужой аудитории получает понятную ошибку «не для этой книги»
  const audience = await bookAudience(input.bookId);
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
      addonsOnly: input.addonsOnly,
      cartoonPaid: await cartoonPaidFor(input.bookId),
      audience,
      paidAddons: await paidAddonKeys(input.bookId),
    },
    promo,
    newbie,
    formats,
    addons,
  );
  const q = picked.quote;
  const printHouse = await db.printHouse.findFirst({ where: { isActive: true } });
  // Выключенный способ доставки и самовывоз без адреса типографии — отказ на сервере (не только в форме)
  if (input.whoPrints === "bookimi" && input.shipping) {
    const e = await shippingMethodError(input.shipping.method, printHouse?.pickupAddress);
    if (e) q.errors.push(e);
  }
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
  // «Для каждого»: строка i — книга i (главная, затем копии по порядку списка группы)
  const bulkIds = input.bulk ? [book.id, ...(await (await import("./bulk-server")).ensureBulkCopies(book)).map((b) => b.id)] : null;
  let ship = input.shipping ? { method: input.shipping.method, address: cleanAddress(input.shipping.method, input.shipping.address) } : null;
  if (input.whoPrints === "bookimi" && ship?.method === "cdek_pvz") {
    const v = await verifyPvz(ship.address);
    if (!v.ok) throw new Error(v.error);
    ship = { ...ship, address: v.address };
  }
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
        create: q.lines.map((l, i) => ({
          bookId: bulkIds?.[i] ?? book.id,
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

/**
 * Создаёт платёж выбранным способом. Идемпотентно: пока заказ ждёт оплаты и срок не вышел, повторное «Оплатить»
 * тем же способом возвращает тот же платёж (тот же ключ идемпотентности у провайдера), а не плодит новые.
 */
export async function startPayment(order: Order, method: string): Promise<PaymentView> {
  if (!(await canAcceptPayments())) throw new Error("Приём оплаты пока выключен");
  if (order.status !== "PENDING_PAYMENT") throw new Error("Заказ не ожидает оплаты");
  const provider = (await availableProviders()).find((p) => p.name === method);
  if (!provider) throw new Error("Способ оплаты недоступен");
  const { pay, reused, fresh } = await db.$transaction(async (tx) => {
    // Блокировка заказа: два одновременных «Оплатить» не создадут два платежа
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id}::uuid FOR UPDATE`;
    const o = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (o.status !== "PENDING_PAYMENT") throw new Error("Заказ не ожидает оплаты");
    const live = !o.expiresAt || o.expiresAt > new Date();
    const existing = live
      ? await tx.payment.findFirst({ where: { orderId: o.id, provider: provider.name, status: { in: ["created", "pending"] }, amountRub: o.totalRub }, orderBy: { createdAt: "desc" } })
      : null;
    if (existing) return { pay: existing, reused: true, fresh: o };
    const created = await tx.payment.create({
      data: { orderId: o.id, provider: provider.name, idempotencyKey: idempotencyKey(), amountRub: o.totalRub, status: "created" },
    });
    return { pay: created, reused: false, fresh: o };
  });
  const res = await provider.create(fresh, pay);
  if (!reused || !pay.externalId) {
    await db.payment.update({ where: { id: pay.id }, data: { externalId: res.externalId, raw: res.raw as object | undefined, status: "pending" } });
  }
  if (!reused || !fresh.expiresAt) {
    const p = await cfg("payments");
    const ttl = provider.name === "transfer" ? p.transfer.cancelHours * 60 : 60;
    await db.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() + ttl * 60_000) } });
  }
  return res.view;
}

export class ClaimRejected extends Error {}

/**
 * Покупатель нажал «Я оплатил(а)» — заказ ждёт подтверждения оператором. Только если покупатель выбрал перевод
 * (есть незавершённый платёж «transfer») и заказ ждёт оплаты; иначе — понятный отказ, заказ не зависает.
 * Алерт владельцу — не чаще 3 в час от одного покупателя (остальные видны на дашборде «Перевод: проверить»).
 */
export async function claimTransfer(orderId: string, userId: string) {
  const o = await db.order.findFirst({ where: { id: orderId, userId } });
  if (!o || o.status !== "PENDING_PAYMENT") return null;
  const pay = await db.payment.findFirst({ where: { orderId: o.id, provider: "transfer", status: { in: ["created", "pending"] } } });
  if (!pay) throw new ClaimRejected("Сначала выберите оплату переводом — тогда появятся реквизиты и кнопка «Я оплатил(а)»");
  if (o.expiresAt && o.expiresAt < new Date()) throw new ClaimRejected("Срок оплаты переводом истёк — выберите способ оплаты заново");
  const r = await db.order.updateMany({ where: { id: o.id, status: "PENDING_PAYMENT" }, data: { status: "AWAITING_CONFIRMATION" } });
  if (r.count !== 1) return null;
  const up = await db.order.findUniqueOrThrow({ where: { id: o.id } });
  await notifySafe(userId, "transfer_waiting", { code: o.publicCode });
  const recent = await db.auditLog.count({ where: { action: "transfer.claim", details: { path: ["userId"], equals: userId }, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  await audit(null, "transfer.claim", "order", o.id, { userId, alerted: recent < 3 });
  if (recent < 3) await alertOwner("Перевод на подтверждении", `Заказ ${o.publicCode}, ${o.totalRub} ₽. Проверьте поступление и подтвердите в админке.`).catch(() => {});
  return up;
}

export const PAYABLE: OrderStatus[] = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED"];
export const PAID_STATUSES: OrderStatus[] = ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"];

/** Выполнить шаг после оплаты; сбой (почта, чек, реферал) не ломает оплату — только в журнал и владельцу. */
async function step(label: string, orderCode: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[markPaid] ${label}:`, (e as Error).message);
    await alertOwner("Сбой после оплаты", `Заказ ${orderCode}: шаг «${label}» не выполнен (${(e as Error).message}). Оплата и книга не затронуты.`).catch(() => {});
  }
}

/**
 * Оплата прошла (вебхук QR или подтверждение оператором). Идемпотентно и без гонок:
 *  • платёж и заказ блокируются (SELECT … FOR UPDATE), статус меняется условно PENDING → PAID;
 *  • в той же транзакции: платёж «succeeded», промокод, paidFull, задачи генерации (outbox через pg-boss) —
 *    книга будет сделана, даже если дальше упадёт почта;
 *  • второй успешный платёж по уже оплаченному заказу → платёж «needs_refund», владельцу «вернуть деньги»,
 *    без второго чека, промокода и писем;
 *  • после коммита: чек НПД, письма (сбой → очередь повторов), реферал, триггеры — каждый шаг отдельно.
 */
export async function markPaid(paymentId: string, opts: { receiptUrl?: string; confirmedBy?: string; client?: PrismaClient } = {}) {
  const { QUEUES, enqueueInTx, getBoss } = await import("./queue");
  await getBoss(); // запуск pg-boss — до транзакции (создание очередей не должно держать блокировки)
  const res = await db.$transaction(
    async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: string; status: string; orderId: string }[]>`SELECT "id", "status", "orderId" FROM "Payment" WHERE "id" = ${paymentId}::uuid FOR UPDATE`;
      if (!locked) throw new Error("Платёж не найден");
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${locked.orderId}::uuid FOR UPDATE`;
      const order0 = await tx.order.findUniqueOrThrow({ where: { id: locked.orderId } });
      if (["succeeded", "needs_refund", "refunded"].includes(locked.status)) return { kind: "already" as const, order: order0 };
      if (!PAYABLE.includes(order0.status)) {
        await tx.payment.update({ where: { id: locked.id }, data: { status: "needs_refund", confirmedById: opts.confirmedBy } });
        return { kind: "duplicate" as const, order: order0 };
      }
      const upd = await tx.order.updateMany({ where: { id: order0.id, status: { in: PAYABLE } }, data: { status: "PAID", paidAt: new Date() } });
      if (upd.count !== 1) {
        await tx.payment.update({ where: { id: locked.id }, data: { status: "needs_refund", confirmedById: opts.confirmedBy } });
        return { kind: "duplicate" as const, order: order0 };
      }
      await tx.payment.update({ where: { id: locked.id }, data: { status: "succeeded", confirmedById: opts.confirmedBy } });
      const order = await tx.order.findUniqueOrThrow({ where: { id: order0.id } });
      // Промокод засчитывается атомарно и не сверх maxUses (два заказа с одним промокодом оплачены одновременно)
      const promoOverLimit = order.promoCodeId ? !(await usePromo(order.promoCodeId, tx)) : false;
      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const bookIds = [...new Set(items.map((i) => i.bookId).filter(Boolean))] as string[];
      if (bookIds.length) await tx.book.updateMany({ where: { id: { in: bookIds } }, data: { paidFull: true } });
      // Задачи — в той же транзакции: оплата без задачи генерации невозможна. Уже готовая книга (печать
      // после PDF, докупка мультфильма) — только недостающие файлы, без перерисовки (runFull, режим extras).
      for (const id of bookIds) {
        await enqueueInTx(tx, QUEUES.generateFull, { bookId: id, orderId: order.id }, { retryLimit: 3, retryDelay: 120, singletonKey: `full-${id}-${order.id}` });
      }
      return { kind: "paid" as const, order, promoOverLimit };
    },
    { timeout: 20_000 },
  );
  const order = res.order;
  if (res.kind === "already") return order;
  if (res.kind === "duplicate") {
    await audit(opts.confirmedBy ?? null, "payment.duplicate", "order", order.id, { paymentId, status: order.status });
    await alertOwner(
      "Повторная оплата — вернуть деньги",
      `Заказ ${order.publicCode} уже оплачен, но пришёл ещё один платёж (${paymentId}). Верните деньги покупателю: платёж отмечен «needs_refund», чек и письма не отправлялись.`,
    ).catch(() => {});
    return order;
  }
  if (res.promoOverLimit) {
    await alertOwner("Промокод сверх лимита", `Заказ ${order.publicCode} оплачен со скидкой по промокоду, у которого уже исчерпан лимит использований.`).catch(() => {});
  }
  let receiptUrl: string | null | undefined;
  await step("чек", order.publicCode, async () => {
    receiptUrl = (await issueReceipt(order.id, { urlFromPayment: opts.receiptUrl }))?.url;
  });
  await step("письмо об оплате", order.publicCode, async () =>
    notifySafe(order.userId, "payment_received", { code: order.publicCode, orderId: order.id, whoPrints: order.whoPrints, heroAcc: await orderHeroAcc(order.id) }),
  );
  if (receiptUrl) await notifySafe(order.userId, "receipt", { code: order.publicCode, url: receiptUrl });
  await step("реферал", order.publicCode, () => onOrderPaid(order.userId, order.id));
  await step("аналитика", order.publicCode, () => track("pay", { userId: order.userId, props: { orderId: order.id, total: order.totalRub } }));
  // Конверсия триггеров: последняя рассылка этому покупателю за 7 дней
  await step("триггеры", order.publicCode, async () => {
    const run = await db.triggerRun.findFirst({
      where: { subjectId: order.userId, sentAt: { gte: new Date(Date.now() - 7 * 86400_000) }, converted: false },
      orderBy: { sentAt: "desc" },
    });
    if (run) await db.triggerRun.update({ where: { id: run.id }, data: { converted: true, revenueRub: order.totalRub } });
  });
  await step("лимит НПД", order.publicCode, () => checkNpdLimit());
  return order;
}

/** Оператор подтвердил перевод. Заказ уже оплачен (двойной клик, оплата по QR) — ничего не делаем. */
export async function confirmTransfer(orderId: string, operatorId: string) {
  const pay = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!PAYABLE.includes(order.status)) return null;
    const existing = await tx.payment.findFirst({ where: { orderId, provider: "transfer", status: { in: ["created", "pending"] } }, orderBy: { createdAt: "desc" } });
    return existing ?? tx.payment.create({ data: { orderId, provider: "transfer", idempotencyKey: idempotencyKey(), amountRub: order.totalRub, status: "pending" } });
  });
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!pay) return order;
  await audit(operatorId, "transfer.confirm", "order", orderId, { amount: order.totalRub });
  return markPaid(pay.id, { confirmedBy: operatorId });
}

/**
 * Возврат — только из оплаченных статусов. ЮKassa: ответ провайдера проверяется (ошибка — возврат не проведён).
 * После полного возврата доступ к файлам книги закрывается (paidFull = false), если её не оплатили другим заказом.
 */
export async function refundOrder(orderId: string, operatorId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, items: true } });
  if (!PAID_STATUSES.includes(order.status)) return { ok: false, error: order.status === "REFUNDED" ? "Заказ уже возвращён" : "Вернуть можно только оплаченный заказ" };
  const pay = order.payments.find((p) => p.status === "succeeded");
  let providerRefund: object | undefined;
  if (pay?.provider === "yookassa") {
    try {
      providerRefund = await new YooKassaProvider().refund(pay, order.totalRub);
    } catch (e) {
      await audit(operatorId, "order.refund_failed", "order", orderId, { reason, provider: pay.provider, error: (e as Error).message });
      return { ok: false, error: `ЮKassa не провела возврат: ${(e as Error).message}. Деньги не возвращены, заказ не изменён.` };
    }
  }
  // СБП-QR — возврат через сервис; перевод — обратный перевод вручную (в карточке заказа — напоминание)
  const r = await db.order.updateMany({ where: { id: orderId, status: { in: PAID_STATUSES } }, data: { status: "REFUNDED", refundedAt: new Date(), comment: reason } });
  if (r.count !== 1) return { ok: false, error: "Заказ уже возвращён" };
  if (pay) await db.payment.update({ where: { id: pay.id }, data: { status: "refunded" } });
  // Доступ к PDF и файлам — только если книга оплачена другим, не возвращённым заказом с форматом
  const bookIds = [...new Set(order.items.map((i) => i.bookId).filter(Boolean))] as string[];
  for (const bookId of bookIds) {
    const other = await db.orderItem.count({ where: { bookId, kind: "format", order: { id: { not: orderId }, paidAt: { not: null }, status: { in: PAID_STATUSES } } } });
    if (!other) await db.book.update({ where: { id: bookId }, data: { paidFull: false } });
  }
  let receiptError: string | undefined;
  try {
    await cancelReceipts(orderId);
  } catch (e) {
    receiptError = (e as Error).message;
    await alertOwner("Чек не аннулирован", `Заказ ${order.publicCode}: ${receiptError}. Аннулируйте чек в «Мой налог» вручную.`).catch(() => {});
  }
  await notifySafe(order.userId, "refund", { code: order.publicCode, amount: order.totalRub });
  await audit(operatorId, "order.refund", "order", orderId, { reason, provider: pay?.provider, amount: order.totalRub, providerRefund, receiptError, accessClosed: bookIds.length });
  return { ok: true };
}

export const STATUS_FLOW: OrderStatus[] = ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"];

export async function setStatus(orderId: string, status: OrderStatus, operatorId?: string, track_?: string) {
  const order = await db.order.update({ where: { id: orderId }, data: { status }, include: { shipment: true } });
  if (track_ && order.shipment) await db.shipment.update({ where: { orderId }, data: { trackNumber: track_, status: "in_transit" } });
  // Готово к отправке (типография упаковала): заказ в СДЭК — автоматически при подключённых ключах
  if (status === "PACKED" && !track_ && order.shipment && !order.shipment.trackNumber && order.shipment.method.startsWith("cdek_")) {
    const { createCdekShipment } = await import("./print");
    await createCdekShipment(orderId).catch((e) =>
      alertOwner("СДЭК: заказ на доставку не создан", `${order.publicCode}: ${(e as Error).message}. Создайте отправление вручную и внесите трек.`).catch(() => {}),
    );
  }
  if (operatorId) await audit(operatorId, "order.status", "order", orderId, { status, track: track_ });
  await notifySafe(order.userId, track_ ? "track" : "status", {
    code: order.publicCode,
    orderId,
    status,
    track: track_,
    service: order.shipment?.method,
    eta: order.shipment?.etaDate ? ruDate(order.shipment.etaDate) : "",
    ready: order.readyDate ? ruDate(order.readyDate) : "",
  });
  if (status === "DELIVERED") {
    await track("delivered", { userId: order.userId, props: { orderId } });
    // ИП + ЮKassa: чек зачёта предоплаты при выдаче печатной книги
    const { yookassaSettlement } = await import("./payments");
    await yookassaSettlement(orderId).catch((e) => alertOwner("Чек зачёта предоплаты не отправлен", `${order.publicCode}: ${(e as Error).message}. Сформируйте его в личном кабинете ЮKassa.`).catch(() => {}));
  }
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

/**
 * Можно ли оформлять книгу: после превью (PREVIEW_READY и дальше) — всегда; без превью — если текст утверждён
 * (TEXT_APPROVED), а дневной лимит превью покупателя исчерпан: «купите без ожидания» — иллюстрации нарисуем
 * после оплаты. Сотрудники ограничены так же (тест покупки без превью — через лимит).
 */
export async function checkoutAllowed(book: { status: string }, user: { id: string; email: string | null; phone: string | null }): Promise<{ ok: boolean; withoutPreview: boolean }> {
  if (["PREVIEW_READY", "FULL_QUEUED", "FULL_READY"].includes(book.status)) return { ok: true, withoutPreview: false };
  if (book.status !== "TEXT_APPROVED") return { ok: false, withoutPreview: false };
  const { used } = await import("./limits");
  const limits = await cfg("limits");
  const contact = user.email ?? user.phone ?? user.id;
  const ok = (await used(contact, "preview")) >= limits.previewsPerContact;
  return { ok, withoutPreview: ok };
}
