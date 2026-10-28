import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SbpQrProvider, YooKassaProvider, type PaymentProvider } from "@/lib/payments";
import { markPaid } from "@/lib/orders";

// Вебхуки платёжных сервисов. Подпись проверяется провайдером; сумма сверяется с заказом.
// Идемпотентно: повторное уведомление ничего не меняет.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  const p: PaymentProvider | null = provider === "sbp" ? new SbpQrProvider(false) : provider === "yookassa" ? new YooKassaProvider() : null;
  if (!p?.webhook) return new NextResponse("unknown", { status: 404 });
  const ev = await p.webhook(raw, req.headers);
  if (!ev) {
    await db.auditLog.create({ data: { action: "security.webhook_bad_signature", entity: "payment", details: { provider } } });
    return new NextResponse("bad signature", { status: 401 });
  }
  const pay = await db.payment.findFirst({ where: { externalId: ev.externalId }, include: { order: true } });
  if (!pay) return NextResponse.json({ ok: true }); // не наш платёж — отвечаем 200, чтобы сервис не повторял
  if (ev.status !== "succeeded") {
    await db.payment.update({ where: { id: pay.id }, data: { status: "failed" } });
    return NextResponse.json({ ok: true });
  }
  if (ev.amountRub !== pay.order.totalRub) {
    await db.auditLog.create({ data: { action: "payment.amount_mismatch", entity: "order", entityId: pay.orderId, details: { got: ev.amountRub, want: pay.order.totalRub } } });
    return NextResponse.json({ ok: false }, { status: 409 });
  }
  await markPaid(pay.id, { receiptUrl: ev.receiptUrl });
  return NextResponse.json({ ok: true });
}
