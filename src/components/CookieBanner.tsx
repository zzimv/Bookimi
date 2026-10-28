"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE = "bk_consent";

function read(): string | null {
  const m = document.cookie.match(/(?:^|; )bk_consent=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function loadMetrika(id: string) {
  if ((window as unknown as { ym?: unknown }).ym) return;
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
    <div className="cookie" role="dialog" aria-label="Файлы cookie">
      Мы используем необходимые cookie, чтобы сайт работал, и — с вашего разрешения — Яндекс Метрику, чтобы
      понимать, что улучшить. <Link href="/cookies">Подробнее</Link>
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
