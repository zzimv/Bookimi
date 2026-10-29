import { NextResponse, type NextRequest } from "next/server";

// 1) Анонимный идентификатор для черновика и превью без регистрации.
// 2) Реферальный код (?ref=) и UTM-метки — в cookie на 30 дней.
// 3) Защита от CSRF: POST/PUT/PATCH/DELETE к /api только с нашего домена (кроме вебхуков).
/** Хост из заголовка Origin; «null» и мусор — null (не бросаем исключение → 403, а не 500). */
export function originHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const method = req.method;

  if (url.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const isWebhook = url.pathname.startsWith("/api/payments/webhook") || url.pathname.startsWith("/api/telegram");
    if (!isWebhook) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const oh = origin ? originHost(origin) : null;
      if (!oh || oh !== host) {
        return NextResponse.json({ error: "csrf" }, { status: 403 });
      }
    }
  }

  const res = NextResponse.next();
  // Ссылка «Поделиться мультфильмом» — личная: не индексировать
  if (url.pathname.startsWith("/mult/")) res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  const secure = process.env.NODE_ENV === "production";
  if (!req.cookies.get("bk_anon")) {
    res.cookies.set("bk_anon", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const ref = url.searchParams.get("ref");
  if (ref && /^[A-Z0-9]{4,12}$/i.test(ref)) {
    res.cookies.set("bk_ref", ref.toUpperCase(), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    const v = url.searchParams.get(k);
    if (v) utm[k] = v.slice(0, 80);
  }
  if (Object.keys(utm).length) {
    res.cookies.set("bk_utm", JSON.stringify(utm), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|fonts|obrazec|showcase|robots.txt|sitemap.xml|llms.txt).*)"],
};
