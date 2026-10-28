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
