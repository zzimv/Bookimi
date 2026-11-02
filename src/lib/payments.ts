// PaymentProvider. Самозанятый: СБП по QR (основной), перевод по реквизитам (запасной),
// ЮKassa — готовый адаптер для перехода на ИП (выключен). Итоговая сумма — только из заказа на сервере.
import type { Order, Payment } from "@prisma/client";
import QRCode from "qrcode";
import { token } from "./crypto";

export type PaymentView =
  | { type: "qr"; qrSvg: string; payUrl: string; expiresAt: Date; demo: boolean }
  | { type: "transfer"; phone: string; card: string; bank: string; holder: string; code: string; amountRub: number; expiresAt: Date }
  | { type: "redirect"; url: string };

export interface PaymentProvider {
  name: "sbp_qr" | "transfer" | "yookassa";
  create(order: Order, payment: Payment): Promise<{ view: PaymentView; externalId?: string; raw?: object }>;
  /** Разбор уведомления (вебхука). Возвращает внешний id и статус либо null, если подпись неверна. */
  webhook?(body: string, headers: Headers): Promise<{ externalId: string; status: "succeeded" | "failed"; amountRub: number; receiptUrl?: string } | null>;
  refund?(payment: Payment, amountRub: number): Promise<{ id: string; status: string }>;
}

export const idempotencyKey = () => token(18);

/** СБП-QR. В демо-режиме QR ведёт на тестовую страницу; боевой — через сервис для самозанятых (PAYMENT_SBP_*). */
export class SbpQrProvider implements PaymentProvider {
  name = "sbp_qr" as const;
  constructor(private demo: boolean) {}

  async create(order: Order, payment: Payment) {
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    if (this.demo || !process.env.PAYMENT_SBP_API_URL) {
      const payUrl = `/api/payments/demo?payment=${payment.id}`;
      const qrSvg = await QRCode.toString(`DEMO-SBP:${order.publicCode}:${order.totalRub}`, { type: "svg", margin: 1, width: 240 });
      return { view: { type: "qr" as const, qrSvg, payUrl, expiresAt, demo: true }, externalId: `demo-${payment.id}` };
    }
    // Универсальный адаптер: POST {api}/qr {amount, orderId, description, callbackUrl} → {qrId, payload}
    const r = await fetch(`${process.env.PAYMENT_SBP_API_URL}/qr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PAYMENT_SBP_API_KEY}`,
        "Idempotency-Key": payment.idempotencyKey,
      },
      body: JSON.stringify({
        amount: order.totalRub * 100,
        orderId: order.publicCode,
        description: `Изготовление персонализированной книги, заказ ${order.publicCode}`,
        callbackUrl: `https://${process.env.DOMAIN}/api/payments/webhook/sbp`,
        ttlMinutes: 60,
      }),
    });
    if (!r.ok) throw new Error(`СБП ${r.status}`);
    const j = (await r.json()) as { qrId: string; payload: string };
    const qrSvg = await QRCode.toString(j.payload, { type: "svg", margin: 1, width: 240 });
    return { view: { type: "qr" as const, qrSvg, payUrl: j.payload, expiresAt, demo: false }, externalId: j.qrId, raw: j };
  }

  async webhook(body: string, headers: Headers) {
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const secret = process.env.PAYMENT_SBP_WEBHOOK_SECRET ?? "";
    const sig = headers.get("x-signature") ?? "";
    const calc = createHmac("sha256", secret).update(body).digest("hex");
    if (!secret || sig.length !== calc.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(calc))) return null;
    const j = JSON.parse(body) as { qrId: string; status: string; amount: number; receiptUrl?: string };
    return {
      externalId: j.qrId,
      status: j.status === "paid" || j.status === "succeeded" ? ("succeeded" as const) : ("failed" as const),
      amountRub: Math.round(j.amount / 100),
      receiptUrl: j.receiptUrl,
    };
  }
}

/** Перевод по номеру телефона (СБП) или карты: реквизиты + код заказа; подтверждает оператор. */
export class TransferProvider implements PaymentProvider {
  name = "transfer" as const;
  constructor(private req: { phone: string; card: string; bank: string; holder: string; cancelHours: number }) {}
  async create(order: Order) {
    return {
      view: {
        type: "transfer" as const,
        phone: this.req.phone,
        card: this.req.card,
        bank: this.req.bank,
        holder: this.req.holder,
        code: order.publicCode,
        amountRub: order.totalRub,
        expiresAt: new Date(Date.now() + this.req.cancelHours * 3600_000),
      },
    };
  }
}

/** ЮKassa — для перехода на ИП. Чек 54-ФЗ передаётся в объекте receipt. */
export class YooKassaProvider implements PaymentProvider {
  name = "yookassa" as const;
  private auth() {
    return "Basic " + Buffer.from(`${process.env.PAYMENT_YOOKASSA_SHOP_ID}:${process.env.PAYMENT_YOOKASSA_SECRET_KEY}`).toString("base64");
  }
  async create(order: Order, payment: Payment) {
    // ИП: чек 54-ФЗ формирует касса ЮKassa по объекту receipt (позиции заказа, НДС и СНО — Настройки → Налоговый режим)
    const receipt = await yookassaReceiptFor(order);
    const r = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: { Authorization: this.auth(), "Idempotence-Key": payment.idempotencyKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: { value: order.totalRub.toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: `https://${process.env.DOMAIN}/zakaz/${order.id}` },
        description: `Заказ ${order.publicCode}`,
        metadata: { orderId: order.id },
        ...(receipt ? { receipt } : {}),
      }),
    });
    if (!r.ok) throw new Error(`ЮKassa ${r.status}${r.status === 400 ? ": проверьте настройки чека (НДС, СНО) и контакты покупателя" : ""}`);
    const j = (await r.json()) as { id: string; confirmation: { confirmation_url: string } };
    return { view: { type: "redirect" as const, url: j.confirmation.confirmation_url }, externalId: j.id, raw: j };
  }
  async webhook(body: string) {
    let id: unknown;
    try {
      id = (JSON.parse(body) as { object?: { id?: unknown } }).object?.id;
    } catch {
      return null;
    }
    // Идентификатор платежа ЮKassa — UUID-подобная строка; всё остальное не отправляем в API
    if (typeof id !== "string" || !/^[0-9a-zA-Z-]{8,64}$/.test(id)) return null;
    // ЮKassa рекомендует перепроверять статус запросом к API — делаем это
    const r = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(id)}`, { headers: { Authorization: this.auth() } });
    if (!r.ok) return null;
    const p = (await r.json()) as { id: string; status: string; amount: { value: string } };
    return { externalId: p.id, status: p.status === "succeeded" ? ("succeeded" as const) : ("failed" as const), amountRub: Math.round(Number(p.amount.value)) };
  }
  /** Возврат: ответ проверяется — не 2xx или статус «canceled» → исключение (заказ не помечается возвращённым). */
  async refund(payment: Payment, amountRub: number) {
    if (!payment.externalId) throw new Error("у платежа нет идентификатора ЮKassa");
    const r = await fetch("https://api.yookassa.ru/v3/refunds", {
      method: "POST",
      // Ключ идемпотентности — от платежа: повторное нажатие не создаст второй возврат
      headers: { Authorization: this.auth(), "Idempotence-Key": `refund-${payment.idempotencyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: payment.externalId, amount: { value: amountRub.toFixed(2), currency: "RUB" } }),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; status?: string; description?: string };
    if (!r.ok) throw new Error(`HTTP ${r.status}${j.description ? `: ${j.description}` : ""}`);
    if (!j.id || !j.status || j.status === "canceled") throw new Error(`возврат не принят (статус ${j.status ?? "неизвестен"})`);
    return { id: j.id, status: j.status };
  }
}

/** Объект receipt для ЮKassa: только при режиме ИП (НПД — чеки «Мой налог», src/lib/npd.ts). */
export async function yookassaReceiptFor(order: Order) {
  const { cfg } = await import("./settings");
  const tax = await cfg("tax");
  if (tax.regime !== "ip") return null;
  const { db } = await import("./db");
  const { buildReceipt54 } = await import("./receipt54");
  const items = await db.orderItem.findMany({ where: { orderId: order.id } });
  return buildReceipt54(order, items, { vatCode: tax.vatCode ?? 1, taxSystemCode: tax.taxSystemCode ?? 0, ffd12: tax.ffd12 ?? true });
}

/**
 * Печатная книга выдана (DELIVERED), режим ИП, оплата ЮKassa: чек зачёта предоплаты (POST /v3/receipts).
 * Без ключей ЮKassa или при НПД — ничего. Ошибка — исключением (вызывающий сообщит владельцу).
 */
export async function yookassaSettlement(orderId: string) {
  const { db } = await import("./db");
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order || order.whoPrints !== "bookimi") return null;
  const pay = order.payments.find((p) => p.provider === "yookassa" && p.status === "succeeded");
  if (!pay?.externalId || !process.env.PAYMENT_YOOKASSA_SHOP_ID) return null;
  const receipt = await yookassaReceiptFor(order);
  if (!receipt) return null;
  const { settlementReceipt54 } = await import("./receipt54");
  const auth = "Basic " + Buffer.from(`${process.env.PAYMENT_YOOKASSA_SHOP_ID}:${process.env.PAYMENT_YOOKASSA_SECRET_KEY}`).toString("base64");
  const r = await fetch("https://api.yookassa.ru/v3/receipts", {
    method: "POST",
    headers: { Authorization: auth, "Idempotence-Key": `settle-${pay.idempotencyKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(settlementReceipt54(pay.externalId, receipt, order.totalRub)),
  });
  if (!r.ok) throw new Error(`ЮKassa чек зачёта ${r.status}`);
  const j = (await r.json()) as { id?: string };
  await db.receipt.create({ data: { orderId, regime: "54fz", externalId: j.id, amountRub: order.totalRub, status: "settlement" } });
  return j.id ?? null;
}
