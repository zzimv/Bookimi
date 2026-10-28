import { db } from "./db";
import { subjectHash } from "./crypto";

/** Дата по Москве в формате YYYY-MM-DD — сутки для лимитов считаются по МСК. */
export function mskDay(d = new Date()) {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Суточный счётчик в БД. Возвращает true, если действие разрешено (и засчитано).
 * Используется для превью, сказок, кодов входа, перерисовок.
 */
export async function hit(subject: string, kind: string, max: number): Promise<boolean> {
  const day = mskDay();
  const s = subjectHash(subject);
  const row = await db.generationLimit.upsert({
    where: { subject_kind_day: { subject: s, kind, day } },
    update: { count: { increment: 1 } },
    create: { subject: s, kind, day, count: 1 },
  });
  if (row.count > max) {
    await db.generationLimit.update({ where: { id: row.id }, data: { count: { decrement: 1 } } });
    return false;
  }
  return true;
}

export async function used(subject: string, kind: string) {
  const row = await db.generationLimit.findUnique({
    where: { subject_kind_day: { subject: subjectHash(subject), kind, day: mskDay() } },
  });
  return row?.count ?? 0;
}

// ── Ограничение частоты запросов в памяти (один web-контейнер) ──
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.n++;
  return b.n <= max;
}

/** Расходы на генерацию за сегодня (МСК), ₽. */
export async function spentTodayRub() {
  const from = new Date(`${mskDay()}T00:00:00+03:00`);
  const r = await db.generationCost.aggregate({ where: { createdAt: { gte: from } }, _sum: { costKopecks: true } });
  return Math.round((r._sum.costKopecks ?? 0) / 100);
}
