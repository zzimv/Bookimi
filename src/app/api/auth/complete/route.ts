import { z } from "zod";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/quiz";
import { checkFirstName, FIRST_NAME_ERROR } from "@/lib/first-name";
import { anonId } from "@/lib/auth";
import { grantConsents, hasConsent } from "@/lib/consent";
import { DOC_VERSION } from "@/lib/legal";

// После входа через VK ID / Яндекс / Mail.ru / Google: телефон (если обязателен и его не дал провайдер),
// «Как к вам обращаться» и согласие на ПДн — одним шагом.
export async function POST(req: Request) {
  const t = await throttle("auth-complete", 10, 60_000);
  if (t) return t;
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  const b = await body(req, z.object({ phone: z.string().trim().max(30).optional(), firstName: z.string().max(60).optional(), consentPd: z.boolean().optional() }));
  if (!b) return err("Проверьте поля");
  const data: { phone?: string; firstName?: string | null } = {};
  if (b.phone) {
    const phone = normalizePhone(b.phone);
    if (!phone) return err("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    const owner = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (owner && owner.id !== user.id) return err("Этот телефон уже привязан к другому аккаунту. Войдите с почтой того аккаунта или напишите в поддержку.");
    data.phone = phone;
  } else if (!user.phone) return err("Укажите мобильный телефон — он нужен для связи по заказу");
  const fn = checkFirstName(b.firstName);
  if (fn === false) return err(FIRST_NAME_ERROR);
  if (fn) data.firstName = fn;
  if (!(await hasConsent("PERSONAL_DATA", { userId: user.id, anonId: await anonId() }))) {
    if (!b.consentPd) return err("Отметьте согласие на обработку персональных данных");
    await grantConsents({ userId: user.id }, { pd: true }, { docVersion: DOC_VERSION, userAgent: req.headers.get("user-agent") ?? undefined });
  }
  if (Object.keys(data).length) await db.user.update({ where: { id: user.id }, data });
  return json({ ok: true, role: user.role });
}
