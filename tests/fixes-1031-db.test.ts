// Регрессия по отчётам тестирования 31.10.2026 (бэкенд, фронтенд) на настоящей PostgreSQL. Без DATABASE_URL — пропуск.
// 1 — групповой заказ в печать: все книги и тиражи; 2 — покупка без превью после лимита; 4 — ПДн (журнал писем после
// удаления, полная выгрузка); 5 — служебные ключи в настройках; 6 — герои при входе; 9 — один чек на заказ;
// 10 — доставка и «Я оплатил(а)», СДЭК; 11 — сбой оплаченной книги.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { setupSellerAndPayments } from "./helpers/db-setup";

const ctx = vi.hoisted(() => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_DIR = `/tmp/bk-1031-${Date.now().toString(36)}`;
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

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("исправления по отчётам 31.10: БД", async () => {
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const { saveSetting, cfg, DEFAULTS } = await import("@/lib/settings");
  const { AnswersV2 } = await import("@/lib/quiz");
  const tag = randomUUID().slice(0, 8);
  let n = 0;
  const mkUser = (extra: object = {}) =>
    db.user.create({ data: { email: `u${++n}-${tag}@test.local`, phone: `+7988${String(Date.now() + n).slice(-7)}`, referralCode: `T${tag}${n}`.slice(0, 12).toUpperCase(), ...extra } });
  const story = async (slug: string) => db.story.findFirstOrThrow({ where: { slug } });
  const contact = { name: "Анна Петрова", phone: "+79001234567" };
  const pickup = { method: "pickup" as const, address: { city: "Москва" } };

  beforeAll(async () => {
    await setupSellerAndPayments();
    await saveSetting("bulk", { ...DEFAULTS.bulk });
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  async function groupBook(userId: string, names: string[]) {
    const a = AnswersV2.parse({
      audience: "CHILD",
      hero: { name: "Маша", gender: "girl", ageGroup: "6-7" },
      story: { slug: "poslednij-den-v-nashej-gruppe" },
      group: { members: names.map((name) => ({ name })), adults: [] },
    });
    const s = await story("poslednij-den-v-nashej-gruppe");
    return db.book.create({ data: { anonId: `anon-${tag}-g${++n}`, userId, storyId: s.id, styleKey: "watercolor-air", params: a as object, status: "PREVIEW_READY", text: { title: "Последний день", spreads: [] } } });
  }
  async function readyForPrint(bookId: string) {
    await db.book.update({ where: { id: bookId }, data: { status: "FULL_READY", fullReadyAt: new Date() } });
    for (const kind of ["print-block", "print-cover"]) await db.bookFile.create({ data: { bookId, kind, storageKey: `${bookId}/files/${kind}.pdf` } });
  }

  it("1. «для каждого» в печать: все книги с файлами и тиражом, письмо — каждая книга; пока не готовы все — не отправляем", async () => {
    const { sendToPrintWhenReady, printFilesReady } = await import("@/lib/print");
    const user = await mkUser();
    const parent = await groupBook(user.id, ["Петя", "Оля"]);
    const o = await orders.createOrder(user.id, { bookId: parent.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], bulk: true, shipping: pickup, contact });
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    const items = await db.orderItem.findMany({ where: { orderId: o.id } });
    const bookIds = [...new Set(items.map((i) => i.bookId!))];
    expect(bookIds).toHaveLength(3);

    // Готова только первая — тихо ждём (без письма и алерта)
    await readyForPrint(bookIds[0]);
    const r1 = await printFilesReady(o.id);
    expect(r1).toMatchObject({ ok: false, pending: true });
    expect(await sendToPrintWhenReady(o.id)).toBeNull();
    for (const id of bookIds.slice(1)) await readyForPrint(id);

    const ph = await db.printHouse.findFirstOrThrow({ where: { isActive: true } });
    const was = { email: ph.email, apiUrl: ph.apiUrl };
    await db.printHouse.update({ where: { id: ph.id }, data: { email: "print-1031@test.local", apiUrl: null } });
    try {
      expect(await sendToPrintWhenReady(o.id)).toBeTruthy();
    } finally {
      await db.printHouse.update({ where: { id: ph.id }, data: was });
    }
    const mail = await db.auditLog.findFirstOrThrow({ where: { action: "outbox.email", details: { path: ["subject"], string_contains: o.publicCode } } });
    const text = (mail.details as { text: string }).text;
    expect(text).toContain("Количество: 3");
    expect(text).toContain("Разных книг: 3");
    for (const id of bookIds) {
      expect(text).toContain(encodeURIComponent(`${id}/files/print-block.pdf`));
      expect(text).toContain(encodeURIComponent(`${id}/files/print-cover.pdf`));
    }
    expect(text).toMatch(/Книга 1 из 3: «Последний день», герой — Маша — 1 экз\./);
    expect(text).toMatch(/Книга 3 из 3: .*герой — Оля/);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("IN_PRINT");
  });

  it("1. «для каждого» через API типографии: один многопозиционный заказ, у каждой книги свои файлы и тираж", async () => {
    const { sendToPrint } = await import("@/lib/print");
    const user = await mkUser();
    const parent = await groupBook(user.id, ["Ваня"]);
    const o = await orders.createOrder(user.id, { bookId: parent.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], bulk: true, shipping: pickup, contact });
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    const ids = [...new Set((await db.orderItem.findMany({ where: { orderId: o.id } })).map((i) => i.bookId!))];
    for (const id of ids) await readyForPrint(id);
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      calls.push({ url: String(url), body: init.body });
      return new Response(JSON.stringify({ id: "ext-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const ph = await db.printHouse.findFirstOrThrow({ where: { isActive: true } });
    await db.printHouse.update({ where: { id: ph.id }, data: { apiUrl: "https://print.test/api/orders" } });
    try {
      await sendToPrint(o.id);
    } finally {
      await db.printHouse.update({ where: { id: ph.id }, data: { apiUrl: ph.apiUrl } });
      vi.unstubAllGlobals();
    }
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body) as { qty: number; items: { qty: number; files: { block: string; cover: string } }[] };
    expect(body.qty).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((i) => i.files.block)).toEqual(ids.map((id) => expect.stringContaining(encodeURIComponent(`${id}/files/print-block.pdf`))));
  });

  it("2. лимит превью исчерпан → оформить без превью можно (текст утверждён); до лимита — нельзя", async () => {
    const { hit } = await import("@/lib/limits");
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-np`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Тёма", gender: "boy" } }, status: "TEXT_APPROVED", text: { title: "Т", spreads: [] } } });
    expect(await orders.checkoutAllowed(b, user)).toEqual({ ok: false, withoutPreview: false });
    const lim = (await cfg("limits")).previewsPerContact;
    for (let i = 0; i < lim; i++) await hit(user.email!, "preview", lim);
    expect(await orders.checkoutAllowed(b, user)).toEqual({ ok: true, withoutPreview: true });
    // Черновик без утверждённого текста — нельзя и после лимита
    expect((await orders.checkoutAllowed({ status: "TEXT_READY" }, user)).ok).toBe(false);
    // Заказ создаётся и после оплаты ставит полную сборку (превью страниц — уже в оплаченной книге)
    const o = await orders.createOrder(user.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "" } });
    expect(o.totalRub).toBeGreaterThan(0);
  });

  it("4b. удаление аккаунта обезличивает письмо типографии и алерт владельцу с текстом обращения", async () => {
    const { deleteAccount } = await import("@/lib/account");
    const { sendEmail, alertOwner } = await import("@/lib/notify");
    const user = await mkUser({ firstName: "Ксения" });
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-del`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Зарина", gender: "girl" } }, status: "FULL_READY", text: { title: "Зарина и звёзды", spreads: [] } } });
    const o = await orders.createOrder(user.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "Ксения Улицкая", phone: "+79161112233" } });
    await db.order.update({ where: { id: o.id }, data: { status: "DELIVERED", paidAt: new Date() } });
    await db.supportTicket.create({ data: { userId: user.id, orderId: o.id, contact: user.email!, message: `Здравствуйте, это мама Зарины, мой телефон ${user.phone}` } });
    await sendEmail("print-del@test.local", `Заказ на печать ${o.publicCode}`, `Заказ ${o.publicCode}\nПолучатель: Ксения Улицкая, +79161112233\nАдрес: Казань, Баумана 7, кв. 7\nКнига «Зарина и звёзды»`);
    await alertOwner("Новое обращение в поддержку", `Заказ ${o.publicCode}. Здравствуйте, это мама Зарины, мой телефон ${user.phone}`);
    expect(await deleteAccount(user.id)).toMatchObject({ ok: true });
    const rows = await db.auditLog.findMany({ where: { action: { startsWith: "outbox." }, OR: [{ details: { path: ["text"], string_contains: o.publicCode } }, { details: { path: ["subject"], string_contains: o.publicCode } }] } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dump = JSON.stringify(rows.map((r) => r.details));
    for (const pd of ["Улицкая", "Ксения", "+79161112233", user.phone!, "Баумана", "Зарин"]) expect(dump).not.toContain(pd);
    expect(rows.every((r) => (r.details as { anonymized?: boolean }).anonymized)).toBe(true);
  });

  it("4c. «Мои данные»: анкета, фото (ссылки), отзывы, обращения, черновики, адреса каналов", async () => {
    const { exportUserData } = await import("@/lib/account");
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-exp`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Зоя", gender: "girl", birthDate: "2020-05-05" }, dedication: `Для Зои ${tag}` }, status: "PREVIEW_READY" } });
    const hero = await db.hero.create({ data: { bookId: b.id, userId: user.id, role: "main", name: "Зоя", appearance: {}, interests: [] } });
    await db.photo.create({ data: { heroId: hero.id, storageKey: `${b.id}/photo-${tag}.jpg`, expiresAt: new Date(Date.now() + 86400_000) } });
    await db.quizDraft.create({ data: { anonId: `anon-${tag}-exp`, userId: user.id, answers: { hero: { name: `Черновик-${tag}` } } } });
    await db.review.create({ data: { userId: user.id, authorName: "Мама Зои", rating: 5, text: `Отзыв ${tag}` } });
    await db.supportTicket.create({ data: { userId: user.id, contact: user.email!, message: `Вопрос ${tag}` } });
    await db.notificationPref.create({ data: { userId: user.id, channel: "telegram", address: `tg-${tag}` } });
    const data = await exportUserData(user.id);
    const s2 = JSON.stringify(data);
    for (const needle of [`Для Зои ${tag}`, "2020-05-05", `Черновик-${tag}`, `Отзыв ${tag}`, `Вопрос ${tag}`, `tg-${tag}`, `photo-${tag}.jpg`, user.email!, user.phone!]) expect(s2).toContain(needle);
    expect(data.heroes[0].photos[0].url).toBeTruthy();
    expect(s2).not.toMatch(/totpSecret|deviceHashes|codeHash/);
  });

  it("5. настройки: __proto__/constructor/prototype не загрязняют прототип и не ломают сайт", async () => {
    const { parseSettingsForm } = await import("@/lib/settings-validate");
    const f = new FormData();
    f.append("f.__proto__.polluted", "yes");
    f.append("f.constructor.prototype.polluted2", "yes");
    f.append("f.printEnabled", "on");
    f.append("__bools", "__proto__.polluted3,printEnabled");
    const out = parseSettingsForm(structuredClone(DEFAULTS.flags), f);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted2).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted3).toBeUndefined();
    expect(Object.keys(out)).toEqual(["printEnabled"]);
    // Значение из БД со служебным ключом не меняет прототип настроек
    await db.setting.upsert({ where: { key: "promoBar" }, update: { value: JSON.parse('{"__proto__":{"evil":1},"text":"x"}') }, create: { key: "promoBar", value: JSON.parse('{"__proto__":{"evil":1},"text":"x"}') } });
    const bar = (await cfg("promoBar")) as Record<string, unknown>;
    expect(bar.text).toBe("x");
    expect(bar.evil).toBeUndefined();
    expect(Object.getPrototypeOf(bar)).toBe(Object.prototype);
    await saveSetting("promoBar", { ...DEFAULTS.promoBar });
  });

  it("6. вход: герои книг и черновиков браузера переходят в аккаунт, напоминание о дне рождения находит героя", async () => {
    const { verifyOtp, ANON_COOKIE } = await import("@/lib/auth");
    const { sha256 } = await import("@/lib/crypto");
    const { triggerCandidates } = await import("@/lib/triggers");
    const anon = `anon-${tag}-login`;
    ctx.cookies.set(ANON_COOKIE, anon);
    const s = await story("poslednij-den-v-nashej-gruppe");
    const book = await db.book.create({ data: { anonId: anon, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Лиза", gender: "girl" } }, status: "TEXT_READY" } });
    // День рождения через 30 дней (по МСК) — окно напоминания
    const bd = new Date(Date.now() + 30 * 86400_000 + 3 * 3600_000);
    const born = new Date(Date.UTC(bd.getUTCFullYear() - 5, bd.getUTCMonth(), bd.getUTCDate()));
    const hero = await db.hero.create({ data: { bookId: book.id, role: "main", name: "Лиза", gender: "girl", birthDate: born, appearance: {}, interests: [] } });
    const draft = await db.quizDraft.create({ data: { anonId: anon, answers: {} } });
    const draftHero = await db.hero.create({ data: { draftId: draft.id, role: "main", name: "", appearance: {}, interests: [] } });
    const email = `login-${tag}@test.local`;
    await db.otpCode.create({ data: { target: email, codeHash: sha256(`${email}:123456`), expiresAt: new Date(Date.now() + 600_000) } });
    const r = await verifyOtp(email, "123456");
    expect(r.ok).toBe(true);
    const userId = (r as { user: { id: string } }).user.id;
    expect((await db.hero.findUniqueOrThrow({ where: { id: hero.id } })).userId).toBe(userId);
    expect((await db.hero.findUniqueOrThrow({ where: { id: draftHero.id } })).userId).toBe(userId);
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).userId).toBe(userId);
    await db.user.update({ where: { id: userId }, data: { marketingOk: true } });
    const c = await triggerCandidates("hero_birthday");
    expect(c.some((x) => x.userId === userId && (x.vars as { name?: string }).name === "Лиза")).toBe(true);
    ctx.cookies.clear();
  });

  it("9. ручной чек: второй — отказ; замена — только с подтверждением, действующий чек один", async () => {
    const { attachManualReceipt, ReceiptExists } = await import("@/lib/npd");
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-rc`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Ия", gender: "girl" } }, status: "FULL_READY" } });
    const o = await orders.createOrder(user.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "" } });
    await db.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date() } });
    await db.receipt.deleteMany({ where: { orderId: o.id } });
    await attachManualReceipt(o.id, "https://lknpd.nalog.ru/api/v1/receipt/1/a/print");
    await expect(attachManualReceipt(o.id, "https://lknpd.nalog.ru/api/v1/receipt/1/b/print")).rejects.toBeInstanceOf(ReceiptExists);
    await Promise.allSettled([1, 2, 3].map(() => attachManualReceipt(o.id, "https://lknpd.nalog.ru/api/v1/receipt/1/c/print")));
    expect(await db.receipt.count({ where: { orderId: o.id, status: "issued" } })).toBe(1);
    await attachManualReceipt(o.id, "https://lknpd.nalog.ru/api/v1/receipt/1/d/print", { replace: true });
    const rs = await db.receipt.findMany({ where: { orderId: o.id } });
    expect(rs.filter((r) => r.status === "issued").map((r) => r.url)).toEqual(["https://lknpd.nalog.ru/api/v1/receipt/1/d/print"]);
    expect(rs.filter((r) => r.status === "replaced")).toHaveLength(1);
    // И на уровне БД: второй действующий чек не вставить
    await expect(db.receipt.create({ data: { orderId: o.id, regime: "npd", url: "x", amountRub: 1, status: "issued" } })).rejects.toThrow();
  });

  it("10. доставка: выключенный способ и самовывоз без адреса типографии — отказ на сервере", async () => {
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-sh`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Ия", gender: "girl" } }, status: "PREVIEW_READY" } });
    const base = { bookId: b.id, whoPrints: "bookimi" as const, formatKey: "std-hard", addons: [], contact };
    const shipping = await cfg("shipping");
    await saveSetting("shipping", { ...shipping, cdekCourier: false, pochta: false });
    try {
      const q = await orders.priceCheckout(user.id, { ...base, shipping: { method: "cdek_courier", address: { city: "Москва", street: "Тверская, 1" } } });
      expect(q.quote.errors.join(" ")).toMatch(/недоступен/);
      await expect(orders.createOrder(user.id, { ...base, shipping: { method: "pochta", address: { city: "Москва", street: "Тверская, 1", postalCode: "101000" } } })).rejects.toThrow(/недоступен/);
    } finally {
      await saveSetting("shipping", shipping);
    }
    const ph = await db.printHouse.findFirstOrThrow({ where: { isActive: true } });
    await db.printHouse.update({ where: { id: ph.id }, data: { pickupAddress: null } });
    try {
      await expect(orders.createOrder(user.id, { ...base, shipping: pickup })).rejects.toThrow(/Самовывоз сейчас недоступен/);
    } finally {
      await db.printHouse.update({ where: { id: ph.id }, data: { pickupAddress: ph.pickupAddress ?? "Москва, ул. Типографская, 1" } });
    }
    expect((await orders.createOrder(user.id, { ...base, shipping: pickup })).id).toBeTruthy();
  });

  it("10. «Я оплатил(а)»: только после выбора перевода; алерты владельцу — не больше 3 в час", async () => {
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const mk = async () => {
      const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-tr${++n}`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Ия", gender: "girl" } }, status: "PREVIEW_READY" } });
      return orders.createOrder(user.id, { bookId: b.id, whoPrints: "self", addons: [], contact: { name: "" } });
    };
    const o = await mk();
    await expect(orders.claimTransfer(o.id, user.id)).rejects.toBeInstanceOf(orders.ClaimRejected);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING_PAYMENT");
    const alerts = () => db.auditLog.count({ where: { action: "outbox.telegram", details: { path: ["text"], string_contains: "Проверьте поступление" }, createdAt: { gte: t0 } } });
    const t0 = new Date();
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? o : await mk();
      await orders.startPayment(x, "transfer");
      expect(await orders.claimTransfer(x.id, user.id)).toBeTruthy();
    }
    expect(await alerts()).toBe(3);
    expect(await db.order.count({ where: { userId: user.id, status: "AWAITING_CONFIRMATION" } })).toBe(5);
  });

  it("10. СДЭК: «упакован» → заказ в СДЭК (с ключами), трек сохраняется; без ключей — вручную", async () => {
    const user = await mkUser();
    const s = await story("poslednij-den-v-nashej-gruppe");
    const b = await db.book.create({ data: { userId: user.id, anonId: `anon-${tag}-cd`, storyId: s.id, styleKey: "watercolor-air", params: { hero: { name: "Ия", gender: "girl" } }, status: "FULL_READY" } });
    const o = await orders.createOrder(user.id, { bookId: b.id, whoPrints: "bookimi", formatKey: "std-hard", addons: [], contact, shipping: { method: "cdek_pvz", address: { city: "Москва", cityCode: 44, pvzCode: "MSK1", pvzAddress: "ул. Ленина, 1" } } });
    await db.order.update({ where: { id: o.id }, data: { status: "IN_PRINT", paidAt: new Date() } });
    // Без ключей: статус меняется, заказ в СДЭК не создаётся
    await orders.setStatus(o.id, "PACKED");
    expect((await db.shipment.findUniqueOrThrow({ where: { orderId: o.id } })).cdekUuid).toBeNull();
    // С ключами
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: { method?: string; body?: string }) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u.replace(/\?.*/, "")}`);
      const ok = (j: object) => new Response(JSON.stringify(j), { status: 200, headers: { "Content-Type": "application/json" } });
      if (u.includes("/oauth/token")) return ok({ access_token: "t", expires_in: 3600 });
      if (u.endsWith("/v2/orders") && init?.method === "POST") {
        const body = JSON.parse(init.body!) as { delivery_point: string; number: string };
        expect(body).toMatchObject({ delivery_point: "MSK1", number: o.publicCode });
        return ok({ entity: { uuid: "uuid-1031" } });
      }
      if (u.includes("/v2/orders/uuid-1031")) return ok({ entity: { cdek_number: "1234567890" } });
      return new Response("{}", { status: 404 });
    });
    process.env.CDEK_CLIENT_ID = "id";
    process.env.CDEK_CLIENT_SECRET = "secret";
    try {
      await db.order.update({ where: { id: o.id }, data: { status: "IN_PRINT" } });
      await orders.setStatus(o.id, "PACKED");
      await orders.setStatus(o.id, "PACKED"); // повтор — второй заказ в СДЭК не создаётся
    } finally {
      delete process.env.CDEK_CLIENT_ID;
      delete process.env.CDEK_CLIENT_SECRET;
      vi.unstubAllGlobals();
    }
    const sh = await db.shipment.findUniqueOrThrow({ where: { orderId: o.id } });
    expect(sh).toMatchObject({ cdekUuid: "uuid-1031", trackNumber: "1234567890" });
    expect(calls.filter((c) => c.startsWith("POST") && c.endsWith("/v2/orders"))).toHaveLength(1);
  });

  it("11. сбой оплаченной книги: оператору — один алерт в сутки", async () => {
    const { alertPaidFailure } = await import("@/lib/notify");
    const id = randomUUID();
    const before = await db.auditLog.count({ where: { action: "outbox.telegram", details: { path: ["text"], string_contains: id } } });
    await alertPaidFailure(id, "GPU timeout");
    await alertPaidFailure(id, "GPU timeout");
    expect(await db.auditLog.count({ where: { action: "outbox.telegram", details: { path: ["text"], string_contains: id } } })).toBe(before + 1);
  });
});
