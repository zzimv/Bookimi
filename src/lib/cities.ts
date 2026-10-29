// Поиск города по первым буквам: нормализация (ё/е, дефисы, «г.», раскладка), ранжирование
// «префикс → слово → опечатка», внутри — по населению. Чистый модуль: работает на сервере и в демо.
// Данные — src/lib/cities.json (scripts/gen-cities.mjs, источник и лицензия — ASSUMPTIONS.md).
import data from "./cities.json";

export interface City {
  name: string;
  region: string;
  population: number;
  lat: number;
  lon: number;
  /** Код города СДЭК (null — неизвестен, ищется через API). */
  cdekCode: number | null;
}

type Row = [string, number, number, number, number, number | null];
const D = data as unknown as { regions: string[]; rows: Row[] };

let all: (City & { n: string; words: string[]; rn: string[] })[] | null = null;
function cities() {
  if (!all) {
    all = D.rows.map(([name, ri, population, lat, lon, cdekCode]) => {
      const n = normalizeCity(name);
      const region = D.regions[ri] ?? "";
      return { name, region, population, lat, lon, cdekCode, n, words: n.split(" "), rn: normalizeCity(region).split(" ").filter(Boolean) };
    });
  }
  return all;
}

export const cityCount = () => D.rows.length;

const LAT = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const CYR = "йцукенгшщзхъфывапролджэячсмитьбюё";

/** Набрано в английской раскладке («rjhjktd» → «королев»). */
export function fromLatinLayout(s: string) {
  if (!/^[a-z\[\];',.`\s-]+$/i.test(s) || !/[a-z]/i.test(s)) return null;
  return s
    .toLowerCase()
    .split("")
    .map((ch) => {
      const i = LAT.indexOf(ch);
      return i >= 0 ? CYR[i] : ch;
    })
    .join("");
}

/** «г. Королёв», «Ростов-на-Дону», «  санкт  » → «королев», «ростов на дону», «санкт». */
export function normalizeCity(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[‐-―−-]+/g, " ")
    .replace(/[«»"'().,;:!?/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s*(г|город|пгт|пос|поселок|село|деревня)\s+(?=\S)/, "")
    .trim();
}

/** Расстояние Дамерау — Левенштейна с ранним выходом (для коротких строк). */
export function editDistance(a: string, b: string, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/**
 * Ранг совпадения (меньше — лучше), null — не подходит.
 * 0 — точное название, 1 — начало названия, 2 — каждое слово запроса — начало слова названия по порядку
 * («нижн нов»), 3 — начало второго и далее слова («петербург»), 4 — с опечаткой (≥ 4 букв).
 * Хвост запроса, не совпавший с названием, может уточнять регион: «королев моск».
 */
export function matchRank(c: { n: string; words: string[]; rn: string[] }, q: string, qWords: string[]): number | null {
  if (c.n === q) return 0;
  if (c.n.startsWith(q)) return 1;
  // Слова запроса по порядку — начала слов названия; оставшиеся — начала слов региона
  let wi = 0;
  let qi = 0;
  for (; qi < qWords.length && wi < c.words.length; wi++) if (c.words[wi].startsWith(qWords[qi])) qi++;
  if (qi > 0 && c.words[0].startsWith(qWords[0])) {
    const rest = qWords.slice(qi);
    if (rest.every((w) => c.rn.some((r) => r.startsWith(w)))) return rest.length ? 1.5 : 2;
  }
  if (qWords.length === 1 && c.words.slice(1).some((w) => w.startsWith(q))) return 3;
  if (q.length >= 4 && c.n[0] === q[0]) {
    const max = q.length >= 7 ? 2 : 1;
    const head = qWords[0];
    // Опечатка в начале названия: сравниваем с префиксом той же длины (±1 буква)
    for (const len of [head.length, head.length + 1, head.length - 1]) {
      if (len < 4) continue;
      if (editDistance(head, c.n.slice(0, len), max) <= max) {
        const rest = qWords.slice(1);
        if (rest.every((w) => c.words.some((x) => x.startsWith(w)) || c.rn.some((r) => r.startsWith(w)))) return 4;
      }
    }
  }
  return null;
}

/** Подсказки по 2+ буквам: ранг совпадения, затем население. */
export function searchCities(query: string, limit = 10): City[] {
  let q = normalizeCity(query);
  if (q.replace(/\s/g, "").length < 2) return [];
  const alt = fromLatinLayout(q);
  const variants = alt ? [q, normalizeCity(alt)] : [q];
  const scored: { c: City; r: number }[] = [];
  for (const c of cities()) {
    let best: number | null = null;
    for (const v of variants) {
      const r = matchRank(c, v, v.split(" "));
      if (r != null && (best == null || r < best)) best = r;
    }
    if (best != null) scored.push({ c, r: best });
  }
  scored.sort((a, b) => a.r - b.r || b.c.population - a.c.population);
  return scored.slice(0, limit).map(({ c }) => ({ name: c.name, region: c.region, population: c.population, lat: c.lat, lon: c.lon, cdekCode: c.cdekCode }));
}

/** Город по точному названию (и региону, если есть тёзки). */
export function findCity(name: string, region?: string): City | null {
  const n = normalizeCity(name);
  const list = cities().filter((c) => c.n === n);
  const hit = (region ? list.find((c) => normalizeCity(c.region) === normalizeCity(region)) : null) ?? list[0];
  return hit ? { name: hit.name, region: hit.region, population: hit.population, lat: hit.lat, lon: hit.lon, cdekCode: hit.cdekCode } : null;
}

/** Подпись для подсказки: «Королёв, Московская обл.». */
export const cityLabel = (c: Pick<City, "name" | "region">) => (c.region ? `${c.name}, ${c.region}` : c.name);
