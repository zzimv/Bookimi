// Админка на отдельном хосте admin.<DOMAIN>: маршрутизация middleware, 404 на основном домене, раздельные cookie
// и сессии сотрудника/покупателя, журнал входов и алерт о новом IP/устройстве. Часть с БД — только с DATABASE_URL.
import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

const ctx = vi.hoisted(() => {
  process.env.DOMAIN = "bookimi.test";
  delete process.env.ADMIN_HOST;
  delete process.env.ADMIN_HOST_SEPARATION;
  return { cookies: new Map<string, { value: string; opts?: Record<string, unknown> }>(), headers: new Map<string, string>() };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (ctx.cookies.has(k) ? { name: k, value: ctx.cookies.get(k)!.value } : undefined),
    set: (k: string, v: string, opts?: Record<string, unknown>) => void ctx.cookies.set(k, { value: v, opts }),
    delete: (k: string) => void ctx.cookies.delete(k),
    getAll: () => [...ctx.cookies].map(([name, c]) => ({ name, value: c.value })),
  }),
  headers: async () => new Headers([...ctx.headers]),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const req = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) => {
  const u = new URL(url);
  return new NextRequest(url, { method: init.method ?? "GET", headers: { host: u.host, ...(init.headers ?? {}) } });
};

describe("admin-хост: маршрутизация", () => {
  it("adminHosts: admin.<DOMAIN>; без DOMAIN, на localhost и с ADMIN_HOST_SEPARATION=0 — выключено", async () => {
    const { adminHosts } = await import("@/lib/admin-host");
    expect(adminHosts({ DOMAIN: "bookimi.ru" })).toEqual({ main: "bookimi.ru", admin: "admin.bookimi.ru" });
    expect(adminHosts({ DOMAIN: "bookimi.ru", ADMIN_HOST: "panel.bookimi.ru" })?.admin).toBe("panel.bookimi.ru");
    expect(adminHosts({})).toBeNull();
    expect(adminHosts({ DOMAIN: "localhost:3000" })).toBeNull();
    expect(adminHosts({ DOMAIN: "bookimi.ru", ADMIN_HOST_SEPARATION: "0" })).toBeNull();
  });

  it("основной домен: /admin, /admin/zakazy, /api/admin/* → 404; сайт работает", async () => {
    const { middleware } = await import("@/middleware");
    for (const p of ["/admin", "/admin/zakazy/1", "/api/admin/books/x/download", "/admin/2fa"]) {
      expect(middleware(req(`https://bookimi.test${p}`)).status).toBe(404);
    }
    const home = middleware(req("https://bookimi.test/"));
    expect(home.status).toBe(200);
    expect(home.headers.get("x-middleware-next")).toBe("1");
  });

  it("admin-хост: админка и вход — открываются (без cookie сайта, noindex); всё остальное — на основной сайт", async () => {
    const { middleware } = await import("@/middleware");
    const a = middleware(req("https://admin.bookimi.test/admin/zakazy"));
    expect(a.headers.get("x-middleware-next")).toBe("1");
    expect(a.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(a.headers.get("cache-control")).toBe("no-store");
    expect(a.cookies.get("bk_anon")).toBeUndefined();
    expect(middleware(req("https://admin.bookimi.test/vhod?next=/admin")).headers.get("x-middleware-next")).toBe("1");
    const root = middleware(req("https://admin.bookimi.test/"));
    expect(root.status).toBe(302);
    expect(root.headers.get("location")).toBe("https://admin.bookimi.test/admin");
    const site = middleware(req("https://admin.bookimi.test/skazki?dlya=deti"));
    expect(site.status).toBe(301);
    expect(site.headers.get("location")).toBe("https://bookimi.test/skazki?dlya=deti");
    expect(middleware(req("https://admin.bookimi.test/kabinet")).headers.get("location")).toBe("https://bookimi.test/kabinet");
    // API сайта на admin-хосте — тоже нет (кроме входа сотрудника)
    expect(middleware(req("https://admin.bookimi.test/api/checkout", { method: "POST", headers: { origin: "https://admin.bookimi.test" } })).status).toBe(301);
    expect(middleware(req("https://admin.bookimi.test/api/auth/verify", { method: "POST", headers: { origin: "https://admin.bookimi.test" } })).headers.get("x-middleware-next")).toBe("1");
  });

  it("строгая CSP админки: без Метрики, frame-ancestors 'none'", async () => {
    const { adminCsp } = await import("@/lib/admin-host");
    const csp = adminCsp(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/mc\.yandex|yastatic|unsafe-eval/);
    const cfg = (await import("../next.config")).default;
    const rules = await cfg.headers!();
    const admin = rules.find((r) => r.source === "/:p(admin|vhod)/:path*")!;
    expect(admin.headers.find((h) => h.key === "Content-Security-Policy")!.value).toBe(adminCsp(process.env.NODE_ENV === "production"));
  });
});

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("admin-хост: сессии и входы (БД)", async () => {
  process.env.DEMO_MODE = "1";
  const { db } = await import("@/lib/db");
  const auth = await import("@/lib/auth");
  const { STAFF_COOKIE } = await import("@/lib/admin-host");
  const tag = randomUUID().slice(0, 8);
  const mk = (role: "OWNER" | "OPERATOR" | "CUSTOMER") => db.user.create({ data: { email: `ah-${role.toLowerCase()}-${tag}-${Math.random().toString(36).slice(2, 6)}@test.local`, role, referralCode: `AH${tag}${Math.random().toString(36).slice(2, 5)}`.slice(0, 12).toUpperCase() } });
  const onHost = (host: string, ip = "203.0.113.5", ua = "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0") => {
    ctx.headers.clear();
    ctx.headers.set("host", host);
    ctx.headers.set("x-forwarded-for", ip);
    ctx.headers.set("user-agent", ua);
    ctx.cookies.clear();
  };
  afterAll(() => {
    ctx.cookies.clear();
    ctx.headers.clear();
  });

  it("вход сотрудника на admin-хосте: cookie bk_staff (SameSite=Strict, Secure, HttpOnly, без Domain), не bk_session", async () => {
    const op = await mk("OPERATOR");
    onHost("admin.bookimi.test");
    await auth.createSession(op.id, op.role);
    expect(ctx.cookies.has(auth.SESSION_COOKIE)).toBe(false);
    const c = ctx.cookies.get(STAFF_COOKIE)!;
    expect(c.opts).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/" });
    expect(c.opts).not.toHaveProperty("domain");
    expect((await auth.adminSession())?.userId).toBe(op.id);
    // Сессия сотрудника — не покупательская: на сайте по ней не войти
    ctx.cookies.set(auth.SESSION_COOKIE, { value: c.value });
    expect(await auth.currentSession()).toBeNull();
    // Та же cookie на основном домене админку не открывает
    const raw = c.value;
    onHost("bookimi.test");
    ctx.cookies.set(STAFF_COOKIE, { value: raw });
    expect(await auth.adminSession()).toBeNull();
  });

  it("сессия покупателя никогда не открывает админку — даже у сотрудника на основном домене", async () => {
    const owner = await mk("OWNER");
    onHost("bookimi.test");
    await auth.createSession(owner.id, owner.role);
    expect(ctx.cookies.has(STAFF_COOKIE)).toBe(false);
    const cust = ctx.cookies.get(auth.SESSION_COOKIE)!;
    expect(cust.opts).toMatchObject({ sameSite: "lax" });
    expect((await auth.currentSession())?.userId).toBe(owner.id);
    // Подложить покупательскую cookie как bk_staff на admin-хосте — не работает (scope=customer)
    onHost("admin.bookimi.test");
    ctx.cookies.set(STAFF_COOKIE, { value: cust.value });
    expect(await auth.adminSession()).toBeNull();
  });

  it("на admin-хосте покупатель не входит (код не тратится), новые аккаунты не создаются", async () => {
    const { sha256 } = await import("@/lib/crypto");
    const c = await mk("CUSTOMER");
    onHost("admin.bookimi.test");
    await db.otpCode.create({ data: { target: c.email!, codeHash: sha256(`${c.email}:111111`), expiresAt: new Date(Date.now() + 600_000) } });
    const r = await auth.verifyOtp(c.email!, "111111");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/только для сотрудников/) });
    expect(await db.otpCode.count({ where: { target: c.email!, usedAt: null } })).toBe(1);
    const ghost = `ghost-${tag}@test.local`;
    await db.otpCode.create({ data: { target: ghost, codeHash: sha256(`${ghost}:222222`), expiresAt: new Date(Date.now() + 600_000) } });
    expect((await auth.verifyOtp(ghost, "222222")).ok).toBe(false);
    expect(await db.user.findUnique({ where: { email: ghost } })).toBeNull();
    await expect(auth.createSession(c.id, c.role)).rejects.toThrow(/только для сотрудников/);
  });

  it("журнал входов с IP и устройством; новый IP или устройство — алерт владельцу, повторный вход — без алерта", async () => {
    const op = await mk("OPERATOR");
    const alerts = () => db.auditLog.count({ where: { action: "outbox.telegram", details: { path: ["text"], string_contains: op.email! } } });
    const a0 = await alerts();
    onHost("admin.bookimi.test", "203.0.113.10");
    await auth.createSession(op.id, op.role);
    expect(await alerts()).toBe(a0 + 1); // первый вход — новый IP и устройство
    onHost("admin.bookimi.test", "203.0.113.10");
    await auth.createSession(op.id, op.role);
    expect(await alerts()).toBe(a0 + 1);
    onHost("admin.bookimi.test", "198.51.100.77");
    await auth.createSession(op.id, op.role);
    expect(await alerts()).toBe(a0 + 2);
    const text = (await db.auditLog.findFirstOrThrow({ where: { action: "outbox.telegram", details: { path: ["text"], string_contains: "198.51.100.77" } }, orderBy: { createdAt: "desc" } })).details as { text: string; subject?: string };
    expect(text.text).toContain(op.email!);
    onHost("admin.bookimi.test", "198.51.100.77", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1");
    await auth.createSession(op.id, op.role);
    expect(await alerts()).toBe(a0 + 3);
    const logins = await db.auditLog.findMany({ where: { action: "admin.login", entityId: op.id } });
    expect(logins).toHaveLength(4);
    expect(logins.every((l) => (l.details as { ip?: string; userAgent?: string }).ip && (l.details as { userAgent?: string }).userAgent)).toBe(true);
    // Сессии видны в «Команде» и завершаются
    const sessions = await db.session.findMany({ where: { userId: op.id, scope: "staff" } });
    expect(sessions).toHaveLength(4);
    expect(sessions.every((s) => s.ip && s.userAgent)).toBe(true);
  });
});
