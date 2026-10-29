// Пункты выдачи СДЭК: общий тип, фильтр по улице/метро, ссылка на карту. Чистый модуль (сервер и демо).
import { normalizeCity } from "./cities";

export interface Pvz {
  code: string;
  name: string;
  address: string;
  workTime: string;
  metro: string | null;
  type: "PVZ" | "POSTAMAT";
  lat: number | null;
  lon: number | null;
  /** Пометка для демо-стенда: «демо-пункт». */
  demo?: boolean;
}

// \b в JS не видит границ кириллических слов — границы задаём пробелами
const STREET_WORDS = /(?<=^|\s)(ул|улица|пр|пр т|просп|проспект|пер|переулок|б р|бульвар|ш|шоссе|пл|площадь|наб|набережная|д|дом|корп|стр|мкр|микрорайон|м|метро|г)(?=\s|$)/g;

/** «ул. Ленина, д. 5» и «Ленина 5» сравниваются одинаково. */
export function normalizeAddress(s: string) {
  return normalizeCity(s).replace(STREET_WORDS, " ").replace(/\s+/g, " ").trim();
}

/** Каждое слово запроса — начало слова в адресе, названии или метро («лен 5», «пушк», «м. сокол»). */
export function filterPvz(points: Pvz[], query: string): Pvz[] {
  const q = normalizeAddress(query);
  if (!q) return points;
  const words = q.split(" ");
  return points.filter((p) => {
    const hay = normalizeAddress(`${p.address} ${p.metro ?? ""} ${p.name}`).split(" ");
    return words.every((w) => hay.some((h) => h.startsWith(w) || (/^\d/.test(w) && h === w)));
  });
}

/** Ссылка «Показать на карте»: только координаты точки, без данных покупателя. */
export function pvzMapUrl(p: Pick<Pvz, "lat" | "lon">) {
  if (p.lat == null || p.lon == null) return null;
  return `https://yandex.ru/maps/?pt=${p.lon.toFixed(6)},${p.lat.toFixed(6)}&z=17&l=map`;
}

export const PVZ_TYPE_TITLE: Record<Pvz["type"], string> = { PVZ: "Пункт выдачи", POSTAMAT: "Постамат" };
