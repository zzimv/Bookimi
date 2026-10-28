"use client";
import { useEffect, useRef } from "react";

// Yandex SmartCaptcha (невидимая проверка + виджет при подозрении). Ключ — YANDEX_SMARTCAPTCHA_CLIENT_KEY.
export function Captcha({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = window as unknown as { smartCaptcha?: { render: (el: HTMLElement, o: object) => number } };
    const render = () => {
      if (ref.current && w.smartCaptcha) w.smartCaptcha.render(ref.current, { sitekey: siteKey, hl: "ru", callback: onToken });
    };
    if (w.smartCaptcha) return render();
    const s = document.createElement("script");
    s.src = "https://smartcaptcha.yandexcloud.net/captcha.js";
    s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [siteKey, onToken]);
  return <div ref={ref} style={{ minHeight: 100, margin: "12px 0" }} />;
}
