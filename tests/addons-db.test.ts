// Допы по аудиториям на настоящей PostgreSQL (DATABASE_URL; без БД — пропускается):
// миграция 0008 на базе «как до неё», расчёт и заказ по аудитории книги, «Добавить к книге» в кабинете,
// передача в типографию — файлы допов и «другой подрядчик».
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { ADDONS } from "@/lib/catalog-defaults";
import { setupSellerAndPayments } from "./helpers/db-setup";

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

/** Допы, как их создавал seed до 0008 (описание = название). */
const OLD_SEED = [
  ["height-chart", "PHYSICAL", "Именной ростомер с героем", 790, null, true],
  ["gift-box", "PHYSICAL", "Подарочная упаковка с картой приключений и открыткой", 490, null, true],
  ["stickers", "PHYSICAL", "Наклейки с героем (лист А5)", 350, null, true],
  ["poster", "PHYSICAL", "Постер с обложкой А3", 590, null, true],
  ["audiobook", "DIGITAL", "Аудиокнига: озвучка диктором", 390, null, false],
  ["audio-self", "DIGITAL", "Аудиокнига вашим голосом: запишите сами в кабинете", 490, null, false],
  ["coloring", "DIGITAL", "Раскраска PDF по иллюстрациям книги", 290, null, false],
  ["second-copy", "MODIFIER", "Второй экземпляр книги", null, 30, true],
  ["urgent", "MODIFIER", "Срочное изготовление", 500, null, true],
  ["cartoon", "DIGITAL", "Мультфильм по книге: 2 минуты с вашими героями и озвучкой", 690, null, false],
  ["cartoon-own-voice", "MODIFIER", "Мультфильм своим голосом: озвучите сами по готовому сценарию", 400, null, false],
] as const;

d("миграция 0008_addon_audiences", () => {
  const schema = `mig_${randomUUID().slice(0, 8)}`;
  let c: pg.Client;
  beforeAll(async () => {
    c = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    await c.query(`CREATE SCHEMA "${schema}"`);
    await c.query(`SET search_path TO "${schema}"`);
  });
  afterAll(async () => {
    await c.query(`DROP SCHEMA "${schema}" CASCADE`);
    await c.end();
  });

  it("база до 0008 + seed старого вида → аудитории, новые допы и правки админки сохраняются", async () => {
    const dir = "prisma/migrations";
    const names = readdirSync(dir).filter((n) => /^\d{4}_/.test(n)).sort();
    expect(names).toContain("0008_addon_audiences"); // дальше — более поздние миграции, тест проверяет переход через 0008
    for (const n of names.filter((x) => x < "0008")) await c.query(readFileSync(join(dir, n, "migration.sql"), "utf8").replace('CREATE SCHEMA IF NOT EXISTS "public";', ""));
    for (const [i, [key, kind, title, price, pct, print]] of OLD_SEED.entries()) {
      await c.query(`INSERT INTO "Addon" ("id","key","kind","title","description","priceRub","percentOff","requiresPrint","sortOrder") VALUES (gen_random_uuid(),$1,$2,$3,$3,$4,$5,$6,$7) ON CONFLICT ("key") DO NOTHING`, [key, kind, title, price, pct, print, i]);
    }
    // Владелец уже поправил описание и цену постера в админке — миграция их не трогает
    await c.query(`UPDATE "Addon" SET "description" = 'Мой текст', "priceRub" = 650 WHERE "key" = 'poster'`);
    await c.query(readFileSync(join(dir, "0008_addon_audiences", "migration.sql"), "utf8"));
    const rows = (await c.query(`SELECT * FROM "Addon" ORDER BY "sortOrder"`)).rows as { key: string; title: string; description: string; priceRub: number | null; audiences: string[]; supplier: string; isActive: boolean; sortOrder: number; requiresPrint: boolean; kind: string }[];
    expect(rows.map((r) => r.key)).toEqual(ADDONS.map((a) => a.key));
    for (const [i, a] of ADDONS.entries()) {
      const r = rows.find((x) => x.key === a.key)!;
      expect(r.audiences, a.key).toEqual([...a.audiences]);
      expect(r.supplier, a.key).toBe(a.supplier);
      expect(r.isActive, a.key).toBe(a.active);
      expect(r.sortOrder, a.key).toBe(i);
      expect(r.kind, a.key).toBe(a.kind);
      expect(r.requiresPrint, a.key).toBe(a.print);
      if (a.key !== "poster") {
        // cartoon/cartoon-own-voice переименованы позже, миграцией 0010 («Оживление книги»)
        if (!a.key.startsWith("cartoon")) expect(r.title, a.key).toBe(a.title);
        if (!a.key.startsWith("cartoon")) expect(r.description, a.key).toBe(a.description);
        expect(r.priceRub, a.key).toBe(a.price);
      }
    }
    const poster = rows.find((r) => r.key === "poster")!;
    expect([poster.description, poster.priceRub]).toEqual(["Мой текст", 650]);
    const cols = await c.query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Addon' AND column_name IN ('audiences','supplier') ORDER BY column_name`, [schema]);
    expect(cols.rows.map((r) => [r.column_name, r.data_type])).toEqual([["audiences", "ARRAY"], ["supplier", "text"]]);
  });
});

d("допы по аудитории книги: БД", async () => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = `/tmp/bk-addons-${Date.now().toString(36)}`;
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const tag = randomUUID().slice(0, 8);
  let user: { id: string };
  const PARAMS = {
    CHILD: { audience: "CHILD", hero: { name: "Маша", gender: "girl" } },
    TEEN: { audience: "TEEN", hero: { name: "Миша", gender: "boy", age: 14 } },
    ADULT: { audience: "ADULT", hero: { name: "Анна", gender: "girl", age: 32 } },
    PET: { audience: "PET", hero: { name: "Барсик", gender: "boy" }, pet: { species: "cat", breed: "сфинкс" } },
  };
  async function book(aud: keyof typeof PARAMS, paid = false) {
    const story = await db.story.findFirstOrThrow({ where: { isActive: true, audience: aud } });
    return db.book.create({
      data: { userId: user.id, storyId: story.id, styleKey: "kind-classic", params: PARAMS[aud], status: paid ? "FULL_READY" : "PREVIEW_READY", paidFull: paid, fullReadyAt: paid ? new Date() : null, text: { title: "Тест", spreads: [] } },
    });
  }
  const ship = { method: "pickup" as const, address: { city: "Москва" } };
  const contact = { name: "Тест Тестов", phone: "+79001234567" };

  beforeAll(async () => {
    await setupSellerAndPayments();
    user = await db.user.create({ data: { email: `addons-${tag}@test.local`, referralCode: `A${tag}`.slice(0, 12).toUpperCase() } });
  });
  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  it("seed: у каждого допа — аудитории и изготовитель как в catalog-defaults", async () => {
    const rows = await db.addon.findMany();
    for (const a of ADDONS) {
      const r = rows.find((x) => x.key === a.key);
      expect(r, a.key).toBeTruthy();
      expect(r!.audiences, a.key).toEqual([...a.audiences]);
      expect(r!.supplier, a.key).toBe(a.supplier);
    }
  });

  it("каталог для расчёта: свои допы у каждой аудитории", async () => {
    const keys = async (aud: string) => (await orders.catalogForPricing(aud)).addons.map((a) => a.key);
    expect(await keys("CHILD")).toEqual(expect.arrayContaining(["height-chart", "coloring", "gift-box"]));
    const teen = await keys("TEEN");
    expect(teen).toEqual(expect.arrayContaining(["teen-poster", "wallpapers", "notebook"]));
    expect(teen).not.toContain("height-chart");
    expect(teen).not.toContain("coloring");
    expect(await keys("PET")).not.toContain("pet-magnet"); // выключен: другой подрядчик
    expect(await keys("ADULT")).toEqual(expect.arrayContaining(["premium-box", "adult-calendar", "postcards"]));
  });

  it("оформление: доп чужой аудитории — ошибка, своей — в заказе", async () => {
    const teen = await book("TEEN");
    const bad = await orders.priceCheckout(user.id, { bookId: teen.id, whoPrints: "bookimi", formatKey: "std-hard", addons: ["height-chart"], shipping: ship, contact });
    expect(bad.quote.errors.join()).toMatch(/не для этой книги/);
    await expect(orders.createOrder(user.id, { bookId: teen.id, whoPrints: "bookimi", formatKey: "std-hard", addons: ["coloring"], shipping: ship, contact })).rejects.toThrow(/не для этой книги/);
    const o = await orders.createOrder(user.id, { bookId: teen.id, whoPrints: "bookimi", formatKey: "std-hard", addons: ["teen-poster", "wallpapers"], shipping: ship, contact });
    const items = await db.orderItem.findMany({ where: { orderId: o.id } });
    expect(items.map((i) => i.refKey).sort()).toEqual(["std-hard", "teen-poster", "wallpapers"]);
    const pet = await book("PET");
    const q = await orders.priceCheckout(user.id, { bookId: pet.id, whoPrints: "self", addons: ["audiobook"], contact });
    expect(q.quote.errors.join()).toMatch(/не для этой книги/);
  });

  it("кабинет «Добавить к книге»: цифровые допы аудитории, купленное исчезает, повтор не продаётся", async () => {
    const teen = await book("TEEN", true);
    const later = (await orders.laterAddonsFor(teen.id)).map((a) => a.key);
    expect(later).toContain("wallpapers");
    expect(later).toContain("audiobook");
    expect(later).not.toContain("coloring");
    expect(later).not.toContain("cartoon"); // своя панель
    expect(later.every((k) => ADDONS.find((a) => a.key === k)?.kind === "DIGITAL")).toBe(true);
    const child = await book("CHILD", true);
    expect((await orders.laterAddonsFor(child.id)).map((a) => a.key)).toEqual(expect.arrayContaining(["coloring", "audiobook"]));
    const pet = await book("PET", true);
    expect((await orders.laterAddonsFor(pet.id)).map((a) => a.key)).toEqual([]);

    const o = await orders.createOrder(user.id, { bookId: teen.id, whoPrints: "self", addons: ["wallpapers"], addonsOnly: true, contact: { name: "" } });
    expect(o.totalRub).toBe(290 - o.discountRub);
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    expect((await orders.laterAddonsFor(teen.id)).map((a) => a.key)).not.toContain("wallpapers");
    await expect(orders.createOrder(user.id, { bookId: teen.id, whoPrints: "self", addons: ["wallpapers"], addonsOnly: true, contact: { name: "" } })).rejects.toThrow(/уже куплен/);
    // Физический доп к оплаченной книге из кабинета (без печати) — нельзя
    await expect(orders.createOrder(user.id, { bookId: teen.id, whoPrints: "self", addons: ["teen-poster"], addonsOnly: true, contact: { name: "" } })).rejects.toThrow(/только для печатной/);
  });

  it("типография: файлы допов обязательны, «другой подрядчик» не уходит в типографию", async () => {
    const { printFilesReady, sendToPrint, printAddonKeys } = await import("@/lib/print");
    // Рамку включаем на время теста (по умолчанию выключена)
    await db.addon.update({ where: { key: "framed-print" }, data: { isActive: true } });
    const adult = await book("ADULT", true);
    const o = await orders.createOrder(user.id, { bookId: adult.id, whoPrints: "bookimi", formatKey: "std-hard", addons: ["adult-calendar", "framed-print"], shipping: ship, contact });
    await db.addon.update({ where: { key: "framed-print" }, data: { isActive: false } });
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    const items = await db.orderItem.findMany({ where: { orderId: o.id } });
    expect(await printAddonKeys(items)).toEqual(["adult-calendar"]);
    for (const kind of ["print-block", "print-cover"]) await db.bookFile.create({ data: { bookId: adult.id, kind, storageKey: `${adult.id}/files/${kind}.pdf` } });
    expect(await printFilesReady(o.id)).toMatchObject({ ok: false, error: expect.stringMatching(/print-addon-adult-calendar/) });
    await db.bookFile.create({ data: { bookId: adult.id, kind: "print-addon-adult-calendar", storageKey: `${adult.id}/files/cal.pdf` } });
    expect(await printFilesReady(o.id)).toMatchObject({ ok: true });

    const ph = await db.printHouse.findFirstOrThrow({ where: { isActive: true } });
    const was = ph.email;
    await db.printHouse.update({ where: { id: ph.id }, data: { email: "print@test.local" } });
    try {
      await sendToPrint(o.id);
    } finally {
      await db.printHouse.update({ where: { id: ph.id }, data: { email: was } });
    }
    const mail = await db.auditLog.findFirstOrThrow({ where: { action: "outbox.email", AND: [{ details: { path: ["to"], equals: "print@test.local" } }, { details: { path: ["subject"], string_contains: o.publicCode } }] }, orderBy: { createdAt: "desc" } });
    const text = (mail.details as { text: string }).text;
    expect(text).toContain("Календарь 2027 А4 — 210×297 мм + вылеты 3 мм, 13 стр.");
    expect(text).toContain("Допы: Календарь 2027 с иллюстрациями книги");
    expect(text).not.toContain("в раме");
    expect(await db.auditLog.findFirst({ where: { action: "print.other_supplier", entityId: o.id } })).toBeTruthy();
  });
});
