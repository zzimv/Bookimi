"use client";
// Весёлый переход к оплате (rev 20): книга закрывается, её перевязывают лентой с бантом, вокруг вспыхивают звёзды,
// а внизу меняются строки «Упаковываем волшебство…», «Ещё чуть-чуть — и книга полетит в типографию».
// Короткий (≈1,4 с) и не мешает: переход случается сразу после анимации. «Уменьшить движение» — без анимации,
// только строка (и та же пауза не нужна — переходим сразу). Работает и в демо-стенде.
import { useEffect, useState } from "react";

export const PAY_LINES = ["Упаковываем волшебство…", "Перевязываем ленточкой…", "Ещё чуть-чуть — и книга полетит в типографию"];
export const PAY_LINES_PDF = ["Упаковываем волшебство…", "Складываем страницы в файл…", "Ещё чуть-чуть — и книга будет у вас"];

/** Длительность показа перед переходом (мс); при «уменьшить движение» — 0. */
export const PAY_TRANSITION_MS = 1400;

export function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Оверлей перехода к оплате. lines — строки по очереди; title — для экранного диктора. */
export function PayTransition({ lines = PAY_LINES, title }: { lines?: string[]; title?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setI((x) => Math.min(lines.length - 1, x + 1)), Math.round(PAY_TRANSITION_MS / lines.length));
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="paytr" role="status" aria-live="polite" data-pay-transition>
      <div className="paytr__card">
        <svg className="paytr__art" viewBox="0 0 200 150" aria-hidden="true">
          <g className="paytr__stars">
            {[[22, 30, 7], [176, 26, 9], [186, 96, 6], [14, 104, 8], [100, 10, 6], [150, 132, 5], [44, 136, 5]].map(([x, y, r], k) => (
              <path key={k} style={{ animationDelay: `${k * 0.11}s` }} transform={`translate(${x} ${y})`} d={`M0 ${-r}c${r * 0.25} ${r * 0.62} ${r * 0.38} ${r * 0.75} ${r} ${r}c${-r * 0.62} ${r * 0.25} ${-r * 0.75} ${r * 0.38} ${-r} ${r}c${-r * 0.25} ${-r * 0.62} ${-r * 0.38} ${-r * 0.75} ${-r} ${-r}c${r * 0.62} ${-r * 0.25} ${r * 0.75} ${-r * 0.38} ${r} ${-r}z`} />
            ))}
          </g>
          <g className="paytr__book">
            <rect x="52" y="34" width="96" height="84" rx="8" className="paytr__cover" />
            <rect x="60" y="42" width="80" height="68" rx="5" className="paytr__inner" />
            <path className="paytr__flap" d="M100 34 h48 a8 8 0 0 1 8 8 v68 a8 8 0 0 1 -8 8 h-48 z" />
          </g>
          <g className="paytr__ribbon">
            <rect x="94" y="30" width="12" height="92" rx="2" />
            <rect x="48" y="70" width="104" height="12" rx="2" />
            <path d="M100 74 c-18 -22 -36 -10 -26 2 c6 8 18 4 26 -2z M100 74 c18 -22 36 -10 26 2 c-6 8 -18 4 -26 -2z" />
            <circle cx="100" cy="75" r="6" />
          </g>
        </svg>
        <p className="paytr__line" data-pay-line>{lines[i]}</p>
        {title && <span className="sr-only">{title}</span>}
      </div>
    </div>
  );
}

/**
 * Запустить переход: показать оверлей, выполнить действие (запрос) и не раньше чем через PAY_TRANSITION_MS — go().
 * Ошибка — оверлей скрывается, ошибка уходит вызывающему.
 */
export function usePayTransition() {
  const [on, setOn] = useState<string[] | null>(null);
  async function run<T>(lines: string[], work: () => Promise<T>, go: (r: T) => void) {
    setOn(lines);
    const wait = reducedMotion() ? 0 : PAY_TRANSITION_MS;
    const t0 = Date.now();
    try {
      const r = await work();
      const left = Math.max(0, wait - (Date.now() - t0));
      setTimeout(() => go(r), left);
    } catch (e) {
      setOn(null);
      throw e;
    }
  }
  return { overlay: on ? <PayTransition lines={on} /> : null, run, active: Boolean(on) };
}
