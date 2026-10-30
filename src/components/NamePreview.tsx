"use client";
import { useEffect, useState } from "react";
import { normalizeName } from "@/lib/declension";

const KEY = "bookimi.heroName";

function clean(v: string) {
  return v.replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "").slice(0, 20);
}

function apply(raw: string) {
  const name = normalizeName(raw);
  document.documentElement.style.setProperty("--hero-name", name ? `"${name}"` : '""');
  document.documentElement.classList.toggle("has-name", Boolean(name));
}

// Имя сразу появляется на обложках страницы (CSS-переменная --hero-name) и подставляется в анкету.
export function NamePreview({ label = "Как зовут героя?", placeholder = "Например, Варя", hint }: { label?: string; placeholder?: string; hint?: string }) {
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
      <label htmlFor="hero-name">{label}</label>
      <input
        id="hero-name"
        type="text"
        autoComplete="off"
        placeholder={placeholder}
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
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
