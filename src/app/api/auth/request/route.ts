import { z } from "zod";
import { normalizeTarget, requestOtp } from "@/lib/auth";
import { body, err, json, throttle } from "@/lib/api";
import { cfg } from "@/lib/settings";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/quiz";

// Вход по коду. Новый формат: { email, phone } — телефон обязателен (настройка auth.phoneRequired),
// код приходит на почту. Старый формат { target } (email или телефон) оставлен для совместимости.
const Input = z.object({
  target: z.string().max(120).optional(),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function POST(req: Request) {
  const t = await throttle("otp", 5, 60_000);
  if (t) return t;
  const b = await body(req, Input);
  if (!b) return err("Укажите почту и телефон");
  const raw = b.email || b.target || "";
  const target = normalizeTarget(raw);
  if (!target) return err(b.email !== undefined ? "Проверьте адрес почты" : "Укажите email или телефон");
  let phone: string | null = null;
  if (b.phone) {
    phone = normalizePhone(b.phone);
    if (!phone) return err("Укажите мобильный номер: +7 9XX XXX-XX-XX");
  }
  if (target.kind === "email") {
    const existing = await db.user.findUnique({ where: { email: target.value }, select: { id: true, role: true, phone: true } });
    // Телефон обязателен для покупателей; сотрудникам и тем, у кого он уже сохранён, — нет
    if ((await cfg("auth")).phoneRequired && !phone && !(existing && (existing.role !== "CUSTOMER" || existing.phone))) {
      return err("Укажите мобильный телефон — он нужен для связи по заказу");
    }
    if (phone) {
      const owner = await db.user.findUnique({ where: { phone }, select: { id: true } });
      if (owner && owner.id !== existing?.id) return err("Этот телефон уже привязан к другому аккаунту. Войдите с почтой того аккаунта или напишите в поддержку.");
    }
  }
  const r = await requestOtp(target.value);
  if (!r.ok) return err(r.error, 429);
  return json(r);
}
