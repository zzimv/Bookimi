"use client";
import { useEffect, useState } from "react";

// Тема сайта: авто (как в системе) · светлая · тёмная. Выбор хранится в браузере;
// до отрисовки его применяет короткий скрипт в <head> (layout.tsx), чтобы не было вспышки.
const OPTIONS = [
  { key: "auto", label: "Авто" },
  { key: "light", label: "Светлая" },
  { key: "dark", label: "Тёмная" },
] as const;

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>("auto");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "auto");
  }, []);
  function choose(t: string) {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try {
      if (t === "auto") localStorage.removeItem("bk_theme");
      else localStorage.setItem("bk_theme", t);
    } catch {}
  }
  return (
    <div className="theme-toggle" role="group" aria-label="Тема сайта">
      <span>Тема:</span>
      {OPTIONS.map((o) => (
        <button key={o.key} type="button" aria-pressed={theme === o.key} onClick={() => choose(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
