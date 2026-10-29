// Тарифы без API (нет ключей СДЭК или сервис не ответил): базовый тариф из настроек + надбавка по удалённости
// города от склада (по координатам из офлайн-списка). Это ориентир — в сводке заказа он так и подписан.
import { findCity, type City } from "./cities";

/** Пояса от склада: до, км → надбавка, ₽ и дни. */
export const ZONES: { km: number; addRub: number; addDays: number }[] = [
  { km: 80, addRub: -40, addDays: -1 }, // свой город и пригород
  { km: 800, addRub: 0, addDays: 0 },
  { km: 2000, addRub: 90, addDays: 1 },
  { km: 4000, addRub: 190, addDays: 3 },
  { km: Infinity, addRub: 340, addDays: 6 },
];

export function distanceKm(a: Pick<City, "lat" | "lon">, b: Pick<City, "lat" | "lon">) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Надбавка к табличному тарифу для города; неизвестный город — без надбавки. */
export function zoneFor(to: { city?: string; region?: string }, fromCity = "Москва") {
  const from = findCity(fromCity);
  const dest = to.city ? findCity(to.city, to.region) : null;
  if (!from || !dest) return { addRub: 0, addDays: 0, km: null as number | null };
  const km = distanceKm(from, dest);
  const z = ZONES.find((x) => km <= x.km)!;
  return { addRub: z.addRub, addDays: z.addDays, km: Math.round(km) };
}

/** Табличная цена и сроки с поясом. */
export function tableQuote(baseRub: number, days: [number, number], to: { city?: string; region?: string }, opts: { zones?: boolean; fromCity?: string } = {}) {
  const z = opts.zones === false ? { addRub: 0, addDays: 0 } : zoneFor(to, opts.fromCity);
  const priceRub = Math.max(0, baseRub + z.addRub);
  const daysMin = Math.max(1, days[0] + z.addDays);
  const daysMax = Math.max(daysMin, days[1] + z.addDays);
  return { priceRub, daysMin, daysMax };
}
