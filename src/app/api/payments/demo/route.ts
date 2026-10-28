import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, isDemo } from "@/lib/auth";
import { markPaid } from "@/lib/orders";

// Только в демо-режиме: имитация оплаты по QR. В продакшне (DEMO_MODE=0) — 404.
export async function GET(req: Request) {
  if (!isDemo()) return new NextResponse("Not found", { status: 404 });
  const id = new URL(req.url).searchParams.get("payment") ?? "";
  const user = await currentUser();
  const pay = await db.payment.findUnique({ where: { id }, include: { order: true } });
  if (!pay || !user || pay.order.userId !== user.id) return new NextResponse("Not found", { status: 404 });
  await markPaid(pay.id);
  return NextResponse.redirect(new URL(`/zakaz/${pay.orderId}?paid=1`, req.url), 303);
}
