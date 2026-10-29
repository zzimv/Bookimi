// Адрес доставки: схема, очистка по способу, адресная книга (последние 3) и подстановка «из прошлого раза».
// Чистый модуль: используется в checkout-схеме, на сервере (заказ, кабинет) и в демо.
import { z } from "zod";

// Без .extend()/.positive(): тот же модуль собирается в демо с мини-zod (tools/demo/shims/zod.ts)
const addressShape = {
  city: z.string().trim().max(80).default(""),
  /** Код города СДЭК (из подсказки) — для калькулятора и списка ПВЗ. */
  cityCode: z.number().int().min(1).max(99_999_999).optional(),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(10).optional(),
  /** Улица и дом. */
  street: z.string().trim().max(160).optional(),
  flat: z.string().trim().max(20).optional(),
  comment: z.string().trim().max(200).optional(),
  pvzCode: z.string().trim().max(40).optional(),
  pvzAddress: z.string().trim().max(200).optional(),
};
export const ShipAddressSchema = z.object(addressShape);
export type DeliveryAddress = z.infer<typeof ShipAddressSchema>;

export const SavedAddressSchema = z.object({
  ...addressShape,
  id: z.string().max(40),
  savedAt: z.string().max(40),
  method: z.string().max(20),
  name: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(20).default(""),
});
export type SavedAddress = z.infer<typeof SavedAddressSchema>;

export const ADDRESS_BOOK_MAX = 3;

/** Только поля, нужные выбранному способу: ПВЗ — пункт, курьер — улица/квартира/комментарий, Почта — индекс. */
export function cleanAddress(method: string, a: Partial<DeliveryAddress>): DeliveryAddress {
  const base: DeliveryAddress = { city: (a.city ?? "").trim() };
  if (method === "pickup") return base;
  if (a.cityCode) base.cityCode = a.cityCode;
  if (a.region) base.region = a.region;
  if (method === "cdek_pvz") {
    if (a.pvzCode) base.pvzCode = a.pvzCode;
    if (a.pvzAddress) base.pvzAddress = a.pvzAddress;
    return base;
  }
  if (a.street) base.street = a.street;
  if (a.flat) base.flat = a.flat;
  if (a.postalCode) base.postalCode = a.postalCode;
  if (method !== "pochta" && a.comment) base.comment = a.comment;
  return base;
}

/** Что не так с адресом для способа (пусто — всё хорошо). */
export function addressError(method: string, a: DeliveryAddress, opts: { pvzListAvailable?: boolean } = {}): string | null {
  if (method === "pickup") return null;
  if (!a.city) return "Укажите город";
  if (method === "cdek_pvz" && !a.pvzCode) return opts.pvzListAvailable === false ? "Укажите пункт выдачи СДЭК" : "Выберите пункт выдачи СДЭК";
  if ((method === "cdek_courier" || method === "yandex" || method === "pochta") && !a.street) return "Укажите улицу и дом";
  if (method === "pochta" && !/^\d{6}$/.test(a.postalCode ?? "")) return "Укажите индекс — 6 цифр";
  return null;
}

const sameAddress = (x: SavedAddress, y: SavedAddress) =>
  x.method === y.method &&
  x.city.toLowerCase() === y.city.toLowerCase() &&
  (x.pvzCode ?? "") === (y.pvzCode ?? "") &&
  (x.street ?? "").toLowerCase() === (y.street ?? "").toLowerCase() &&
  (x.flat ?? "") === (y.flat ?? "");

/** Новый адрес — первым; тот же адрес не дублируется (обновляется); не больше трёх. */
export function addToAddressBook(list: SavedAddress[] | null | undefined, entry: SavedAddress, max = ADDRESS_BOOK_MAX): SavedAddress[] {
  const rest = (list ?? []).filter((x) => !sameAddress(x, entry));
  return [entry, ...rest].slice(0, max);
}

/** Разбор адресной книги из JSON-поля (битые записи отбрасываются). null — книга ни разу не заводилась. */
export function parseAddressBook(v: unknown): SavedAddress[] | null {
  if (v == null) return null;
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const r = SavedAddressSchema.safeParse(x);
    return r.success ? [r.data] : [];
  });
}

export interface LastOrderInfo {
  contactName?: string | null;
  contactPhone?: string | null;
  shipment?: { method: string; address: unknown; pvzCode?: string | null; pvzAddress?: string | null; cityCode?: number | null } | null;
}

export interface Prefill {
  source: "saved" | "order" | "profile" | "draft" | "none";
  method?: string;
  address: DeliveryAddress;
  contact: { name: string; phone: string };
}

/**
 * Подстановка в оформление.
 * Вошедший покупатель: 1) последний адрес из адресной книги; 2) если книги ещё нет — последний заказ с доставкой
 *   (кроме оформленных без «Сохранить адрес»); 3) имя и телефон из профиля.
 *   Пустая адресная книга (всё удалено в кабинете) — адрес не подставляется, только профиль.
 * Гость / новый покупатель: из текущего черновика (контакт из анкеты).
 * Способ доставки — только если он сейчас доступен; пункт выдачи — только для «СДЭК — пункт выдачи».
 */
export function pickPrefill(input: {
  saved: SavedAddress[] | null;
  lastOrder?: LastOrderInfo | null;
  profile?: { name?: string | null; phone?: string | null } | null;
  draft?: { name?: string; phone?: string } | null;
  methods: string[];
}): Prefill {
  const profileName = input.profile?.name?.trim() ?? "";
  const profilePhone = input.profile?.phone?.trim() ?? "";
  const fallbackContact = {
    name: profileName || input.draft?.name?.trim() || "",
    phone: profilePhone || input.draft?.phone?.trim() || "",
  };
  const fallbackSource: Prefill["source"] = profileName || profilePhone ? "profile" : input.draft?.name || input.draft?.phone ? "draft" : "none";
  const withMethod = (method: string, address: Partial<DeliveryAddress>, contact: { name: string; phone: string }, source: Prefill["source"]): Prefill => {
    const ok = input.methods.includes(method);
    const clean = cleanAddress(ok ? method : "cdek_courier", address);
    // Способ недоступен — переносим только город, пункт/улицу не угадываем
    const addr = ok ? clean : { city: clean.city, ...(clean.cityCode ? { cityCode: clean.cityCode } : {}), ...(clean.region ? { region: clean.region } : {}) };
    return { source, method: ok ? method : undefined, address: addr, contact: { name: contact.name || fallbackContact.name, phone: contact.phone || fallbackContact.phone } };
  };

  const saved = input.saved?.[0];
  if (saved) return withMethod(saved.method, saved, { name: saved.name, phone: saved.phone }, "saved");

  const o = input.lastOrder;
  const raw = (o?.shipment?.address ?? null) as (Partial<DeliveryAddress> & { noPrefill?: boolean }) | null;
  if (input.saved === null && o?.shipment && raw && !raw.noPrefill) {
    const addr: Partial<DeliveryAddress> = {
      ...raw,
      pvzCode: o.shipment.pvzCode ?? raw.pvzCode,
      pvzAddress: o.shipment.pvzAddress ?? raw.pvzAddress,
      cityCode: o.shipment.cityCode ?? raw.cityCode,
    };
    return withMethod(o.shipment.method, addr, { name: o.contactName ?? "", phone: o.contactPhone ?? "" }, "order");
  }
  return { source: fallbackSource, address: { city: "" }, contact: fallbackContact };
}

/** Строка адреса для кабинета, админки и письма в типографию. */
export function addressLine(a: Partial<DeliveryAddress>) {
  return [
    a.postalCode,
    a.city,
    a.pvzCode ? `ПВЗ ${a.pvzCode}${a.pvzAddress ? ` (${a.pvzAddress})` : ""}` : null,
    a.street,
    a.flat ? `кв./офис ${a.flat}` : null,
    a.comment ? `комментарий: ${a.comment}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}
