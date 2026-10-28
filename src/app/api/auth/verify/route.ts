import { z } from "zod";
import { cookies } from "next/headers";
import { verifyOtp } from "@/lib/auth";
import { body, deviceKey, err, json, throttle } from "@/lib/api";
import { subjectHash } from "@/lib/crypto";
import { db } from "@/lib/db";
import { DOC_VERSION } from "@/lib/legal";

export async function POST(req: Request) {
  const t = await throttle("otp-verify", 10, 60_000);
  if (t) return t;
  const b = await body(req, z.object({ target: z.string().min(5).max(120), code: z.string().min(4).max(8), consentPd: z.boolean().optional() }));
  if (!b) return err("Введите код");
  const ref = (await cookies()).get("bk_ref")?.value;
  const r = await verifyOtp(b.target, b.code, { referral: ref, device: subjectHash(await deviceKey()) });
  if (!r.ok) return err(r.error);
  if (b.consentPd) {
    await db.consent.create({ data: { userId: r.user.id, type: "PERSONAL_DATA", docVersion: DOC_VERSION, granted: true } });
  }
  // Канал уведомлений по умолчанию — тот, через который вошли
  if (r.user.email) {
    await db.notificationPref.upsert({
      where: { userId_channel: { userId: r.user.id, channel: "email" } },
      update: {},
      create: { userId: r.user.id, channel: "email", address: r.user.email, marketing: r.user.marketingOk },
    });
  }
  return json({ ok: true, role: r.user.role });
}
