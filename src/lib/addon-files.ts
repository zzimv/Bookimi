// Файлы допов по иллюстрациям книги: что печатает типография (PDF с вылетами 3 мм) и что получает покупатель (PNG-обои).
//  постер / принт А3 · стикеры (лист А5 + контур резки) · закладки 5×15 · обложка скетчбука А5 · открытки 10×15 ·
//  календарь 2027 А4 (обложка + 12 месяцев) · «паспорт питомца» 10×15 · открытка и наклейка премиум-коробки · обои.
// HTML собирается чистыми функциями (тесты проверяют размеры и число страниц), PDF — Chromium (src/lib/pdf.ts),
// PNG — sharp. Ростомер и упаковка с картой (дети) делает типография по своему шаблону — как раньше, без наших файлов.
import { esc, fonts, uri, type BookPageData } from "./pdf";
import { calendarYear, holidayLine, transferLine, WEEKDAYS_RU } from "./calendar";
import { plainSpread } from "./spread-markup";
import { normalizeName } from "./declension";

export const BLEED_MM = 3;
const SAFE = 5;
export const CALENDAR_YEAR = 2027;

export interface AddonFileSpec {
  /** BookFile.kind: print-addon-* — только типографии; addon-* — покупателю в кабинет. */
  kind: string;
  label: string;
  type: "pdf" | "png";
  /** Обрезной формат, мм (PDF: страница = формат + 2 × вылет). */
  wMm?: number;
  hMm?: number;
  bleedMm?: number;
  pages?: number;
  /** PNG: размер в пикселях. */
  px?: [number, number];
  /** Для типографии: материал и обработка (уходит в письмо заказа). */
  note?: string;
}

const A3 = { wMm: 297, hMm: 420 };
const A4 = { wMm: 210, hMm: 297 };
const A5 = { wMm: 148, hMm: 210 };
const CARD = { wMm: 150, hMm: 100 };
const STRIP = { wMm: 50, hMm: 150 };

const pdf = (key: string, label: string, size: { wMm: number; hMm: number }, pages: number, note: string, suffix = ""): AddonFileSpec => ({
  kind: `print-addon-${key}${suffix}`,
  label,
  type: "pdf",
  ...size,
  bleedMm: BLEED_MM,
  pages,
  note,
});

const POSTER_NOTE = "А3 297×420 мм, мелованная матовая 250 г/м², без полей (вылеты 3 мм)";
const STICKER_NOTE = "А5, самоклеящаяся плёнка, плоттерная надсечка: стр. 1 — печать, стр. 2 — контур резки (линия CutContour)";
const CARD_NOTE = "10×15 см, картон 300 г/м², двусторонняя 4+4: нечётные страницы — лицо, чётные — оборот";
const CAL_NOTE = "Настенный перекидной А4 на пружине сверху: 13 листов (обложка + 12 месяцев), мелованная 200 г/м², 4+0, картонная подложка с ригелем";

/** Какие файлы делает каждый доп. Нет в списке — доп без наших файлов (ростомер, упаковка, аудио, модификаторы). */
export const ADDON_FILES: Record<string, AddonFileSpec[]> = {
  poster: [pdf("poster", "Постер А3", A3, 1, POSTER_NOTE)],
  "teen-poster": [pdf("teen-poster", "Постер А3", A3, 1, POSTER_NOTE)],
  "adult-print": [pdf("adult-print", "Принт А3", A3, 1, POSTER_NOTE.replace("матовая 250", "матовая 300"))],
  "pet-poster": [pdf("pet-poster", "Постер А3", A3, 1, POSTER_NOTE)],
  stickers: [pdf("stickers", "Наклейки А5", A5, 2, STICKER_NOTE.replace("плёнка", "бумага"))],
  "teen-stickers": [pdf("teen-stickers", "Стикерпак А5", A5, 2, STICKER_NOTE.replace("плёнка", "виниловая плёнка с ламинацией"))],
  "teen-bookmarks": [pdf("teen-bookmarks", "Закладки 5×15 (4 шт.)", STRIP, 8, "4 закладки 50×150 мм, картон 300 г/м², 4+4 (страницы парами: лицо, оборот), матовая ламинация, скруглённые углы")],
  bookmark: [pdf("bookmark", "Закладка 5×15", STRIP, 2, "Закладка 50×150 мм, картон 300 г/м², 4+4 (стр. 1 — лицо, стр. 2 — оборот), матовая ламинация")],
  notebook: [pdf("notebook", "Обложка скетчбука А5", A5, 2, "Скетчбук А5 на пружине по левому краю: стр. 1 — лицевая обложка, стр. 2 — задняя, картон 300 г/м² с ламинацией; блок — 48 листов офсет 120 г/м² без линовки")],
  postcards: [pdf("postcards", "Открытки 10×15 (6 шт.)", CARD, 12, CARD_NOTE)],
  "pet-postcards": [pdf("pet-postcards", "Открытки 10×15 (4 шт.)", CARD, 8, CARD_NOTE), pdf("pet-postcards", "Наклейки А5", A5, 2, STICKER_NOTE.replace("плёнка", "бумага"), "-stickers")],
  "adult-calendar": [pdf("adult-calendar", `Календарь ${CALENDAR_YEAR} А4`, A4, 13, CAL_NOTE)],
  "pet-calendar": [pdf("pet-calendar", `Календарь ${CALENDAR_YEAR} А4`, A4, 13, CAL_NOTE)],
  "pet-passport": [pdf("pet-passport", "«Паспорт питомца» 10×15", CARD, 2, "Карточка 10×15 см, картон 300 г/м², 4+4 (стр. 1 — лицо, стр. 2 — оборот), матовая ламинация — по ней можно писать ручкой")],
  "premium-box": [
    pdf("premium-box", "Открытка 10×15", CARD, 2, "Открытка в коробку: 10×15 см, дизайнерский картон 300 г/м², 4+4"),
    pdf("premium-box", "Наклейка на крышку 10×10", { wMm: 100, hMm: 100 }, 1, "Наклейка на крышку коробки 100×100 мм, самоклеящаяся бумага, ламинация; коробка — чёрная самосборная из микрогофрокартона под формат книги", "-label"),
  ],
  wallpapers: [
    { kind: "addon-wallpaper-phone", label: "Обои для телефона", type: "png", px: [1170, 2532] },
    { kind: "addon-wallpaper-desktop", label: "Обои для компьютера", type: "png", px: [2560, 1440] },
  ],
};

export const addonFileSpecs = (key: string) => ADDON_FILES[key] ?? [];
/** Допы заказа, для которых нужны файлы типографии. */
export const printAddonKinds = (keys: string[]) => keys.flatMap((k) => addonFileSpecs(k).filter((f) => f.type === "pdf").map((f) => f.kind));

/** Данные для файлов допов: книга + кличка/порода питомца. */
export interface AddonArt extends BookPageData {
  pet?: { species?: string; breed?: string; furColor?: string };
}

// ───────── общая вёрстка ─────────
type Img = { data: Buffer; contentType: string };
const INK = "#1e4d3b";
const CREAM = "#fbf6ea";
const GOLD = "#c8a24a";

function css(W: number, H: number) {
  return `${fonts()}
  @page{size:${W}mm ${H}mm;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}mm}
  body{font-family:Manrope,sans-serif;color:#1a2b24;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:${W}mm;height:${H}mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
  .img{position:absolute;background-size:cover;background-repeat:no-repeat;background-position:center}
  h1,h2,.head{font-family:Nunito,sans-serif;font-weight:800}
  .mark{position:absolute;bottom:0.5mm;right:0.5mm;font-size:1pt;color:#fff}`;
}

/** Картинка блоком: абсолютные мм от края страницы (с вылетом). */
const pic = (img: Img, x: number, y: number, w: number, h: number, extra = "") =>
  `<div class="img" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;background-image:url(${uri(img)});${extra}"></div>`;

const page = (inner: string, style = "") => `<section class="page" style="${style}">${inner}</section>`;

const firstSentence = (text: string, max = 110) => {
  const t = plainSpread(text).replace(/\s+/g, " ").trim();
  const m = t.match(/^(.{20,}?[.!?…])\s/);
  const s = m ? m[1] : t;
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : s;
};

/** Иллюстрация n (1–12) — по кругу; нет разворотов — обложка. */
const spread = (a: AddonArt, n: number): Img => (a.spreads.length ? a.spreads[(n - 1 + a.spreads.length) % a.spreads.length].image : a.cover);

export interface AddonHtml {
  html: string;
  wMm: number;
  hMm: number;
  pages: number;
}

function doc(spec: AddonFileSpec, pages: string[]): AddonHtml {
  const b = spec.bleedMm ?? 0;
  const W = spec.wMm! + 2 * b;
  const H = spec.hMm! + 2 * b;
  return { html: `<style>${css(W, H)}</style>${pages.join("")}`, wMm: W, hMm: H, pages: pages.length };
}

const petWord = (a: AddonArt) => (a.pet?.species === "cat" ? (a.heroGender === "girl" ? "кошка" : "кот") : a.pet?.species === "dog" ? (a.heroGender === "girl" ? "собака" : "пёс") : "питомец");

// ───────── постер / принт А3 ─────────
function poster(key: string, a: AddonArt, spec: AddonFileSpec) {
  const B = BLEED_MM;
  const W = spec.wMm! + 2 * B, H = spec.hMm! + 2 * B;
  const code = `<span class="mark">${esc(a.orderCode ?? "")}</span>`;
  if (key === "adult-print") {
    // Паспарту: светлое поле 30 мм, иллюстрация-разворот, подпись курсивом
    const m = B + 30;
    const w = W - 2 * m;
    return page(`<div style="position:absolute;inset:0;background:${CREAM}"></div>${pic(spread(a, 6), m, m, w, w * 1.18)}
      <p style="position:absolute;left:${m}mm;right:${m}mm;top:${m + w * 1.18 + 12}mm;text-align:center;font-size:16pt;font-style:italic;color:#4a4a42">${esc(a.title)}</p>
      <p style="position:absolute;left:${m}mm;right:${m}mm;bottom:${B + 22}mm;text-align:center;font-size:8pt;letter-spacing:.3em;color:#9a917c">БУКИМИ</p>${code}`);
  }
  if (key === "teen-poster") {
    // В стиле книги: иллюстрация во весь лист, название — плашкой снизу, крупно и контрастно
    return page(`${pic(spread(a, 1), 0, 0, W, H)}<div style="position:absolute;left:0;right:0;bottom:0;height:${110 + B}mm;background:linear-gradient(transparent,rgba(10,16,30,.92) 55%)"></div>
      <h1 style="position:absolute;left:${B + 18}mm;right:${B + 18}mm;bottom:${B + 34}mm;color:#fff;font-size:44pt;line-height:1.02;text-transform:uppercase;letter-spacing:.02em">${esc(a.title)}</h1>
      <p style="position:absolute;left:${B + 18}mm;bottom:${B + 20}mm;color:#9fe3ff;font-size:12pt;letter-spacing:.25em">${esc(a.heroName.toUpperCase())} · ${a.heroGender === "girl" ? "ГЛАВНАЯ ГЕРОИНЯ" : "ГЛАВНЫЙ ГЕРОЙ"}</p>${code}`);
  }
  if (key === "pet-poster") {
    return page(`<div style="position:absolute;inset:0;background:${CREAM}"></div>${pic(a.cover, 0, 0, W, H * 0.74)}
      <h1 style="position:absolute;left:0;right:0;top:${H * 0.74 + 14}mm;text-align:center;font-size:72pt;color:${INK}">${esc(a.heroName)}</h1>
      <p style="position:absolute;left:0;right:0;bottom:${B + 22}mm;text-align:center;font-size:14pt;color:#6b6250">${esc(a.title)}</p>${code}`);
  }
  // Дети: обложка книги с названием
  return page(`${pic(a.cover, 0, 0, W, H)}<div style="position:absolute;left:0;right:0;bottom:0;height:${90 + B}mm;background:linear-gradient(transparent,rgba(20,40,30,.75))"></div><h1 style="position:absolute;left:${B + 20}mm;right:${B + 20}mm;bottom:${B + 30}mm;color:#fff;font-size:40pt;line-height:1.1;text-shadow:0 2mm 6mm rgba(0,0,0,.45)">${esc(a.title)}</h1>${code}`);
}

// ───────── наклейки: лист + контур резки ─────────
interface Sticker {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  img?: Img;
  text?: string;
  color?: string;
}
function stickerSet(key: string, a: AddonArt): Sticker[] {
  const B = BLEED_MM;
  const x0 = B + SAFE + 2;
  const teen = key === "teen-stickers";
  const pet = key.startsWith("pet");
  const girl = a.heroGender === "girl";
  const words = teen
    ? [a.heroName, girl ? "Главная героиня" : "Главный герой", "Не спойлерить!", "Сюжет — мой", "Глава 13 скоро"]
    : pet
      ? [a.heroName, a.pet?.species === "cat" ? "Мяу!" : "Гав!", `Лучший ${petWord(a) === "кошка" || petWord(a) === "собака" ? "друг" : petWord(a)}`, girl ? "Я тут главная" : "Я тут главный", "Обнимашки"]
      : [a.heroName, girl ? "Я — героиня сказки!" : "Я — герой сказки!", "Ура!", "Смелость", "Мечтай"];
  const colors = teen ? ["#111827", "#7c3aed", "#ef4444", "#0ea5e9", "#f59e0b"] : ["#1e4d3b", "#f59e0b", "#ef6f6c", "#3b82f6", "#8b5cf6"];
  const list: Sticker[] = [
    { x: x0, y: B + SAFE + 2, w: 62, h: 62, r: 31, img: a.cover },
    { x: x0 + 70, y: B + SAFE + 4, w: 54, h: 54, r: teen ? 8 : 27, img: spread(a, 4) },
    { x: x0, y: B + 76, w: 50, h: 50, r: 25, img: spread(a, 7) },
    { x: x0 + 58, y: B + 70, w: 66, h: 44, r: 8, img: spread(a, 10) },
    { x: x0 + 4, y: B + 134, w: 40, h: 40, r: 20, img: spread(a, 12) },
  ];
  const tx = [
    { x: x0 + 52, y: B + 122, w: 74, h: 16 },
    { x: x0 + 52, y: B + 142, w: 56, h: 14 },
    { x: x0, y: B + 180, w: 60, h: 14 },
    { x: x0 + 66, y: B + 162, w: 58, h: 14 },
    { x: x0 + 66, y: B + 182, w: 50, h: 12 },
  ];
  tx.forEach((t, i) => list.push({ ...t, r: t.h / 2, text: words[i], color: colors[i] }));
  return list;
}
function stickers(key: string, a: AddonArt): string[] {
  const set = stickerSet(key, a);
  const art = set
    .map((s) =>
      s.img
        ? `<div style="position:absolute;left:${s.x - 1.5}mm;top:${s.y - 1.5}mm;width:${s.w + 3}mm;height:${s.h + 3}mm;border-radius:${s.r + 1.5}mm;background:#fff;box-shadow:0 0 0 .2mm #ddd"></div>${pic(s.img, s.x, s.y, s.w, s.h, `border-radius:${s.r}mm`)}`
        : `<div class="head" style="position:absolute;left:${s.x}mm;top:${s.y}mm;width:${s.w}mm;height:${s.h}mm;border-radius:${s.r}mm;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.min(16, s.h * 0.75)}pt;border:1.5mm solid #fff">${esc(s.text ?? "")}</div>`,
    )
    .join("");
  // Контур надсечки: на 1,5 мм шире картинки (белая обводка), линия 0,25 pt — цвет CutContour (100% magenta)
  const cut = set
    .map((s) => {
      const o = s.img ? 1.5 : 0;
      return `<div style="position:absolute;left:${s.x - o}mm;top:${s.y - o}mm;width:${s.w + 2 * o}mm;height:${s.h + 2 * o}mm;border-radius:${s.r + o}mm;border:.25pt solid #ec008c"></div>`;
    })
    .join("");
  return [page(`<div style="position:absolute;inset:0;background:#fff"></div>${art}<span class="mark">${esc(a.orderCode ?? "")}</span>`), page(`${cut}<p style="position:absolute;left:${BLEED_MM + 4}mm;bottom:${BLEED_MM + 2}mm;font-size:6pt;color:#ec008c">CutContour · надсечка по контуру</p>`)];
}

// ───────── закладки ─────────
function bookmarks(a: AddonArt, n: number): string[] {
  const B = BLEED_MM;
  const W = STRIP.wMm + 2 * B, H = STRIP.hMm + 2 * B;
  const picks = n === 1 ? [6] : [2, 5, 8, 11];
  const out: string[] = [];
  picks.forEach((sp, i) => {
    const img = spread(a, sp);
    // Лицо: две страницы разворота квадратами одна под другой (герой точно попадёт), ниже — плашка с именем
    const sq = W;
    out.push(page(`${pic(img, 0, 0, W, sq, "background-size:200% 100%;background-position:0% 50%")}${pic(img, 0, sq, W, sq, "background-size:200% 100%;background-position:100% 50%")}
      <div style="position:absolute;left:0;right:0;top:${sq * 2}mm;bottom:0;background:${i % 2 ? "#14213d" : INK}"></div>
      <p class="head" style="position:absolute;left:${B + 5}mm;right:${B + 5}mm;top:${sq * 2 + 8}mm;color:#fff;font-size:13pt;line-height:1.1">${esc(a.heroName)}</p>
      <p style="position:absolute;left:${B + 5}mm;right:${B + 5}mm;top:${sq * 2 + 16}mm;color:${GOLD};font-size:6.5pt;line-height:1.35">${esc(a.title)}</p>
      <div style="position:absolute;left:50%;top:${B + 8}mm;width:4mm;height:4mm;margin-left:-2mm;border-radius:50%;border:.3mm dashed rgba(255,255,255,.8)"></div>`));
    const text = a.spreads.length ? firstSentence(a.spreads[(sp - 1) % a.spreads.length].text, 140) : a.title;
    out.push(page(`<div style="position:absolute;inset:0;background:${i % 2 ? "#14213d" : INK}"></div>
      <p style="position:absolute;left:${B + SAFE + 1}mm;right:${B + SAFE + 1}mm;top:${B + 26}mm;color:${CREAM};font-size:10pt;line-height:1.5;font-style:italic">«${esc(text)}»</p>
      <p style="position:absolute;left:${B + SAFE + 1}mm;right:${B + SAFE + 1}mm;bottom:${B + 16}mm;color:${GOLD};font-size:7pt;line-height:1.4">${esc(a.title)}</p>
      <p class="head" style="position:absolute;left:${B + SAFE + 1}mm;bottom:${B + 8}mm;color:${CREAM};font-size:8pt">букими</p>`));
  });
  return out;
}

// ───────── обложка скетчбука ─────────
function notebook(a: AddonArt): string[] {
  const B = BLEED_MM;
  const W = A5.wMm + 2 * B, H = A5.hMm + 2 * B;
  // Пружина слева: отступ 12 мм от корешка — без важного
  return [
    page(`${pic(spread(a, 3), 0, 0, W, H, "background-position:65% 50%")}<div style="position:absolute;left:${B + 16}mm;right:${B + 10}mm;bottom:${B + 16}mm;background:rgba(255,255,255,.92);border-radius:3mm;padding:5mm">
      <p class="head" style="font-size:18pt;color:#111827;line-height:1.1">${esc(a.heroName)}</p><p style="font-size:8pt;color:#555;margin-top:2mm">скетчбук · ${esc(a.title)}</p></div><span class="mark">${esc(a.orderCode ?? "")}</span>`),
    page(`<div style="position:absolute;inset:0;background:#111827"></div>${pic(spread(a, 9), W / 2 - 25, H / 2 - 35, 50, 50, "border-radius:50%")}
      <p class="head" style="position:absolute;left:0;right:0;bottom:${B + 18}mm;text-align:center;color:#f3f4f6;font-size:9pt;letter-spacing:.3em">БУКИМИ</p>`),
  ];
}

// ───────── открытки ─────────
function cardBack(a: AddonArt, caption: string, i: number) {
  const B = BLEED_MM;
  const W = CARD.wMm + 2 * B, H = CARD.hMm + 2 * B;
  const lines = Array.from({ length: 4 }, (_, k) => `<div style="position:absolute;left:${W / 2 + 6}mm;right:${B + 10}mm;top:${B + 46 + k * 10}mm;border-bottom:.25mm solid #b9b2a0"></div>`).join("");
  return page(`<div style="position:absolute;inset:0;background:${CREAM}"></div>
    <div style="position:absolute;left:${W / 2}mm;top:${B + 12}mm;bottom:${B + 12}mm;border-left:.3mm solid #cfc7b2"></div>
    <div style="position:absolute;right:${B + 10}mm;top:${B + 10}mm;width:20mm;height:24mm;border:.3mm dashed #b9b2a0"></div>
    ${lines}
    <p style="position:absolute;left:${B + 10}mm;width:${W / 2 - B - 18}mm;bottom:${B + 18}mm;font-size:7pt;line-height:1.4;color:#6b6250">${esc(caption)}</p>
    <p class="head" style="position:absolute;left:${B + 10}mm;bottom:${B + 9}mm;font-size:8pt;color:${INK}">букими · ${i + 1}</p>`);
}
function postcards(a: AddonArt, n: number): string[] {
  const B = BLEED_MM;
  const W = CARD.wMm + 2 * B, H = CARD.hMm + 2 * B;
  const picks = n === 6 ? [1, 3, 5, 7, 9, 12] : [2, 5, 8, 11];
  return picks.flatMap((sp, i) => [
    page(`${pic(spread(a, sp), 0, 0, W, H)}${i === 0 ? `<p class="head" style="position:absolute;left:${B + 8}mm;bottom:${B + 7}mm;color:#fff;font-size:14pt;text-shadow:0 1mm 3mm rgba(0,0,0,.5)">${esc(a.heroName)}</p>` : ""}<span class="mark">${esc(a.orderCode ?? "")}</span>`),
    cardBack(a, `Иллюстрация из книги «${a.title}»`, i),
  ]);
}

// ───────── календарь 2027 ─────────
const DAY_COLOR: Record<string, string> = { work: "#1a2b24", weekend: "#c0392b", holiday: "#fff", dayoff: "#c0392b", workday: "#1a2b24" };
function calendar(key: string, a: AddonArt): string[] {
  const B = BLEED_MM;
  const W = A4.wMm + 2 * B, H = A4.hMm + 2 * B;
  const pet = key === "pet-calendar";
  const imgH = 158 + B; // от верхнего края с вылетом
  // Пружина сверху: 10 мм от обреза — без важного
  const cover = page(`${pic(a.cover, 0, 0, W, H * 0.78)}<div style="position:absolute;left:0;right:0;top:${H * 0.78}mm;bottom:0;background:${pet ? CREAM : INK}"></div>
    <h1 style="position:absolute;left:${B + 14}mm;right:${B + 14}mm;top:${H * 0.78 + 10}mm;font-size:54pt;color:${pet ? INK : GOLD};line-height:1">${CALENDAR_YEAR}</h1>
    <p class="head" style="position:absolute;left:${B + 14}mm;right:${B + 14}mm;top:${H * 0.78 + 34}mm;font-size:15pt;color:${pet ? "#6b6250" : CREAM}">${esc(pet ? `${a.heroName} — весь год с вами` : a.title)}</p>
    <span class="mark">${esc(a.orderCode ?? "")}</span>`);
  const months = calendarYear(CALENDAR_YEAR).map((m) => {
    const cell = 24.5;
    const gx = (W - cell * 7) / 2;
    const head = WEEKDAYS_RU.map((d, i) => `<div style="position:absolute;left:${gx + i * cell}mm;top:${imgH + 24}mm;width:${cell}mm;text-align:center;font-size:9pt;font-weight:700;color:${i >= 5 ? "#c0392b" : "#6b6250"}">${d}</div>`).join("");
    const rows = m.weeks.length;
    const ch = Math.min(17, (H - B - 18 - (imgH + 32)) / rows);
    const days = m.weeks
      .flatMap((w, r) =>
        w.map((d, c) => {
          if (!d) return "";
          const x = gx + c * cell;
          const y = imgH + 32 + r * ch;
          const hol = d.kind === "holiday";
          const label = d.kind === "dayoff" ? `<span style="display:block;font-size:4.5pt;font-weight:500;color:#c0392b">выходной</span>` : d.kind === "workday" ? `<span style="display:block;font-size:4.5pt;font-weight:500;color:#6b6250">рабочий</span>` : "";
          return `<div data-day="${d.day}" data-kind="${d.kind}" style="position:absolute;left:${x + 1.5}mm;top:${y}mm;width:${cell - 3}mm;height:${ch - 2}mm;border-radius:2mm;${hol ? "background:#c0392b;" : d.kind === "dayoff" ? "background:#fde8e6;" : ""}color:${DAY_COLOR[d.kind]};text-align:center;padding-top:1.5mm;font-family:Nunito;font-weight:800;font-size:15pt;line-height:1">${d.day}${label}</div>`;
        }),
      )
      .join("");
    const holidays = [holidayLine(m), transferLine(CALENDAR_YEAR, m)].filter(Boolean).join("; ");
    return page(`${pic(spread(a, m.month), 0, 0, W, imgH)}
      <h2 style="position:absolute;left:${gx}mm;top:${imgH + 7}mm;font-size:24pt;color:${INK}">${m.title}</h2>
      <p style="position:absolute;right:${gx}mm;top:${imgH + 11}mm;font-size:10pt;color:#9a917c;font-family:Nunito;font-weight:800">${CALENDAR_YEAR}</p>
      ${head}${days}
      ${holidays ? `<p class="hol" style="position:absolute;left:${gx}mm;right:${gx}mm;bottom:${B + 8}mm;font-size:7pt;color:#c0392b">${esc(holidays)}</p>` : ""}`);
  });
  return [cover, ...months];
}

// ───────── «паспорт питомца» ─────────
function passport(a: AddonArt): string[] {
  const B = BLEED_MM;
  const W = CARD.wMm + 2 * B, H = CARD.hMm + 2 * B;
  const kv = (k: string, v: string, y: number) =>
    `<p style="position:absolute;left:${B + 56}mm;right:${B + 8}mm;top:${y}mm;font-size:7pt;color:#8a826e">${k}</p><p style="position:absolute;left:${B + 56}mm;right:${B + 8}mm;top:${y + 3}mm;font-size:10pt;font-weight:500;border-bottom:.25mm solid #cfc7b2;min-height:5mm">${esc(v)}</p>`;
  const front = page(`<div style="position:absolute;inset:0;background:${CREAM}"></div><div style="position:absolute;left:0;right:0;top:0;height:${B + 14}mm;background:${INK}"></div>
    <p class="head" style="position:absolute;left:${B + 8}mm;top:${B + 4}mm;color:${GOLD};font-size:11pt;letter-spacing:.2em">ПАСПОРТ ПИТОМЦА</p>
    ${pic(a.cover, B + 8, B + 20, 42, 52, "border-radius:2mm;box-shadow:0 0 0 .6mm #fff")}
    ${kv("Кличка", a.heroName, B + 20)}${kv("Порода", a.pet?.breed || "", B + 33)}${kv("Окрас", a.pet?.furColor || "", B + 46)}${kv("Вид", petWord(a), B + 59)}
    <p style="position:absolute;left:${B + 8}mm;bottom:${B + 6}mm;font-size:6pt;color:#8a826e">Герой книги «${esc(a.title)}» · букими</p><span class="mark">${esc(a.orderCode ?? "")}</span>`);
  const fields = ["Дата рождения", "Дата появления в семье", "Любимое лакомство", "Любимая игрушка", "Особые приметы", "Хозяева"];
  const back = page(`<div style="position:absolute;inset:0;background:${CREAM}"></div>
    ${fields.map((f, i) => `<p style="position:absolute;left:${B + 10}mm;right:${B + 10}mm;top:${B + 10 + i * 13}mm;font-size:7pt;color:#8a826e;border-bottom:.25mm solid #cfc7b2;padding-bottom:6mm">${f}</p>`).join("")}`);
  return [front, back];
}

// ───────── премиум-коробка: открытка и наклейка ─────────
function boxCard(a: AddonArt): string[] {
  const B = BLEED_MM;
  const W = CARD.wMm + 2 * B, H = CARD.hMm + 2 * B;
  return [
    page(`${pic(spread(a, 12), 0, 0, W, H)}<div style="position:absolute;inset:${B + 5}mm;border:.4mm solid rgba(255,255,255,.85)"></div><span class="mark">${esc(a.orderCode ?? "")}</span>`),
    page(`<div style="position:absolute;inset:0;background:#1b1b1b"></div><p style="position:absolute;left:${B + 14}mm;right:${B + 14}mm;top:${B + 18}mm;color:#f3ead7;font-size:11pt;font-style:italic;line-height:1.55;white-space:pre-line">${esc(a.dedication || `Для тебя, ${a.heroName}.`)}</p>
      <p class="head" style="position:absolute;left:${B + 14}mm;bottom:${B + 10}mm;color:${GOLD};font-size:8pt;letter-spacing:.3em">БУКИМИ</p>`),
  ];
}
function boxLabel(a: AddonArt): string[] {
  const B = BLEED_MM;
  return [
    page(`<div style="position:absolute;inset:0;background:#1b1b1b"></div><div style="position:absolute;inset:${B + 5}mm;border:.5mm solid ${GOLD}"></div>
      <p class="head" style="position:absolute;left:${B + 12}mm;right:${B + 12}mm;top:${B + 26}mm;text-align:center;color:${GOLD};font-size:15pt;line-height:1.2">${esc(a.title)}</p>
      <p style="position:absolute;left:0;right:0;bottom:${B + 16}mm;text-align:center;color:#f3ead7;font-size:7pt;letter-spacing:.35em">БУКИМИ</p>`),
  ];
}

/** HTML файла допа (PDF). Неизвестный доп или PNG-файл — null. */
export function addonHtml(key: string, spec: AddonFileSpec, art: AddonArt): AddonHtml | null {
  if (spec.type !== "pdf") return null;
  // Имя на допах — всегда с заглавной (старые книги могли сохранить «маша»)
  const a: AddonArt = { ...art, heroName: normalizeName(art.heroName) };
  const k = spec.kind;
  let pages: string[];
  if (["poster", "teen-poster", "adult-print", "pet-poster"].includes(key)) pages = [poster(key, a, spec)];
  else if (key === "stickers" || key === "teen-stickers" || k === "print-addon-pet-postcards-stickers") pages = stickers(key, a);
  else if (key === "teen-bookmarks") pages = bookmarks(a, 4);
  else if (key === "bookmark") pages = bookmarks(a, 1);
  else if (key === "notebook") pages = notebook(a);
  else if (key === "postcards") pages = postcards(a, 6);
  else if (key === "pet-postcards") pages = postcards(a, 4);
  else if (key === "adult-calendar" || key === "pet-calendar") pages = calendar(key, a);
  else if (key === "pet-passport") pages = passport(a);
  else if (k === "print-addon-premium-box-label") pages = boxLabel(a);
  else if (key === "premium-box") pages = boxCard(a);
  else return null;
  return doc(spec, pages);
}

// ───────── обои (PNG, sharp) ─────────
const svgEsc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export async function wallpaperPng(art: AddonArt, w: number, h: number): Promise<Buffer> {
  const a: AddonArt = { ...art, heroName: normalizeName(art.heroName) };
  const sharp = (await import("sharp")).default;
  const phone = h > w;
  const src = phone ? a.cover : spread(a, 1);
  const base = src.data.length ? sharp(src.data, { density: 144 }) : sharp({ create: { width: 16, height: 16, channels: 3, background: INK } });
  const bg = await base.resize(w, h, { fit: "cover", position: "centre" }).flatten({ background: INK }).toBuffer();
  // Телефон: часы экрана блокировки сверху — подпись снизу; компьютер: значки слева — подпись справа внизу
  const fs = Math.round((phone ? w : h) * 0.055);
  const title = svgEsc(a.title.length > 40 ? `${a.title.slice(0, 39)}…` : a.title);
  const overlay = phone
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w / 2}" y="${h - fs * 3.2}" font-family="Nunito, DejaVu Sans, sans-serif" font-weight="800" font-size="${fs}" fill="#fff" text-anchor="middle">${svgEsc(a.heroName)}</text><text x="${w / 2}" y="${h - fs * 2}" font-family="Manrope, DejaVu Sans, sans-serif" font-size="${Math.round(fs * 0.42)}" fill="#fff" fill-opacity="0.85" text-anchor="middle">${title}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="${w - fs}" y="${h - fs * 2.6}" font-family="Nunito, DejaVu Sans, sans-serif" font-weight="800" font-size="${fs}" fill="#fff" text-anchor="end">${svgEsc(a.heroName)}</text><text x="${w - fs}" y="${h - fs * 1.7}" font-family="Manrope, DejaVu Sans, sans-serif" font-size="${Math.round(fs * 0.4)}" fill="#fff" fill-opacity="0.85" text-anchor="end">${title}</text></svg>`;
  return sharp(bg).composite([{ input: Buffer.from(overlay) }]).png({ compressionLevel: 9 }).toBuffer();
}

const PT = 72 / 25.4;
/**
 * Точные размеры для типографии: Chromium округляет страницу до CSS-пикселя (106 мм → 105,83 мм), поэтому MediaBox и
 * BleedBox ставим ровно «формат + 2 × вылет», TrimBox — обрезной формат (по нему режут и проверяют препресс-программы).
 */
export async function setPrintBoxes(pdfBytes: Buffer, spec: AddonFileSpec): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBytes);
  const b = (spec.bleedMm ?? 0) * PT;
  const w = spec.wMm! * PT, h = spec.hMm! * PT;
  for (const p of doc.getPages()) {
    p.setMediaBox(0, 0, w + 2 * b, h + 2 * b);
    p.setBleedBox(0, 0, w + 2 * b, h + 2 * b);
    p.setTrimBox(b, b, w, h);
    p.setCropBox(0, 0, w + 2 * b, h + 2 * b);
  }
  return Buffer.from(await doc.save());
}

/** Все файлы одного допа: [спецификация, данные]. PDF — через renderHtmlPdf (Chromium). */
export async function renderAddon(key: string, a: AddonArt): Promise<{ spec: AddonFileSpec; data: Buffer }[]> {
  const out: { spec: AddonFileSpec; data: Buffer }[] = [];
  for (const spec of addonFileSpecs(key)) {
    if (spec.type === "png") {
      out.push({ spec, data: await wallpaperPng(a, spec.px![0], spec.px![1]) });
      continue;
    }
    const h = addonHtml(key, spec, a);
    if (!h) continue;
    const { renderHtmlPdf } = await import("./pdf");
    const raw = await renderHtmlPdf(h.html, h.wMm, h.hMm, { title: `${a.title} — ${spec.label}`, orderCode: a.orderCode });
    out.push({ spec, data: await setPrintBoxes(raw, spec) });
  }
  return out;
}
