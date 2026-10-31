// Полукруглая шкала (лимит НПД с прогнозом) и горизонтальный индикатор прогресса (расход на сервисы за сегодня).
import { useId } from "react";
import "./charts.css";
import { fmtNum, fmtShort } from "./scale";

type Level = "ok" | "warn" | "bad";
export const levelOf = (pct: number, warn = 80, bad = 95): Level => (pct >= bad ? "bad" : pct >= warn ? "warn" : "ok");
const LEVEL_TEXT: Record<Level, string> = { ok: "В норме", warn: "Внимание", bad: "Критично" };

// Дуга от 180° до 0° (слева направо по верху), центр (100,100), радиус 80
const R = 80;
const pt = (f: number) => {
  const a = Math.PI * (1 - Math.min(1, Math.max(0, f)));
  return [100 + R * Math.cos(a), 100 - R * Math.sin(a)] as const;
};
const arc = (f0: number, f1: number) => {
  const [x0, y0] = pt(f0);
  const [x1, y1] = pt(f1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};

export function Gauge({
  title,
  value,
  max,
  unit = "₽",
  forecast,
  note,
  thresholds = [80, 95],
}: {
  title: string;
  value: number;
  max: number;
  unit?: string;
  forecast?: number; // прогноз на конец периода (рисуется пунктиром поверх)
  note?: React.ReactNode;
  thresholds?: [number, number];
}) {
  const id = useId();
  const f = max ? value / max : 0;
  const p = Math.round(f * 1000) / 10;
  const level = levelOf(p, ...thresholds);
  const ff = forecast != null && max ? forecast / max : null;
  return (
    <figure className="chart gauge" aria-labelledby={`${id}t`}>
      <span className="chart__title" id={`${id}t`}>{title}</span>
      <svg viewBox="-14 -6 228 118" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${fmtNum(value, unit)} из ${fmtNum(max, unit)}, ${p.toLocaleString("ru-RU")}%`}>
        <title>{`${title}: ${fmtNum(value, unit)} из ${fmtNum(max, unit)} (${p.toLocaleString("ru-RU")}%)${forecast != null ? `; прогноз на конец года — ${fmtNum(forecast, unit)}` : ""}`}</title>
        <path className="track" d={arc(0, 1)} />
        {ff != null && ff > f && <path className="fc" d={arc(f, Math.min(1, ff))} />}
        {f > 0 && <path className={`val is-${level}`} d={arc(0, Math.max(f, 0.005))} />}
        {thresholds.map((t) => {
          const [xa, ya] = pt(t / 100);
          const a = Math.PI * (1 - t / 100);
          return (
            <g key={t}>
              <line className="tick" x1={xa - 9 * Math.cos(a)} y1={ya + 9 * Math.sin(a)} x2={xa + 11 * Math.cos(a)} y2={ya - 11 * Math.sin(a)} />
              <text className="tick-label" x={xa + 23 * Math.cos(a)} y={ya - 23 * Math.sin(a) + 3} textAnchor="middle">{t}%</text>
            </g>
          );
        })}
      </svg>
      <div className="gauge__big">{p.toLocaleString("ru-RU")}%</div>
      <div className="gauge__note">{fmtShort(value, unit)} из {fmtShort(max, unit)}</div>
      <div className={`gauge__state is-${level}`}>{LEVEL_TEXT[level]}</div>
      {(note || forecast != null) && (
        <div className="chart__legend" style={{ justifyContent: "center" }}>
          {forecast != null && <span><i className="is-fc" />прогноз на 31 декабря: {fmtShort(forecast, unit)}</span>}
        </div>
      )}
      {note && <p className="gauge__note" style={{ marginTop: 6 }}>{note}</p>}
    </figure>
  );
}

export function Progress({ title, value, max, unit = "₽", thresholds = [80, 100] }: { title: string; value: number; max: number; unit?: string; thresholds?: [number, number] }) {
  const p = max ? (value / max) * 100 : 0;
  const level = levelOf(p, ...thresholds);
  return (
    <div className="chart meter">
      <div className="meter__row">
        <span className="chart__title">{title}</span>
        <span><b>{fmtNum(value, unit)}</b> <span className="chart__sub">из {fmtNum(max, unit)}</span></span>
      </div>
      <svg viewBox="0 0 100 12" preserveAspectRatio="none" role="meter" aria-label={title} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <title>{`${title}: ${fmtNum(value, unit)} из ${fmtNum(max, unit)} (${Math.round(p)}%)`}</title>
        <rect className="track" x={0} y={0} width={100} height={12} rx={3} />
        {p > 0 && <rect className={`fill is-${level}`} x={0} y={0} width={Math.min(100, Math.max(p, 1))} height={12} rx={3} />}
      </svg>
      {level !== "ok" && <p className={`gauge__state is-${level}`} style={{ margin: "4px 0 0" }}>{p >= 100 ? "Лимит на сегодня исчерпан" : "Близко к лимиту"}</p>}
    </div>
  );
}
