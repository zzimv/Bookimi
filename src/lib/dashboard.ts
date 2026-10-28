// Метрики дашборда администратора. Деньги, лимит НПД, воронка, источники, «Приведи друга»,
// юнит-экономика, операции, скорость сайта.
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { incomeThisYear, npdForecast } from "./npd";
import { cfg } from "./settings";
import { spentTodayRub } from "./limits";

export interface Filters {
  days: number;
  source?: string;
  device?: string;
  story?: string;
  who?: string;
}

function range(days: number, shift = 0) {
  const to = new Date(Date.now() - shift * days * 86400_000);
  const from = new Date(to.getTime() - days * 86400_000);
  return { from, to };
}

async function money(f: Filters, shift: number) {
  const { from, to } = range(f.days, shift);
  const where: Prisma.OrderWhereInput = {
    paidAt: { gte: from, lt: to },
    ...(f.who ? { whoPrints: f.who } : {}),
    ...(f.source ? { utm: { path: ["utm_source"], equals: f.source } } : {}),
    ...(f.story ? { items: { some: { book: { story: { slug: f.story } } } } } : {}),
  };
  const orders = await db.order.findMany({ where, include: { items: true } });
  const ok = orders.filter((o) => o.status !== "REFUNDED" && o.status !== "CANCELLED");
  const revenue = ok.reduce((s, o) => s + o.totalRub, 0);
  const refunds = orders.filter((o) => o.status === "REFUNDED").reduce((s, o) => s + o.totalRub, 0);
  const pdf = ok.filter((o) => o.whoPrints === "self").length;
  const addonsRub = ok.flatMap((o) => o.items).filter((i) => i.kind === "addon").reduce((s, i) => s + i.priceRub, 0);
  return { revenue, orders: ok.length, avg: ok.length ? Math.round(revenue / ok.length) : 0, pdfShare: ok.length ? pdf / ok.length : 0, addonsShare: revenue ? addonsRub / revenue : 0, refunds };
}

export async function dashboard(f: Filters) {
  const [cur, prev] = await Promise.all([money(f, 0), money(f, 1)]);
  const { from } = range(f.days);

  const tax = await cfg("tax");
  const income = await incomeThisYear();
  const forecast = npdForecast(income, tax.npdYearLimitRub);

  // Воронка по шагам (уникальные посетители/книги)
  const evWhere = (name: string): Prisma.FunnelEventWhereInput => ({
    name,
    createdAt: { gte: from },
    ...(f.source ? { source: f.source } : {}),
    ...(f.device ? { device: f.device } : {}),
  });
  const steps: [string, string][] = [
    ["quiz_step", "Анкета заполнена"],
    ["text_ready", "Сказка сочинена"],
    ["text_approved", "Сказка одобрена"],
    ["photo_upload", "Фото загружено"],
    ["preview_ready", "Превью готово"],
    ["checkout", "Заказ оформлен"],
    ["pay", "Оплачено"],
  ];
  const funnel = await Promise.all(
    steps.map(async ([name, label]) => ({ label, n: (await db.funnelEvent.groupBy({ by: ["anonId", "userId"], where: evWhere(name) })).length })),
  );

  // Источники
  const paid = await db.order.findMany({ where: { paidAt: { gte: from } }, select: { utm: true, totalRub: true } });
  const sources = new Map<string, { orders: number; revenue: number }>();
  for (const o of paid) {
    const s = (o.utm as { utm_source?: string } | null)?.utm_source ?? "прямые и поиск";
    const v = sources.get(s) ?? { orders: 0, revenue: 0 };
    v.orders++;
    v.revenue += o.totalRub;
    sources.set(s, v);
  }

  // «Приведи друга»
  const [invited, refPaid, bonusIssued, bonusUsed] = await Promise.all([
    db.referral.count({ where: { createdAt: { gte: from } } }),
    db.referral.count({ where: { paidAt: { gte: from } } }),
    db.promoCode.count({ where: { source: "referral_bonus", validFrom: { gte: from } } }),
    db.promoCode.count({ where: { source: "referral_bonus", usedCount: { gt: 0 } } }),
  ]);

  // Юнит-экономика: себестоимость генерации, печати, доставки
  const gen = await db.generationCost.aggregate({ where: { createdAt: { gte: from } }, _sum: { costKopecks: true } });
  const ph = await db.printHouse.findFirst({ where: { isActive: true } });
  const printCosts = (ph?.costs ?? {}) as Record<string, number>;
  const printItems = await db.orderItem.findMany({ where: { order: { paidAt: { gte: from }, whoPrints: "bookimi" } }, select: { refKey: true } });
  const printCost = printItems.reduce((s, i) => s + (printCosts[i.refKey] ?? 0), 0);
  const ship = await db.order.aggregate({ where: { paidAt: { gte: from } }, _sum: { shippingRub: true } });
  const genRub = Math.round((gen._sum.costKopecks ?? 0) / 100);
  const margin = cur.revenue - genRub - printCost - (ship._sum.shippingRub ?? 0);

  // Операции
  const [genQueue, transfers, printDelays, reviews, tickets] = await Promise.all([
    db.book.count({ where: { status: { in: ["TEXT_QUEUED", "PREVIEW_QUEUED", "FULL_QUEUED"] } } }),
    db.order.count({ where: { status: "AWAITING_CONFIRMATION" } }),
    db.order.count({ where: { status: { in: ["PAID", "IN_PRINT"] }, whoPrints: "bookimi", readyDate: { lt: new Date() } } }),
    db.review.count({ where: { status: "pending" } }),
    db.supportTicket.count({ where: { status: "open" } }),
  ]);

  // Скорость сайта (RUM, p75)
  const vitals = await db.webVital.findMany({ where: { createdAt: { gte: from } }, select: { name: true, value: true } });
  const p75 = (name: string) => {
    const xs = vitals.filter((v) => v.name === name).map((v) => v.value).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length * 0.75)] : null;
  };

  // Расходы на генерацию по дням
  const costs = await db.generationCost.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true, costKopecks: true } });
  const byDay = new Map<string, number>();
  for (const c of costs) {
    const d = new Date(c.createdAt.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + c.costKopecks / 100);
  }

  return {
    cur,
    prev,
    npd: { income, limit: tax.npdYearLimitRub, forecast, regime: tax.regime },
    funnel,
    sources: [...sources.entries()].sort((a, b) => b[1].revenue - a[1].revenue),
    referral: { invited, refPaid, bonusIssued, bonusUsed },
    unit: { genRub, printCost, shipRub: ship._sum.shippingRub ?? 0, margin, perOrder: cur.orders ? Math.round(margin / cur.orders) : 0 },
    ops: { genQueue, transfers, printDelays, reviews, tickets, spentToday: await spentTodayRub(), dailyLimit: (await cfg("limits")).dailySpendRub },
    vitals: { LCP: p75("LCP"), INP: p75("INP"), CLS: p75("CLS"), TTFB: p75("TTFB"), n: vitals.length },
    costByDay: [...byDay.entries()].sort(),
  };
}

// ───────────── Графики дашборда ─────────────
// Чистые функции агрегации (покрыты тестами в tests/dashboard.test.ts) + выборка из БД.

const MSK = 3 * 3600_000;
const DAY = 86400_000;

/** Ключ дня по Москве: YYYY-MM-DD. */
export function mskDayKey(d: Date): string {
  return new Date(d.getTime() + MSK).toISOString().slice(0, 10);
}

const RU_MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
/** «2026-10-29» → «29 окт». */
export function dayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${RU_MON[m - 1]}`;
}

/**
 * Плотный ряд по дням (МСК): ровно `days` точек, последняя — сегодня, пропуски — нули.
 * Строки вне окна отбрасываются.
 */
export function dailySeries(rows: { at: Date; value: number }[], days: number, now = new Date()): { day: string; value: number }[] {
  const out: { day: string; value: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const day = mskDayKey(new Date(now.getTime() - i * DAY));
    idx.set(day, out.length);
    out.push({ day, value: 0 });
  }
  for (const r of rows) {
    const k = idx.get(mskDayKey(r.at));
    if (k != null) out[k].value += r.value;
  }
  return out;
}

/** Группировка с подсчётом и суммой, по убыванию суммы (затем количества). */
export function groupSum<T>(rows: T[], key: (r: T) => string, value: (r: T) => number = () => 0): { key: string; n: number; sum: number }[] {
  const m = new Map<string, { key: string; n: number; sum: number }>();
  for (const r of rows) {
    const k = key(r);
    const v = m.get(k) ?? { key: k, n: 0, sum: 0 };
    v.n++;
    v.sum += value(r);
    m.set(k, v);
  }
  return [...m.values()].sort((a, b) => b.sum - a.sum || b.n - a.n || a.key.localeCompare(b.key));
}

/** Свернуть хвост в «Другое», чтобы график не превращался в забор. */
export function topWithOther(groups: { key: string; n: number; sum: number }[], limit = 6, other = "Другое") {
  if (groups.length <= limit) return groups;
  const head = groups.slice(0, limit - 1);
  const tail = groups.slice(limit - 1);
  return [...head, { key: other, n: tail.reduce((s, g) => s + g.n, 0), sum: tail.reduce((s, g) => s + g.sum, 0) }];
}

/**
 * Источник продажи: промокод блогера важнее UTM (блогер мог дать код в сторис без ссылки),
 * затем utm_source, затем «Приведи друга» (реферальный промокод), иначе «прямые и поиск».
 */
export function saleSource(utm: unknown, promo?: { source: string; blogger: string | null; code: string } | null): string {
  if (promo?.source === "blogger") return `блогер: ${promo.blogger || promo.code}`;
  const s = (utm as { utm_source?: unknown } | null)?.utm_source;
  if (typeof s === "string" && s.trim()) return s.trim().toLowerCase();
  if (promo?.source?.startsWith("referral")) return "приведи друга";
  return "прямые и поиск";
}

/** Прогресс НПД: доля, уровень, прогноз дохода на 31 декабря при текущем темпе. */
export function npdProgress(income: number, limit: number, now = new Date()) {
  const y = Number(mskDayKey(now).slice(0, 4));
  const start = Date.parse(`${y}-01-01T00:00:00+03:00`);
  const end = Date.parse(`${y + 1}-01-01T00:00:00+03:00`);
  const elapsed = Math.max(1, (now.getTime() - start) / DAY);
  const yearDays = (end - start) / DAY;
  const pct = limit ? (income / limit) * 100 : 0;
  return {
    pct,
    level: (pct >= 95 ? "bad" : pct >= 80 ? "warn" : "ok") as "ok" | "warn" | "bad",
    yearEnd: Math.round((income / elapsed) * yearDays),
  };
}

export const STATUS_ORDER = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export const AUDIENCE_RU: Record<string, string> = { CHILD: "Дети", TEEN: "Подростки", ADULT: "Взрослые", PET: "Питомцы" };

/** Воронка для графика: квиз → сказка → превью → оплата (уникальные посетители). */
export const CHART_FUNNEL: [string, string][] = [
  ["quiz_step", "Квиз"],
  ["text_ready", "Сказка"],
  ["preview_ready", "Превью"],
  ["pay", "Оплата"],
];

const notVoid: Prisma.OrderWhereInput = { status: { notIn: ["REFUNDED", "CANCELLED"] } };

export async function dashboardCharts(f: Filters, now = new Date()) {
  const days = Math.min(Math.max(f.days, 7), 90);
  const from = new Date(now.getTime() - days * DAY);
  const series30From = new Date(now.getTime() - 30 * DAY);

  // Выручка по дням, 30 дней (оплаченные, без возвратов)
  const paid30 = await db.order.findMany({ where: { paidAt: { gte: series30From }, ...notVoid }, select: { paidAt: true, totalRub: true } });
  const revenue = dailySeries(paid30.map((o) => ({ at: o.paidAt!, value: o.totalRub })), 30, now);

  // Заказы по статусам за период (по дате создания)
  const byStatusRaw = await db.order.groupBy({ by: ["status"], where: { createdAt: { gte: from } }, _count: { _all: true } });
  const byStatus = STATUS_ORDER.map((s) => ({ status: s, n: byStatusRaw.find((r) => r.status === s)?._count._all ?? 0 })).filter((r) => r.n > 0);

  // Воронка
  const funnel = await Promise.all(
    CHART_FUNNEL.map(async ([name, label]) => ({
      label,
      n: (
        await db.funnelEvent.groupBy({
          by: ["anonId", "userId"],
          where: { name, createdAt: { gte: from }, ...(f.source ? { source: f.source } : {}), ...(f.device ? { device: f.device } : {}) },
        })
      ).length,
    })),
  );

  // Расходы ИИ по дням против суточного лимита (30 дней)
  const costs = await db.generationCost.findMany({ where: { createdAt: { gte: series30From } }, select: { createdAt: true, costKopecks: true } });
  const spend = dailySeries(costs.map((c) => ({ at: c.createdAt, value: c.costKopecks / 100 })), 30, now).map((d) => ({ ...d, value: Math.round(d.value) }));
  const dailyLimit = (await cfg("limits")).dailySpendRub;

  // НПД
  const tax = await cfg("tax");
  const income = await incomeThisYear();
  const npd = { income, limit: tax.npdYearLimitRub, regime: tax.regime, forecastDate: npdForecast(income, tax.npdYearLimitRub, now), ...npdProgress(income, tax.npdYearLimitRub, now) };

  // Продажи по источникам: UTM и промокоды блогеров
  const paidPeriod = await db.order.findMany({
    where: { paidAt: { gte: from }, ...notVoid },
    select: { utm: true, totalRub: true, promoCode: { select: { source: true, blogger: true, code: true } } },
  });
  const sources = topWithOther(groupSum(paidPeriod, (o) => saleSource(o.utm, o.promoCode), (o) => o.totalRub));

  // Продажи по аудиториям (сюжет книги → audience). Колонка может отсутствовать на старой базе — тогда null.
  let audiences: { key: string; n: number; sum: number }[] | null = null;
  try {
    const items = await db.orderItem.findMany({
      where: { kind: "format", order: { paidAt: { gte: from }, ...notVoid } },
      select: { priceRub: true, book: { select: { story: { select: { audience: true } } } } },
    });
    audiences = groupSum(items, (i) => AUDIENCE_RU[String(i.book?.story?.audience ?? "")] ?? "Не указано", (i) => i.priceRub);
  } catch (e) {
    console.error("[dashboard] audience:", (e as Error).message);
  }

  return { days, revenue, byStatus, funnel, spend, dailyLimit, npd, sources, audiences };
}
