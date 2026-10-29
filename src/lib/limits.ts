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

/**
 * Подсеть клиента для суточных лимитов по IP: IPv4 — /24 («203.0.113.0/24»), IPv6 — /64.
 * Сброс cookie (новый deviceKey) не обходит лимит, а соседи по NAT делят один, более высокий, лимит.
 */
export function ipSubnet(ip: string): string {
  const v = ip.trim().replace(/^::ffff:/i, "");
  const v4 = v.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (v.includes(":")) {
    const groups = v.split("::")[0].split(":").filter(Boolean);
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return v || "unknown";
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

/**
 * Расходы на генерацию за сегодня (МСК), ₽. Покупательский лимит (limits.dailySpendRub) считает только книги
 * покупателей; тестовые книги сотрудников — отдельно (staff: true, лимит limits.staffDailySpendRub).
 */
export async function spentTodayRub(opts: { staff?: boolean } = {}) {
  const from = new Date(`${mskDay()}T00:00:00+03:00`);
  const r = await db.generationCost.aggregate({ where: { createdAt: { gte: from }, staff: Boolean(opts.staff) }, _sum: { costKopecks: true } });
  return Math.round((r._sum.costKopecks ?? 0) / 100);
}

/**
 * IP клиента из X-Forwarded-For: каждый прокси дописывает адрес справа, левые элементы может подделать клиент.
 * Берём самый правый адрес, пропуская доверенные прокси (trusted: «1.2.3.4,10.0.» — адреса или префиксы).
 * Без X-Forwarded-For — X-Real-IP.
 */
export function pickClientIp(xff: string | null | undefined, realIp?: string | null, trusted?: string | null): string {
  const list = (xff ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const proxies = (trusted ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const isTrusted = (ip: string) => proxies.some((p) => (p.endsWith(".") || p.endsWith(":") ? ip.startsWith(p) : ip === p));
  for (let i = list.length - 1; i >= 0; i--) {
    if (!isTrusted(list[i])) return list[i];
  }
  return (list[0] ?? realIp ?? "0.0.0.0").trim() || "0.0.0.0";
}
