// Столбцы и полосы.
//  BarChart    — горизонтальные полосы по категориям (статусы, источники, аудитории): подписи читаются на телефоне.
//  ColumnChart — вертикальные столбцы по дням, с линией лимита (расходы на ИИ против суточного лимита).
import { useId } from "react";
import "./charts.css";
import { fmtNum, fmtShort, niceMax, ticks } from "./scale";

export interface Bar {
  label: string;
  value: number;
  note?: string; // доп. подпись справа от значения (например, выручка или доля)
  hint?: string;
}

export function BarChart({ title, sub, bars, unit = "", empty = "Пока нет данных за этот период" }: { title: string; sub?: string; bars: Bar[]; unit?: string; empty?: string }) {
  const id = useId();
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="chart" aria-labelledby={`${id}t`}>
      <div className="chart__head">
        <span className="chart__title" id={`${id}t`}>{title}</span>
        {sub && <span className="chart__sub">{sub}</span>}
      </div>
      {bars.length === 0 || bars.every((b) => b.value === 0) ? (
        <p className="chart__empty">{empty}</p>
      ) : (
        <ul className="hbars" role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {bars.map((b) => {
            const w = (b.value / max) * 100;
            const text = `${b.hint ?? b.label}: ${fmtNum(b.value, unit)}${b.note ? ` (${b.note})` : ""}`;
            return (
              <li key={b.label} className="hbars__row" aria-label={text}>
                <span className="hbars__label" title={b.label}>{b.label}</span>
                <svg viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
                  <title>{text}</title>
                  <rect className="track" x={0} y={2} width={100} height={10} rx={2} />
                  {b.value > 0 && <rect className="fill" x={0} y={2} width={Math.max(w, 0.8)} height={10} rx={2} />}
                </svg>
                <span className="hbars__val">{fmtNum(b.value, unit)}{b.note && <small>{b.note}</small>}</span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

const W = 1000;
const H = 100;

export function ColumnChart({
  title,
  sub,
  bars,
  unit = "",
  limit,
  height = 170,
  xLabels = 5,
}: {
  title: string;
  sub?: string;
  bars: Bar[];
  unit?: string;
  limit?: { value: number; label: string };
  height?: number;
  xLabels?: number;
}) {
  const id = useId();
  const n = bars.length;
  const max = niceMax(Math.max(0, limit?.value ?? 0, ...bars.map((b) => b.value)) * 1.05);
  const y = (v: number) => H - (v / max) * H;
  const slot = n ? W / n : W;
  const gap = Math.min(slot * 0.28, 14);
  const over = limit ? bars.filter((b) => b.value > limit.value).length : 0;
  const step = Math.max(1, Math.ceil(n / xLabels));
  const empty = !n || bars.every((b) => b.value === 0);
  return (
    <figure className="chart" aria-labelledby={`${id}t`}>
      <div className="chart__head">
        <span className="chart__title" id={`${id}t`}>{title}</span>
        {sub && <span className="chart__sub">{sub}</span>}
      </div>
      {empty && !limit ? (
        <p className="chart__empty">Пока нет данных за этот период</p>
      ) : (
        <>
          <div className="chart__plot" style={{ height }}>
            {ticks(max).map((t) => (
              <span key={t} className="chart__y" style={{ top: `${(y(t) / H) * 100}%` }} aria-hidden="true">{fmtShort(t)}</span>
            ))}
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}.${limit ? ` ${limit.label}: ${fmtNum(limit.value, unit)}. Дней выше лимита: ${over}.` : ""}`}>
              {ticks(max).slice(1).map((t) => <line key={t} className="grid" x1={0} x2={W} y1={y(t)} y2={y(t)} />)}
              {bars.map((b, i) => {
                const isOver = limit ? b.value > limit.value : false;
                const h = H - y(b.value);
                return (
                  <g key={i}>
                    {b.value > 0 && <rect className={`col${isOver ? " is-over" : ""}`} x={i * slot + gap / 2} width={slot - gap} y={y(b.value)} height={Math.max(h, 0.6)} />}
                    <rect className="hit" x={i * slot} width={slot} y={0} height={H}>
                      <title>{`${b.hint ?? b.label}: ${fmtNum(b.value, unit)}${isOver ? " — выше лимита" : ""}`}</title>
                    </rect>
                  </g>
                );
              })}
              {limit && <line className="limit" x1={0} x2={W} y1={y(limit.value)} y2={y(limit.value)} />}
              <line className="base" x1={0} x2={W} y1={H} y2={H} />
            </svg>
            {limit && <span className="chart__tag" style={{ top: `${(y(limit.value) / H) * 100}%` }} aria-hidden="true">{limit.label}: {fmtNum(limit.value, unit)}</span>}
          </div>
          <div className="chart__x" aria-hidden="true">
            {bars.map((b, i) => (i % step === 0 || i === n - 1) && (n - 1 - i >= step / 2 || i === n - 1) ? <span key={i} style={{ left: `${((i + 0.5) * slot / W) * 100}%`, transform: "translateX(-50%)" }}>{b.label}</span> : null)}
          </div>
          {limit && (
            <div className="chart__legend">
              <span><i />расход за день</span>
              <span><i className="is-limit" />{limit.label.toLowerCase()}</span>
              {over > 0 && <span><i className="is-bad" />выше лимита: {over} дн.</span>}
            </div>
          )}
          <table className="chart-sr">
            <caption>{title}</caption>
            <tbody>{bars.map((b, i) => <tr key={i}><th scope="row">{b.hint ?? b.label}</th><td>{fmtNum(b.value, unit)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </figure>
  );
}
