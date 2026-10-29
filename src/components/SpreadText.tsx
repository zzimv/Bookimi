// Текст разворота на экране: строки стихов, подписи комикса [..] — плашками, звуки ВЖЖЖ! — жирным.
// Разбор общий с PDF — src/lib/spread-markup.ts. Серверный и клиентский компонент (без хуков).
import { parseSpread } from "@/lib/spread-markup";

export function SpreadText({ text, className }: { text: string | null | undefined; className?: string }) {
  const lines = parseSpread(text);
  return (
    <span className={`sp-text${className ? ` ${className}` : ""}`}>
      {lines.map((l, i) =>
        l.kind === "gap" ? (
          <span key={i} className="sp-gap" aria-hidden="true" />
        ) : (
          <span key={i} className={l.kind === "caption" ? "sp-cap" : l.kind === "thought" ? "sp-thought" : "sp-line"}>
            {l.parts.map((p, j) => (p.t === "sound" ? <b key={j} className="sp-sound">{p.v}</b> : p.v))}
          </span>
        ),
      )}
    </span>
  );
}
