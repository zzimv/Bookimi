import { requireAdmin } from "@/lib/admin";
import { ruleStats, TRIGGER_EVENTS } from "@/lib/triggers";
import { triggerAction, triggerTestAction } from "../../actions";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function RuleForm({ r }: { r?: Awaited<ReturnType<typeof ruleStats>>[number] }) {
  return (
    <form action={triggerAction}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid2">
        <label className="field"><span>Название</span><input className="input" name="name" defaultValue={r?.name} required /></label>
        <label className="field"><span>Событие</span>
          <select className="select" name="event" defaultValue={r?.event ?? "preview_abandoned"}>
            {Object.entries(TRIGGER_EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>Задержка, минут</span><input className="input" type="number" name="delayMinutes" defaultValue={r?.delayMinutes ?? 60} /></label>
        <label className="field"><span>Промокод, % (пусто — без промокода)</span><input className="input" type="number" name="promoPercent" defaultValue={r?.promoPercent ?? ""} /></label>
        <label className="field"><span>Контрольная группа, %</span><input className="input" type="number" name="controlPct" defaultValue={r?.controlPct ?? 10} /></label>
        <label className="check"><input type="checkbox" name="isActive" defaultChecked={r?.isActive ?? false} /> Правило включено</label>
      </div>
      <label className="field"><span>Текст. Подстановки: {"{name}"} {"{title}"} {"{link}"} {"{promo}"} {"{review}"} {"{ref}"}</span><textarea className="textarea" name="template" defaultValue={r?.template} required /></label>
      <button className="btn btn--primary btn--sm">Сохранить</button>
    </form>
  );
}

export default async function Page() {
  await requireAdmin("triggers");
  const rules = await ruleStats();
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Триггеры</h1>
      <p className="muted">Все сообщения — маркетинговые: уходят только тем, кто дал согласие на рассылку, не чаще одного в сутки, с отпиской в один клик. Если после рассылок правила растут отписки (больше 3% за сутки), правило выключается само.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Правило</th><th>Событие</th><th>Задержка</th><th>Сработало</th><th>Конверсия / контроль</th><th>Выручка</th><th></th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.isActive ? <span className="badge">вкл</span> : <span className="badge badge--gold">выкл</span>} {r.name}</td>
                <td className="small">{TRIGGER_EVENTS[r.event as keyof typeof TRIGGER_EVENTS] ?? r.event}</td>
                <td>{r.delayMinutes >= 60 ? `${Math.round(r.delayMinutes / 60)} ч` : `${r.delayMinutes} мин`}</td>
                <td>{r.sent} + {r.control} контроль</td>
                <td>{pct(r.convSent)} / {pct(r.convControl)}</td>
                <td>{r.revenue.toLocaleString("ru-RU")} ₽</td>
                <td><form action={triggerTestAction}><input type="hidden" name="id" value={r.id} /><button className="link-btn">Тест мне</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rules.map((r) => (
        <details key={r.id} className="panel edit"><summary>Изменить: {r.name}</summary><div style={{ marginTop: 12 }}><RuleForm r={r} /></div></details>
      ))}
      <details className="panel edit"><summary>Новое правило</summary><div style={{ marginTop: 12 }}><RuleForm /></div></details>
      <p className="small muted" style={{ marginTop: 12 }}>A/B-тесты страниц — в Varioqub (Яндекс), идентификатор задаётся в .env (VARIOQUB_ID).</p>
    </>
  );
}
