// ShippingProvider: СДЭК (API v2), Почта России, Яндекс Доставка. Без ключей — тарифы из настроек.
import { cfg } from "./settings";

export type ShipMethod = "pickup" | "cdek_pvz" | "cdek_courier" | "pochta" | "yandex";

export interface ShipQuote {
  method: ShipMethod;
  title: string;
  priceRub: number;
  daysMin: number;
  daysMax: number;
  source: "api" | "table";
}

export interface ShipAddress {
  city: string;
  postalCode?: string;
  street?: string;
  pvzCode?: string;
}

export const METHOD_TITLES: Record<ShipMethod, string> = {
  pickup: "Заберу сам в типографии",
  cdek_pvz: "СДЭК — пункт выдачи",
  cdek_courier: "СДЭК — курьером",
  pochta: "Почта России",
  yandex: "Яндекс Доставка",
};

// Посылка с одной книгой 21×21 в коробке: ~0,6 кг
const parcel = (books: number) => ({ weight: 400 + books * 450, length: 32, width: 26, height: 4 + books * 2 });

let cdekToken: { v: string; exp: number } | null = null;
const cdekBase = () => (process.env.CDEK_TEST_MODE === "true" ? "https://api.edu.cdek.ru" : "https://api.cdek.ru");

async function cdekAuth() {
  if (cdekToken && cdekToken.exp > Date.now() + 60_000) return cdekToken.v;
  const r = await fetch(
    `${cdekBase()}/v2/oauth/token?grant_type=client_credentials&client_id=${process.env.CDEK_CLIENT_ID}&client_secret=${process.env.CDEK_CLIENT_SECRET}`,
    { method: "POST" },
  );
  if (!r.ok) throw new Error(`СДЭК auth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cdekToken = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function cdekCalc(method: "cdek_pvz" | "cdek_courier", to: ShipAddress, books: number) {
  const token = await cdekAuth();
  const r = await fetch(`${cdekBase()}/v2/calculator/tariff`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tariff_code: method === "cdek_pvz" ? 136 : 137, // склад-склад / склад-дверь
      from_location: { code: Number(process.env.CDEK_FROM_CITY_CODE ?? 44) },
      to_location: to.postalCode ? { postal_code: to.postalCode } : { address: to.city },
      packages: [parcel(books)],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`СДЭК ${r.status}`);
  const j = (await r.json()) as { total_sum: number; period_min: number; period_max: number };
  return { priceRub: Math.ceil(j.total_sum), daysMin: j.period_min, daysMax: j.period_max };
}

export async function availableMethods(pickupAddress?: string | null): Promise<ShipMethod[]> {
  const s = await cfg("shipping");
  const out: ShipMethod[] = [];
  if (pickupAddress) out.push("pickup");
  if (s.cdekPvz) out.push("cdek_pvz");
  if (s.cdekCourier) out.push("cdek_courier");
  if (s.pochta) out.push("pochta");
  if (s.yandex) out.push("yandex");
  return out;
}

export async function shipQuote(method: ShipMethod, to: ShipAddress, books: number): Promise<ShipQuote> {
  const s = await cfg("shipping");
  if (method === "pickup") return { method, title: METHOD_TITLES.pickup, priceRub: 0, daysMin: 0, daysMax: 0, source: "table" };
  if ((method === "cdek_pvz" || method === "cdek_courier") && process.env.CDEK_CLIENT_ID) {
    try {
      const q = await cdekCalc(method, to, books);
      return { method, title: METHOD_TITLES[method], ...q, source: "api" };
    } catch (e) {
      console.error("[shipping]", (e as Error).message);
    }
  }
  // Почта России и Яндекс Доставка: API подключается ключами POCHTA_*/YANDEX_DELIVERY_*; до этого — таблица
  const [dMin, dMax] = s.fallbackDays[method] ?? [3, 10];
  return { method, title: METHOD_TITLES[method], priceRub: s.fallbackRub[method] ?? 350, daysMin: dMin, daysMax: dMax, source: "table" };
}

/** Создание отправления в СДЭК после печати. Без ключей — трек вносит оператор вручную. */
export async function createCdekOrder(o: {
  code: string;
  method: "cdek_pvz" | "cdek_courier";
  name: string;
  phone: string;
  address: ShipAddress;
  books: number;
}) {
  if (!process.env.CDEK_CLIENT_ID) return null;
  const token = await cdekAuth();
  const r = await fetch(`${cdekBase()}/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: o.code,
      tariff_code: o.method === "cdek_pvz" ? 136 : 137,
      shipment_point: process.env.CDEK_SHIPMENT_POINT,
      delivery_point: o.method === "cdek_pvz" ? o.address.pvzCode : undefined,
      to_location: o.method === "cdek_courier" ? { address: `${o.address.city}, ${o.address.street ?? ""}`, postal_code: o.address.postalCode } : undefined,
      recipient: { name: o.name, phones: [{ number: o.phone }] },
      packages: [{ number: "1", ...parcel(o.books), items: [{ name: "Книга, изготовленная на заказ", ware_key: o.code, payment: { value: 0 }, cost: 0, weight: 450, amount: o.books }] }],
    }),
  });
  if (!r.ok) throw new Error(`СДЭК order ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { entity?: { uuid: string } };
  return j.entity?.uuid ?? null;
}
