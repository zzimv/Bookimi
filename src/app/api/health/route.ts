import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Мониторинг и CI: проверяет БД и очередь pg-boss.
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = { db: "fail", queue: "fail" };
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = "ok";
    const rows = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pgboss.version`;
    if (rows[0]?.n >= 0) checks.queue = "ok";
  } catch {
    /* статус ниже */
  }
  const ok = checks.db === "ok" && checks.queue === "ok";
  return NextResponse.json({ status: ok ? "ok" : "degraded", checks }, { status: ok ? 200 : 503 });
}
