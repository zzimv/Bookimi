"use client";
// Выбор внешности картинками (rev 14): каждый вариант — маленький рисунок тем же демо-рисовальщиком, что и книга
// (/obrazec, портрет или крупно лицо), с этим вариантом поверх текущего выбора. Картинки кешируются по ссылке
// (браузер и демо-стенд). Доступность: ряд — radiogroup (или group для переключателей), каждый вариант — кнопка
// с aria-label («Рыжие волосы»), стрелки ←/→ переходят между вариантами, выбранный — рамка и галочка.
import type { KeyboardEvent } from "react";

export interface PicOption {
  key: string;
  /** Подпись для экранного диктора и подсказки: «Рыжие волосы». */
  label: string;
  /** Картинка варианта (/obrazec?…). */
  src: string;
}

/** Стрелки влево/вправо (и вверх/вниз) — к соседней кнопке ряда. */
function arrows(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(e.key)) return;
  // Ряд — по цели события (в демо-стенде обработчики делегированы, currentTarget — корень)
  const row = (e.target as HTMLElement).closest?.(".pic-row");
  if (!row) return;
  const btns = Array.from(row.querySelectorAll<HTMLButtonElement>("button[data-pic]"));
  const at = btns.indexOf(document.activeElement as HTMLButtonElement);
  if (at < 0) return;
  e.preventDefault();
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
  btns[(at + step + btns.length) % btns.length]?.focus();
}

/** Ряд картинок, из которых выбирают одну (повторный клик по выбранной — снять выбор, если allowEmpty). */
export function PicRow({ name, label, options, value, onChange, allowEmpty = false, size = "m", caps = false }: {
  name: string;
  label: string;
  options: PicOption[];
  value: string;
  onChange: (key: string) => void;
  allowEmpty?: boolean;
  size?: "s" | "m";
  /** Подпись под картинкой (rev 17: «Пониже», «Плотненький»). */
  caps?: boolean;
}) {
  return (
    <div className="pic-row-wrap" data-pic-row={name}>
      <span className="label" id={`pic-${name}`}>{label}</span>
      <div className={`pic-row pic-row--${size}`} role="radiogroup" aria-labelledby={`pic-${name}`} onKeyDown={arrows}>
        {options.map((o) => {
          const on = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.label}
              title={o.label}
              className="pic"
              data-pic={o.key}
              onClick={() => onChange(on && allowEmpty ? "" : o.key)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.src} alt="" width={84} height={84} loading="lazy" decoding="async" />
              <span className="pic__check" aria-hidden="true">✓</span>
              {caps && <span className="pic__cap" aria-hidden="true">{o.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Ряд переключателей-картинок (очки, веснушки, румянец, борода…): можно отметить несколько. */
export function PicToggles({ name, label, options, value, onToggle }: {
  name: string;
  label: string;
  options: PicOption[];
  value: Record<string, boolean | undefined>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="pic-row-wrap" data-pic-row={name}>
      <span className="label" id={`pic-${name}`}>{label}</span>
      <div className="pic-row pic-row--m" role="group" aria-labelledby={`pic-${name}`} onKeyDown={arrows}>
        {options.map((o) => {
          const on = Boolean(value[o.key]);
          return (
            <button key={o.key} type="button" aria-pressed={on} aria-label={o.label} title={o.label} className="pic" data-pic={o.key} onClick={() => onToggle(o.key)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.src} alt="" width={84} height={84} loading="lazy" decoding="async" />
              <span className="pic__check" aria-hidden="true">✓</span>
              <span className="pic__cap" aria-hidden="true">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
