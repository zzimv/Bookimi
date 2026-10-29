import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SbpQrProvider, YooKassaProvider, type PaymentProvider } from "@/lib/payments";
import { markPaid } from "@/lib/orders";
import { cfg } from "@/lib/settings";

// Вебхуки платёжных сервисов. Подпись проверяется провайдером; сумма сверяется с заказом.
// Идемпотентно: повторное уведомление ничего не меняет.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  // Выключенный способ оплаты не принимает уведомлений и не ходит во внешний API
  const pay_ = await cfg("payments");
  if (provider === "yookassa" && !pay_.yookassa.enabled) return new NextResponse("not found", { status: 404 });
  if (provider === "sbp" && !pay_.sbpQr.enabled) return new NextResponse("not found", { status: 404 });
  const raw = await req.text();
  const p: PaymentProvider | null = provider === "sbp" ? new SbpQrProvider(false) : provider === "yookassa" ? new YooKassaProvider() : null;
  if (!p?.webhook) return new NextResponse("unknown", { status: 404 });
  const ev = await p.webhook(raw, req.headers).catch(() => null);
  if (!ev) {
    await db.auditLog.create({ data: { action: "security.webhook_bad_signature", entity: "payment", details: { provider } } });
    return new NextResponse("bad signature", { status: 401 });
  }
  const pay = await db.payment.findFirst({ where: { externalId: ev.externalId, provider: provider === "sbp" ? "sbp_qr" : provider }, include: { order: true } });
  if (!pay) return NextResponse.json({ ok: true }); // не наш платёж — отвечаем 200, чтобы сервис не повторял
  if (ev.status !== "succeeded") {
    // Отказ не перезаписывает уже прошедший платёж
    await db.payment.updateMany({ where: { id: pay.id, status: { in: ["created", "pending"] } }, data: { status: "failed" } });
    return NextResponse.json({ ok: true });
  }
  if (ev.amountRub !== pay.order.totalRub) {
    await db.auditLog.create({ data: { action: "payment.amount_mismatch", entity: "order", entityId: pay.orderId, details: { got: ev.amountRub, want: pay.order.totalRub } } });
    return NextResponse.json({ ok: false }, { status: 409 });
  }
  await markPaid(pay.id, { receiptUrl: ev.receiptUrl });
  return NextResponse.json({ ok: true });
}
