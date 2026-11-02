// Чеки НПД в «Мой налог». Режимы:
//  payment — чек формирует платёжный сервис/банк (ссылка приходит в вебхуке)
//  partner — API партнёра ФНС (NPD_API_URL / NPD_API_KEY)
//  manual  — оператор формирует чек в приложении «Мой налог» и вставляет ссылку в админке
//  demo    — демо-режим, чек не фискальный (с явной пометкой)
// При ИП (tax.regime = ip) — чек 54-ФЗ через онлайн-кассу провайдера (ЮKassa), здесь не формируется.
import { db } from "./db";
import { cfg } from "./settings";

export function npdMode(): "payment" | "partner" | "manual" | "demo" {
  if (process.env.DEMO_MODE === "1") return "demo";
  const m = process.env.NPD_PROVIDER;
  if (m === "partner" && process.env.NPD_API_URL) return "partner";
  if (m === "payment") return "payment";
  return "manual";
}

export async function issueReceipt(orderId: string, opts: { urlFromPayment?: string } = {}) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, receipts: true } });
  if (!order) return null;
  const existing = order.receipts.find((r) => r.status === "issued");
  if (existing) return existing;
  const tax = await cfg("tax");
  if (tax.regime === "ip") return null; // 54-ФЗ — касса ЮKassa по объекту receipt (src/lib/receipt54.ts, payments.ts)

  const mode = npdMode();
  let url: string | undefined = opts.urlFromPayment;
  let externalId: string | undefined;

  if (!url && mode === "partner") {
    const r = await fetch(`${process.env.NPD_API_URL}/receipts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NPD_API_KEY}` },
      body: JSON.stringify({
        inn: process.env.NPD_INN,
        operationTime: (order.paidAt ?? new Date()).toISOString(),
        client: { type: "individual" },
        services: [{ name: `Изготовление персонализированной книги на заказ (заказ ${order.publicCode})`, amount: order.totalRub, quantity: 1 }],
        totalAmount: order.totalRub,
      }),
    });
    if (r.ok) {
      const j = (await r.json()) as { id: string; link: string };
      url = j.link;
      externalId = j.id;
    }
  }
  if (!url && mode === "demo") url = `/chek/${order.id}`;
  if (!url) return null; // manual: ждём, пока оператор вставит ссылку

  return db.receipt.create({ data: { orderId, regime: "npd", url, externalId, amountRub: order.totalRub, status: "issued" } });
}

export class ReceiptExists extends Error {}

/**
 * Ручной чек: один действующий чек на оплату заказа. Чек уже есть — без `replace` отказ (ReceiptExists);
 * с `replace` (оператор подтвердил замену) старый помечается «replaced», новый — «issued». Под блокировкой заказа:
 * двойной клик или две вкладки не создадут два чека (иначе прогноз лимита НПД завышается).
 */
export async function attachManualReceipt(orderId: string, url: string, opts: { replace?: boolean } = {}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { receipts: true } });
    if (!order.paidAt) throw new Error("Заказ не оплачен — чек не нужен");
    const issued = order.receipts.filter((r) => r.status === "issued");
    if (issued.length && !opts.replace) throw new ReceiptExists("У заказа уже есть чек. Чтобы заменить его, отметьте «Заменить чек».");
    if (issued.some((r) => r.url === url)) return issued.find((r) => r.url === url)!;
    for (const r of issued) await tx.receipt.update({ where: { id: r.id }, data: { status: "replaced", cancelledAt: new Date() } });
    return tx.receipt.create({ data: { orderId, regime: "npd", url, amountRub: order.totalRub, status: "issued" } });
  });
}

/** Аннулирование чека при возврате. В manual-режиме оператор аннулирует его в «Мой налог» сам. */
export async function cancelReceipts(orderId: string) {
  const receipts = await db.receipt.findMany({ where: { orderId, status: "issued" } });
  for (const r of receipts) {
    if (npdMode() === "partner" && r.externalId) {
      await fetch(`${process.env.NPD_API_URL}/receipts/${r.externalId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NPD_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "REFUND" }),
      });
    }
    await db.receipt.update({ where: { id: r.id }, data: { status: "cancelled", cancelledAt: new Date() } });
  }
}

/** Доход с 1 января (для лимита НПД 2,4 млн ₽). */
export async function incomeThisYear() {
  const from = new Date(`${new Date().getFullYear()}-01-01T00:00:00+03:00`);
  const r = await db.receipt.aggregate({ where: { status: "issued", createdAt: { gte: from } }, _sum: { amountRub: true } });
  const paidNoReceipt = await db.order.aggregate({
    where: { paidAt: { gte: from }, status: { notIn: ["REFUNDED", "CANCELLED"] }, receipts: { none: { status: "issued" } } },
    _sum: { totalRub: true },
  });
  return (r._sum.amountRub ?? 0) + (paidNoReceipt._sum.totalRub ?? 0);
}

export function npdForecast(income: number, limit: number, now = new Date()) {
  const start = new Date(`${now.getFullYear()}-01-01T00:00:00+03:00`);
  const days = Math.max(1, (now.getTime() - start.getTime()) / 86400_000);
  const perDay = income / days;
  if (perDay <= 0) return null;
  const left = limit - income;
  if (left <= 0) return now;
  const d = new Date(now.getTime() + (left / perDay) * 86400_000);
  return d.getFullYear() === now.getFullYear() ? d : null;
}
