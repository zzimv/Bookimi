"use client";
// Поле «Город» с подсказками по первым буквам (ARIA combobox): /api/geo/cities?q=, задержка 200 мс,
// стрелки/Enter/Escape, подпись региона («Королёв, Московская обл.»). Город не из списка тоже принимается.
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/client";

export interface CityValue {
  city: string;
  region?: string;
  cityCode?: number;
}
interface Hit {
  name: string;
  region: string;
  code: number | null;
  label: string;
}

export function CityInput({ value, onChange, required, label = "Город" }: { value: CityValue; onChange: (v: CityValue) => void; required?: boolean; label?: string }) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value.city);
  const [items, setItems] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const picked = Boolean(value.region || value.cityCode);

  // Значение сменили снаружи (подстановка, «Очистить») — показываем его
  useEffect(() => {
    if (value.city !== text && !open) setText(value.city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.city]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || !open) {
      setItems([]);
      setLoading(false);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ cities: Hit[] }>(`/api/geo/cities?q=${encodeURIComponent(q)}`);
        if (my !== seq.current) return; // пришёл ответ на старый запрос
        setItems(r.cities);
        setActive(r.cities.length ? 0 : -1);
      } catch {
        if (my === seq.current) setItems([]);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [text, open]);

  function pick(h: Hit) {
    setText(h.name);
    setOpen(false);
    setItems([]);
    setActive(-1);
    onChange({ city: h.name, region: h.region || undefined, cityCode: h.code ?? undefined });
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (!items.length) return;
      const d = k === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + items.length) % items.length);
    } else if (k === "Enter") {
      if (open && active >= 0 && items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (k === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  }

  const showList = open && text.trim().length >= 2;
  return (
    <div className="field combo">
      <label htmlFor={id} className="label">
        {label} {required && <span className="req">*</span>}
      </label>
      <div className="combo-box">
      <input
        id={id}
        className="input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList && items.length > 0}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={`${id}-hint`}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="next"
        placeholder="Начните вводить: «Кор…»"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setOpen(true);
          onChange({ city: v.trim() });
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          if (!picked && text.trim().length >= 2) setOpen(true);
        }}
        onBlur={() => {
          // Задержка: клик по подсказке успевает сработать
          blurTimer.current = setTimeout(() => setOpen(false), 200);
        }}
        onKeyDown={onKey}
      />
      {showList && (
        <ul className="combo-list" role="listbox" id={listId} aria-label="Подсказки городов">
          {items.map((h, i) => (
            <li
              key={`${h.name}|${h.region}|${h.code ?? ""}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onClick={() => pick(h)}
            >
              <b>{h.name}</b>
              {h.region && <span>, {h.region}</span>}
            </li>
          ))}
          {!loading && items.length === 0 && <li className="combo-empty" aria-disabled="true">Не нашли такой город — проверьте написание или оставьте как есть</li>}
        </ul>
      )}
      </div>
      <small id={`${id}-hint`} aria-live="polite">
        {picked && !open ? value.region || "Город выбран" : showList && loading ? "Ищем…" : showList ? (items.length ? `Подсказок: ${items.length}. Стрелки — выбрать, Enter — подтвердить` : "") : "Две-три первые буквы — и выберите из списка"}
      </small>
    </div>
  );
}
