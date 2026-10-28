import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getReadiness } from "@/lib/settings";
import { incomeThisYear } from "@/lib/npd";
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
  const pct = Math.min(100, (income / tax.npdYearLimitRub) * 100);
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
        <div className="kpi"><small>Очередь генерации</small><b>{queue}</b></div>
        <Link href="/admin/podderzhka" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Обращения</small><b>{tickets}</b></Link>
        <Link href="/admin/otzyvy" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Отзывы на модерации</small><b>{reviews}</b></Link>
        <div className="kpi"><small>Оплат сегодня</small><b>{todayOrders}</b></div>
        <div className="kpi"><small>Генерация сегодня</small><b>{spent} ₽</b><small>из {limits.dailySpendRub} ₽</small></div>
      </div>
      {tax.regime === "npd" && (
        <section className="panel" style={{ marginTop: 16 }}>
          <b>Лимит НПД: {income.toLocaleString("ru-RU")} ₽ из {tax.npdYearLimitRub.toLocaleString("ru-RU")} ₽</b>
          <div className={`bar ${pct >= 95 ? "bar--bad" : pct >= 80 ? "bar--warn" : ""}`} style={{ marginTop: 8 }}><i style={{ width: `${pct}%` }} /></div>
        </section>
      )}
    </>
  );
}
