import { requireAdmin } from "@/lib/admin";
import { dashboard, dashboardCharts, dayLabel } from "@/lib/dashboard";
import { BarChart, ColumnChart, Funnel, Gauge, LineChart, Progress } from "@/components/charts";
import { ORDER_STATUS } from "@/lib/labels";
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
  const filters = { days, source: sp.source, device: sp.device, story: sp.story, who: sp.who };
  const [d, c] = await Promise.all([dashboard(filters), dashboardCharts(filters)]);
  const stories = await db.story.findMany({ where: { isActive: true }, select: { slug: true, title: true } });
  const maxF = Math.max(1, ...d.funnel.map((x) => x.n));
  const spendPanel = (
    <section className="panel">
      <ColumnChart
        title="Расходы на ИИ по дням"
        sub="30 дней"
        unit="₽"
        bars={c.spend.map((s, i) => ({ label: dayLabel(s.day), value: s.value, extra: c.staffSpend[i]?.value ?? 0 }))}
        limit={{ value: c.dailyLimit, label: "Суточный лимит" }}
        extraLabel={`тесты сотрудников (свой лимит ${c.staffDailyLimit} ₽)`}
      />
    </section>
  );
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

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <LineChart
            title="Выручка по дням, 30 дней"
            unit="₽"
            points={c.revenue.map((r) => ({ label: dayLabel(r.day), value: r.value }))}
          />
        </section>
        {c.npd.regime === "npd" ? (
          <section className="panel">
            <Gauge
              title="Лимит НПД за год"
              value={c.npd.income}
              max={c.npd.limit}
              forecast={c.npd.yearEnd}
              note={c.npd.forecastDate ? <>При текущем темпе лимит будет достигнут <b>{ruDate(c.npd.forecastDate)}</b>.</> : "При текущем темпе в этом году лимит не будет достигнут."}
            />
          </section>
        ) : (
          spendPanel
        )}
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <Funnel title="Воронка: квиз → сказка → превью → оплата" steps={c.funnel} />
        </section>
        <section className="panel">
          <BarChart title="Заказы по статусам" sub={`созданы за ${c.days} дн.`} bars={c.byStatus.map((s) => ({ label: ORDER_STATUS[s.status] ?? s.status, value: s.n }))} />
        </section>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <BarChart
            title="Продажи по источникам"
            sub="UTM и промокоды блогеров"
            unit="₽"
            bars={c.sources.map((s) => ({ label: s.key, value: s.sum, note: `${s.n} зак.` }))}
            empty="Пока нет оплат"
          />
        </section>
        <section className="panel">
          {c.audiences ? (
            <BarChart title="Продажи по аудиториям" sub="по сюжету книги" unit="₽" bars={c.audiences.map((a) => ({ label: a.key, value: a.sum, note: `${a.n} кн.` }))} empty="Пока нет оплат" />
          ) : (
            <p className="small muted">Аудитории появятся после обновления базы (поле сюжета «аудитория»).</p>
          )}
        </section>
      </div>

      {c.npd.regime === "npd" && <div style={{ marginTop: 16 }}>{spendPanel}</div>}

      <details className="panel" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Воронка по всем шагам</summary>
        <div className="funnel" style={{ marginTop: 10 }}>
        {d.funnel.map((f, i) => (
          <div key={f.label}>
            <span>{f.label}</span>
            <div className="bar"><i style={{ width: `${(f.n / maxF) * 100}%` }} /></div>
            <span>{f.n}{i > 0 && d.funnel[i - 1].n ? ` · ${Math.round((f.n / d.funnel[i - 1].n) * 100)}%` : ""}</span>
          </div>
        ))}
        </div>
      </details>

      <div className="grid2" style={{ marginTop: 16 }}>
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
          <Progress title="Генерация сегодня" value={d.ops.spentToday} max={d.ops.dailyLimit} />
          <p className="small muted" style={{ marginTop: 8 }}>Расход за период: {fmt(d.unit.genRub)}. По дням — на графике выше.</p>
        </section>
      </div>
    </>
  );
}
