// Чек 54-ФЗ для ЮKassa (режим ИП, tax.regime = "ip"): объект receipt в POST /v3/payments и чек зачёта предоплаты
// (POST /v3/receipts) при выдаче печатной книги. Справочник значений — yookassa.ru/developers/54fz/parameters-values.
// Чистые функции без БД — покрыты тестами (tests/fixes-1031-unit.test.ts).

export interface Receipt54Order {
  publicCode: string;
  whoPrints: string;
  subtotalRub: number;
  discountRub: number;
  pdfCreditRub: number;
  shippingRub: number;
  totalRub: number;
  contactEmail: string | null;
  contactPhone: string | null;
}
export interface Receipt54Item {
  kind: string;
  title: string;
  priceRub: number;
  qty: number;
}
export interface Receipt54Tax {
  /** Код НДС ЮKassa: 1 — без НДС, 2 — 0%, 3 — 10%, 4 — 20%, 7 — 5%, 8 — 7%, 11 — 22% (с 2026). */
  vatCode: number;
  /** Код СНО 1–6; 0 — не передавать (касса настроена на одну СНО). */
  taxSystemCode: number;
  /** Касса на ФФД 1.2 — передаём measure. */
  ffd12: boolean;
}

export interface Receipt54ItemOut {
  description: string;
  quantity: string;
  amount: { value: string; currency: "RUB" };
  vat_code: number;
  payment_mode: "full_prepayment" | "full_payment";
  payment_subject: "service" | "commodity";
  measure?: "piece";
}
export interface Receipt54 {
  customer: { email?: string; phone?: string };
  items: Receipt54ItemOut[];
  tax_system_code?: number;
  internet: "true";
}

const money = (rub: number) => rub.toFixed(2);
/** Наименование позиции в чеке: до 128 символов. */
const desc = (s: string) => (s.length > 128 ? `${s.slice(0, 127)}…` : s);
/** Телефон для ЮKassa — цифры в формате 79XXXXXXXXX. */
export const receiptPhone = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  if (d.length === 11 && (d[0] === "7" || d[0] === "8")) return `7${d.slice(1)}`;
  if (d.length === 10 && d[0] === "9") return `7${d}`;
  return null;
};

/**
 * Позиции чека: строки заказа со скидкой и зачётом оплаченного PDF, распределёнными пропорционально цене (сумма —
 * ровно totalRub, копейки округления — на самую дорогую строку), доставка — отдельной позицией.
 * Печать — «полная предоплата» (книгу изготовят и передадут позже; при выдаче — чек зачёта предоплаты), PDF и цифровые
 * допы — «полный расчёт» (выдаются сразу после оплаты). Предмет расчёта — услуга (изготовление на заказ).
 */
export function buildReceipt54(order: Receipt54Order, items: Receipt54Item[], tax: Receipt54Tax): Receipt54 {
  const email = order.contactEmail?.trim() || undefined;
  const phone = receiptPhone(order.contactPhone) ?? undefined;
  if (!email && !phone) throw new Error("Для чека 54-ФЗ нужен email или телефон покупателя");
  const mode: Receipt54ItemOut["payment_mode"] = order.whoPrints === "bookimi" ? "full_prepayment" : "full_payment";
  const lines = items.filter((i) => i.priceRub > 0).map((i) => ({ title: i.title, gross: i.priceRub * Math.max(1, i.qty), qty: Math.max(1, i.qty) }));
  const goods = lines.reduce((s, l) => s + l.gross, 0);
  const goodsNet = Math.max(0, order.totalRub - order.shippingRub);
  // Скидка и зачёт PDF — пропорционально, в копейках
  const net = lines.map((l) => (goods > 0 ? Math.floor((l.gross * goodsNet * 100) / goods) : 0));
  const rest = goodsNet * 100 - net.reduce((s, x) => s + x, 0);
  if (lines.length) {
    const top = lines.reduce((bi, l, i, a) => (l.gross > a[bi].gross ? i : bi), 0);
    net[top] += rest;
  }
  const out: Receipt54ItemOut[] = [];
  lines.forEach((l, i) => {
    if (net[i] <= 0) return;
    // Цена за единицу × количество должна совпасть с суммой строки: при неделимой сумме — одна позиция на всё количество
    const unitK = net[i] % l.qty === 0 ? net[i] / l.qty : net[i];
    const qty = net[i] % l.qty === 0 ? l.qty : 1;
    out.push(item(l.title, unitK / 100, qty, tax, mode));
  });
  if (order.shippingRub > 0) out.push(item(`Доставка заказа ${order.publicCode}`, order.shippingRub, 1, tax, mode));
  if (out.length > 100) throw new Error("В чеке ЮKassa не больше 100 позиций");
  const total = out.reduce((s, x) => s + Math.round(Number(x.amount.value) * 100) * Number(x.quantity), 0);
  if (total !== order.totalRub * 100) throw new Error(`Сумма чека ${total / 100} ≠ сумме заказа ${order.totalRub}`);
  return {
    customer: { ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
    items: out,
    ...(tax.taxSystemCode >= 1 && tax.taxSystemCode <= 6 ? { tax_system_code: tax.taxSystemCode } : {}),
    internet: "true",
  };
}

function item(title: string, unitRub: number, qty: number, tax: Receipt54Tax, mode: Receipt54ItemOut["payment_mode"]): Receipt54ItemOut {
  return {
    description: desc(title),
    quantity: qty.toFixed(3),
    amount: { value: money(unitRub), currency: "RUB" },
    vat_code: tax.vatCode,
    payment_mode: mode,
    payment_subject: "service",
    ...(tax.ffd12 ? { measure: "piece" as const } : {}),
  };
}

/**
 * Чек зачёта предоплаты (печатная книга выдана): те же позиции с «полным расчётом» и settlement «prepayment»
 * на всю сумму. POST /v3/receipts с payment_id исходного платежа.
 */
export function settlementReceipt54(paymentId: string, prepaid: Receipt54, totalRub: number) {
  return {
    type: "payment" as const,
    payment_id: paymentId,
    customer: prepaid.customer,
    items: prepaid.items.map((i) => ({ ...i, payment_mode: "full_payment" as const })),
    ...(prepaid.tax_system_code ? { tax_system_code: prepaid.tax_system_code } : {}),
    settlements: [{ type: "prepayment" as const, amount: { value: money(totalRub), currency: "RUB" as const } }],
    send: true,
  };
}
