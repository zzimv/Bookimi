"use client";
import { useEffect } from "react";

// RUM: реальные Core Web Vitals → /api/vitals → дашборд «Скорость сайта».
export function Vitals() {
  useEffect(() => {
    import("web-vitals").then(({ onLCP, onINP, onCLS, onTTFB }) => {
      const device = /mobile|android|iphone/i.test(navigator.userAgent) ? "mobile" : "desktop";
      const send = (m: { name: string; value: number }) =>
        fetch("/api/vitals", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: m.name, value: m.value, page: location.pathname.slice(0, 120), device }) }).catch(() => {});
      onLCP(send);
      onINP(send);
      onCLS(send);
      onTTFB(send);
    });
  }, []);
  return null;
}
