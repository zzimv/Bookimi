// Путь создания книги на настоящей PostgreSQL (DATABASE_URL; без БД — пропускается):
// согласия один раз (включая отдельную галочку для фото других детей), срок фото 24 ч без книги и 7 дней с книгой,
// заказ «для каждого в группе» — N копий одним заказом.
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

d("путь создания: БД", async () => {
  process.env.DEMO_MODE = "1";
  process.env.STORAGE_DRIVER = "local";
  const { db } = await import("@/lib/db");
  const { purgeExpiredPhotos, photoExpiry } = await import("@/lib/photos");
  const { grantConsents, hasConsent, consentState } = await import("@/lib/consent");
  const { attachPhotosToBook, openDraft, ownedPhotos } = await import("@/lib/draft");
  const { saveSetting, DEFAULTS } = await import("@/lib/settings");
  const { AnswersV2 } = await import("@/lib/quiz");
  const { bulkQuote, groupChildren } = await import("@/lib/bulk");
  const orders = await import("@/lib/orders");
  const tag = randomUUID().slice(0, 8);
  const limits = { photoTtlDays: 7, photoTtlNoBookHours: 24 };

  afterAll(async () => {
    const { getBoss } = await import("@/lib/queue");
    await (await getBoss()).stop({ graceful: false }).catch(() => {});
  });

  it("согласия — один раз: повтор не создаёт дублей; фото других детей — отдельная галочка", async () => {
    const who = { anonId: `anon-${tag}-c` };
    expect(await consentState(who)).toEqual({ pd: false, photo: false, group: false });
    await grantConsents(who, { pd: true, photo: true }, { docVersion: "t" });
    await grantConsents(who, { pd: true, photo: true }, { docVersion: "t" });
    expect(await db.consent.count({ where: { anonId: who.anonId } })).toBe(2);
    // Фото других детей группы без отдельной галочки не разрешены
    expect(await hasConsent("GROUP_PHOTO", who)).toBe(false);
    await grantConsents(who, { group: true }, { docVersion: "t" });
    await grantConsents(who, { pd: true, photo: true, group: true }, { docVersion: "t" });
    expect(await consentState(who)).toEqual({ pd: true, photo: true, group: true });
    expect(await db.consent.count({ where: { anonId: who.anonId } })).toBe(3);
  });

  async function draftPhoto(anonId: string, createdAt: Date) {
    const draft = await openDraft({ anonId });
    const hero = await db.hero.create({ data: { draftId: draft.id, role: "main", name: "", appearance: {}, interests: [] } });
    return db.photo.create({ data: { heroId: hero.id, storageKey: `draft/${draft.id}/${randomUUID()}.jpg`, createdAt, expiresAt: photoExpiry(createdAt, false, limits) } });
  }
  async function book(anonId: string, userId?: string, params: object = { hero: { name: "Тест", gender: "boy" } }) {
    const story = await db.story.findFirstOrThrow({ where: { slug: "poslednij-den-v-nashej-gruppe" } });
    return db.book.create({ data: { anonId, userId, storyId: story.id, styleKey: "watercolor-air", params: params as object, status: "PREVIEW_READY", text: { title: "Последний день", spreads: [] } } });
  }

  it("фото без книги удаляется через 24 часа, с книгой — через 7 дней", async () => {
    await saveSetting("limits", { ...DEFAULTS.limits, photoTtlNoBookHours: 24, photoTtlDays: 7 });
    const anonId = `anon-${tag}-ttl`;
    const t0 = new Date(Date.now() - 1000);
    const lonely = await draftPhoto(anonId, t0);
    const kept = await draftPhoto(anonId, t0);
    expect(lonely.expiresAt.getTime() - t0.getTime()).toBe(24 * 3600_000);
    // Книга создана — фото переезжает к герою книги и получает 7 дней от загрузки
    const b = await book(anonId);
    const bookHero = await db.hero.create({ data: { bookId: b.id, role: "main", name: "Тест", appearance: {}, interests: [] } });
    expect(await ownedPhotos({ anonId }, [lonely.id, kept.id])).toHaveLength(2);
    await attachPhotosToBook({ anonId }, (id) => (id === kept.id ? bookHero.id : undefined), [kept.id], 7);
    const moved = await db.photo.findUniqueOrThrow({ where: { id: kept.id } });
    expect(moved.heroId).toBe(bookHero.id);
    expect(moved.expiresAt.getTime() - t0.getTime()).toBe(7 * 86400_000);
    // Чужая cookie не видит и не получает фото
    expect(await ownedPhotos({ anonId: `anon-${tag}-other` }, [lonely.id, kept.id])).toHaveLength(0);

    await purgeExpiredPhotos(new Date(t0.getTime() + 23 * 3600_000));
    expect((await db.photo.findUniqueOrThrow({ where: { id: lonely.id } })).deletedAt).toBeNull();
    await purgeExpiredPhotos(new Date(t0.getTime() + 25 * 3600_000));
    expect((await db.photo.findUniqueOrThrow({ where: { id: lonely.id } })).deletedAt).not.toBeNull();
    expect((await db.photo.findUniqueOrThrow({ where: { id: kept.id } })).deletedAt).toBeNull();
    await purgeExpiredPhotos(new Date(t0.getTime() + 8 * 86400_000));
    expect((await db.photo.findUniqueOrThrow({ where: { id: kept.id } })).deletedAt).not.toBeNull();
  });

  it("срок «без книги» уменьшили в настройках — старые фото черновика удаляются по новому сроку", async () => {
    const anonId = `anon-${tag}-ttl2`;
    const t0 = new Date(Date.now() - 1000);
    const p = await draftPhoto(anonId, t0);
    await saveSetting("limits", { ...DEFAULTS.limits, photoTtlNoBookHours: 2 });
    await purgeExpiredPhotos(new Date(t0.getTime() + 3 * 3600_000));
    expect((await db.photo.findUniqueOrThrow({ where: { id: p.id } })).deletedAt).not.toBeNull();
    await saveSetting("limits", { ...DEFAULTS.limits });
  });

  it("заказ «для каждого в группе»: N книг одним заказом, строка на книгу, скидка за количество", async () => {
    const user = await db.user.create({ data: { email: `bulk-${tag}@test.local`, phone: `+7999${String(Date.now()).slice(-7)}`, referralCode: `B${tag}`.slice(0, 12).toUpperCase() } });
    const names = ["Аня", "Петя", "Ваня", "Оля", "Катя", "Миша", "Даша", "Гоша", "Соня", "Лиза", "Глеб", "Варя", "Егор", "Мила", "Ева", "Рома", "Ника", "Тимур", "Вера", "Марк", "Полина", "Артём", "Злата", "Фёдор", "Алиса"];
    const a = AnswersV2.parse({
      audience: "CHILD",
      hero: { name: "Маша", gender: "girl", ageGroup: "6-7" },
      story: { slug: "poslednij-den-v-nashej-gruppe" },
      occasion: { key: "vypusknoj-v-sadu" },
      group: { members: names.map((name) => ({ name })), adults: [{ name: "Мария Ивановна", role: "воспитатель" }, { name: "Ольга Петровна", role: "помощник воспитателя" }] },
    });
    const parent = await book(`anon-${tag}-bulk`, user.id, a);
    await saveSetting("bulk", { ...DEFAULTS.bulk });
    const input = { bookId: parent.id, whoPrints: "self" as const, addons: [], bulk: true, contact: { name: "Тест" } };
    const priced = await orders.priceCheckout(user.id, input);
    expect(priced.quote.lines).toHaveLength(26);
    const fmt = await db.productFormat.findUniqueOrThrow({ where: { key: "pdf" } });
    expect(priced.quote.totalRub).toBe(bulkQuote({ whoPrints: "self", heroes: groupChildren(a).map((c) => c.name) }, [{ key: "pdf", kind: "PDF", title: fmt.title, priceRub: fmt.priceRub }]).totalRub);
    expect((priced.quote as { bulkPct?: number }).bulkPct).toBe(35);

    const order = await orders.createOrder(user.id, input);
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    expect(items).toHaveLength(26);
    const ids = new Set(items.map((i) => i.bookId));
    expect(ids.size).toBe(26);
    const copies = await db.book.findMany({ where: { parentBookId: parent.id }, orderBy: { createdAt: "asc" } });
    expect(copies).toHaveLength(25);
    const first = AnswersV2.parse(copies[0].params);
    expect(first.hero.name).toBe("Аня");
    expect(first.group!.members.map((m) => m.name)).toContain("Маша");
    expect(first.group!.members.map((m) => m.name)).not.toContain("Аня");
    expect(first.group!.adults).toHaveLength(2);
    // Ленивая генерация: тексты первых копий — в очереди, остальные ждут оплаты
    expect(copies.slice(0, 2).every((c) => c.status === "TEXT_QUEUED")).toBe(true);
    expect(copies.slice(2).every((c) => c.status === "DRAFT")).toBe(true);
    // Повторное оформление не плодит копии
    await orders.createOrder(user.id, input);
    expect(await db.book.count({ where: { parentBookId: parent.id } })).toBe(25);
    expect(order.totalRub).toBe(priced.quote.totalRub);
  });
});
