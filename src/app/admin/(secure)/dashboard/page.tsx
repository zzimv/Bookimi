import { requireAdmin } from "@/lib/admin";
import { dashboard } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { ruDate } from "@/lib/pricing";

const fmt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <small className="muted">—</small>;
  const d = (cur - prev) / prev;
  return <small className={d >= 0 ? "up" : "down"}>{d >= 0 ? "+" : ""}{Math.round(d * 100)}% к прошлому</small>;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("dashboard");
  const sp = await searchParams;
  const days = Number(sp.p ?? 30) || 30;
  const d = await dashboard({ days, source: sp.source, device: sp.device, story: sp.story, who: sp.who });
  const stories = await db.story.findMany({ where: { isActive: true }, select: { slug: true, title: true } });
  const maxF = Math.max(1, ...d.funnel.map((x) => x.n));
  const npdPct = Math.min(100, (d.npd.income / d.npd.limit) * 100);
  const maxCost = Math.max(1, ...d.costByDay.map(([, v]) => v));
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Дашборд</h1>
      <form className="row" style={{ marginBottom: 16 }}>
        <select className="select" name="p" defaultValue={String(days)} style={{ width: "auto" }}>
          <option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="365">Год</option>
        </select>
        <input className="input" name="source" placeholder="Источник (utm_source)" defaultValue={sp.source} style={{ width: 180 }} />
        <select className="select" name="device" defaultValue={sp.device ?? ""} style={{ width: "auto" }}>
          <option value="">Все устройства</option><option value="mobile">Телефон</option><option value="desktop">Компьютер</option><option value="tablet">Планшет</option>
        </select>
        <select className="select" name="story" defaultValue={sp.story ?? ""} style={{ width: "auto" }}>
          <option value="">Все сюжеты</option>{stories.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
        </select>
        <select className="select" name="who" defaultValue={sp.who ?? ""} style={{ width: "auto" }}>
          <option value="">PDF и печать</option><option value="self">Только PDF</option><option value="bookimi">Только печать</option>
        </select>
        <button className="btn btn--ghost btn--sm">Показать</button>
      </form>

      <h2 style={{ fontSize: "var(--fs-lg)" }}>Деньги</h2>
      <div className="kpis">
        <div className="kpi"><small>Выручка</small><b>{fmt(d.cur.revenue)}</b><Delta cur={d.cur.revenue} prev={d.prev.revenue} /></div>
        <div className="kpi"><small>Заказы</small><b>{d.cur.orders}</b><Delta cur={d.cur.orders} prev={d.prev.orders} /></div>
        <div className="kpi"><small>Средний чек</small><b>{fmt(d.cur.avg)}</b><Delta cur={d.cur.avg} prev={d.prev.avg} /></div>
        <div className="kpi"><small>Доля PDF / печати</small><b>{pct(d.cur.pdfShare)} / {pct(1 - d.cur.pdfShare)}</b></div>
        <div className="kpi"><small>Доля допов в выручке</small><b>{pct(d.cur.addonsShare)}</b></div>
        <div className="kpi"><small>Возвраты</small><b>{fmt(d.cur.refunds)}</b></div>
      </div>

      {d.npd.regime === "npd" && (
        <section className="panel" style={{ marginTop: 16 }}>
          <b>Лимит НПД</b>
          <p className="small" style={{ margin: "4px 0 8px" }}>Доход с 1 января — {fmt(d.npd.income)} из {fmt(d.npd.limit)}. {d.npd.forecast ? <>При текущем темпе лимит будет достигнут <b>{ruDate(d.npd.forecast)}</b>.</> : "В этом году лимит не будет достигнут при текущем темпе."}</p>
          <div className={`bar ${npdPct >= 95 ? "bar--bad" : npdPct >= 80 ? "bar--warn" : ""}`}><i style={{ width: `${npdPct}%` }} /></div>
        </section>
      )}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Воронка</h2>
      <div className="panel funnel">
        {d.funnel.map((f, i) => (
          <div key={f.label}>
            <span>{f.label}</span>
            <div className="bar"><i style={{ width: `${(f.n / maxF) * 100}%` }} /></div>
            <span>{f.n}{i > 0 && d.funnel[i - 1].n ? ` · ${Math.round((f.n / d.funnel[i - 1].n) * 100)}%` : ""}</span>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <b>Источники</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <thead><tr><th>Источник</th><th>Заказы</th><th>Выручка</th></tr></thead>
            <tbody>{d.sources.length ? d.sources.map(([s, v]) => <tr key={s}><td>{s}</td><td>{v.orders}</td><td>{fmt(v.revenue)}</td></tr>) : <tr><td colSpan={3} className="muted">Пока нет оплат</td></tr>}</tbody>
          </table>
        </section>
        <section className="panel">
          <b>Приведи друга</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Пришли по ссылкам</td><td>{d.referral.invited}</td></tr>
              <tr><td>Оплатили</td><td>{d.referral.refPaid}</td></tr>
              <tr><td>Выдано промокодов</td><td>{d.referral.bonusIssued}</td></tr>
              <tr><td>Использовано</td><td>{d.referral.bonusUsed}</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <b>Юнит-экономика</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Генерация (ИИ, GPU)</td><td>{fmt(d.unit.genRub)}</td></tr>
              <tr><td>Печать (себестоимость из настроек типографии)</td><td>{fmt(d.unit.printCost)}</td></tr>
              <tr><td>Доставка</td><td>{fmt(d.unit.shipRub)}</td></tr>
              <tr><td><b>Маржа</b></td><td><b>{fmt(d.unit.margin)}</b></td></tr>
              <tr><td>Маржа на заказ</td><td>{fmt(d.unit.perOrder)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <b>Операции</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Очередь генерации</td><td>{d.ops.genQueue}</td></tr>
              <tr><td>Переводы на подтверждении</td><td>{d.ops.transfers}</td></tr>
              <tr><td>Задержки печати</td><td>{d.ops.printDelays}</td></tr>
              <tr><td>Отзывы на модерации</td><td>{d.ops.reviews}</td></tr>
              <tr><td>Открытые обращения</td><td>{d.ops.tickets}</td></tr>
              <tr><td>Генерация сегодня</td><td>{d.ops.spentToday} ₽ из {d.ops.dailyLimit} ₽</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <b>Скорость сайта (p75, реальные пользователи)</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>LCP (цель &lt; 2,5 с)</td><td>{d.vitals.LCP != null ? `${(d.vitals.LCP / 1000).toFixed(2)} с` : "—"}</td></tr>
              <tr><td>INP (цель &lt; 200 мс)</td><td>{d.vitals.INP != null ? `${Math.round(d.vitals.INP)} мс` : "—"}</td></tr>
              <tr><td>CLS (цель &lt; 0,1)</td><td>{d.vitals.CLS != null ? d.vitals.CLS.toFixed(3) : "—"}</td></tr>
              <tr><td>Ответ сервера (цель &lt; 500 мс)</td><td>{d.vitals.TTFB != null ? `${Math.round(d.vitals.TTFB)} мс` : "—"}</td></tr>
            </tbody>
          </table>
          <small className="muted">Замеров: {d.vitals.n}</small>
        </section>
        <section className="panel">
          <b>Расходы на генерацию по дням</b>
          <div className="funnel" style={{ marginTop: 8 }}>
            {d.costByDay.length ? d.costByDay.slice(-14).map(([day, v]) => (
              <div key={day}><span>{day.slice(5)}</span><div className="bar"><i style={{ width: `${(v / maxCost) * 100}%` }} /></div><span>{Math.round(v)} ₽</span></div>
            )) : <p className="small muted">Пока нет расходов</p>}
          </div>
        </section>
      </div>
    </>
  );
}
