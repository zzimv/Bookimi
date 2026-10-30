import { z } from "zod";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/limits";
import { clientIp } from "@/lib/auth";

// RUM: Core Web Vitals из браузеров → дашборд «Скорость сайта».
export async function POST(req: Request) {
  if (!rateLimit(`vitals:${await clientIp()}`, 30, 60_000)) return new Response(null, { status: 204 });
  const r = z
    .object({ name: z.enum(["LCP", "INP", "CLS", "TTFB", "FCP"]), value: z.number().min(0).max(120000), page: z.string().max(120), device: z.string().max(20).optional() })
    .safeParse(await req.json().catch(() => null));
  if (r.success) await db.webVital.create({ data: r.data }).catch(() => {});
  return new Response(null, { status: 204 });
}
