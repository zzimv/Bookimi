import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getReadiness } from "@/lib/settings";
import { incomeThisYear, npdForecast } from "@/lib/npd";
import { dailySeries, dayLabel, npdProgress } from "@/lib/dashboard";
import { Gauge, LineChart, Progress } from "@/components/charts";
import { ruDate } from "@/lib/pricing";
import { cfg } from "@/lib/settings";
import { spentTodayRub } from "@/lib/limits";

export default async function Page({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const u = await requireAdmin("dashboard");
  const sp = await searchParams;
  const readiness = u.role === "OWNER" ? await getReadiness() : [];
  const [transfers, queue, tickets, reviews, todayOrders] = await Promise.all([
    db.order.count({ where: { status: "AWAITING_CONFIRMATION" } }),
    db.book.count({ where: { status: { in: ["TEXT_QUEUED", "PREVIEW_QUEUED", "FULL_QUEUED"] } } }),
    db.supportTicket.count({ where: { status: "open" } }),
    db.review.count({ where: { status: "pending" } }),
    db.order.count({ where: { paidAt: { gte: new Date(new Date().toISOString().slice(0, 10)) } } }),
  ]);
  const tax = await cfg("tax");
  const income = await incomeThisYear();
  const limits = await cfg("limits");
  const spent = await spentTodayRub();
  const npd = npdProgress(income, tax.npdYearLimitRub);
  const npdDate = npdForecast(income, tax.npdYearLimitRub);
  const since14 = new Date(Date.now() - 14 * 86400_000);
  const paid14 = await db.order.findMany({ where: { paidAt: { gte: since14 }, status: { notIn: ["REFUNDED", "CANCELLED"] } }, select: { paidAt: true, totalRub: true } });
  const rev14 = dailySeries(paid14.map((o) => ({ at: o.paidAt!, value: o.totalRub })), 14);
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Главная</h1>
      {sp.denied && <p className="error">Этот раздел недоступен для вашей роли.</p>}
      {readiness.length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Готовность к продажам</h2>
          <ul className="checklist">
            {readiness.map((r) => (
              <li key={r.key} className={r.ok ? "is-ok" : ""}>
                <span className="dot" />
                <span>
                  <b>{r.label}</b>
                  {!r.ok && <> — <span className="muted">{r.disabled}.</span> <Link href={r.href}>Заполнить</Link></>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="kpis">
        <Link href="/admin/perevody" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Переводы на подтверждении</small><b>{transfers}</b></Link>
        <div className="kpi"><small>Очередь подготовки книг</small><b>{queue}</b></div>
        <Link href="/admin/podderzhka" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Обращения</small><b>{tickets}</b></Link>
        <Link href="/admin/otzyvy" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Отзывы на модерации</small><b>{reviews}</b></Link>
        <div className="kpi"><small>Оплат сегодня</small><b>{todayOrders}</b></div>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <LineChart title="Выручка, 14 дней" unit="₽" height={140} points={rev14.map((r) => ({ label: dayLabel(r.day), value: r.value }))} />
          <p className="small" style={{ margin: "10px 0 0" }}><Link href="/admin/dashboard">Все графики →</Link></p>
        </section>
        <section className="panel" style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <Progress title="Расходы на подготовку книг сегодня" value={spent} max={limits.dailySpendRub} />
          {tax.regime === "npd" && (
            <Gauge
              title="Лимит НПД"
              value={income}
              max={tax.npdYearLimitRub}
              forecast={npd.yearEnd}
              note={npdDate ? <>Темп: лимит будет достигнут {ruDate(npdDate)}.</> : null}
            />
          )}
        </section>
      </div>
    </>
  );
}
