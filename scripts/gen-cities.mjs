// Офлайн-список городов для подсказок «Город» (src/lib/cities.json).
// Источник: npm-пакет russia-cities-data (ISC, © Timur Arbaev, https://github.com/arbaev/russia-cities):
// 1231 город России с регионом, населением (перепись 2021) и координатами.
//   npm pack russia-cities-data && tar xzf russia-cities-data-*.tgz
//   node scripts/gen-cities.mjs package/russia-cities.json
// Коды городов СДЭК в открытых данных нет — заполнены только достоверно известные (Москва, Санкт-Петербург),
// остальные null: при ключах СДЭК код берётся из /v2/location/suggest/cities (src/lib/cities-server.ts).
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("Укажите путь к russia-cities.json");
  process.exit(1);
}
const raw = JSON.parse(readFileSync(src, "utf8"));
const CDEK = { "Москва": 44, "Санкт-Петербург": 137 };

/** «Московская обл.», «Краснодарский край», «Респ. Татарстан», «Ханты-Мансийский АО». */
function regionLabel(r) {
  switch (r.type) {
    case "Область":
      return `${r.name} обл.`;
    case "Край":
      return `${r.name} край`;
    case "Автономный округ":
    case "Автономная область":
      return `${r.name} АО`;
    case "Республика":
      return (r.fullname ?? `Республика ${r.name}`).replace(/Республика/, "Респ.").replace(" /Якутия/", " (Якутия)").replace(" - ", " — ");
    default:
      return ""; // города федерального значения
  }
}

const regions = [];
const rows = raw
  .map((c) => {
    const label = c.name === "Севастополь" || c.region.type === "Город" ? "" : regionLabel(c.region);
    let ri = regions.indexOf(label);
    if (ri < 0) ri = regions.push(label) - 1;
    return [c.name, ri, c.population ?? 0, +c.coords.lat.toFixed(3), +c.coords.lon.toFixed(3), CDEK[c.name] ?? null];
  })
  .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], "ru"));

const out = {
  source: "russia-cities-data 1.0.6 (ISC, © Timur Arbaev) — https://github.com/arbaev/russia-cities",
  fields: ["name", "region", "population", "lat", "lon", "cdekCode"],
  regions,
  rows,
};
writeFileSync(new URL("../src/lib/cities.json", import.meta.url), JSON.stringify(out));
console.log(`городов: ${rows.length}, регионов: ${regions.length}`);
