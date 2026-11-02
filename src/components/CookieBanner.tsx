"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hideContentPath, metrikaAllowed, PD_FIELD_SELECTOR } from "@/lib/metrika";

const COOKIE = "bk_consent";

function read(): string | null {
  const m = document.cookie.match(/(?:^|; )bk_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Поля с ПДн — ym-disable-keys (и новые — по мере появления); анкета целиком — ym-hide-content. */
function maskFields() {
  const mark = () => {
    document.querySelectorAll(PD_FIELD_SELECTOR).forEach((el) => el.classList.add("ym-disable-keys"));
    if (hideContentPath(location.pathname)) document.querySelector("main")?.classList.add("ym-hide-content");
  };
  mark();
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
}

function loadMetrika(id: string) {
  if ((window as unknown as { ym?: unknown }).ym) return;
  // Кабинет, книга, заказ, чек, мультфильм, вход, отписка, админка — без Метрики
  if (!metrikaAllowed(location.pathname, location.hostname)) return;
  maskFields();
  const w = window as unknown as { ym: ((...a: unknown[]) => void) & { a?: unknown[]; l?: number } };
  w.ym = function (...args: unknown[]) {
    (w.ym.a = w.ym.a || []).push(args);
  } as typeof w.ym;
  w.ym.l = Date.now();
  (window as unknown as { __YM_ID?: number }).__YM_ID = Number(id);
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(s);
  // Вебвизор включён, поля с ПДн помечаются классом ym-disable-keys / ym-hide-content
  w.ym(Number(id), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
}

// Выбор: только необходимые / с аналитикой. Метрика грузится только после согласия.
export function CookieBanner({ metrikaId }: { metrikaId?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Переход по сайту в личный раздел, когда Метрика уже загружена: выгрузить её можно только перезагрузкой
  useEffect(() => {
    if ((window as unknown as { ym?: unknown }).ym && !metrikaAllowed(pathname, location.hostname)) location.reload();
    if ((window as unknown as { ym?: unknown }).ym && hideContentPath(pathname)) document.querySelector("main")?.classList.add("ym-hide-content");
  }, [pathname]);

  useEffect(() => {
    const v = read();
    if (!v) setOpen(true);
    else if (v === "analytics" && metrikaId) loadMetrika(metrikaId);
  }, [metrikaId]);

  function choose(v: "necessary" | "analytics") {
    document.cookie = `${COOKIE}=${v}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax; Secure`;
    setOpen(false);
    if (v === "analytics" && metrikaId) loadMetrika(metrikaId);
    // Согласие фиксируется на сервере (Consent ANALYTICS_COOKIES)
    fetch("/api/consent/cookies", { method: "POST", body: JSON.stringify({ value: v }), headers: { "content-type": "application/json" } }).catch(() => {});
  }

  if (!open) return null;
  return (
    <div className="cookie" role="region" aria-label="Файлы cookie">
      <p className="cookie__text">
        Необходимые cookie — чтобы сайт работал; Яндекс Метрика — только с вашего разрешения. <Link href="/cookies">Подробнее</Link>
      </p>
      <div className="cookie__row">
        <button className="btn btn--primary" onClick={() => choose("analytics")}>
          Разрешить аналитику
        </button>
        <button className="btn btn--ghost" onClick={() => choose("necessary")}>
          Только необходимые
        </button>
      </div>
    </div>
  );
}
