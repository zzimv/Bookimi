// Имена на настоящей PostgreSQL: оформление (получатель — имя и фамилия, с заглавных), «Как к вам обращаться»,
// миграция старых записей (scripts/normalize-names.ts: пробный прогон, --apply, идемпотентность). Без DATABASE_URL — пропуск.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { setupSellerAndPayments } from "./helpers/db-setup";

const ctx = vi.hoisted(() => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = `/tmp/bk-names-${Date.now().toString(36)}`;
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

const d = process.env.DATABASE_URL ? describe : describe.skip;

d("имена: БД", async () => {
  const { db } = await import("@/lib/db");
  const tag = randomUUID().slice(0, 8);
  let n = 0;
  async function user(data: Record<string, unknown> = {}) {
    n++;
    return db.user.create({ data: { email: `names-${tag}-${n}@test.local`, phone: `+79${String(randomInt(0, 1e9)).padStart(9, "0")}`, referralCode: `N${tag}${n}`.slice(0, 12).toUpperCase(), ...data } });
  }
  async function login(userId: string) {
    const raw = randomUUID();
    await db.session.create({ data: { userId, tokenHash: createHash("sha256").update(raw).digest("hex"), csrfToken: "t", expiresAt: new Date(Date.now() + 86400_000) } });
    ctx.cookies.clear();
    ctx.cookies.set("bk_session", raw);
    ctx.cookies.set("bk_anon", `anon-${tag}-${userId}`);
    // Сотруднику — ещё и сессия админки (bk_staff, scope=staff)
    const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
    if (u.role !== "CUSTOMER") {
      const rawStaff = randomUUID();
      await db.session.create({ data: { userId, scope: "staff", mfaPassed: true, mfaAt: new Date(), tokenHash: createHash("sha256").update(rawStaff).digest("hex"), csrfToken: "t", expiresAt: new Date(Date.now() + 86400_000) } });
      ctx.cookies.set("bk_staff", rawStaff);
    }
  }
  async function book(userId: string, name = "маша") {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true, audience: "CHILD" } });
    return db.book.create({
      data: { userId, storyId: story.id, styleKey: "watercolor-air", params: { audience: "CHILD", hero: { name, gender: "girl", ageGroup: "4-5" } }, status: "FULL_READY", paidFull: true, text: { title: "Сказка", spreads: [] } },
    });
  }
  const post = (body: unknown) => new Request("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  beforeAll(async () => {
    await setupSellerAndPayments();
    ctx.headers.set("x-forwarded-for", `10.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`);
    mkdirSync(process.env.LOCAL_STORAGE_DIR!, { recursive: true });
  });

  it("печать: получатель — два слова; «анна петрова» сохраняется как «Анна Петрова»", async () => {
    const checkout = await import("@/app/api/checkout/route");
    const u = await user();
    const b = await book(u.id);
    await login(u.id);
    const base = { bookId: b.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], shipping: { method: "cdek_courier", address: { city: "Москва", street: "Тверская, 1" } } };
    const one = await checkout.POST(post({ ...base, contact: { name: "анна", phone: "+79123456789" } }));
    expect(one.status).toBe(400);
    expect(((await one.json()) as { error: string }).error).toMatch(/имя и фамилию получателя/);
    const ok = await checkout.POST(post({ ...base, contact: { name: "  анна   ПЕТРОВА ", phone: "+79123456789" } }));
    const j = (await ok.json()) as { orderId?: string; error?: string };
    expect(j.error, j.error).toBeUndefined();
    const o = await db.order.findUniqueOrThrow({ where: { id: j.orderId! } });
    expect(o.contactName).toBe("Анна Петрова");
    const saved = (await db.user.findUniqueOrThrow({ where: { id: u.id } })).savedAddresses as { name: string }[];
    expect(saved[0].name).toBe("Анна Петрова");
  });

  it("«Как к вам обращаться» в кабинете: «АННА» → «Анна»", async () => {
    const me = await import("@/app/api/me/route");
    const u = await user();
    await login(u.id);
    const r = await me.POST(post({ action: "name", firstName: "АННА" }));
    expect(r.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).firstName).toBe("Анна");
    const bad = await me.POST(post({ action: "name", firstName: "Анна2" }));
    expect(bad.status).toBe(400);
  });

  it("миграция scripts/normalize-names.ts: пробный прогон, --apply, повтор ничего не меняет, история не трогается", async () => {
    const { normalizeNames } = await import("../scripts/normalize-names");
    const u = await user({ firstName: "анна" });
    const b = await book(u.id);
    const mk = (status: string, contactName: string) =>
      db.order.create({ data: { publicCode: `NM${tag}${randomInt(0, 1e6)}`.slice(0, 16), userId: u.id, status: status as never, whoPrints: "bookimi", subtotalRub: 1, totalRub: 1, contactName, items: { create: [{ kind: "format", refKey: "std-hard", title: "x", priceRub: 1, bookId: b.id }] } } });
    const pending = await mk("PAID", "анна петрова");
    const delivered = await mk("DELIVERED", "анна петрова");
    const lines: string[] = [];
    await normalizeNames({ apply: false, log: (s) => lines.push(s) });
    expect(lines.some((l) => l.includes("«анна» → «Анна»"))).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).firstName).toBe("анна");
    await normalizeNames({ apply: true, log: () => {} });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).firstName).toBe("Анна");
    expect((await db.order.findUniqueOrThrow({ where: { id: pending.id } })).contactName).toBe("Анна Петрова");
    expect((await db.order.findUniqueOrThrow({ where: { id: delivered.id } })).contactName).toBe("анна петрова");
    expect(await db.auditLog.count({ where: { action: "names.normalize", entityId: { in: [u.id, pending.id] } } })).toBe(2);
    const again = await normalizeNames({ apply: true, log: () => {} });
    expect(again).toEqual({ users: 0, orders: 0 });
  });
});
