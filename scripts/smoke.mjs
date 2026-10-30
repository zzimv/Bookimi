// Приёмочная проверка безопасности на работающем сайте (DEMO_MODE=1).
// node scripts/smoke.mjs http://localhost:3000
const B = process.argv[2] ?? "http://localhost:3000";
const host = new URL(B).host;
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fails++; };

function jar() {
  const c = new Map();
  return {
    async f(path, opts = {}) {
      const headers = { ...(opts.headers ?? {}), cookie: [...c].map(([k, v]) => `${k}=${v}`).join("; ") };
      if (opts.method && opts.method !== "GET" && opts.origin !== false) headers.origin = B;
      if (opts.json) { headers["content-type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
      const r = await fetch(B + path, { ...opts, headers, redirect: "manual" });
      for (const s of r.headers.getSetCookie?.() ?? []) { const [kv] = s.split(";"); const i = kv.indexOf("="); c.set(kv.slice(0, i), kv.slice(i + 1)); }
      return r;
    },
    async login(email) {
      await this.f("/");
      // Вход: телефон обязателен (auth.phoneRequired), код — на почту
      const phone = `+79${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}`;
      const r = await this.f("/api/auth/request", { method: "POST", json: { email, phone } });
      const { demoCode } = await r.json();
      const v = await this.f("/api/auth/verify", { method: "POST", json: { email, phone, code: demoCode, consentPd: true } });
      return v.status === 200;
    },
  };
}

const a = jar();
// Публичные страницы и машиночитаемые файлы
for (const p of ["/", "/skazki", "/povod/novyj-god", "/llms.txt", "/catalog.json", "/agents.md", "/sitemap.xml", "/robots.txt", "/api/health"]) {
  ok((await a.f(p)).status === 200, `GET ${p} → 200`);
}
const h = await a.f("/");
ok(h.headers.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
ok((h.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"), "CSP запрещает встраивание");
ok(Boolean(h.headers.get("strict-transport-security")), "HSTS");
{
  const pp = h.headers.get("permissions-policy") ?? "";
  ok(pp.includes("microphone=(self)") && pp.includes("camera=()") && pp.includes("geolocation=()"), "Permissions-Policy: микрофон — свой сайт (запись голоса), камера и геолокация — выкл.");
}

// CSRF: POST без своего Origin
const csrf = await a.f("/api/books", { method: "POST", json: {}, origin: false, headers: { origin: "https://evil.example" } });
ok(csrf.status === 403, "POST с чужого сайта → 403 (CSRF)");
const csrfNull = await a.f("/api/books", { method: "POST", json: {}, origin: false, headers: { origin: "null" } });
ok(csrfNull.status === 403, "POST с Origin: null → 403, а не 500");

// Книга: создать, дождаться текста
const answers = { hero: { name: "Тест", gender: "girl", ageGroup: "4-5" }, story: { slug: "sonnaya-strana" }, style: "watercolor-air" };
const cr = await a.f("/api/books", { method: "POST", json: { answers } });
const { bookId } = await cr.json();
ok(cr.status === 200 && bookId, "книга создаётся без регистрации");
let st;
for (let i = 0; i < 40; i++) { st = await (await a.f(`/api/books/${bookId}`)).json(); if (st.status === "TEXT_READY") break; await new Promise((r) => setTimeout(r, 1000)); }
ok(st.status === "TEXT_READY", "сказка сочинена");

// Полный PDF до оплаты недоступен
ok((await a.f(`/api/books/${bookId}/download?kind=pdf-screen`)).status === 403, "полный PDF без оплаты → 403");

// Чужая книга и чужой заказ не открываются
const b = jar();
await b.login(`stranger-${Date.now()}@test.local`);
ok((await b.f(`/api/books/${bookId}`)).status === 404, "чужая книга → 404");
const ids = process.argv[3];
if (ids) ok((await b.f(`/api/orders/${ids}`)).status === 404, "чужой заказ → 404");

// Лимит превью: второе за сутки → 429
await a.login(`limit-${Date.now()}@test.local`);
await a.f(`/api/books/${bookId}/action`, { method: "POST", json: { action: "approve" } });
const p1 = await a.f(`/api/books/${bookId}/action`, { method: "POST", json: { action: "preview", withPhoto: false } });
ok(p1.status === 200, "первое превью разрешено");
const cr2 = await a.f("/api/books", { method: "POST", json: { answers } });
const { bookId: b2 } = await cr2.json();
for (let i = 0; i < 40; i++) { const s = await (await a.f(`/api/books/${b2}`)).json(); if (s.status === "TEXT_READY") break; await new Promise((r) => setTimeout(r, 1000)); }
await a.f(`/api/books/${b2}/action`, { method: "POST", json: { action: "approve" } });
const p2 = await a.f(`/api/books/${b2}/action`, { method: "POST", json: { action: "preview", withPhoto: false } });
ok(p2.status === 429, "второе превью за сутки → 429");

// Вход только по почте: телефон как цель кода — нет (вход по SMS выключен по умолчанию)
const ph = await jar().f("/api/auth/request", { method: "POST", json: { target: "+79001234567" } });
ok(ph.status === 400, "код на телефон без включённого входа по SMS → 400");

// Перебор кодов входа
const c = jar();
let last = 200;
for (let i = 0; i < 8; i++) last = (await c.f("/api/auth/request", { method: "POST", json: { email: `spam-${i}@test.local`, phone: `+7900000000${i}` } })).status;
ok(last === 429, "частые запросы кодов → 429");

console.log(fails ? `\nОшибок: ${fails}` : "\nВсе проверки пройдены");
process.exit(fails ? 1 : 0);
