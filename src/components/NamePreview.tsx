"use client";
import { useEffect, useState } from "react";

const KEY = "bookimi.heroName";

function clean(v: string) {
  return v.replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "").slice(0, 20);
}

function apply(name: string) {
  document.documentElement.style.setProperty("--hero-name", name ? `"${name}"` : '""');
}

// Единственная интерактивная деталь первого экрана: имя сразу появляется на всех обложках.
export function NamePreview() {
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const saved = clean(localStorage.getItem(KEY) ?? "");
      if (saved) {
        setName(saved);
        apply(saved);
      }
    } catch {}
  }, []);

  return (
    <div className="namebox">
      <label htmlFor="hero-name">Как зовут ребёнка?</label>
      <input
        id="hero-name"
        type="text"
        autoComplete="off"
        placeholder="Например, Варя"
        value={name}
        maxLength={20}
        onChange={(e) => {
          const v = clean(e.target.value);
          setName(v);
          apply(v);
          try {
            localStorage.setItem(KEY, v);
          } catch {}
        }}
      />
    </div>
  );
}
