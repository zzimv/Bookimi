// Доставка: поиск города (нормализация, ранжирование), фильтр пунктов выдачи, подстановка «из прошлого раза»,
// адресная книга, схема оформления, тарифы без API по поясам, кэш.
import { describe, expect, it } from "vitest";
import { cityCount, cityLabel, editDistance, findCity, fromLatinLayout, normalizeCity, searchCities } from "@/lib/cities";
import { filterPvz, normalizeAddress, pvzMapUrl, type Pvz } from "@/lib/pvz";
import { addToAddressBook, addressError, cleanAddress, parseAddressBook, pickPrefill, type SavedAddress } from "@/lib/delivery";
import { Checkout } from "@/lib/checkout-schema";
import { tableQuote, zoneFor } from "@/lib/ship-zones";
import { Lru } from "@/lib/lru";

const names = (q: string, n = 5) => searchCities(q, n).map((c) => c.name);

describe("город: нормализация", () => {
  it("ё и е, регистр: «Ёлки» = «ёлки» = «елки»", () => {
    expect(normalizeCity("Ёлки")).toBe("елки");
    expect(normalizeCity("ёлки")).toBe("елки");
    expect(normalizeCity("ЁЛКИ")).toBe(normalizeCity("елки"));
  });
  it("«г. Москва», «город Москва», «  москва » → «москва»", () => {
    expect(normalizeCity("г. Москва")).toBe("москва");
    expect(normalizeCity("г Москва")).toBe("москва");
    expect(normalizeCity("город Москва")).toBe("москва");
    expect(normalizeCity("  москва ")).toBe("москва");
  });
  it("дефисы и тире → пробел", () => {
    expect(normalizeCity("Ростов-на-Дону")).toBe("ростов на дону");
    expect(normalizeCity("Санкт–Петербург")).toBe("санкт петербург");
  });
  it("английская раскладка", () => {
    expect(fromLatinLayout("rjhjktd")).toBe("королев");
    expect(fromLatinLayout("москва")).toBeNull();
  });
  it("расстояние с перестановкой букв", () => {
    expect(editDistance("екатеринбрг", "екатеринбург")).toBe(1);
    expect(editDistance("казнаь", "казань")).toBe(1);
  });
});

describe("город: поиск и ранжирование", () => {
  it("офлайн-список — больше 1100 городов с регионом", () => {
    expect(cityCount()).toBeGreaterThanOrEqual(1100);
    expect(findCity("Королёв")?.region).toBe("Московская обл.");
  });
  it("меньше двух букв — пусто", () => {
    expect(searchCities("м")[0].name).toBe("Москва");
    expect(searchCities("  ")).toEqual([]);
  });
  it("«кор» → Королёв первым (префикс, затем население), Коркино в списке", () => {
    const r = searchCities("кор", 10);
    expect(r[0].name).toBe("Королёв");
    expect(cityLabel(r[0])).toBe("Королёв, Московская обл.");
    expect(r.map((c) => c.name)).toContain("Коркино");
    const pops = r.map((c) => c.population);
    expect([...pops].sort((a, b) => b - a)).toEqual(pops);
  });
  it("«королев» без ё находит Королёв", () => {
    expect(names("королев")[0]).toBe("Королёв");
  });
  it("«г. Москва» → Москва, «санкт» → Санкт-Петербург", () => {
    expect(names("г. Москва")[0]).toBe("Москва");
    expect(names("санкт")[0]).toBe("Санкт-Петербург");
  });
  it("«нижн нов» → Нижний Новгород (каждое слово — начало слова)", () => {
    expect(names("нижн нов")[0]).toBe("Нижний Новгород");
    expect(names("Н.Новгород")[0]).toBe("Нижний Новгород");
  });
  it("второе слово названия: «петербург»; уточнение регионом: «королев моск»", () => {
    expect(names("петербург")).toContain("Санкт-Петербург");
    expect(names("королев моск")[0]).toBe("Королёв");
  });
  it("лёгкие опечатки: «екатеринбрг», «новосибирк»", () => {
    expect(names("екатеринбрг")[0]).toBe("Екатеринбург");
    expect(names("новосибирк")[0]).toBe("Новосибирск");
  });
  it("точное совпадение выше префикса: «орёл» → Орёл раньше Орехово-Зуево", () => {
    const r = names("орел", 10);
    expect(r[0]).toBe("Орёл");
  });
  it("тёзки различаются регионом", () => {
    const r = searchCities("советск", 10).filter((c) => c.name === "Советск");
    expect(new Set(r.map((c) => c.region)).size).toBe(r.length);
    expect(r.length).toBeGreaterThan(1);
  });
});

const P = (code: string, address: string, metro: string | null = null, type: Pvz["type"] = "PVZ"): Pvz => ({ code, name: `Пункт ${code}`, address, workTime: "10–20", metro, type, lat: 55.9, lon: 37.8 });
const points = [P("A1", "ул. Ленина, 5"), P("A2", "пр-т Мира, 12к2", "Проспект Мира"), P("A3", "ул. Пушкина, 15", null, "POSTAMAT"), P("A4", "ул. Ленинградская, 7", "Сокол"), P("A5", "Королёва ул., 1")];

describe("пункты выдачи: фильтр по улице", () => {
  it("пустой запрос — все", () => expect(filterPvz(points, "  ")).toHaveLength(5));
  it("«ленин» — начало слова: Ленина и Ленинградская", () => expect(filterPvz(points, "ленин").map((p) => p.code)).toEqual(["A1", "A4"]));
  it("служебные слова не мешают: «ул. Ленина д. 5» = «ленина 5»", () => {
    expect(normalizeAddress("ул. Ленина, д. 5")).toBe("ленина 5");
    expect(filterPvz(points, "ул. Ленина д. 5").map((p) => p.code)).toEqual(["A1"]);
  });
  it("номер дома — точно: «пушкина 1» не находит дом 15", () => {
    expect(filterPvz(points, "пушкина 15").map((p) => p.code)).toEqual(["A3"]);
    expect(filterPvz(points, "пушкина 1")).toHaveLength(1); // «1» — начало «15»: допускаем как префикс
  });
  it("по метро и ё/е: «сокол», «королев»", () => {
    expect(filterPvz(points, "м. Сокол").map((p) => p.code)).toEqual(["A4"]);
    expect(filterPvz(points, "королев").map((p) => p.code)).toEqual(["A5"]);
  });
  it("ссылка на карту — только координаты", () => {
    const u = pvzMapUrl(points[0])!;
    expect(u).toBe("https://yandex.ru/maps/?pt=37.800000,55.900000&z=17&l=map");
    expect(pvzMapUrl({ lat: null, lon: null })).toBeNull();
  });
});

const saved = (over: Partial<SavedAddress> = {}): SavedAddress => ({
  id: "s1",
  savedAt: "2026-10-01T10:00:00Z",
  method: "cdek_pvz",
  name: "Анна Петрова",
  phone: "+79001112233",
  city: "Королёв",
  region: "Московская обл.",
  pvzCode: "KRL12",
  pvzAddress: "ул. Ленина, 5",
  ...over,
});
const methods = ["cdek_pvz", "cdek_courier"];

describe("подстановка «из прошлого раза»", () => {
  it("адресная книга — первой: имя, телефон, город, способ, пункт", () => {
    const p = pickPrefill({ saved: [saved()], lastOrder: { contactName: "Другой", contactPhone: "1", shipment: { method: "cdek_courier", address: { city: "Казань", street: "Баумана, 1" } } }, profile: { name: "Профиль" }, methods });
    expect(p.source).toBe("saved");
    expect(p.method).toBe("cdek_pvz");
    expect(p.contact).toEqual({ name: "Анна Петрова", phone: "+79001112233" });
    expect(p.address).toMatchObject({ city: "Королёв", region: "Московская обл.", pvzCode: "KRL12", pvzAddress: "ул. Ленина, 5" });
  });
  it("книги нет (NULL) — последний заказ; пункт из колонок отправления", () => {
    const p = pickPrefill({ saved: null, lastOrder: { contactName: "Иван", contactPhone: "+7900", shipment: { method: "cdek_pvz", address: { city: "Коркино" }, pvzCode: "KRK1", pvzAddress: "ул. Мира, 1", cityCode: 555 } }, profile: null, methods });
    expect(p.source).toBe("order");
    expect(p.address).toMatchObject({ city: "Коркино", pvzCode: "KRK1", cityCode: 555 });
    expect(p.contact.name).toBe("Иван");
  });
  it("заказ без «Сохранить адрес» не подставляется", () => {
    const p = pickPrefill({ saved: null, lastOrder: { contactName: "Иван", contactPhone: "+7900", shipment: { method: "cdek_pvz", address: { city: "Коркино", noPrefill: true } } }, profile: { name: "Иван П.", phone: "+7911" }, methods });
    expect(p.source).toBe("profile");
    expect(p.address.city).toBe("");
    expect(p.contact).toEqual({ name: "Иван П.", phone: "+7911" });
  });
  it("книга пуста ([] — всё удалено в кабинете) — прошлый заказ не подставляется", () => {
    const p = pickPrefill({ saved: [], lastOrder: { contactName: "Иван", shipment: { method: "cdek_pvz", address: { city: "Коркино" } } }, methods });
    expect(p.source).toBe("none");
    expect(p.address.city).toBe("");
  });
  it("способ сейчас выключен — переносим только город, без пункта", () => {
    const p = pickPrefill({ saved: [saved({ method: "pochta", street: "Ленина, 1", postalCode: "141070" })], methods });
    expect(p.method).toBeUndefined();
    expect(p.address).toEqual({ city: "Королёв", region: "Московская обл." });
  });
  it("гость / первый заказ — из черновика анкеты", () => {
    const p = pickPrefill({ saved: null, lastOrder: null, profile: { name: "", phone: "" }, draft: { phone: "+79005556677" }, methods });
    expect(p.source).toBe("draft");
    expect(p.contact.phone).toBe("+79005556677");
  });
  it("пункт выдачи не переносится в курьерский способ", () => {
    const p = pickPrefill({ saved: [saved({ method: "cdek_courier", street: "Мира, 3", flat: "12" })], methods });
    expect(p.address.pvzCode).toBeUndefined();
    expect(p.address).toMatchObject({ street: "Мира, 3", flat: "12" });
  });
});

describe("адресная книга", () => {
  it("последний — первым, без дублей, не больше трёх", () => {
    let list: SavedAddress[] | null = null;
    list = addToAddressBook(list, saved({ id: "1", pvzCode: "P1" }));
    list = addToAddressBook(list, saved({ id: "2", pvzCode: "P2" }));
    list = addToAddressBook(list, saved({ id: "3", pvzCode: "P3" }));
    list = addToAddressBook(list, saved({ id: "4", pvzCode: "P1", name: "Новое имя" }));
    expect(list.map((x) => x.id)).toEqual(["4", "3", "2"]);
    list = addToAddressBook(list, saved({ id: "5", pvzCode: "P9" }));
    expect(list).toHaveLength(3);
    expect(list[0].id).toBe("5");
  });
  it("битые записи отбрасываются, NULL ≠ []", () => {
    expect(parseAddressBook(null)).toBeNull();
    expect(parseAddressBook([])).toEqual([]);
    expect(parseAddressBook([{ foo: 1 }, saved()])).toHaveLength(1);
  });
});

describe("адрес и схема оформления", () => {
  it("cleanAddress оставляет поля способа", () => {
    const a = { city: "Королёв", cityCode: 9, region: "Московская обл.", street: "Мира 1", flat: "5", comment: "домофон", postalCode: "141070", pvzCode: "X", pvzAddress: "ул. Ленина" };
    expect(cleanAddress("cdek_pvz", a)).toEqual({ city: "Королёв", cityCode: 9, region: "Московская обл.", pvzCode: "X", pvzAddress: "ул. Ленина" });
    expect(cleanAddress("cdek_courier", a)).toEqual({ city: "Королёв", cityCode: 9, region: "Московская обл.", street: "Мира 1", flat: "5", comment: "домофон", postalCode: "141070" });
    expect(cleanAddress("pochta", a)).not.toHaveProperty("comment");
    expect(cleanAddress("pickup", a)).toEqual({ city: "Королёв" });
  });
  it("ошибки адреса по способу", () => {
    expect(addressError("cdek_pvz", { city: "" })).toBe("Укажите город");
    expect(addressError("cdek_pvz", { city: "Королёв" })).toBe("Выберите пункт выдачи СДЭК");
    expect(addressError("cdek_courier", { city: "Королёв" })).toBe("Укажите улицу и дом");
    expect(addressError("pochta", { city: "Королёв", street: "Мира 1", postalCode: "1410" })).toBe("Укажите индекс — 6 цифр");
    expect(addressError("pochta", { city: "Королёв", street: "Мира 1", postalCode: "141070" })).toBeNull();
    expect(addressError("pickup", { city: "" })).toBeNull();
  });
  const base = { bookId: "6f2cbfd8-692a-4ee4-9b16-067210bde3fc", whoPrints: "bookimi" };
  it("схема: сохранить адрес — по умолчанию да; пункт и код города проходят", () => {
    const r = Checkout.parse({ ...base, shipping: { method: "cdek_pvz", address: { city: "Королёв", cityCode: 1234, region: "Московская обл.", pvzCode: "KRL12", pvzAddress: "ул. Ленина, 5" } } });
    expect(r.saveAddress).toBe(true);
    expect(r.shipping?.address.pvzCode).toBe("KRL12");
    expect(Checkout.parse({ ...base, saveAddress: false }).saveAddress).toBe(false);
  });
  it("схема: отрицательный код города, длинный комментарий, чужой способ — отказ", () => {
    expect(Checkout.safeParse({ ...base, shipping: { method: "cdek_pvz", address: { city: "X", cityCode: -1 } } }).success).toBe(false);
    expect(Checkout.safeParse({ ...base, shipping: { method: "cdek_courier", address: { city: "X", comment: "a".repeat(201) } } }).success).toBe(false);
    expect(Checkout.safeParse({ ...base, shipping: { method: "dhl", address: { city: "X" } } }).success).toBe(false);
  });
});

describe("тарифы без API: пояса", () => {
  it("Москва и Королёв — дешевле базы, Владивосток — дороже и дольше", () => {
    const moscow = tableQuote(290, [2, 7], { city: "Королёв", region: "Московская обл." });
    const mid = tableQuote(290, [2, 7], { city: "Казань" });
    const far = tableQuote(290, [2, 7], { city: "Владивосток" });
    expect(moscow.priceRub).toBeLessThan(290);
    expect(mid.priceRub).toBe(290);
    expect(far.priceRub).toBeGreaterThan(mid.priceRub);
    expect(far.daysMax).toBeGreaterThan(mid.daysMax);
    expect(zoneFor({ city: "Неизвестноград" }).km).toBeNull();
    expect(tableQuote(290, [2, 7], { city: "Владивосток" }, { zones: false }).priceRub).toBe(290);
  });
});

describe("LRU-кэш", () => {
  it("вытесняет старое, один промис на одновременные запросы", async () => {
    const c = new Lru<number>(2, 60_000);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    let calls = 0;
    const f = () => new Promise<number>((r) => setTimeout(() => r(++calls), 5));
    const [x, y] = await Promise.all([c.wrap("k", f), c.wrap("k", f)]);
    expect(x).toBe(1);
    expect(y).toBe(1);
    expect(calls).toBe(1);
  });
});
