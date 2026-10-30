import { NextResponse } from "next/server";
import { z } from "zod";
import "@/lib/zod-ru";
import { db, hasDatabase } from "@/lib/db";

const body = z.object({ value: z.enum(["necessary", "analytics"]) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (hasDatabase) {
    try {
      await db.consent.create({
        data: {
          type: "ANALYTICS_COOKIES",
          granted: parsed.data.value === "analytics",
          docVersion: "cookies-2026-10",
          userAgent: req.headers.get("user-agent")?.slice(0, 300),
        },
      });
    } catch {}
  }
  return NextResponse.json({ ok: true });
}
