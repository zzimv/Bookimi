import { z } from "zod";
import { requestOtp } from "@/lib/auth";
import { body, err, json, throttle } from "@/lib/api";

export async function POST(req: Request) {
  const t = await throttle("otp", 5, 60_000);
  if (t) return t;
  const b = await body(req, z.object({ target: z.string().min(5).max(120) }));
  if (!b) return err("Укажите email или телефон");
  const r = await requestOtp(b.target);
  if (!r.ok) return err(r.error, 429);
  return json(r);
}
