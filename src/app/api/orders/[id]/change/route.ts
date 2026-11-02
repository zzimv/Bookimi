import { db } from "@/lib/db";
import { err, json, throttle } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { Checkout } from "@/lib/checkout-schema";
import { priceCheckout, type CheckoutInput } from "@/lib/orders";
import { canChangeOrder, CHANGE_LOCKED_TEXT, describeChange, type OrderShape } from "@/lib/order-change";

// «Изменить заказ» — только до оплаты (решение владелицы, rev 10): тот же выбор, что при оформлении, сумма — заново
// на сервере; строки заказа, доставка и получатель перезаписываются, изменение — в журнал OrderChange.
// Оплаченный заказ — 409 «Заказ оплачен — изменения через поддержку».
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await throttle("order-change", 10, 60_000);
  if (t) return t;
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true, shipment: true } });
  if (!order || order.userId !== user.id) return err("Не найдено", 404);
  const can = canChangeOrder(order);
  if (!can.ok) return err(can.reason, 409);
  const parsed = Checkout.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Проверьте поля");
  const bookId = order.items.find((i) => i.kind === "format")?.bookId ?? parsed.data.bookId;
  const input = { ...parsed.data, bookId, whoPrints: "bookimi", bulk: undefined, addonsOnly: undefined } as CheckoutInput;
  const priced = await priceCheckout(user.id, input);
  if (priced.quote.errors.length) return err(priced.quote.errors.join("; "));
  const q = priced.quote;
  const ship = order.shipment as { method?: string; address?: Record<string, string> | null; pvzCode?: string | null; pvzAddress?: string | null } | null;
  const before: OrderShape = {
    formatKey: order.items.find((i) => i.kind === "format")?.refKey,
    addons: order.items.filter((i) => i.kind === "addon").map((i) => i.refKey),
    method: ship?.method,
    address: ship ? { ...(ship.address ?? {}), pvzCode: ship.pvzCode ?? undefined, pvzAddress: ship.pvzAddress ?? undefined } : null,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
  };
  const after: OrderShape = { formatKey: input.formatKey, addons: input.addons, method: input.shipping?.method, address: input.shipping?.address as OrderShape["address"], contactName: input.contact.name, contactPhone: input.contact.phone };
  const lines = describeChange(before, after);
  if (!lines.length) return json({ ok: true, unchanged: true });
  const book = await db.book.findUnique({ where: { id: bookId }, select: { text: true } });
  const title = (book?.text as { title?: string } | null)?.title ?? "Персональная книга";
  const done = await db.$transaction(async (tx) => {
    // Пока меняли, могли оплатить — проверяем ещё раз под блокировкой заказа
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order:${id}`}))`;
    const fresh = await tx.order.findUnique({ where: { id }, select: { status: true, paidAt: true, whoPrints: true } });
    if (!fresh || !canChangeOrder(fresh).ok) throw new Error("locked");
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    await tx.orderItem.createMany({
      data: q.lines.map((l) => ({ orderId: id, bookId, kind: l.kind, refKey: l.key, title: l.kind === "format" ? `Изготовление персонализированной книги «${title}» на заказ: ${l.title}` : `Изготовление на заказ: ${l.title}`, priceRub: l.priceRub })),
    });
    await tx.order.update({ where: { id }, data: { subtotalRub: q.subtotalRub, discountRub: q.discountRub, pdfCreditRub: q.pdfCreditRub, shippingRub: q.shippingRub, totalRub: q.totalRub, contactName: input.contact.name, contactPhone: input.contact.phone ?? order.contactPhone, readyDate: priced.eta?.ready ?? order.readyDate } });
    if (input.shipping && order.shipment) {
      const a = input.shipping.address as Record<string, string | number | undefined>;
      await tx.shipment.update({ where: { orderId: id }, data: { method: input.shipping.method, address: a as object, pvzCode: (a.pvzCode as string) || null, pvzAddress: (a.pvzAddress as string) || null } as never });
    }
    await (tx as unknown as { orderChange: { create(a: { data: object }): Promise<unknown> } }).orderChange.create({ data: { orderId: id, before: before as object, after: after as object, lines, totalRub: q.totalRub } });
  }).catch((e) => ((e as Error).message === "locked" ? "locked" : Promise.reject(e)));
  if (done === "locked") return err(CHANGE_LOCKED_TEXT, 409);
  return json({ ok: true, lines, totalRub: q.totalRub });
}
