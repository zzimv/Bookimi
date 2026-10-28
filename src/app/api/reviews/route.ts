import { z } from "zod";
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
  const paid = await db.order.findFirst({ where: { userId: user.id, paidAt: { not: null } }, orderBy: { paidAt: "desc" } });
  if (!paid) return err("Отзыв можно оставить после покупки", 403);
  await db.review.create({ data: { userId: user.id, orderId: paid.id, rating: b.rating, text: b.text, authorName: b.authorName, status: "pending" } });
  await track("review", { userId: user.id });
  return json({ ok: true });
}
