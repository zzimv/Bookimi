// Линейный график одной серии (например, выручка по дням). Без JS: подсказки — <title> на колонках-мишенях.
import { useId } from "react";
import "./charts.css";
import { fmtNum, fmtShort, niceMax, ticks } from "./scale";

export interface Point {
  label: string; // подпись по оси X (короткая)
  value: number;
  hint?: string; // полная подпись для подсказки, по умолчанию label
}

const W = 1000;
const H = 100;

export function LineChart({ title, sub, points, unit = "", height = 180, xLabels = 5 }: { title: string; sub?: string; points: Point[]; unit?: string; height?: number; xLabels?: number }) {
  const id = useId();
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(2)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z` : "";
  const step = Math.max(1, Math.ceil(n / xLabels));
  const shown = points.map((p, i) => ({ p, i })).filter(({ i }) => i % step === 0 || i === n - 1).filter(({ i }, k, arr) => !(k === arr.length - 2 && n - 1 - i < step / 2));
  const last = points[n - 1];
  const empty = !n || points.every((p) => p.value === 0);

  return (
    <figure className="chart" aria-labelledby={`${id}t`}>
      <div className="chart__head">
        <span className="chart__title" id={`${id}t`}>{title}</span>
        <span className="chart__sub">{sub ?? `Всего: ${fmtNum(total, unit)}`}</span>
      </div>
      {empty ? (
        <p className="chart__empty">Пока нет данных за этот период</p>
      ) : (
        <>
          <div className="chart__plot" style={{ height }}>
            {ticks(max).map((t) => (
              <span key={t} className="chart__y" style={{ top: `${(y(t) / H) * 100}%` }} aria-hidden="true">{fmtShort(t)}</span>
            ))}
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}. ${sub ?? `Всего ${fmtNum(total, unit)}`}. Последнее значение: ${last.hint ?? last.label} — ${fmtNum(last.value, unit)}.`}>
              {ticks(max).slice(1).map((t) => <line key={t} className="grid" x1={0} x2={W} y1={y(t)} y2={y(t)} />)}
              <path className="area" d={area} />
              <path className="line" d={line} />
              <line className="base" x1={0} x2={W} y1={H} y2={H} />
              {points.map((p, i) => {
                const w = n <= 1 ? W : W / (n - 1);
                return (
                  <rect key={i} className="hit" x={Math.max(0, x(i) - w / 2)} width={Math.min(w, W)} y={0} height={H}>
                    <title>{`${p.hint ?? p.label}: ${fmtNum(p.value, unit)}`}</title>
                  </rect>
                );
              })}
            </svg>
            <span className="chart__dot" style={{ left: `${(x(n - 1) / W) * 100}%`, top: `${(y(last.value) / H) * 100}%` }} aria-hidden="true" />
            {last.value > 0 && <span className="chart__last" style={{ left: `${(x(n - 1) / W) * 100}%`, top: `${(y(last.value) / H) * 100}%` }} aria-hidden="true">{fmtNum(last.value, unit)}</span>}
          </div>
          <div className="chart__x" aria-hidden="true">
            {shown.map(({ p, i }) => <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>{p.label}</span>)}
          </div>
          <table className="chart-sr">
            <caption>{title}</caption>
            <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.hint ?? p.label}</th><td>{fmtNum(p.value, unit)}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </figure>
  );
}
