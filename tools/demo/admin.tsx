// Админка демо-стенда. На сайте она открывается по отдельному адресу со входом по коду и 2FA, данные — из базы;
// здесь — те же разделы и графики (src/components/charts) по хранилищу демо. До сегодняшнего дня графики
// дополнены примерными данными, чтобы было на что смотреть; сегодня — ваши действия в этом окне.
import Link from "next/link";
import { useState } from "react";
import { SideNav } from "../../src/components/SideNav";
import { BarChart, ColumnChart, Funnel, Gauge, LineChart, Progress } from "../../src/components/charts";
import { AUDIENCE_RU, CHART_FUNNEL, dailySeries, dayLabel, groupSum, npdProgress, saleSource, STATUS_ORDER, topWithOther } from "../../src/lib/dashboard";
import { npdForecast } from "../../src/lib/npd";
import { ORDER_STATUS } from "../../src/lib/labels";
import { ruDate } from "../../src/lib/pricing";
import { METHOD_TITLES } from "../../src/lib/shipping";
import { ADDONS, FORMATS } from "../../src/lib/catalog-defaults";
import { audiencesLabel } from "../../src/lib/addons-core";
import { DEFAULTS, getReadiness } from "../../src/lib/settings";
import { addPromo, bookById, confirmTransfer, mskDay, orderById, pageUrl, resetLimits, S, setLimits, setPrices, setSoon, setStatus, spentTodayRub, STATUS_FLOW, togglePromo } from "./api";
import { AUDIENCE_PAGES } from "../../src/lib/storefront";
import { SHELF } from "../../src/lib/shelf";
import { NotFoundError } from "./router";
import { normalizeName } from "../../src/lib/names";

const NAV = [
  { href: "/admin", label: "Главная" },
  { href: "/admin/dashboard", label: "Дашборд" },
  { href: "/admin/zakazy", label: "Заказы" },
  { href: "/admin/perevody", label: "Переводы" },
  { href: "/admin/promokody", label: "Промокоды" },
  { href: "/admin/prazdniki", label: "Праздники" },
  { href: "/admin/katalog", label: "Каталог и цены" },
  { href: "/admin/nastrojki", label: "Настройки" },
  { href: "/admin/zhurnal", label: "Журнал" },
];

export function AdminLayout({ children }: { children: unknown }) {
  return (
    <>
      <div className="admin-top">
        <div className="wrap">
          <span>Админка · owner@bookimi.demo · владелец</span>
          <Link href="/">На сайт</Link>
        </div>
      </div>
      <div className="demo-banner">Демо: админка открыта прямо здесь, без входа. На сайте админка открывается по отдельному адресу со входом по коду и 2FA.</div>
      <div className="wrap cab">
        <SideNav items={NAV} />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}

const fmt = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const DAY = 86400_000;
const paidStatus = (s: string) => !["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED", "REFUNDED"].includes(s);

// ───────── данные для графиков ─────────
interface Row {
  at: number;
  created: number;
  total: number;
  who: string;
  source: string;
  audience: string;
  status: string;
  addons: number;
}
/** Примерные данные за прошлые 29 дней (детерминированные) — только для графиков. */
function history(): { rows: Row[]; costs: { at: number; rub: number }[]; funnel: Record<string, number>; income: number } {
  const rows: Row[] = [];
  const costs: { at: number; rub: number }[] = [];
  const funnel: Record<string, number> = { quiz_step: 0, text_ready: 0, preview_ready: 0, pay: 0 };
  const now = Date.now();
  for (let i = 29; i >= 1; i--) {
    const at = now - i * DAY;
    const n = [1, 2, 0, 3, 1, 2, 4, 2, 1, 3][i % 10] + (i < 8 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const total = [990, 2990, 3990, 990, 4490, 3480, 5490][(i * 3 + k) % 7];
      rows.push({
        at,
        created: at,
        total,
        who: total === 990 ? "self" : "bookimi",
        source: ["прямые и поиск", "vk", "telegram", "блогер: mama_chitaet", "приведи друга", "yandex"][(i + k) % 6],
        audience: ["Дети", "Дети", "Подростки", "Взрослые", "Питомцы"][(i * 2 + k) % 5],
        status: total === 990 ? "PAID" : i > 12 ? "DELIVERED" : i > 6 ? "SHIPPED" : i > 3 ? "PACKED" : "IN_PRINT",
        addons: total === 3480 ? 490 : 0,
      });
    }
    costs.push({ at, rub: i === 6 ? 3320 : 700 + ((i * 37) % 11) * 170 });
    funnel.quiz_step += 14 + ((i * 7) % 9);
    funnel.text_ready += 11 + ((i * 5) % 7);
    funnel.preview_ready += 5 + ((i * 3) % 4);
    funnel.pay += n;
  }
  return { rows, costs, funnel, income: 412_300 + rows.reduce((s, r) => s + r.total, 0) };
}

function realRows(): Row[] {
  return S.orders.map((o) => {
    const b = bookById(o.bookId);
    return {
      at: o.paidAt ?? 0,
      created: o.createdAt,
      total: o.totalRub,
      who: o.whoPrints,
      source: saleSource(null, o.promo ? { source: "manual", blogger: null, code: o.promo } : null),
      audience: AUDIENCE_RU[b?.params.audience ?? ""] ?? "Не указано",
      status: o.status,
      addons: o.items.filter((i) => i.kind === "addon").reduce((s, i) => s + i.priceRub, 0),
    };
  });
}

function data() {
  const h = history();
  const real = realRows();
  const all = [...h.rows, ...real];
  const paid = all.filter((r) => r.at && paidStatus(r.status));
  const since30 = Date.now() - 30 * DAY;
  const p30 = paid.filter((r) => r.at >= since30);
  const revenue30 = p30.reduce((s, r) => s + r.total, 0);
  const costs = [...h.costs, ...S.costs];
  const funnel = CHART_FUNNEL.map(([name, label]) => ({ label, n: h.funnel[name] + S.events.filter((e) => e.name === name).length }));
  const income = h.income + real.filter((r) => r.at && paidStatus(r.status)).reduce((s, r) => s + r.total, 0);
  const limit = DEFAULTS.tax.npdYearLimitRub;
  const spend = dailySeries(costs.map((c) => ({ at: new Date(c.at), value: c.rub })), 30).map((d) => ({ ...d, value: Math.round(d.value) }));
  return {
    real,
    revenue: dailySeries(paid.map((r) => ({ at: new Date(r.at), value: r.total })), 30),
    revenue14: dailySeries(paid.map((r) => ({ at: new Date(r.at), value: r.total })), 14),
    money: {
      revenue: revenue30,
      orders: p30.length,
      avg: p30.length ? Math.round(revenue30 / p30.length) : 0,
      pdfShare: p30.length ? p30.filter((r) => r.who === "self").length / p30.length : 0,
      addonsShare: revenue30 ? p30.reduce((s, r) => s + r.addons, 0) / revenue30 : 0,
    },
    byStatus: STATUS_ORDER.map((s) => ({ status: s, n: all.filter((r) => r.status === s).length })).filter((r) => r.n > 0),
    funnel,
    spend,
    npd: { income, limit, forecastDate: npdForecast(income, limit), ...npdProgress(income, limit) },
    sources: topWithOther(groupSum(p30, (r) => r.source, (r) => r.total)),
    audiences: groupSum(p30, (r) => r.audience, (r) => r.total),
  };
}

const DemoDataNote = () => <p className="small muted demo-note">Демо: до сегодняшнего дня — примерные данные, сегодня — ваши действия в этом окне.</p>;

// ───────── /admin ─────────
export async function AdminHome() {
  const readiness = await getReadiness();
  return <AdminHomeView readiness={readiness} />;
}
function AdminHomeView({ readiness }: { readiness: Awaited<ReturnType<typeof getReadiness>> }) {
  const d = data();
  const transfers = S.orders.filter((o) => o.status === "AWAITING_CONFIRMATION").length;
  const queue = S.books.filter((b) => ["TEXT_QUEUED", "PREVIEW_QUEUED", "FULL_QUEUED"].includes(b.status)).length;
  const today = S.orders.filter((o) => o.paidAt && mskDay(new Date(o.paidAt)) === mskDay()).length;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Главная</h1>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Готовность к продажам</h2>
        <ul className="checklist">
          {readiness.map((r) => (
            <li key={r.key} className={r.ok ? "is-ok" : ""}>
              <span className="dot" />
              <span>
                <b>{r.label}</b>
                {!r.ok && <> — <span className="muted">{r.disabled}.</span></>}
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: "8px 0 0" }}>Демо: реквизиты, оплата и приём фото заполнены как в scripts/seed-demo.ts — с пометкой «демо».</p>
      </section>
      <div className="kpis">
        <Link href="/admin/perevody" className="kpi" style={{ textDecoration: "none", color: "inherit" }}><small>Переводы на подтверждении</small><b>{transfers}</b></Link>
        <div className="kpi"><small>Очередь подготовки книг</small><b>{queue}</b></div>
        <div className="kpi"><small>Обращения</small><b>0</b></div>
        <div className="kpi"><small>Отзывы на модерации</small><b>0</b></div>
        <div className="kpi"><small>Оплат сегодня</small><b>{today}</b></div>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <LineChart title="Выручка, 14 дней" unit="₽" height={140} points={d.revenue14.map((r) => ({ label: dayLabel(r.day), value: r.value }))} />
          <p className="small" style={{ margin: "10px 0 0" }}><Link href="/admin/dashboard">Все графики →</Link></p>
        </section>
        <section className="panel" style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <Progress title="Расходы на подготовку книг сегодня" value={spentTodayRub()} max={DEFAULTS.limits.dailySpendRub} />
          <Gauge title="Лимит НПД" value={d.npd.income} max={d.npd.limit} forecast={d.npd.yearEnd} note={d.npd.forecastDate ? <>Темп: лимит будет достигнут {ruDate(d.npd.forecastDate)}.</> : null} />
        </section>
      </div>
      <DemoDataNote />
    </>
  );
}

// ───────── /admin/dashboard ─────────
export function AdminDashboard() {
  const d = data();
  const spendPanel = (
    <section className="panel">
      <ColumnChart title="Расходы на сервисы по дням" sub="30 дней" unit="₽" bars={d.spend.map((s) => ({ label: dayLabel(s.day), value: s.value }))} limit={{ value: DEFAULTS.limits.dailySpendRub, label: "Суточный лимит" }} />
    </section>
  );
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Дашборд</h1>
      <DemoDataNote />
      <h2 style={{ fontSize: "var(--fs-lg)" }}>Деньги</h2>
      <div className="kpis">
        <div className="kpi"><small>Выручка</small><b>{fmt(d.money.revenue)}</b><small className="muted">30 дней</small></div>
        <div className="kpi"><small>Заказы</small><b>{d.money.orders}</b></div>
        <div className="kpi"><small>Средний чек</small><b>{fmt(d.money.avg)}</b></div>
        <div className="kpi"><small>Доля PDF / печати</small><b>{pct(d.money.pdfShare)} / {pct(1 - d.money.pdfShare)}</b></div>
        <div className="kpi"><small>Доля допов в выручке</small><b>{pct(d.money.addonsShare)}</b></div>
        <div className="kpi"><small>Возвраты</small><b>{fmt(0)}</b></div>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <LineChart title="Выручка по дням, 30 дней" unit="₽" points={d.revenue.map((r) => ({ label: dayLabel(r.day), value: r.value }))} />
        </section>
        <section className="panel">
          <Gauge
            title="Лимит НПД за год"
            value={d.npd.income}
            max={d.npd.limit}
            forecast={d.npd.yearEnd}
            note={d.npd.forecastDate ? <>При текущем темпе лимит будет достигнут <b>{ruDate(d.npd.forecastDate)}</b>.</> : "При текущем темпе в этом году лимит не будет достигнут."}
          />
        </section>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <Funnel title="Воронка: квиз → сказка → превью → оплата" steps={d.funnel} />
        </section>
        <section className="panel">
          <BarChart title="Заказы по статусам" sub="созданы за 30 дн." bars={d.byStatus.map((s) => ({ label: ORDER_STATUS[s.status] ?? s.status, value: s.n }))} />
        </section>
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <section className="panel">
          <BarChart title="Продажи по источникам" sub="UTM и промокоды блогеров" unit="₽" bars={d.sources.map((s) => ({ label: s.key, value: s.sum, note: `${s.n} зак.` }))} empty="Пока нет оплат" />
        </section>
        <section className="panel">
          <BarChart title="Продажи по аудиториям" sub="по сюжету книги" unit="₽" bars={d.audiences.map((a) => ({ label: a.key, value: a.sum, note: `${a.n} кн.` }))} empty="Пока нет оплат" />
        </section>
      </div>
      <div style={{ marginTop: 16 }}>{spendPanel}</div>
    </>
  );
}

// ───────── заказы ─────────
export function AdminOrders() {
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказы</h1>
      {S.orders.length === 0 ? (
        <p className="muted">Заказов пока нет — оформите книгу на сайте (вкладка «Сайт»).</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Заказ</th><th>Покупатель</th><th>Печать</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {S.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/zakazy/${o.id}`}><b>{o.publicCode}</b></Link><br /><small className="muted">{new Date(o.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></td>
                  <td>{normalizeName(o.contactName ?? "") || o.contactEmail}</td>
                  <td>{o.whoPrints === "self" ? "PDF" : "БУКИМИ"}</td>
                  <td className="num">{fmt(o.totalRub)}</td>
                  <td><span className={`badge ${o.status === "AWAITING_CONFIRMATION" ? "badge--gold" : ""}`}>{ORDER_STATUS[o.status]}</span>{o.shipment?.trackNumber && <><br /><small>трек {o.shipment.trackNumber}</small></>}</td>
                  <td><OrderQuick id={o.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Быстрые действия в списке: подтвердить перевод или следующий этап. */
function OrderQuick({ id }: { id: string }) {
  const o = orderById(id)!;
  if (o.status === "AWAITING_CONFIRMATION" || o.status === "PENDING_PAYMENT")
    return o.status === "AWAITING_CONFIRMATION" ? <button className="btn btn--primary btn--sm" data-demo="confirm" onClick={() => confirmTransfer(id)}>Деньги пришли</button> : <span className="small muted">ждёт оплаты</span>;
  if (o.whoPrints !== "bookimi" || o.status === "DELIVERED") return <span className="small muted">—</span>;
  const i = STATUS_FLOW.indexOf(o.status);
  const next = STATUS_FLOW[Math.min(STATUS_FLOW.length - 1, i + 1)];
  return (
    <button
      className="btn btn--ghost btn--sm"
      data-demo="next-status"
      onClick={() => setStatus(id, next, next === "SHIPPED" && !o.shipment?.trackNumber ? `CDEK${String(Date.now()).slice(-8)}` : undefined)}
    >
      → {ORDER_STATUS[next]}
    </button>
  );
}

export function AdminOrder({ id }: { id: string }) {
  const o = orderById(id);
  if (!o) throw new NotFoundError();
  const b = bookById(o.bookId);
  const addr = o.shipment?.address;
  return (
    <>
      <p className="small"><Link href="/admin/zakazy">← Заказы</Link></p>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказ {o.publicCode} <span className="badge">{ORDER_STATUS[o.status]}</span></h1>
      <div className="grid2">
        <section className="panel">
          <b>Состав</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              {o.items.map((i, k) => <tr key={k}><td>{i.title}</td><td>{i.priceRub} ₽</td></tr>)}
              {o.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td>−{o.pdfCreditRub} ₽</td></tr>}
              {o.discountRub > 0 && <tr><td>Скидка {o.promo ? `(${o.promo})` : ""}</td><td>−{o.discountRub} ₽</td></tr>}
              <tr><td>Доставка</td><td>{o.shippingRub} ₽</td></tr>
              <tr><td><b>Итого</b></td><td><b>{o.totalRub} ₽</b></td></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <b>Покупатель и доставка</b>
          <p className="small">{normalizeName(o.contactName ?? "")}<br />{o.contactPhone} · {o.contactEmail}</p>
          {o.shipment && (
            <p className="small">
              {METHOD_TITLES[o.shipment.method as keyof typeof METHOD_TITLES]}
              {addr && <><br />{[addr.postalCode, addr.city, addr.street, addr.pvzCode && `ПВЗ ${addr.pvzCode}`].filter(Boolean).join(", ")}</>}
              {o.shipment.trackNumber && <><br />Трек: <b>{o.shipment.trackNumber}</b></>}
            </p>
          )}
        </section>
      </div>
      <OrderActions id={id} />
      {b && (
        <section className="panel" style={{ marginTop: 16 }}>
          <b>Книга</b> <span className="badge">{b.status}</span> <Link className="small" href={`/zakaz/${o.id}`}>заказ глазами покупателя</Link>
          <div className="cards admin-pages" style={{ marginTop: 10 }}>
            {b.pages.slice(0, 4).map((i) => <img key={i} className="preview-img" src={pageUrl(b, i)} alt="" />)}
          </div>
        </section>
      )}
    </>
  );
}

function OrderActions({ id }: { id: string }) {
  const o = orderById(id)!;
  const [status, setSt] = useState(o.status);
  const [track, setTrack] = useState(o.shipment?.trackNumber ?? "");
  const [msg, setMsg] = useState("");
  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <b>Действия</b>
      <div className="row" style={{ marginTop: 10 }}>
        {(o.status === "AWAITING_CONFIRMATION" || o.status === "PENDING_PAYMENT") && (
          <button className="btn btn--primary btn--sm" data-demo="confirm" onClick={() => { confirmTransfer(id); setSt("PAID"); }}>Подтвердить оплату ({o.totalRub} ₽, код {o.publicCode})</button>
        )}
        {o.whoPrints === "bookimi" && o.status === "PAID" && (
          <button className="btn btn--primary btn--sm" data-demo="to-print" onClick={() => { setStatus(id, "IN_PRINT"); setSt("IN_PRINT"); setMsg("Файлы отправлены в типографию (в демо — запись в журнал)."); }}>Передать в печать</button>
        )}
      </div>
      {o.whoPrints === "bookimi" && !["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED", "REFUNDED"].includes(o.status) && (
        <form
          className="row"
          style={{ marginTop: 10 }}
          onSubmit={(e: Event) => {
            e.preventDefault();
            if (status === "SHIPPED" && !track.trim()) return setMsg("Укажите трек-номер при передаче в доставку.");
            setStatus(id, status, track.trim() || undefined);
            setMsg(`Сохранено: ${ORDER_STATUS[status]}. Покупатель видит новый этап в пути заказа.`);
          }}
        >
          <select className="select" name="status" value={status} style={{ width: "auto" }} onChange={(e: Event) => setSt((e.target as HTMLSelectElement).value)}>
            {STATUS_FLOW.map((s) => <option key={s} value={s}>{ORDER_STATUS[s]}</option>)}
          </select>
          <input className="input" name="track" placeholder="Трек-номер (при передаче в доставку)" value={track} onChange={(e: Event) => setTrack((e.target as HTMLInputElement).value)} style={{ width: 260, maxWidth: "100%" }} />
          <button className="btn btn--ghost btn--sm" data-demo="save-status">Сохранить статус</button>
        </form>
      )}
      {msg && <p className="ok small">{msg}</p>}
    </section>
  );
}

export function AdminTransfers() {
  const orders = S.orders.filter((o) => (o.status === "AWAITING_CONFIRMATION" || o.status === "PENDING_PAYMENT") && o.payMethod === "transfer");
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Переводы на подтверждении</h1>
      <p className="muted">Сверьте сумму и код заказа в комментарии к переводу в банке. После подтверждения — чек НПД и запуск заказа.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Код (комментарий)</th><th>Сумма</th><th>Покупатель</th><th>Статус</th><th>Ждёт с</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/zakazy/${o.id}`}><b>{o.publicCode}</b></Link></td>
                <td><b>{o.totalRub.toLocaleString("ru-RU")} ₽</b></td>
                <td>{normalizeName(o.contactName ?? "") || o.contactEmail}</td>
                <td>{o.status === "AWAITING_CONFIRMATION" ? <span className="badge badge--gold">нажал «Я оплатил»</span> : "ещё не отметил"}</td>
                <td>{new Date(o.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
                <td><button className="btn btn--primary btn--sm" data-demo="confirm" onClick={() => confirmTransfer(o.id)}>Деньги пришли</button></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">Нет переводов на подтверждении</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────── промокоды ─────────
export function AdminPromos() {
  const [f, setF] = useState({ code: "", pct: "", rub: "", max: "" });
  const [msg, setMsg] = useState("");
  const val = (k: keyof typeof f) => (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Промокоды</h1>
      <form
        className="panel row"
        onSubmit={(e: Event) => {
          e.preventDefault();
          const code = f.code.trim().toUpperCase();
          const p = Number(f.pct) || null;
          const r = Number(f.rub) || null;
          if (!/^[A-Z0-9А-ЯЁ_-]{3,30}$/i.test(code)) return setMsg("Код — от 3 символов, буквы и цифры");
          if (S.promos.some((x) => x.code === code)) return setMsg("Такой код уже есть");
          if (!p && !r) return setMsg("Укажите % скидки или сумму в рублях");
          if (p && (p < 1 || p > 90)) return setMsg("Скидка — от 1 до 90%");
          addPromo({ code, percentOff: p, amountOffRub: r, maxUses: Number(f.max) || null });
          setF({ code: "", pct: "", rub: "", max: "" });
          setMsg(`Промокод ${code} создан — попробуйте его при оформлении.`);
        }}
      >
        <input className="input" name="code" placeholder="КОД" value={f.code} onChange={val("code")} style={{ width: 150 }} />
        <input className="input" name="percentOff" type="number" placeholder="% скидки" value={f.pct} onChange={val("pct")} style={{ width: 110 }} />
        <input className="input" name="amountOffRub" type="number" placeholder="или ₽" value={f.rub} onChange={val("rub")} style={{ width: 100 }} />
        <input className="input" name="maxUses" type="number" placeholder="Лимит" value={f.max} onChange={val("max")} style={{ width: 90 }} />
        <button className="btn btn--primary btn--sm" data-demo="add-promo">Создать</button>
      </form>
      {msg && <p className="small ok">{msg}</p>}
      <div className="tbl-wrap" style={{ marginTop: 12 }}>
        <table className="tbl">
          <thead><tr><th>Код</th><th>Скидка</th><th>Использован</th><th>Источник</th><th></th></tr></thead>
          <tbody>
            {S.promos.map((p) => (
              <tr key={p.code}>
                <td><b>{p.code}</b></td>
                <td>{p.percentOff ? `−${p.percentOff}%` : `−${p.amountOffRub} ₽`}</td>
                <td>{p.usedCount}{p.maxUses ? ` из ${p.maxUses}` : ""}</td>
                <td>{p.source}</td>
                <td><button className="btn btn--ghost btn--sm" onClick={() => togglePromo(p.code)}>{p.isActive ? "Выключить" : "Включить"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────── цены ─────────
export function AdminCatalog() {
  const items = [...FORMATS.map((f) => ({ key: f.key, title: f.title, price: f.price as number })), ...ADDONS.filter((a) => a.price !== null).map((a) => ({ key: a.key, title: `${a.title} · ${audiencesLabel(a.audiences)}${a.active ? "" : " (выкл.: другой подрядчик)"}`, price: a.price as number }))];
  const [p, setP] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.key, String(i.price)])));
  const [msg, setMsg] = useState("");
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Каталог и цены</h1>
      <p className="muted">Цены форматов и допов. Новая цена сразу применяется на витрине и при оформлении.</p>
      <form
        className="panel"
        onSubmit={(e: Event) => {
          e.preventDefault();
          const out: Record<string, number> = {};
          for (const i of items) out[i.key] = Math.max(0, Math.round(Number(p[i.key]) || 0));
          setPrices(out);
          setMsg("Сохранено: новые цены уже на сайте и в оформлении.");
        }}
      >
        <div className="grid3 price-grid">
          {items.map((i) => (
            <label key={i.key} className="field">
              <span>{i.title}</span>
              <input className="input" type="number" min="0" name={`price-${i.key}`} value={p[i.key]} onChange={(e: Event) => setP({ ...p, [i.key]: (e.target as HTMLInputElement).value })} />
            </label>
          ))}
        </div>
        <button className="btn btn--primary btn--sm" data-demo="save-prices">Сохранить цены</button>
        {msg && <p className="ok small">{msg}</p>}
      </form>
    </>
  );
}

// ───────── лимиты ─────────
const LIMIT_FIELDS: [keyof typeof DEFAULTS.limits, string][] = [
  ["dailySpendRub", "Лимит расходов на подготовку книг в сутки, ₽"],
  ["previewsPerContact", "Превью в сутки на один контакт"],
  ["textsPerDevice", "Сказок в сутки с одного устройства"],
  ["rewrites", "Бесплатных «Переписать»"],
  ["freeRedraws", "Бесплатных перерисовок после покупки"],
  ["moodChangesPreview", "Смен настроения превью до оплаты"],
  ["redrawPriceRub", "Цена перерисовки сверх лимита, ₽"],
  ["staffDailySpendRub", "Сотрудники: лимит расходов на сервисы текста и иллюстраций в сутки, ₽ (лимиты покупателя на них не действуют)"],
];
export function AdminSettings() {
  const [l, setL] = useState<Record<string, string>>(() => Object.fromEntries(LIMIT_FIELDS.map(([k]) => [k, String(DEFAULTS.limits[k])])));
  const [msg, setMsg] = useState("");
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Настройки</h1>
      <form
        className="panel"
        onSubmit={(e: Event) => {
          e.preventDefault();
          const out: Record<string, number> = {};
          for (const [k] of LIMIT_FIELDS) out[k] = Math.max(0, Math.round(Number(l[k]) || 0));
          setLimits(out);
          setMsg("Лимиты сохранены. Превью, ждавшие из-за лимита расходов, уже рисуются.");
        }}
      >
        <h2 style={{ fontSize: "var(--fs-lg)" }} id="limits">Лимиты</h2>
        <div className="grid3">
          {LIMIT_FIELDS.map(([k, label]) => (
            <label key={k} className="field">
              <span>{label}</span>
              <input className="input" type="number" min="0" name={`limit-${k}`} value={l[k]} onChange={(e: Event) => setL({ ...l, [k]: (e.target as HTMLInputElement).value })} />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn btn--primary btn--sm" data-demo="save-limits">Сохранить лимиты</button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            data-demo="admin-reset-limits"
            onClick={() => {
              resetLimits();
              setL(Object.fromEntries(LIMIT_FIELDS.map(([k]) => [k, String(DEFAULTS.limits[k])])));
              setMsg("Лимиты сброшены к демо-значениям (по 999), счётчики за сегодня обнулены.");
            }}
          >
            Сбросить лимиты
          </button>
        </div>
        {msg && <p className="ok small">{msg}</p>}
      </form>
      <SoonSettings />
      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Сейчас в демо</h2>
        <ul className="small">
          <li>Оплата: СБП по QR (тестовый) и перевод по номеру телефона — подтверждается в разделе «Переводы».</li>
          <li>Тексты — заготовленные развороты сюжетов (как демо-режим сайта без сервиса текста), иллюстрации — демо-SVG без GPU.</li>
          <li>Письма и СМС не отправляются — они пишутся в «Журнал».</li>
          <li>Сегодня потрачено на подготовку книг (оценка): {spentTodayRub()} ₽ из {DEFAULTS.limits.dailySpendRub} ₽.</li>
        </ul>
      </section>
    </>
  );
}

/** «Скоро» (storefront.soon) — как раздел настроек сайта: галочка снята — аудитория и книга полки работают как обычно. */
function SoonSettings() {
  const soon = DEFAULTS.storefront.soon;
  const [msg, setMsg] = useState("");
  const toggle = (path: string, on: boolean) => {
    const next = structuredClone(soon);
    if (path.startsWith("shelf.")) next.shelf[path.slice(6)] = on;
    else (next as unknown as Record<string, boolean>)[path] = on;
    setSoon(next);
    setMsg("Сохранено — меню, полка на главной и страницы аудиторий уже обновились.");
  };
  return (
    <section className="panel" style={{ marginTop: 16 }} id="storefront" data-demo="soon-settings">
      <h2 style={{ fontSize: "var(--fs-lg)" }}>«Скоро»: что ещё не продаётся</h2>
      <p className="small muted">Значок «скоро» в меню и на полке главной; ссылка ведёт к примерам с плашкой, кнопки «Создать» там выключены. Почту не собираем.</p>
      <div className="grid3">
        {AUDIENCE_PAGES.map((a) => (
          <label key={a.key} className="check">
            <input type="checkbox" name={`soon-${a.key}`} checked={Boolean(soon[a.key])} onChange={(e: Event) => toggle(a.key, (e.target as HTMLInputElement).checked)} />
            <span>{a.menu}: скоро</span>
          </label>
        ))}
      </div>
      <div className="grid3">
        {SHELF.map((it) => (
          <label key={it.id} className="check">
            <input type="checkbox" name={`soon-shelf-${it.id}`} checked={Boolean(soon.shelf[it.id])} onChange={(e: Event) => toggle(`shelf.${it.id}`, (e.target as HTMLInputElement).checked)} />
            <span>Полка: {it.coverLead ? `${it.coverLead} ${it.title}` : it.title}</span>
          </label>
        ))}
      </div>
      <button type="button" className="btn btn--ghost btn--sm" data-demo="soon-reset" onClick={() => { setSoon(undefined); setMsg("Сброшено: все разделы открыты."); }}>Сбросить</button>
      {msg && <p className="ok small">{msg}</p>}
    </section>
  );
}

export function AdminJournal() {
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Журнал</h1>
      <p className="muted">Действия покупателя, уведомления и алерты владельцу — всё, что в этом окне сделал «сайт».</p>
      {S.log.length ? (
        <ul className="log small">
          {S.log.map((l, i) => (
            <li key={i}><span className="muted">{new Date(l.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span> — {l.text}</li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Пока пусто.</p>
      )}
    </>
  );
}
