import { z } from "zod";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { claimTransfer, startPayment } from "@/lib/orders";

async function ownOrder(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const user = await currentUser();
  if (!user) return null;
  const order = await db.order.findUnique({ where: { id } });
  // Чужой заказ не открывается — 404, а не 403, чтобы не подтверждать существование
  if (!order || order.userId !== user.id) return null;
  return { order, user };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await ownOrder(id);
  if (!o) return err("Не найдено", 404);
  const full = await db.order.findUnique({ where: { id }, include: { receipts: true, shipment: true } });
  return json({ status: full!.status, receipts: full!.receipts.filter((r) => r.status === "issued").map((r) => r.url), track: full!.shipment?.trackNumber });
}

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay"), method: z.enum(["sbp_qr", "transfer", "yookassa"]) }),
  z.object({ action: z.literal("claim") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("order", 20, 60_000);
  if (t) return t;
  const o = await ownOrder(id);
  if (!o) return err("Не найдено", 404);
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  try {
    if (b.action === "pay") return json({ view: await startPayment(o.order, b.method) });
    const r = await claimTransfer(id, o.user.id);
    return r ? json({ ok: true }) : err("Заказ не ожидает оплаты");
  } catch (e) {
    return err((e as Error).message);
  }
}
