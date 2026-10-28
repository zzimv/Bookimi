// Воронка: центрированные полосы, между шагами — конверсия из предыдущего шага.
import { useId } from "react";
import "./charts.css";
import { fmtNum } from "./scale";

export interface FunnelStep {
  label: string;
  n: number;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function Funnel({ title, sub, steps }: { title: string; sub?: string; steps: FunnelStep[] }) {
  const id = useId();
  const max = Math.max(1, ...steps.map((s) => s.n));
  const first = steps[0]?.n ?? 0;
  const lastN = steps[steps.length - 1]?.n ?? 0;
  return (
    <figure className="chart" aria-labelledby={`${id}t`}>
      <div className="chart__head">
        <span className="chart__title" id={`${id}t`}>{title}</span>
        <span className="chart__sub">{sub ?? `Сквозная конверсия: ${pct(lastN, first)}`}</span>
      </div>
      {first === 0 ? (
        <p className="chart__empty">Пока нет событий за этот период</p>
      ) : (
        <ol className="fnl" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((s, i) => {
            const w = Math.max((s.n / max) * 100, s.n ? 1.5 : 0);
            const text = `${s.label}: ${fmtNum(s.n)}${i ? `, ${pct(s.n, steps[i - 1].n)} от предыдущего шага` : ""}`;
            return (
              <li key={s.label}>
                {i > 0 && (
                  <div className="fnl__conv" aria-hidden="true">
                    <span />
                    <span>↓ {pct(s.n, steps[i - 1].n)}</span>
                    <span />
                  </div>
                )}
                <div className="fnl__row" aria-label={text}>
                  <span className="fnl__label">{s.label}</span>
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
                    <title>{text}</title>
                    <rect className="fill" x={(100 - w) / 2} width={w} y={2} height={26} rx={2} opacity={1 - i * 0.12} />
                  </svg>
                  <span className="fnl__n">{fmtNum(s.n)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
