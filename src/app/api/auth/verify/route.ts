import { z } from "zod";
import { cookies } from "next/headers";
import { anonId, normalizeTarget, verifyOtp } from "@/lib/auth";
import { attachAnonConsents, hasConsent } from "@/lib/consent";
import { body, deviceKey, err, json, throttle } from "@/lib/api";
import { subjectHash } from "@/lib/crypto";
import { db } from "@/lib/db";
import { DOC_VERSION } from "@/lib/legal";
import { normalizePhone } from "@/lib/quiz";

export async function POST(req: Request) {
  const t = await throttle("otp-verify", 10, 60_000);
  if (t) return t;
  const b = await body(
    req,
    z.object({
      target: z.string().min(5).max(120).optional(),
      email: z.string().trim().min(5).max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      code: z.string().min(4).max(8),
      consentPd: z.boolean().optional(),
      /** Необязательная отдельная галочка «новости и скидки» — только на входе. */
      marketing: z.boolean().optional(),
    }),
  );
  if (!b || !(b.email || b.target)) return err("Введите код");
  // Согласие на обработку ПДн — один раз: если уже дано (с этого устройства или в аккаунте), повторно не требуем.
  // Проверяем до кода, чтобы не «сжечь» его. Сотрудникам согласие покупателя не нужно.
  const anon = await anonId();
  const t0 = normalizeTarget(b.email || b.target!);
  const existing = t0 ? await db.user.findUnique({ where: t0.kind === "email" ? { email: t0.value } : { phone: t0.value }, select: { id: true, role: true } }) : null;
  const pdGiven = await hasConsent("PERSONAL_DATA", { userId: existing?.id, anonId: anon });
  if (!b.consentPd && !pdGiven && !(existing && existing.role !== "CUSTOMER")) {
    return err("Отметьте согласие на обработку персональных данных");
  }
  const ref = (await cookies()).get("bk_ref")?.value;
  const r = await verifyOtp(b.email || b.target!, b.code, { referral: ref, device: subjectHash(await deviceKey()) });
  if (!r.ok) return err(r.error);
  // Телефон из формы входа — в профиль (если он ещё ни за кем не закреплён)
  const phone = b.phone ? normalizePhone(b.phone) : null;
  if (phone && r.user.phone !== phone) {
    const owner = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (!owner) r.user = await db.user.update({ where: { id: r.user.id }, data: { phone } });
  }
  await attachAnonConsents(r.user.id, anon);
  if (b.consentPd && !pdGiven) {
    await db.consent.create({ data: { userId: r.user.id, type: "PERSONAL_DATA", docVersion: DOC_VERSION, granted: true, userAgent: req.headers.get("user-agent")?.slice(0, 300) } });
  }
  if (b.marketing) {
    r.user = await db.user.update({ where: { id: r.user.id }, data: { marketingOk: true } });
    await db.consent.create({ data: { userId: r.user.id, type: "MARKETING", docVersion: DOC_VERSION, granted: true } });
  }
  // Канал уведомлений по умолчанию — тот, через который вошли
  if (r.user.email) {
    await db.notificationPref.upsert({
      where: { userId_channel: { userId: r.user.id, channel: "email" } },
      update: b.marketing ? { marketing: true } : {},
      create: { userId: r.user.id, channel: "email", address: r.user.email, marketing: r.user.marketingOk },
    });
  }
  return json({ ok: true, role: r.user.role });
}
