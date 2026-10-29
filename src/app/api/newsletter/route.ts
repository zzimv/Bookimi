import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { DOC_VERSION } from "@/lib/legal";
import { getNewsletter } from "@/lib/storefront";

// Подписка с главной: согласие на рассылку (отдельная галочка) → промокод на первый заказ.
// Работает, только если промокод указан в настройках («Подписка на главной») и активен.
const Input = z.object({ email: z.string().trim().toLowerCase().email("Проверьте адрес почты").max(120), consent: z.literal(true) });

export async function POST(req: Request) {
  const t = await throttle("newsletter", 5, 60_000);
  if (t) return t;
  const nl = await getNewsletter();
  if (!nl) return err("Подписка сейчас не работает", 404);
  const b = await body(req, Input);
  if (!b) return err("Укажите почту и отметьте согласие на рассылку");
  let user = await db.user.findUnique({ where: { email: b.email } });
  if (!user) {
    user = await db.user.create({ data: { email: b.email, marketingOk: true, referralCode: randomBytes(5).toString("hex").slice(0, 7).toUpperCase() } });
  } else if (!user.marketingOk) {
    user = await db.user.update({ where: { id: user.id }, data: { marketingOk: true } });
  }
  await db.consent.create({ data: { userId: user.id, type: "MARKETING", docVersion: DOC_VERSION, granted: true, userAgent: req.headers.get("user-agent")?.slice(0, 300) } });
  await db.notificationPref.upsert({
    where: { userId_channel: { userId: user.id, channel: "email" } },
    update: { marketing: true },
    create: { userId: user.id, channel: "email", address: b.email, marketing: true },
  });
  return json({ ok: true, code: nl.code });
}
