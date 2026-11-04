import type { NextConfig } from "next";
import { adminCsp } from "./src/lib/admin-host";
import { AGE_REDIRECTS } from "./src/lib/catalog-defaults";

const isProd = process.env.NODE_ENV === "production";

// CSP: сторонние скрипты — только Яндекс Метрика. 'unsafe-inline' для скриптов
// временно (инлайн-скрипты Next); на шаге 7 заменяется на nonce.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net" + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.yandexcloud.net https://storage.yandexcloud.net https://mc.yandex.ru",
  "font-src 'self'",
  // blob: — своя запись голоса (волна и прослушивание до загрузки)
  "connect-src 'self' blob: https://mc.yandex.ru https://smartcaptcha.yandexcloud.net",
  // Аудио и мультфильм: свои записи (blob:), файлы по подписанным ссылкам Object Storage
  "media-src 'self' blob: https://*.yandexcloud.net https://storage.yandexcloud.net",
  "frame-src https://smartcaptcha.yandexcloud.net",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(self)" },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: { removeConsole: isProd ? { exclude: ["error"] } : false },
  images: { formats: ["image/avif", "image/webp"] },
  // Тело запроса через middleware (у нас — все /api/*) Next по умолчанию обрезает до 10 МБ: фото обещаны до 15 МБ,
  // multipart добавляет заголовки — лимит 16 МБ. Сам размер файла (15 МБ) проверяет маршрут с понятной ошибкой.
  experimental: { middlewareClientMaxBodySize: "16mb" },
  // Типы проверяются отдельным шагом CI (npm run typecheck). SKIP_TYPECHECK=1 — только
  // для окружений без движков Prisma, где клиент сгенерирован как заглушка.
  typescript: { ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1" },
  // rev 20: возрастные группы 0–3 / 4–6 / 7–9 — старые адреса /vozrast/* навсегда переехали (301)
  async redirects() {
    return AGE_REDIRECTS.map((r) => ({ source: r.from, destination: r.to, statusCode: 301 as const }));
  },
  async headers() {
    // Админка и вход (на admin-хосте открыты только они): строгая CSP без Метрики и сторонних скриптов
    const adminHeaders = securityHeaders.map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: adminCsp(isProd) } : h));
    return [
      { source: "/((?!admin|api/admin|vhod).*)", headers: securityHeaders },
      { source: "/:p(admin|vhod)", headers: adminHeaders },
      { source: "/:p(admin|vhod)/:path*", headers: adminHeaders },
      { source: "/api/admin/:path*", headers: adminHeaders },
    ];
  },
};

export default config;
