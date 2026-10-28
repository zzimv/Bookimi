// Путь заказа: этапы с датами, текущий подсвечен, у него — слово от команды.
import "./journey.css";
import { journey, type JourneyOrder } from "./journey";

export function OrderTimeline({ order, compact = false }: { order: JourneyOrder; compact?: boolean }) {
  const j = journey(order);
  if (j.closed) return null;
  return (
    <ol className={`journey${compact ? " journey--compact" : ""}`} aria-label="Как идёт заказ">
      {j.stages.map((s) => (
        <li key={s.key} className={`journey__step is-${s.state}`} aria-current={s.state === "current" ? "step" : undefined}>
          <span className="journey__dot" aria-hidden="true">{s.state === "done" ? "✓" : ""}</span>
          <div className="journey__body">
            <div className="journey__head">
              <b>{s.title}</b>
              {s.when && <span className="journey__when">{s.when}</span>}
            </div>
            {s.message && <p className="journey__msg">{s.message}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
