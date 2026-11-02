// Регрессия по отчёту тестирования 30.10.2026 (критичные и важные пункты) на настоящей PostgreSQL.
// Без DATABASE_URL — пропускается. next/headers и next/cache подменены: сессия — настоящая строка Session,
// cookie и заголовки — из ctx; redirect/notFound — настоящие (бросают ошибку с digest).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { setupSellerAndPayments } from "./helpers/db-setup";

const ctx = vi.hoisted(() => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = `/tmp/bk-fixes-${Date.now().toString(36)}`;
  return { cookies: new Map<string, string>(), headers: new Map<string, string>() };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (ctx.cookies.has(k) ? { name: k, value: ctx.cookies.get(k)! } : undefined),
    set: (k: string, v: string) => void ctx.cookies.set(k, v),
    delete: (k: string) => void ctx.cookies.delete(k),
    getAll: () => [...ctx.cookies].map(([name, value]) => ({ name, value })),
  }),
  headers: async () => new Headers([...ctx.headers]),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
// PDF в тестах не рендерим (Chromium): считаем вызовы — печать после PDF должна делать только блок и обложку
const pdf = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/pdf", () => ({
  // Подготовка картинок к печати (300 dpi) — без изменений в тестах; ниже 250 dpi — не проверяем
  preparePrint: async (d: unknown) => ({ data: d, lowDpi: [] }),
  MIN_SOURCE_DPI: 250,
  renderPdf: async (_d: unknown, o: { kind: string }) => {
    pdf.calls.push(o.kind);
    return Buffer.from("%PDF-1.4 test");
  },
}));

// Счётчик проверок TOTP (сама проверка настоящая): параллельный подбор не должен проверять больше 5 кодов
const totpChecks = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/crypto", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/crypto")>();
  return { ...orig, totpVerify: (...a: Parameters<typeof orig.totpVerify>) => (totpChecks.n++, orig.totpVerify(...a)) };
});

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

/** Куда вёл redirect()/notFound() из next/navigation. */
async function nav(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "no-redirect";
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    if (digest.includes("404")) return "404";
    throw e;
  }
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Свой IP на каждый прогон: лимит попыток 2FA по IP не должен зависеть от прошлых запусков. */
const randomIp = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
function totpNow(secret: string) {
  let bits = "";
  for (const ch of secret) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const key: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) key.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", Buffer.from(key)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0");
}

d("исправления по отчёту 30.10: БД", async () => {
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const { saveSetting, cfg } = await import("@/lib/settings");
  const { encrypt, totpSecret, recoveryHash } = await import("@/lib/crypto");
  const tag = randomUUID().slice(0, 8);
  let n = 0;

  async function user(name: string, data: Record<string, unknown> = {}) {
    n++;
    return db.user.create({ data: { email: `${name}-${tag}-${n}@test.local`, phone: `+79${String(randomInt(0, 1e9)).padStart(9, "0")}`, referralCode: `F${tag}${n}`.slice(0, 12).toUpperCase(), ...data } });
  }
  // Вход: сессия покупателя (bk_session); сотруднику — ещё и сессия админки (bk_staff, scope=staff) — её и возвращаем
  async function login(userId: string, data: Record<string, unknown> = {}) {
    const raw = randomUUID();
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    const staff = u.role !== "CUSTOMER";
    const s = await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(raw).digest("hex"), csrfToken: "t", expiresAt: new Date(Date.now() + 86400_000), ...(staff ? {} : data) } });
    ctx.cookies.clear();
    ctx.cookies.set("bk_session", raw);
    ctx.cookies.set("bk_anon", `anon-${tag}-${userId}`);
    if (!staff) return s;
    const rawStaff = randomUUID();
    ctx.cookies.set("bk_staff", rawStaff);
    return db.session.create({ data: { userId, scope: "staff", tokenHash: createHash("sha256").update(rawStaff).digest("hex"), csrfToken: "t", expiresAt: new Date(Date.now() + 86400_000), ...data } });
  }
  async function book(userId: string | null, data: Record<string, unknown> = {}) {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true, audience: "CHILD" } });
    return db.book.create({
      data: {
        userId,
        storyId: story.id,
        styleKey: "watercolor-air",
        params: { audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "4-5" }, extras: [{ role: "dad", name: "Пётр" }] },
        status: "PREVIEW_READY",
        text: { title: "Маша и звёздный дракончик", spreads: [{ index: 1, text: "Жила-была Маша." }] },
        ...data,
      },
    });
  }
  async function paidOrder(u: { id: string }, b: { id: string }, input: Partial<Parameters<typeof orders.createOrder>[1]> = {}) {
    const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Анна" }, ...input });
    await orders.startPayment(o, "sbp_qr");
    const pay = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
    await orders.markPaid(pay.id);
    return db.order.findUniqueOrThrow({ where: { id: o.id } });
  }
  const jobs = async (queue: string, bookId: string) =>
    (await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM pgboss.job WHERE name = $1 AND data->>'bookId' = $2`, queue, bookId))[0].n;

  /** Алерты «Подбор кода 2FA» про этого сотрудника: по каналам. */
  const alerts2fa = async (email: string) => {
    const where = (ch: string) => ({ action: `outbox.${ch}`, AND: [{ details: { path: ["text"], string_contains: email } }, { OR: [{ details: { path: ["subject"], string_contains: "Подбор кода 2FA" } }, { details: { path: ["text"], string_contains: "Подбор кода 2FA" } }] }] });
    return { telegram: await db.auditLog.count({ where: where("telegram") }), email: await db.auditLog.count({ where: where("email") }) };
  };

  beforeAll(async () => {
    await setupSellerAndPayments();
    ctx.headers.set("x-forwarded-for", randomIp());
    mkdirSync(process.env.LOCAL_STORAGE_DIR!, { recursive: true });
  });
  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  // ── 1. 2FA ──
  describe("1. 2FA", () => {
    it("включённую 2FA нельзя перенастроить из сессии без второго фактора", async () => {
      const { totpSetupAction } = await import("@/app/admin/actions");
      const secret = totpSecret();
      const op = await user("op2fa", { role: "OPERATOR", totpEnabled: true, totpSecret: encrypt(secret) });
      await login(op.id, { mfaPassed: false });
      expect(await nav(totpSetupAction())).toBe("/admin/2fa");
      const after = await db.user.findUniqueOrThrow({ where: { id: op.id } });
      expect(after.totpSecret).toBe(op.totpSecret); // ключ не заменён
      expect(after.totpEnabled).toBe(true);
      expect(await db.auditLog.count({ where: { action: "security.2fa_setup_blocked", entityId: op.id } })).toBe(1);
    });

    it("5 неверных кодов → блокировка на 15 минут, сессия завершена, владельцу алерт; верный код потом не пускает", async () => {
      const { totpVerifyAction } = await import("@/app/admin/actions");
      const secret = totpSecret();
      const op = await user("brute", { role: "OPERATOR", totpEnabled: true, totpSecret: encrypt(secret) });
      ctx.headers.set("x-forwarded-for", randomIp());
      const s = await login(op.id);
      const f = (code: string) => {
        const fd = new FormData();
        fd.set("code", code);
        return fd;
      };
      for (let i = 0; i < 4; i++) expect(await nav(totpVerifyAction(f("000000")))).toContain("error=1");
      expect(await alerts2fa(op.email!)).toEqual({ telegram: 0, email: 0 });
      expect(await nav(totpVerifyAction(f("000000")))).toContain("locked=1");
      expect(await db.session.findUnique({ where: { id: s.id } })).toBeNull();
      expect(await db.auditLog.count({ where: { action: "auth.2fa_locked", entityId: op.id } })).toBe(1);
      expect(await alerts2fa(op.email!)).toEqual({ telegram: 1, email: 0 }); // алерт владельцу — один, в Telegram (настройка alerts)
      // Новая сессия (код с почты) и даже верный код — пока блокировка
      ctx.headers.set("x-forwarded-for", randomIp());
      await login(op.id);
      expect(await nav(totpVerifyAction(f(totpNow(secret))))).toContain("locked=1");
      ctx.headers.set("x-forwarded-for", randomIp());
    });

    it("40 параллельных неверных кодов: проверено не больше 5, одна блокировка и один алерт; верный код потом не пускает", async () => {
      const { totpVerifyAction } = await import("@/app/admin/actions");
      const secret = totpSecret();
      const op = await user("par", { role: "OPERATOR", totpEnabled: true, totpSecret: encrypt(secret) });
      ctx.headers.set("x-forwarded-for", randomIp());
      await login(op.id);
      const checkedBefore = totpChecks.n;
      const f = () => {
        const fd = new FormData();
        fd.set("code", "000000");
        return fd;
      };
      const res = await Promise.all(Array.from({ length: 40 }, () => nav(totpVerifyAction(f()))));
      const checked = totpChecks.n - checkedBefore;
      expect(checked).toBeLessThanOrEqual(5);
      expect(res.every((r) => r.includes("error=1") || r.includes("locked=1"))).toBe(true);
      expect(await db.auditLog.count({ where: { action: "auth.2fa_fail", entityId: op.id } })).toBe(5);
      expect(await db.auditLog.count({ where: { action: "auth.2fa_locked", entityId: op.id } })).toBe(1);
      expect(await alerts2fa(op.email!)).toEqual({ telegram: 1, email: 0 });
      ctx.headers.set("x-forwarded-for", randomIp());
      await login(op.id);
      expect(await nav(totpVerifyAction((() => { const fd = new FormData(); fd.set("code", totpNow(secret)); return fd; })()))).toContain("locked=1");
      ctx.headers.set("x-forwarded-for", randomIp());
    });

    it("коды восстановления: при включении — 10 штук (хэши), каждый срабатывает один раз", async () => {
      const { totpVerifyAction, recoveryAckAction } = await import("@/app/admin/actions");
      ctx.headers.set("x-forwarded-for", randomIp());
      const secret = totpSecret();
      const op = await user("rc", { role: "OWNER", totpEnabled: false, totpSecret: encrypt(secret) });
      const s = await login(op.id);
      const fd = new FormData();
      fd.set("code", totpNow(secret));
      expect(await nav(totpVerifyAction(fd))).toBe("/admin/2fa?codes=1");
      const u = await db.user.findUniqueOrThrow({ where: { id: op.id } });
      expect(u.totpEnabled).toBe(true);
      expect(u.totpRecovery).toHaveLength(10);
      const sess = await db.session.findUniqueOrThrow({ where: { id: s.id } });
      expect(sess.mfaPassed).toBe(true);
      const { decrypt } = await import("@/lib/crypto");
      const codes = decrypt(sess.recoveryShow!).split(" ");
      expect(codes).toHaveLength(10);
      expect(u.totpRecovery).toContain(recoveryHash(op.id, codes[0]));
      expect(u.totpRecovery.join()).not.toContain(codes[0]); // в БД — не сам код
      expect(await nav(recoveryAckAction())).toBe("/admin");
      expect((await db.session.findUniqueOrThrow({ where: { id: s.id } })).recoveryShow).toBeNull();
      // Вход по коду восстановления — один раз
      const s2 = await login(op.id);
      const rc = new FormData();
      rc.set("code", codes[3].toUpperCase());
      expect(await nav(totpVerifyAction(rc))).toBe("/admin");
      expect((await db.session.findUniqueOrThrow({ where: { id: s2.id } })).mfaPassed).toBe(true);
      expect((await db.user.findUniqueOrThrow({ where: { id: op.id } })).totpRecovery).toHaveLength(9);
      await login(op.id);
      expect(await nav(totpVerifyAction(rc))).toContain("error=1");
    });

    it("чувствительное действие без свежего кода 2FA → подтверждение и обратно", async () => {
      const { refundAction, teamAction } = await import("@/app/admin/actions");
      const owner = await user("fresh", { role: "OWNER", totpEnabled: true, totpSecret: encrypt(totpSecret()) });
      await login(owner.id, { mfaPassed: true, mfaAt: new Date(Date.now() - 30 * 60_000) });
      ctx.headers.set("referer", "http://localhost/admin/zakazy/123");
      const fd = new FormData();
      fd.set("orderId", randomUUID());
      expect(await nav(refundAction(fd))).toBe(`/admin/2fa?reauth=1&next=${encodeURIComponent("/admin/zakazy/123")}`);
      const t = new FormData();
      t.set("email", `x-${tag}@test.local`);
      t.set("role", "OWNER");
      expect(await nav(teamAction(t))).toContain("/admin/2fa?reauth=1");
      expect(await db.user.findUnique({ where: { email: `x-${tag}@test.local` } })).toBeNull();
      ctx.headers.delete("referer");
    });

    it("сессия сотрудника — не дольше 12 часов", async () => {
      const { currentSession, currentStaffSession } = await import("@/lib/auth");
      const op = await user("old", { role: "OPERATOR" });
      const s = await login(op.id);
      expect(await currentStaffSession()).not.toBeNull();
      await db.session.update({ where: { id: s.id }, data: { createdAt: new Date(Date.now() - 13 * 3600_000) } });
      expect(await currentStaffSession()).toBeNull();
      const c = await user("cust");
      const s2 = await login(c.id);
      await db.session.update({ where: { id: s2.id }, data: { createdAt: new Date(Date.now() - 13 * 3600_000) } });
      expect(await currentSession()).not.toBeNull();
    });
  });

  // ── 2. Сбой почты не ломает оплату ──
  describe("2. SMTP недоступен (127.0.0.1:1)", () => {
    it("markPaid: заказ оплачен, задача генерации в очереди, письмо — в очередь повторов", async () => {
      const notif = await cfg("notifications");
      await saveSetting("notifications", { ...notif, smtpHost: "127.0.0.1", smtpPort: 1 });
      try {
        const u = await user("smtp");
        await db.notificationPref.create({ data: { userId: u.id, channel: "email", address: u.email! } });
        const b = await book(u.id);
        const o = await paidOrder(u, b);
        expect(o.status).toBe("PAID");
        expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).paidFull).toBe(true);
        expect(await jobs("generate-full", b.id)).toBe(1n);
        const retry = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM pgboss.job WHERE name = 'send-notification' AND data->>'userId' = $1`, u.id);
        expect(retry[0].n).toBeGreaterThan(0n);
        // Повторный вебхук — ничего не дублирует
        await orders.markPaid((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).id);
        expect(await jobs("generate-full", b.id)).toBe(1n);
      } finally {
        await saveSetting("notifications", notif);
      }
    });

    it("код входа не ушёл → понятная ошибка, код аннулирован; в журнале кода нет", async () => {
      const { requestOtp } = await import("@/lib/auth");
      const notif = await cfg("notifications");
      const email = `otp-${tag}@test.local`;
      await saveSetting("notifications", { ...notif, smtpHost: "127.0.0.1", smtpPort: 1 });
      try {
        const r = await requestOtp(email);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.status).toBe(503);
          expect(r.error).toMatch(/Не получилось отправить письмо/);
        }
        expect(await db.otpCode.count({ where: { target: email, usedAt: null } })).toBe(0);
      } finally {
        await saveSetting("notifications", notif);
      }
      const ok = await requestOtp(email);
      expect(ok.ok).toBe(true);
      const code = ok.ok ? ok.demoCode! : "";
      const log = await db.auditLog.findFirstOrThrow({ where: { action: "outbox.email", details: { path: ["to"], equals: email } }, orderBy: { createdAt: "desc" } });
      expect(JSON.stringify(log.details)).not.toContain(code);
    });
  });

  // ── 3. Двойная оплата и гонка ──
  describe("3. двойная оплата", () => {
    it("параллельные вебхуки и второй платёж: один PAID, второй — needs_refund, один чек, промокод +1, одно письмо", async () => {
      const u = await user("race");
      const b = await book(u.id);
      const promo = await db.promoCode.create({ data: { code: `RACE${tag}`.toUpperCase(), percentOff: 10, source: "manual", maxUses: 100 } });
      const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], promo: promo.code, contact: { name: "Анна" } });
      await orders.startPayment(o, "sbp_qr");
      const p1 = await db.payment.findFirstOrThrow({ where: { orderId: o.id } });
      const p2 = await db.payment.create({ data: { orderId: o.id, provider: "sbp_qr", idempotencyKey: `k2-${tag}`, amountRub: o.totalRub, status: "pending", externalId: `ext2-${tag}` } });
      await Promise.all([orders.markPaid(p1.id), orders.markPaid(p1.id), orders.markPaid(p2.id), orders.markPaid(p1.id)]);
      const pays = await db.payment.findMany({ where: { orderId: o.id } });
      expect(pays.filter((p) => p.status === "succeeded")).toHaveLength(1);
      expect(pays.filter((p) => p.status === "needs_refund")).toHaveLength(1);
      expect(await db.receipt.count({ where: { orderId: o.id } })).toBe(1);
      expect((await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } })).usedCount).toBe(1);
      expect(await db.auditLog.count({ where: { action: "outbox.email", details: { path: ["subject"], string_contains: `${o.publicCode} оплачен` } } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "outbox.email", details: { path: ["subject"], string_contains: `Чек по заказу ${o.publicCode}` } } })).toBe(1);
      expect(await db.auditLog.count({ where: { action: "payment.duplicate", entityId: o.id } })).toBe(1);
      expect(await jobs("generate-full", b.id)).toBe(1n);
    });

    it("«Оплатить» идемпотентно: повтор тем же способом — тот же платёж", async () => {
      const u = await user("idem");
      const b = await book(u.id);
      const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Анна" } });
      await Promise.all([orders.startPayment(o, "sbp_qr"), orders.startPayment(o, "sbp_qr")]);
      await orders.startPayment(o, "sbp_qr");
      expect(await db.payment.count({ where: { orderId: o.id, provider: "sbp_qr" } })).toBe(1);
      await orders.startPayment(o, "transfer");
      expect(await db.payment.count({ where: { orderId: o.id } })).toBe(2);
    });

    it("оператор подтверждает перевод по уже оплаченному заказу — ничего не происходит", async () => {
      const u = await user("tr");
      const op = await user("trop", { role: "OPERATOR" });
      const b = await book(u.id);
      const o = await paidOrder(u, b);
      await orders.confirmTransfer(o.id, op.id);
      expect(await db.payment.count({ where: { orderId: o.id, status: "needs_refund" } })).toBe(0);
      expect(await db.payment.count({ where: { orderId: o.id } })).toBe(1);
    });
  });

  // ── 4. Сотрудники и покупательские API ──
  describe("4. сотрудники", () => {
    it("покупательские API чужой книги для сотрудника — 404; админский API — по правам, фото — только владельцу", async () => {
      const buyer = await user("buyer");
      const b = await book(buyer.id, { status: "FULL_READY", paidFull: true });
      const h = await db.hero.create({ data: { bookId: b.id, userId: buyer.id, role: "main", name: "Маша", appearance: {}, interests: [] } });
      await db.photo.create({ data: { heroId: h.id, storageKey: `${b.id}/p.jpg`, expiresAt: new Date(Date.now() + 86400_000) } });
      await db.bookFile.create({ data: { bookId: b.id, kind: "pdf-screen", storageKey: `${b.id}/files/x.pdf` } });
      const bookRoute = await import("@/app/api/books/[id]/route");
      const dl = await import("@/app/api/books/[id]/download/route");
      const action = await import("@/app/api/books/[id]/action/route");
      const adminBook = await import("@/app/api/admin/books/[id]/route");
      const params = { params: Promise.resolve({ id: b.id }) };
      const req = (body?: object) => new Request(`http://localhost/api/books/${b.id}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      for (const role of ["MARKETER", "OPERATOR", "OWNER"] as const) {
        const staff = await user(`st-${role}`, { role });
        await login(staff.id);
        expect((await bookRoute.GET(req(), params)).status).toBe(404);
        expect((await dl.GET(req(), params)).status).toBe(404);
        expect((await action.POST(req({ action: "preview", withPhoto: false, pd: true }), params)).status).toBe(404);
        const a = await adminBook.GET(req(), params);
        if (role === "MARKETER") expect(a.status).toBe(404);
        else {
          expect(a.status).toBe(200);
          const j = (await a.json()) as { photos: unknown[]; files: string[] };
          expect(j.files).toContain("pdf-screen");
          expect(j.photos).toHaveLength(role === "OWNER" ? 1 : 0);
        }
      }
      expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).userId).toBe(buyer.id);
    });
  });

  // ── 5. Печать после PDF ──
  describe("5. печать после PDF", () => {
    it("книга готова — оплата печати рендерит только блок и обложку; в печать — только когда готово", async () => {
      const { runFull } = await import("@/lib/gen/pipeline");
      const { printFilesReady } = await import("@/lib/print");
      const u = await user("print");
      const b = await book(u.id);
      const pdfOrder = await paidOrder(u, b);
      expect(pdfOrder.status).toBe("PAID");
      // Имитация готовой книги после первой генерации
      await db.book.update({ where: { id: b.id }, data: { status: "FULL_READY", fullReadyAt: new Date() } });
      await db.bookFile.create({ data: { bookId: b.id, kind: "pdf-screen", storageKey: `${b.id}/files/pdf-screen-old.pdf` } });
      const costsBefore = await db.generationCost.count({ where: { bookId: b.id } });
      const printOrder = await paidOrder(u, b, { whoPrints: "bookimi", formatKey: "std-hard", shipping: { method: "pickup", address: { city: "" } as never }, contact: { name: "Анна", phone: "+79990000000" } });
      pdf.calls.length = 0;
      await runFull(b.id, printOrder.id);
      expect(pdf.calls.sort()).toEqual(["cover", "print"]);
      const after = await db.book.findUniqueOrThrow({ where: { id: b.id }, include: { files: true } });
      expect(after.status).toBe("FULL_READY");
      expect(after.files.find((f) => f.kind === "pdf-screen")!.storageKey).toContain("pdf-screen-old");
      expect(await db.generationCost.count({ where: { bookId: b.id } })).toBe(costsBefore);
      expect(after.files.map((f) => f.kind)).toEqual(expect.arrayContaining(["print-block", "print-cover"]));
      // Посреди генерации (смена настроения) — в печать нельзя
      await db.book.update({ where: { id: b.id }, data: { status: "FULL_QUEUED" } });
      expect(await printFilesReady(printOrder.id)).toMatchObject({ ok: false });
      await db.book.update({ where: { id: b.id }, data: { status: "FULL_READY" } });
      const r = await printFilesReady(printOrder.id);
      expect(r.ok || (await db.order.findUniqueOrThrow({ where: { id: printOrder.id } })).status === "IN_PRINT").toBe(true);
    });
  });

  // ── 6. Удаление аккаунта ──
  describe("6. удаление аккаунта (152-ФЗ)", () => {
    it("удаляет тексты, файлы, фото, голос, журнал писем, коды; обезличивает тикеты, отзывы, заказы", async () => {
      const { deleteAccount } = await import("@/lib/account");
      const { putFile } = await import("@/lib/storage");
      const { notifySafe } = await import("@/lib/notify");
      const u = await user("del", { firstName: "Анна" });
      await db.notificationPref.create({ data: { userId: u.id, channel: "email", address: u.email! } });
      const b = await book(u.id, { status: "FULL_READY", paidFull: true });
      await db.bookPage.create({ data: { bookId: b.id, index: 1, text: "Маша полетела", imageKey: `${b.id}/p01.png`, previewKey: `${b.id}/p01-preview.jpg` } });
      await putFile("books", `${b.id}/p01.png`, Buffer.from("img"), "image/png");
      await putFile("books", `${b.id}/voice/voice-01.webm`, Buffer.from("voice"), "audio/webm");
      await db.bookFile.create({ data: { bookId: b.id, kind: "voice-01", storageKey: `${b.id}/voice/voice-01.webm` } });
      const h = await db.hero.create({ data: { bookId: b.id, userId: u.id, role: "main", name: "Маша", appearance: {}, interests: [] } });
      await putFile("photos", `${b.id}/ph.jpg`, Buffer.from("photo"), "image/jpeg");
      await db.photo.create({ data: { heroId: h.id, storageKey: `${b.id}/ph.jpg`, expiresAt: new Date(Date.now() + 86400_000) } });
      const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Анна Иванова", phone: "+79991112233", email: u.email! } });
      await orders.startPayment(o, "sbp_qr");
      await orders.markPaid((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).id);
      await db.otpCode.create({ data: { target: u.email!, codeHash: "x", expiresAt: new Date() } });
      await notifySafe(u.id, "preview_ready", { title: "Маша и дракончик", bookId: b.id });
      await db.supportTicket.create({ data: { userId: u.id, contact: u.email!, message: `Здравствуйте, книга про Машу, пишите на ${u.email}` } });
      await db.review.create({ data: { userId: u.id, orderId: o.id, authorName: "Анна Иванова", rating: 5, text: "Маше очень понравилось!", status: "approved" } });
      await db.review.create({ data: { userId: u.id, authorName: "Анна", rating: 4, text: "Ждём ещё", status: "pending" } });
      const dir = process.env.LOCAL_STORAGE_DIR!;
      expect(existsSync(join(dir, "books", b.id, "voice", "voice-01.webm"))).toBe(true);

      const r = await deleteAccount(u.id);
      expect(r).toMatchObject({ ok: true, books: 1, photos: 1 });
      expect(existsSync(join(dir, "books", b.id))).toBe(false);
      expect(existsSync(join(dir, "photos", b.id))).toBe(false);
      expect(await db.book.findUnique({ where: { id: b.id } })).toBeNull();
      expect(await db.bookPage.count({ where: { bookId: b.id } })).toBe(0);
      expect(await db.hero.count({ where: { userId: u.id } })).toBe(0);
      expect(await db.otpCode.count({ where: { target: u.email! } })).toBe(0);
      expect(await db.auditLog.count({ where: { action: { startsWith: "outbox." }, details: { path: ["to"], equals: u.email! } } })).toBe(0);
      const t = await db.supportTicket.findFirstOrThrow({ where: { message: { contains: "Здравствуйте" }, contact: "удалён" } });
      expect(t.message).not.toContain("Машу");
      expect(t.message).not.toContain(u.email!);
      const rev = await db.review.findMany({ where: { orderId: o.id } });
      expect(rev).toHaveLength(1);
      expect(rev[0].authorName).toBe("Покупатель");
      expect(rev[0].text).not.toMatch(/Маш/);
      expect(await db.review.count({ where: { text: "Ждём ещё" } })).toBe(0);
      const ord = await db.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true, receipts: true } });
      expect([ord.contactName, ord.contactPhone, ord.contactEmail]).toEqual([null, null, null]);
      expect(ord.totalRub).toBe(o.totalRub); // сумма — для налогового учёта
      expect(ord.receipts).toHaveLength(1);
      expect(ord.items[0].title).not.toContain("Маша");
      const gone = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect([gone.email, gone.phone, gone.firstName]).toEqual([null, null, null]);
      expect(gone.deletedAt).not.toBeNull();
    });

    it("печатный заказ в работе — удаление откладывается с понятной причиной", async () => {
      const { deleteAccount } = await import("@/lib/account");
      const u = await user("delp");
      const b = await book(u.id);
      const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], shipping: { method: "pickup", address: { city: "" } as never }, contact: { name: "Анна", phone: "+79990000001" } });
      await db.order.update({ where: { id: o.id }, data: { status: "IN_PRINT", paidAt: new Date() } });
      const r = await deleteAccount(u.id);
      expect(r.ok).toBe(false);
      expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).deletedAt).toBeNull();
    });
  });

  // ── 8, 11. Зачёт PDF, возврат ──
  it("8. зачёт PDF — фактически оплаченное (после скидки) и только один раз", async () => {
    const u = await user("credit");
    const b = await book(u.id);
    const promo = await db.promoCode.create({ data: { code: `HALF${tag}`.toUpperCase(), percentOff: 50, source: "manual" } });
    await paidOrder(u, b, { promo: promo.code });
    expect(await orders.pdfPaidFor(b.id, u.id)).toBe(495);
    const print = await paidOrder(u, b, { whoPrints: "bookimi", formatKey: "std-hard", shipping: { method: "pickup", address: { city: "" } as never }, contact: { name: "Анна", phone: "+79990000002" } });
    expect(print.pdfCreditRub).toBe(495);
    expect(await orders.pdfPaidFor(b.id, u.id)).toBe(0);
  });

  it("11. возврат: только из оплаченных статусов, один раз, доступ к PDF закрывается, журнал", async () => {
    const u = await user("refund");
    const op = await user("refop", { role: "OWNER" });
    const b = await book(u.id);
    const pending = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Анна" } });
    expect(await orders.refundOrder(pending.id, op.id, "x")).toMatchObject({ ok: false });
    const o = await paidOrder(u, b);
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).paidFull).toBe(true);
    expect(await orders.refundOrder(o.id, op.id, "брак")).toEqual({ ok: true });
    expect((await db.book.findUniqueOrThrow({ where: { id: b.id } })).paidFull).toBe(false);
    expect(await orders.refundOrder(o.id, op.id, "ещё раз")).toMatchObject({ ok: false, error: "Заказ уже возвращён" });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "order.refund", entityId: o.id } });
    expect(log.details).toMatchObject({ reason: "брак", amount: o.totalRub });
  });

  // ── 9. Настройки и промокоды в админке ──
  it("9. настройки и промокоды: ошибка — понятный текст, ничего не сохраняется; дубль кода — без падения", async () => {
    const { settingsAction, promoAction } = await import("@/app/admin/actions");
    const owner = await user("set", { role: "OWNER" });
    await login(owner.id);
    const seller = await cfg("seller");
    const f = new FormData();
    f.set("__key", "seller");
    f.set("f.fullName", "Иванов Иван");
    f.set("f.inn", "123");
    f.set("f.status", "НПД");
    f.set("f.email", "");
    f.set("f.phone", "");
    const url = await nav(settingsAction(f));
    expect(decodeURIComponent(url)).toContain("ИНН");
    expect(url).toContain("sec=seller");
    expect(await cfg("seller")).toEqual(seller);
    const lim = await cfg("limits");
    const l = new FormData();
    l.set("__key", "limits");
    for (const [k, v] of Object.entries(lim)) l.set(`f.${k}`, String(v));
    l.set("f.previewsPerContact", "");
    expect(decodeURIComponent(await nav(settingsAction(l)))).toContain("Превью в сутки");
    l.set("f.previewsPerContact", "1");
    l.set("f.dailySpendRub", "-5");
    expect(decodeURIComponent(await nav(settingsAction(l)))).toContain("не меньше 0");
    expect(await cfg("limits")).toEqual(lim);
    // Скидки группы — редактируются и проверяются
    const bulk = await cfg("bulk");
    const g = new FormData();
    g.set("__key", "bulk");
    g.set("__bools", "enabled");
    g.set("f.enabled", "on");
    g.set("f.previewCopies", "3");
    g.set("f.tiers", "15:30, 5:20");
    expect(decodeURIComponent(await nav(settingsAction(g)))).toContain("по возрастанию");
    g.set("f.tiers", "4:15, 12:25");
    expect(await nav(settingsAction(g))).toBe("/admin/nastrojki?saved=bulk#bulk");
    expect((await cfg("bulk")).tiers).toEqual([{ min: 4, pct: 15 }, { min: 12, pct: 25 }]);
    await saveSetting("bulk", bulk);
    // Промокоды
    const p = (code: string, pct: string) => {
      const x = new FormData();
      x.set("code", code);
      x.set("percentOff", pct);
      return x;
    };
    expect(decodeURIComponent(await nav(promoAction(p(`BIG${tag}`, "200"))))).toContain("от 1 до 90");
    await db.promoCode.create({ data: { code: `DUP${tag}`.toUpperCase(), percentOff: 10, source: "manual" } });
    expect(decodeURIComponent(await nav(promoAction(p(`dup${tag}`, "10"))))).toContain("уже есть");
  });

  // ── 12, 15. Воркер и мелочи ──
  it("15. заказ без способа оплаты отменяется через 48 часов", async () => {
    const { cancelUnpaid } = await import("@/worker/jobs");
    const u = await user("cancel");
    const b = await book(u.id);
    const o = await orders.createOrder(u.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Анна" } });
    await cancelUnpaid();
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING_PAYMENT");
    await db.order.update({ where: { id: o.id }, data: { createdAt: new Date(Date.now() - 49 * 3600_000) } });
    await cancelUnpaid();
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("CANCELLED");
  });

  it("15. отписка: GET ничего не меняет, кнопка — одна запись согласия даже при повторе", async () => {
    const { unsubscribe } = await import("@/lib/unsubscribe");
    const { signToken } = await import("@/lib/crypto");
    const Page = (await import("@/app/otpiska/page")).default;
    const u = await user("unsub", { marketingOk: true });
    const t = signToken(`unsub:${u.id}`);
    await Page({ searchParams: Promise.resolve({ t }) });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).marketingOk).toBe(true);
    expect(await unsubscribe(t)).toBe("ok");
    expect(await unsubscribe(t)).toBe("already");
    expect(await db.consent.count({ where: { userId: u.id, type: "MARKETING", granted: false } })).toBe(1);
  });

  it("15. один отзыв на заказ; /chek/не-UUID → 404; вебхук выключенной ЮKassa → 404 без внешнего запроса", async () => {
    const reviews = await import("@/app/api/reviews/route");
    const u = await user("rev");
    const b = await book(u.id);
    await paidOrder(u, b);
    await login(u.id);
    const post = () => reviews.POST(new Request("http://localhost/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating: 5, text: "Очень тёплая книга, спасибо!", authorName: "Анна" }) }));
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(409);
    expect(await db.review.count({ where: { userId: u.id } })).toBe(1);

    const Chek = (await import("@/app/chek/[id]/page")).default;
    expect(await nav(Chek({ params: Promise.resolve({ id: "not-a-uuid" }) }))).toBe("404");

    const wh = await import("@/app/api/payments/webhook/[provider]/route");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await wh.POST(new Request("http://localhost/api/payments/webhook/yookassa", { method: "POST", body: JSON.stringify({ object: { id: "../../x?y" } }) }), { params: Promise.resolve({ provider: "yookassa" }) });
    expect(r.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("14–15. оформление: телефон получателя печати проверяется; фото после готовности книги не принимаются; подросток 11–17", async () => {
    const checkout = await import("@/app/api/checkout/route");
    const photos = await import("@/app/api/books/[id]/photos/route");
    const books = await import("@/app/api/books/route");
    const u = await user("phone");
    const b = await book(u.id, { status: "FULL_READY", paidFull: true });
    await login(u.id);
    const body = { bookId: b.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], shipping: { method: "cdek_courier", address: { city: "Москва", street: "Тверская, 1" } }, contact: { name: "Анна Петрова", phone: "abc" } };
    const res = await checkout.POST(new Request("http://localhost/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Телефон получателя/);

    const fd = new FormData();
    fd.set("file", new File([Buffer.from("x")], "a.jpg", { type: "image/jpeg" }));
    const ph = await photos.POST(new Request(`http://localhost/api/books/${b.id}/photos`, { method: "POST", body: fd }), { params: Promise.resolve({ id: b.id }) });
    expect(ph.status).toBe(409);

    const teen = await books.POST(
      new Request("http://localhost/api/books", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: { audience: "TEEN", hero: { name: "Петя", gender: "boy", age: 10 }, story: { idea: "про космос" } } }) }),
    );
    expect(teen.status).toBe(400);
    expect(((await teen.json()) as { error: string }).error).toMatch(/от 11 до 17/);
  });

  // ── 16. Имя ──
  it("16. «Как к вам обращаться»: вход, «Мои данные», выгрузка; неверное имя — ошибка", async () => {
    const { verifyOtp, requestOtp } = await import("@/lib/auth");
    const me = await import("@/app/api/me/route");
    const email = `name-${tag}@test.local`;
    const r = await requestOtp(email);
    const v = await verifyOtp(email, r.ok ? r.demoCode! : "", { firstName: "Анна-Мария" });
    expect(v.ok && v.user.firstName).toBe("Анна-Мария");
    const post = (firstName: string) => me.POST(new Request("http://localhost/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "name", firstName }) }));
    expect((await post("<script>")).status).toBe(400);
    expect((await post("Аня")).status).toBe(200);
    const exp = (await (await me.GET()).json()) as { firstName: string; totpRecovery?: unknown };
    expect(exp.firstName).toBe("Аня");
    expect(exp.totpRecovery).toBeUndefined();
  });

  // ── 17. Сотрудники без лимитов покупателя, со своим лимитом расходов ──
  it("17. превью сотрудника — без лимита на контакт; расходы сотрудников не съедают лимит покупателей", async () => {
    const action = await import("@/app/api/books/[id]/action/route");
    const { spendLimitReached } = await import("@/lib/staff");
    const { spentTodayRub } = await import("@/lib/limits");
    const staff = await user("tester", { role: "MARKETER" });
    await db.consent.create({ data: { userId: staff.id, type: "PERSONAL_DATA", docVersion: "t", granted: true } });
    await login(staff.id);
    for (let i = 0; i < 3; i++) {
      const b = await book(staff.id, { status: "TEXT_APPROVED" });
      const res = await action.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", withPhoto: false }) }), { params: Promise.resolve({ id: b.id }) });
      expect(res.status).toBe(200);
    }
    const cust = await user("cust17");
    await db.consent.create({ data: { userId: cust.id, type: "PERSONAL_DATA", docVersion: "t", granted: true } });
    await login(cust.id);
    const codes: number[] = [];
    for (let i = 0; i < 2; i++) {
      const b = await book(cust.id, { status: "TEXT_APPROVED" });
      codes.push((await action.POST(new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", withPhoto: false }) }), { params: Promise.resolve({ id: b.id }) })).status);
    }
    expect(codes).toEqual([200, 429]);
    const custBefore = await spentTodayRub();
    const sb = await book(staff.id);
    await db.generationCost.create({ data: { bookId: sb.id, provider: "qwen", operation: "scene", costKopecks: 900_00, staff: true } });
    expect(await spentTodayRub()).toBe(custBefore);
    expect(await spentTodayRub({ staff: true })).toBeGreaterThanOrEqual(900);
    const lim = await cfg("limits");
    await saveSetting("limits", { ...lim, staffDailySpendRub: 500 });
    try {
      expect((await spendLimitReached(true)).over).toBe(true);
      expect((await spendLimitReached(false)).over).toBe(custBefore >= lim.dailySpendRub);
    } finally {
      await saveSetting("limits", lim);
    }
  });
});
