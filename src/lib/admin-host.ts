// Админка — только на отдельном хосте admin.<DOMAIN> (ASSUMPTIONS.md, «Безопасность админки»).
// Чистые функции без Node API: используются в middleware (edge) и на сервере.
//  • основной домен: /admin и /api/admin/* → 404;
//  • admin-хост: только админка, вход сотрудников и служебные файлы; остальное → 301 на основной сайт;
//  • cookie сотрудника — своя (bk_staff), только для admin-хоста (без Domain), SameSite=Strict, Secure, HttpOnly.
// Разделение выключено, если DOMAIN не задан или это localhost/IP (локальная разработка, демо, тесты), либо
// ADMIN_HOST_SEPARATION=0 (аварийный выключатель — README).

export const STAFF_COOKIE = "bk_staff";

export interface AdminHosts {
  main: string;
  admin: string;
}

const isLocal = (h: string) => /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(h);

/** Основной и admin-хост из окружения; null — разделение выключено. */
export function adminHosts(env: Record<string, string | undefined> = process.env): AdminHosts | null {
  if (env.ADMIN_HOST_SEPARATION === "0") return null;
  const main = (env.DOMAIN ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!main || isLocal(main)) return null;
  const admin = (env.ADMIN_HOST ?? `admin.${main}`).trim().toLowerCase();
  return { main, admin };
}

/** Хост запроса без порта (Caddy передаёт исходный Host; X-Forwarded-Host — если впереди ещё прокси). */
export function requestHost(h: { get(name: string): string | null }): string {
  return (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export const isAdminPath = (p: string) => p === "/admin" || p.startsWith("/admin/") || p === "/api/admin" || p.startsWith("/api/admin/");

/** Что можно открыть на admin-хосте, кроме самой админки: вход сотрудника и статика. */
const ADMIN_HOST_EXTRA = [/^\/vhod(\/|$)/, /^\/api\/auth\/(request|verify|logout)(\/|$)/, /^\/_next\//, /^\/fonts\//, /^\/(icon|apple-icon|favicon)[^/]*$/, /^\/manifest\.webmanifest$/, /^\/robots\.txt$/];

export type HostRoute = { action: "next"; adminHost: boolean } | { action: "404" } | { action: "redirect"; to: string; status: 301 | 302 };

/** Маршрутизация по хосту: что делать с запросом (middleware). */
export function routeForHost(host: string, pathname: string, search: string, cfg: AdminHosts | null): HostRoute {
  if (!cfg) return { action: "next", adminHost: false };
  if (host === cfg.admin) {
    if (pathname === "/") return { action: "redirect", to: "/admin", status: 302 };
    if (isAdminPath(pathname) || ADMIN_HOST_EXTRA.some((re) => re.test(pathname))) return { action: "next", adminHost: true };
    return { action: "redirect", to: `https://${cfg.main}${pathname}${search}`, status: 301 };
  }
  if (isAdminPath(pathname)) return { action: "404" };
  return { action: "next", adminHost: false };
}

/** Строже, чем у сайта: без Метрики и сторонних скриптов, без картинок из хранилища кроме подписанных ссылок. */
export function adminCsp(isProd = process.env.NODE_ENV === "production") {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isProd ? "" : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.yandexcloud.net https://storage.yandexcloud.net",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob: https://*.yandexcloud.net https://storage.yandexcloud.net",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** Заголовки admin-хоста (middleware). */
export function adminHeaders(): [string, string][] {
  return [
    ["X-Robots-Tag", "noindex, nofollow, noarchive"],
    ["Content-Security-Policy", adminCsp()],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "no-referrer"],
    ["Cache-Control", "no-store"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["Cross-Origin-Resource-Policy", "same-origin"],
  ];
}
