"use client";
// Закрывает мобильное меню (<details class="burger">): по нажатию на пункт, по Esc и по нажатию вне меню.
import { useEffect } from "react";

export function BurgerCloser() {
  useEffect(() => {
    const close = () => document.querySelectorAll<HTMLDetailsElement>("details.burger[open]").forEach((d) => d.removeAttribute("open"));
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      const menu = t.closest("details.burger");
      if (!menu) return close(); // нажали вне меню
      if (t.closest("a")) close(); // выбрали пункт
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", close);
    window.addEventListener("hashchange", close); // демо-стенд: адреса в hash
    return () => {
      window.removeEventListener("hashchange", close);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", close);
    };
  }, []);
  return null;
}
