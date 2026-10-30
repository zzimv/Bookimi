import { z } from "zod";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { checkText } from "@/lib/moderation";
import { track } from "@/lib/events";

// Отзыв покупателя — только после оплаченного заказа, публикуется после модерации.
export async function POST(req: Request) {
  const t = await throttle("review", 3, 60_000);
  if (t) return t;
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  const b = await body(req, z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().min(10).max(2000), authorName: z.string().trim().min(2).max(80), orderId: z.string().uuid().optional() }));
  if (!b) return err("Заполните отзыв");
  if (checkText(b.text + " " + b.authorName)) return err("Уберите недопустимые слова или ссылки");
  // Один отзыв на заказ: указанный заказ или последний оплаченный без отзыва
  const paidWhere = { userId: user.id, paidAt: { not: null }, status: { notIn: ["CANCELLED" as const, "REFUNDED" as const] } };
  const anyPaid = await db.order.findFirst({ where: paidWhere, select: { id: true } });
  if (!anyPaid) return err("Отзыв можно оставить после покупки", 403);
  const reviewed = (await db.review.findMany({ where: { userId: user.id, orderId: { not: null } }, select: { orderId: true } })).map((r) => r.orderId!);
  const order = await db.order.findFirst({
    where: { ...paidWhere, id: b.orderId ? b.orderId : { notIn: reviewed } },
    orderBy: { paidAt: "desc" },
  });
  if (!order || reviewed.includes(order.id)) return err("Спасибо! Отзыв на этот заказ уже есть", 409);
  const created = await db.$transaction(async (tx) => {
    // Параллельные запросы: блокировка по заказу, внутри — повторная проверка
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`review:${order.id}`}))`;
    if (await tx.review.count({ where: { orderId: order.id } })) return false;
    await tx.review.create({ data: { userId: user.id, orderId: order.id, rating: b.rating, text: b.text, authorName: b.authorName, status: "pending" } });
    return true;
  });
  if (!created) return err("Спасибо! Отзыв на этот заказ уже есть", 409);
  await track("review", { userId: user.id });
  return json({ ok: true });
}
