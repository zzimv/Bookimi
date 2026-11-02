// «Изменить заказ» (rev 10, решение владелицы от 02.11): до оплаты покупатель меняет всё — состав (формат, обложка,
// допы, второй экземпляр), способ доставки, адрес, пункт выдачи и получателя; сумма пересчитывается тем же расчётом,
// что при оформлении. После оплаты заказ закрыт для изменений: «Заказ оплачен — изменения через поддержку».
// Доплат и возвратов разницы нет. Чистые функции — общие для сервера и демо-стенда.

/** Менять можно только неоплаченный заказ. «Я оплатил(а)» (AWAITING_CONFIRMATION) — уже нельзя: деньги в пути. */
export const CHANGEABLE_STATUSES = ["PENDING_PAYMENT"] as const;

export const CHANGE_LOCKED_TEXT = "Заказ оплачен — изменения через поддержку";
export const SUPPORT_HREF = "/kabinet/podderzhka";

export function canChangeOrder(o: { status: string; whoPrints: string; addonsOnly?: boolean | null; paidAt?: unknown }): { ok: true } | { ok: false; reason: string } {
  if (o.whoPrints !== "bookimi" || o.addonsOnly) return { ok: false, reason: "В заказе PDF менять нечего" };
  if (o.status === "CANCELLED" || o.status === "REFUNDED") return { ok: false, reason: "Заказ отменён" };
  if (o.status === "AWAITING_CONFIRMATION") return { ok: false, reason: "Оплата проверяется — изменения через поддержку" };
  if (o.paidAt || !(CHANGEABLE_STATUSES as readonly string[]).includes(o.status)) return { ok: false, reason: CHANGE_LOCKED_TEXT };
  return { ok: true };
}

export interface OrderShape {
  formatKey?: string | null;
  addons: string[];
  method?: string | null;
  address?: { city?: string; street?: string; flat?: string; pvzCode?: string; pvzAddress?: string; postalCode?: string } | null;
  contactName?: string | null;
  contactPhone?: string | null;
}

/** Что поменялось — строками для журнала («Формат: … → …»). titles — подписи форматов, допов, способов доставки. */
export function describeChange(before: OrderShape, after: OrderShape, titles: Record<string, string> = {}): string[] {
  const t = (k?: string | null) => (k ? titles[k] ?? k : "—");
  const out: string[] = [];
  if ((before.formatKey ?? "") !== (after.formatKey ?? "")) out.push(`Формат: ${t(before.formatKey)} → ${t(after.formatKey)}`);
  const added = after.addons.filter((k) => !before.addons.includes(k));
  const removed = before.addons.filter((k) => !after.addons.includes(k));
  if (added.length) out.push(`Добавлено: ${added.map(t).join(", ")}`);
  if (removed.length) out.push(`Убрано: ${removed.map(t).join(", ")}`);
  if ((before.method ?? "") !== (after.method ?? "")) out.push(`Доставка: ${t(before.method)} → ${t(after.method)}`);
  const addr = (a?: OrderShape["address"]) => (a ? [a.city, a.pvzAddress || [a.street, a.flat].filter(Boolean).join(", "), a.postalCode].filter(Boolean).join(", ") : "");
  if (addr(before.address) !== addr(after.address)) out.push(`Адрес: ${addr(before.address) || "—"} → ${addr(after.address) || "—"}`);
  if ((before.contactName ?? "") !== (after.contactName ?? "") || (before.contactPhone ?? "") !== (after.contactPhone ?? "")) out.push(`Получатель: ${after.contactName ?? ""}${after.contactPhone ? `, ${after.contactPhone}` : ""}`);
  return out;
}
