// Вход через внешние аккаунты: VK ID, Яндекс ID, Mail.ru (VK Group), Google. Чистые функции без БД и сети:
// какие провайдеры включены (переменные окружения), ссылка авторизации (OAuth 2.0 + PKCE), разбор профиля.
// Обмен кода на токен — exchangeCode() с переданным fetch (в тестах — заглушка). В демо-стенде сети нет: кнопки
// демо имитируют вход (tools/demo/api.ts, /api/auth/oauth-demo).
//
// Порядок кнопок — российские сервисы первыми (решение владелицы, ASSUMPTIONS.md, rev 10): данные покупателя
// остаются в РФ. Google — данные приходят ОТ Google к нам; мы Google персональные данные не передаём.
// Выключено по умолчанию: провайдер показывается, только если заданы и OAUTH_<ID>_CLIENT_ID, и …_CLIENT_SECRET.

export type OAuthKey = "vkid" | "yandex" | "mailru" | "google";

export interface OAuthProvider {
  key: OAuthKey;
  /** Подпись кнопки: «Войти через …». */
  title: string;
  /** Коротко для круглой кнопки (aria-label — title). */
  short: string;
  /** Фирменный цвет круглой кнопки. */
  color: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  /** Префикс переменных окружения: OAUTH_YANDEX_CLIENT_ID / OAUTH_YANDEX_CLIENT_SECRET. */
  env: string;
  /** Где владелице зарегистрировать приложение (README → «Вход через VK ID, Яндекс, Mail.ru, Google»). */
  console: string;
  /** PKCE обязателен (VK ID) или поддерживается. */
  pkce: boolean;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    key: "vkid",
    title: "VK ID",
    short: "VK",
    color: "#0077ff",
    authorizeUrl: "https://id.vk.com/authorize",
    tokenUrl: "https://id.vk.com/oauth2/auth",
    userinfoUrl: "https://id.vk.com/oauth2/user_info",
    scope: "email phone",
    env: "OAUTH_VKID",
    console: "https://id.vk.com/about/business/go",
    pkce: true,
  },
  {
    key: "yandex",
    title: "Яндекс ID",
    short: "Я",
    color: "#fc3f1d",
    authorizeUrl: "https://oauth.yandex.ru/authorize",
    tokenUrl: "https://oauth.yandex.ru/token",
    userinfoUrl: "https://login.yandex.ru/info?format=json",
    scope: "login:email login:info login:default_phone",
    env: "OAUTH_YANDEX",
    console: "https://oauth.yandex.ru/client/new",
    pkce: true,
  },
  {
    key: "mailru",
    title: "Mail.ru",
    short: "@",
    color: "#005ff9",
    authorizeUrl: "https://oauth.mail.ru/login",
    tokenUrl: "https://oauth.mail.ru/token",
    userinfoUrl: "https://oauth.mail.ru/userinfo",
    scope: "userinfo",
    env: "OAUTH_MAILRU",
    console: "https://o2.mail.ru/app/",
    pkce: false,
  },
  {
    key: "google",
    title: "Google",
    short: "G",
    color: "#ffffff",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    env: "OAUTH_GOOGLE",
    console: "https://console.cloud.google.com/apis/credentials",
    pkce: true,
  },
];

export const oauthProvider = (key: string) => OAUTH_PROVIDERS.find((p) => p.key === key) ?? null;

type Env = Record<string, string | undefined>;

/** Ключи приложения из окружения; нет обоих — провайдер выключен. */
export function oauthCredentials(p: OAuthProvider, env: Env = process.env): { clientId: string; clientSecret: string } | null {
  const clientId = env[`${p.env}_CLIENT_ID`]?.trim();
  const clientSecret = env[`${p.env}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Публичный список для кнопок входа: только настроенные провайдеры (по умолчанию — пусто). */
export function enabledOAuth(env: Env = process.env): { key: OAuthKey; title: string; short: string; color: string }[] {
  if (env.OAUTH_DISABLED === "1") return [];
  return OAUTH_PROVIDERS.filter((p) => oauthCredentials(p, env)).map(({ key, title, short, color }) => ({ key, title, short, color }));
}

/** Ссылка на страницу входа провайдера. state — защита от подделки запроса (храним в httpOnly-cookie). */
export function authorizeUrl(p: OAuthProvider, o: { clientId: string; redirectUri: string; state: string; codeChallenge?: string }): string {
  const u = new URL(p.authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", o.clientId);
  u.searchParams.set("redirect_uri", o.redirectUri);
  u.searchParams.set("state", o.state);
  if (p.scope) u.searchParams.set("scope", p.scope);
  if (p.pkce && o.codeChallenge) {
    u.searchParams.set("code_challenge", o.codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  if (p.key === "yandex") u.searchParams.set("force_confirm", "no");
  if (p.key === "google") u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export interface OAuthProfile {
  provider: OAuthKey;
  providerUserId: string;
  email: string | null;
  /** Телефон только в формате +7XXXXXXXXXX, иначе null — тогда спросим его отдельно. */
  phone: string | null;
  firstName: string | null;
}

const asStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const emailOk = (v: string | null) => (v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v.toLowerCase() : null);
export function ruPhone(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  const ten = d.length === 11 && /^[78]/.test(d) ? d.slice(1) : d.length === 10 ? d : "";
  return /^9\d{9}$/.test(ten) ? `+7${ten}` : null;
}

/** Ответ userinfo провайдера → единый профиль. Поля у всех разные. */
export function normalizeProfile(key: OAuthKey, raw: Record<string, unknown>): OAuthProfile | null {
  const r = (key === "vkid" && raw.user && typeof raw.user === "object" ? raw.user : raw) as Record<string, unknown>;
  let id: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let firstName: string | null = null;
  switch (key) {
    case "vkid":
      id = asStr(r.user_id);
      email = asStr(r.email);
      phone = ruPhone(r.phone);
      firstName = asStr(r.first_name);
      break;
    case "yandex":
      id = asStr(r.id);
      email = asStr(r.default_email) ?? (Array.isArray(r.emails) ? asStr(r.emails[0]) : null);
      phone = ruPhone((r.default_phone as { number?: string } | undefined)?.number);
      firstName = asStr(r.first_name);
      break;
    case "mailru":
      id = asStr(r.id);
      email = asStr(r.email);
      firstName = asStr(r.first_name);
      break;
    case "google":
      id = asStr(r.sub);
      email = r.email_verified === false ? null : asStr(r.email);
      firstName = asStr(r.given_name);
      break;
  }
  if (!id) return null;
  return { provider: key, providerUserId: id, email: emailOk(email), phone, firstName };
}

/** Код авторизации → токен → профиль. fetch передаётся снаружи (в тестах — заглушка). */
export async function exchangeCode(
  p: OAuthProvider,
  o: { clientId: string; clientSecret: string; code: string; redirectUri: string; codeVerifier?: string; deviceId?: string },
  f: typeof fetch = fetch,
): Promise<OAuthProfile | null> {
  const form = new URLSearchParams({ grant_type: "authorization_code", code: o.code, redirect_uri: o.redirectUri, client_id: o.clientId, client_secret: o.clientSecret });
  if (p.pkce && o.codeVerifier) form.set("code_verifier", o.codeVerifier);
  if (p.key === "vkid" && o.deviceId) form.set("device_id", o.deviceId);
  const tr = await f(p.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!tr.ok) return null;
  const tok = (await tr.json()) as { access_token?: string };
  if (!tok.access_token) return null;
  const ur =
    p.key === "vkid"
      ? await f(p.userinfoUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ access_token: tok.access_token, client_id: o.clientId }) })
      : p.key === "mailru"
        ? await f(`${p.userinfoUrl}?access_token=${encodeURIComponent(tok.access_token)}`)
        : await f(p.userinfoUrl, { headers: { Authorization: `${p.key === "yandex" ? "OAuth" : "Bearer"} ${tok.access_token}` } });
  if (!ur.ok) return null;
  return normalizeProfile(p.key, (await ur.json()) as Record<string, unknown>);
}

/** PKCE: verifier → challenge (S256, base64url). */
export async function pkceChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
