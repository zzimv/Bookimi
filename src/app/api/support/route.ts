import { z } from "zod";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { alertOwner } from "@/lib/notify";
import { checkText } from "@/lib/moderation";

export async function POST(req: Request) {
  const t = await throttle("support", 5, 60_000);
  if (t) return t;
  const b = await body(req, z.object({ contact: z.string().trim().min(3).max(120), message: z.string().trim().min(5).max(2000), orderId: z.string().uuid().optional() }));
  if (!b) return err("Опишите вопрос и укажите контакт");
  if (checkText(b.message)) return err("Уберите ссылки из сообщения");
  const user = await currentUser();
  const order = b.orderId ? await db.order.findFirst({ where: { id: b.orderId, userId: user?.id } }) : null;
  const ticket = await db.supportTicket.create({ data: { userId: user?.id, orderId: order?.id, contact: b.contact, message: b.message } });
  await alertOwner("Новое обращение в поддержку", `${order ? `Заказ ${order.publicCode}. ` : ""}${b.message.slice(0, 300)}`);
  return json({ id: ticket.id });
}
