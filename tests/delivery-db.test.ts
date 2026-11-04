// Доставка на настоящей PostgreSQL (DATABASE_URL): пункт выдачи в колонках Shipment, адресная книга в профиле,
// «не сохранять адрес», подстановка во второй заказ. Без БД — пропускается.
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const d = process.env.DATABASE_URL ? describe : describe.skip;

d("доставка: заказ и адресная книга", async () => {
  process.env.DEMO_MODE = "1";
  const { db } = await import("@/lib/db");
  const orders = await import("@/lib/orders");
  const { parseAddressBook, pickPrefill } = await import("@/lib/delivery");
  const tag = randomUUID().slice(0, 8);

  async function setup() {
    const u = await db.user.create({ data: { email: `ship-${tag}-${Math.random()}@test.local`, referralCode: `S${randomUUID().slice(0, 10)}`.toUpperCase(), deviceHashes: [] } });
    const story = await db.story.findFirstOrThrow({ where: { isActive: true, NOT: { segments: { has: "kids-0-3" } } } });
    const b = await db.book.create({ data: { userId: u.id, storyId: story.id, styleKey: "watercolor-air", params: {}, status: "PREVIEW_READY", text: { title: "Т", spreads: [] } } });
    const fmt = await db.productFormat.findFirstOrThrow({ where: { kind: "PRINT", isActive: true } });
    return { u, b, fmt };
  }

  it("ПВЗ: код и адрес пункта — в Shipment, адрес — в адресной книге; второй заказ подставляет", async () => {
    const { u, b, fmt } = await setup();
    const o = await orders.createOrder(u.id, {
      bookId: b.id,
      whoPrints: "bookimi",
      formatKey: fmt.key,
      addons: [],
      shipping: { method: "cdek_pvz", address: { city: "Королёв", region: "Московская обл.", pvzCode: "KRL12", pvzAddress: "ул. Ленина, 5", street: "лишнее" } },
      contact: { name: "Анна Петрова", phone: "+79001112233" },
    });
    const sh = await db.shipment.findUniqueOrThrow({ where: { orderId: o.id } });
    expect(sh.pvzCode).toBe("KRL12");
    expect(sh.pvzAddress).toBe("ул. Ленина, 5");
    expect((sh.address as { street?: string }).street).toBeUndefined();
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    const book = parseAddressBook(user.savedAddresses)!;
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ name: "Анна Петрова", phone: "+79001112233", city: "Королёв", pvzCode: "KRL12", method: "cdek_pvz" });
    const p = pickPrefill({ saved: book, methods: ["cdek_pvz", "cdek_courier"] });
    expect(p.contact.name).toBe("Анна Петрова");
    expect(p.address.pvzCode).toBe("KRL12");
  });

  it("«Сохранить адрес» снят: книга не заводится, заказ помечен noPrefill", async () => {
    const { u, b, fmt } = await setup();
    const o = await orders.createOrder(u.id, {
      bookId: b.id,
      whoPrints: "bookimi",
      formatKey: fmt.key,
      addons: [],
      saveAddress: false,
      shipping: { method: "cdek_courier", address: { city: "Казань", street: "Баумана, 1", flat: "3", comment: "домофон 3" } },
      contact: { name: "Иван", phone: "+79000000000" },
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.savedAddresses).toBeNull();
    const last = await db.order.findUniqueOrThrow({ where: { id: o.id }, select: { contactName: true, contactPhone: true, shipment: true } });
    expect(pickPrefill({ saved: null, lastOrder: last, profile: { name: "", phone: "" }, methods: ["cdek_courier"] }).address.city).toBe("");
  });
});
