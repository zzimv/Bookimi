// ShippingProvider: СДЭК (API v2), Почта России, Яндекс Доставка. Без ключей — тарифы из настроек.
import { cfg } from "./settings";
import { Lru } from "./lru";
import { findCity, normalizeCity, searchCities, type City } from "./cities";
import { tableQuote } from "./ship-zones";
import type { Pvz } from "./pvz";
import type { DeliveryAddress } from "./delivery";
import { normalizeName } from "./names";

export type ShipMethod = "pickup" | "cdek_pvz" | "cdek_courier" | "pochta" | "yandex";

export interface ShipQuote {
  method: ShipMethod;
  title: string;
  priceRub: number;
  daysMin: number;
  daysMax: number;
  source: "api" | "table";
}

export type ShipAddress = DeliveryAddress;

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
export const hasCdek = () => Boolean(process.env.CDEK_CLIENT_ID && process.env.CDEK_CLIENT_SECRET);
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
      to_location: await cdekLocation(to),
      packages: [parcel(books)],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`СДЭК ${r.status}`);
  const j = (await r.json()) as { total_sum: number; period_min: number; period_max: number };
  return { priceRub: Math.ceil(j.total_sum), daysMin: j.period_min, daysMax: j.period_max };
}


// ───────── География СДЭК: подсказки городов, коды, пункты выдачи (кэш в памяти процесса) ─────────
async function cdekGet<T>(path: string, params: Record<string, string | number | boolean>): Promise<T> {
  const token = await cdekAuth();
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const r = await fetch(`${cdekBase()}${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`СДЭК ${path} ${r.status}`);
  return (await r.json()) as T;
}

export interface CityHit {
  name: string;
  region: string;
  code: number | null;
  lat: number | null;
  lon: number | null;
}

const suggestCache = new Lru<CityHit[]>(1000, 24 * 3600_000);
const codeCache = new Lru<number | null>(2000, 7 * 24 * 3600_000);
const pvzCache = new Lru<Pvz[]>(300, 6 * 3600_000);

/** GET /v2/location/suggest/cities: «Королёв, Московская обл., Россия» → { name, region, code }. */
async function cdekSuggest(q: string): Promise<CityHit[]> {
  return suggestCache.wrap(normalizeCity(q), async () => {
    const list = await cdekGet<{ code: number; full_name: string }[]>("/v2/location/suggest/cities", { name: q, country_code: "RU" });
    return list.slice(0, 20).map((x) => {
      const parts = x.full_name.split(",").map((t) => t.trim()).filter((t) => t && t !== "Россия");
      return { name: parts[0] ?? x.full_name, region: parts.slice(1).join(", "), code: x.code, lat: null, lon: null };
    });
  });
}

const sameRegion = (a: string, b: string) => {
  const x = normalizeCity(a).split(" ")[0] ?? "";
  const y = normalizeCity(b).split(" ")[0] ?? "";
  return !x || !y || x.slice(0, 5) === y.slice(0, 5);
};

/**
 * Подсказки города: офлайн-список (ранжирование и население) + коды и малые населённые пункты из СДЭК.
 * СДЭК не ответил или ключей нет — только офлайн-список.
 */
export async function suggestCities(q: string, limit = 10): Promise<{ cities: CityHit[]; source: "cdek" | "offline" }> {
  const offline: CityHit[] = searchCities(q, limit).map((c: City) => ({ name: c.name, region: c.region, code: c.cdekCode, lat: c.lat, lon: c.lon }));
  if (!hasCdek()) return { cities: offline, source: "offline" };
  try {
    const remote = await cdekSuggest(q);
    const used = new Set<CityHit>();
    for (const c of offline) {
      const m = remote.find((r) => !used.has(r) && normalizeCity(r.name) === normalizeCity(c.name) && sameRegion(r.region, c.region));
      if (m) {
        c.code = m.code;
        used.add(m);
      }
    }
    const nq = normalizeCity(q);
    const extra = remote.filter((r) => !used.has(r) && normalizeCity(r.name).startsWith(nq));
    return { cities: [...offline, ...extra].slice(0, limit), source: "cdek" };
  } catch (e) {
    console.error("[geo]", (e as Error).message);
    return { cities: offline, source: "offline" };
  }
}

/** Код города СДЭК по названию и региону: офлайн-список → GET /v2/location/cities. */
export async function cdekCityCode(city: string, region?: string): Promise<number | null> {
  const known = findCity(city, region)?.cdekCode;
  if (known) return known;
  if (!hasCdek() || !city) return null;
  return codeCache.wrap(`${normalizeCity(city)}|${normalizeCity(region ?? "")}`, async () => {
    const list = await cdekGet<{ code: number; city: string; region?: string }[]>("/v2/location/cities", { country_codes: "RU", city, size: 10 });
    const hit = list.find((x) => normalizeCity(x.city) === normalizeCity(city) && (!region || sameRegion(x.region ?? "", region))) ?? list[0];
    return hit?.code ?? null;
  });
}

async function cdekLocation(to: ShipAddress) {
  const code = to.cityCode ?? (to.city ? await cdekCityCode(to.city, to.region).catch(() => null) : null);
  if (code) return { code };
  return to.postalCode ? { postal_code: to.postalCode } : { address: to.city };
}

interface CdekPoint {
  code: string;
  name?: string;
  type?: string;
  work_time?: string;
  nearest_metro_station?: string;
  nearest_station?: string;
  is_handout?: boolean;
  location?: { address?: string; address_full?: string; latitude?: number; longitude?: number };
}

/** GET /v2/deliverypoints?city_code=…: пункты выдачи и постаматы города (только с выдачей посылок). */
export async function cdekPoints(cityCode: number): Promise<Pvz[]> {
  if (!hasCdek()) return [];
  return pvzCache.wrap(String(cityCode), async () => {
    const list = await cdekGet<CdekPoint[]>("/v2/deliverypoints", { city_code: cityCode, country_code: "RU", is_handout: true, type: "ALL" });
    return list
      .filter((p) => p.code && p.is_handout !== false)
      .map((p) => ({
        code: p.code,
        name: p.name ?? "",
        address: p.location?.address ?? p.location?.address_full ?? "",
        workTime: p.work_time ?? "",
        metro: p.nearest_metro_station || null,
        type: (p.type === "POSTAMAT" ? "POSTAMAT" : "PVZ") as Pvz["type"],
        lat: p.location?.latitude ?? null,
        lon: p.location?.longitude ?? null,
      }))
      .sort((a, b) => a.address.localeCompare(b.address, "ru"));
  });
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
  if ((method === "cdek_pvz" || method === "cdek_courier") && hasCdek() && to.city) {
    try {
      const q = await cdekCalc(method, to, books);
      return { method, title: METHOD_TITLES[method], ...q, source: "api" };
    } catch (e) {
      console.error("[shipping]", (e as Error).message);
    }
  }
  // Почта России и Яндекс Доставка: API подключается ключами POCHTA_*/YANDEX_DELIVERY_*; до этого — таблица
  // Тариф из настроек + надбавка по удалённости города от склада (src/lib/ship-zones.ts)
  const t = tableQuote(s.fallbackRub[method] ?? 350, s.fallbackDays[method] ?? [3, 10], to, { zones: s.distanceMarkup, fromCity: process.env.SHIP_FROM_CITY });
  return { method, title: METHOD_TITLES[method], ...t, source: "table" };
}

/** Создание отправления в СДЭК после печати (POST /v2/orders). Без ключей — трек вносит оператор вручную. */
export async function createCdekOrder(o: {
  code: string;
  method: "cdek_pvz" | "cdek_courier";
  name: string;
  phone: string;
  address: ShipAddress;
  books: number;
}) {
  if (!hasCdek()) return null;
  if (o.method === "cdek_pvz" && !o.address.pvzCode) throw new Error("Не выбран пункт выдачи СДЭК");
  const token = await cdekAuth();
  const street = [o.address.street, o.address.flat && `кв. ${o.address.flat}`].filter(Boolean).join(", ");
  const r = await fetch(`${cdekBase()}/v2/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: o.code,
      tariff_code: o.method === "cdek_pvz" ? 136 : 137,
      shipment_point: process.env.CDEK_SHIPMENT_POINT,
      delivery_point: o.method === "cdek_pvz" ? o.address.pvzCode : undefined,
      to_location:
        o.method === "cdek_courier"
          ? { ...(o.address.cityCode ? { code: o.address.cityCode } : {}), address: `${o.address.city}, ${street}`, postal_code: o.address.postalCode }
          : undefined,
      comment: o.method === "cdek_courier" ? o.address.comment : undefined,
      recipient: { name: o.name, phones: [{ number: o.phone }] },
      packages: [{ number: "1", ...parcel(o.books), items: [{ name: "Книга, изготовленная на заказ", ware_key: o.code, payment: { value: 0 }, cost: 0, weight: 450, amount: o.books }] }],
    }),
  });
  if (!r.ok) throw new Error(`СДЭК order ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { entity?: { uuid: string } };
  return j.entity?.uuid ?? null;
}

/** Параметры отправления из заказа: пункт выдачи и код города — из колонок Shipment (миграция 0004). */
export function cdekOrderInput(order: {
  publicCode: string;
  contactName: string | null;
  contactPhone: string | null;
  shipment: { method: string; address: unknown; pvzCode: string | null; cityCode: number | null } | null;
  books: number;
}) {
  const sh = order.shipment;
  if (!sh || (sh.method !== "cdek_pvz" && sh.method !== "cdek_courier")) return null;
  const address = { ...(sh.address as ShipAddress), pvzCode: sh.pvzCode ?? (sh.address as ShipAddress).pvzCode, cityCode: sh.cityCode ?? (sh.address as ShipAddress).cityCode };
  return { code: order.publicCode, method: sh.method, name: normalizeName(order.contactName ?? ""), phone: order.contactPhone ?? "", address, books: order.books } as Parameters<typeof createCdekOrder>[0];
}

/** Способ доставки разрешён сейчас: включён в настройках; самовывоз — только если у типографии есть адрес. */
export async function shippingMethodError(method: string, pickupAddress?: string | null): Promise<string | null> {
  const allowed = await availableMethods(pickupAddress);
  if (allowed.includes(method as ShipMethod)) return null;
  if (method === "pickup") return "Самовывоз сейчас недоступен — выберите доставку СДЭК";
  return "Этот способ доставки сейчас недоступен — выберите другой";
}

/**
 * Пункт выдачи СДЭК при оформлении: с ключами — код проверяется по API (пункт есть в городе и выдаёт посылки),
 * адрес берётся из СДЭК, а не из браузера. Без ключей — как ввёл покупатель (оператор сверит вручную).
 * СДЭК не ответил — принимаем как есть и пишем в лог (заказ не теряем).
 */
export async function verifyPvz(address: ShipAddress): Promise<{ ok: true; address: ShipAddress } | { ok: false; error: string }> {
  if (!address.pvzCode) return { ok: false, error: "Выберите пункт выдачи СДЭК" };
  if (!hasCdek()) return { ok: true, address };
  if (!address.cityCode) return { ok: false, error: "Выберите город из подсказки, затем пункт выдачи" };
  let points: Pvz[];
  try {
    points = await cdekPoints(address.cityCode);
  } catch (e) {
    console.error("[shipping] проверка ПВЗ:", (e as Error).message);
    return { ok: true, address };
  }
  const p = points.find((x) => x.code === address.pvzCode);
  if (!p) return { ok: false, error: "Такого пункта выдачи СДЭК нет в выбранном городе — выберите пункт заново" };
  return { ok: true, address: { ...address, pvzAddress: p.address || address.pvzAddress } };
}

/** Номер отправления СДЭК (cdek_number) по uuid заказа: появляется через несколько секунд после создания. */
export async function cdekTrackNumber(uuid: string): Promise<string | null> {
  if (!hasCdek()) return null;
  const j = await cdekGet<{ entity?: { cdek_number?: string } }>(`/v2/orders/${encodeURIComponent(uuid)}`, {});
  return j.entity?.cdek_number ?? null;
}
