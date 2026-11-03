// Рендер книги HTML → PDF (Chromium) во всех форматах. Один шаблон вёрстки адаптируется под форматы.
//  screen    — для экрана, квадратные страницы, облегчённые картинки
//  a4        — домашняя печать: А4 альбомный, разворот (2 страницы) на листе
//  print     — для типографии и копицентра: страница w×h + вылеты 3 мм, безопасные поля 5 мм, 300 dpi
//  cover     — обложка для типографии: задняя + корешок + передняя (для твёрдой — с загибами)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spreadHtml, SPREAD_PDF_CSS } from "./spread-markup";
import { declineName, normalizeName } from "./declension";
import { authorLine, backLines, COVER_VARIANTS, fairyPalette, finalLines, splitSpread, welcomeLines, type FairyLine } from "./book-layout";

export interface BookPageData {
  title: string;
  dedication: string;
  heroName: string;
  /** Аудитория книги — от неё зависят подписи на последней странице и обложке. */
  audience?: "CHILD" | "TEEN" | "ADULT" | "PET";
  /** Пол героя (boy | girl) — для «главный герой / главная героиня». */
  heroGender?: string;
  cover: PdfImage;
  spreads: { text: string; image: PdfImage; /** Печать: левая и правая половины разворота точно под страницу (preparePrint). */ halves?: [PdfImage, PdfImage] }[];
  orderCode?: string;
  /** Оформление обложки 0–2 (src/lib/book-layout.ts, rev 13). */
  coverVariant?: number;
  /** «Автор: …» на первой странице. */
  author?: string;
  /** Фото на странице «Фото и посвящение» — как есть; нет — иллюстрация обложки. */
  photo?: PdfImage | null;
  /** Тон текста на картинке по страницам разворота: light — тёмный текст на светлом, dark — светлый на тёмном. */
  tones?: ("light" | "dark")[][];
  /** Картинки уже подготовлены для печати этого вида (preparePrint) — повторно не масштабируем. */
  preparedFor?: string;
}

/** Картинка книги: data — облегчённая (экран, А4); source — исходник (SVG или PNG) для печати в 300 dpi. */
export interface PdfImage {
  data: Buffer;
  contentType: string;
  source?: { data: Buffer; contentType: string };
}

export type PdfKind =
  | { kind: "screen" }
  | { kind: "a4" }
  | { kind: "print"; wMm: number; hMm: number }
  | { kind: "cover"; wMm: number; hMm: number; hard: boolean; pages: number };

const BLEED = 3;
const SAFE = 5;

/** Книжный шрифт текста сказки (rev 19): Lora (OFL, кириллица, встроен ниже), запасные — системные с засечками. */
export const BOOK_SERIF = `"Lora","PT Serif","Literata","Noto Serif","Georgia","DejaVu Serif",serif`;
/** Декоративный шрифт имени и ключевых слов (rev 19): Yeseva One (OFL, кириллица). */
export const FAIRY_SERIF = `"Yeseva One","Lora",Georgia,serif`;

let fontCss: string | null = null;
/** Шрифты сайта (Nunito 800, Manrope 500) для PDF — встраиваются в HTML. */
export function fonts() {
  if (fontCss) return fontCss;
  const f = (pkg: string, file: string) =>
    readFileSync(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file)).toString("base64");
  const face = (family: string, weight: number, b64: string, range: string, style = "normal") =>
    `@font-face{font-family:'${family}';font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`;
  const CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
  const LAT = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  fontCss = [
    face("Nunito", 800, f("nunito", "nunito-cyrillic-800-normal.woff2"), CYR),
    face("Nunito", 800, f("nunito", "nunito-latin-800-normal.woff2"), LAT),
    face("Manrope", 500, f("manrope", "manrope-cyrillic-500-normal.woff2"), CYR),
    face("Manrope", 500, f("manrope", "manrope-latin-500-normal.woff2"), LAT),
    // rev 19: «сказочная» книга — те же шрифты, что на экране (src/app/layout.tsx)
    face("Yeseva One", 400, f("yeseva-one", "yeseva-one-cyrillic-400-normal.woff2"), CYR),
    face("Yeseva One", 400, f("yeseva-one", "yeseva-one-latin-400-normal.woff2"), LAT),
    face("Lora", 400, f("lora", "lora-cyrillic-400-normal.woff2"), CYR),
    face("Lora", 400, f("lora", "lora-latin-400-normal.woff2"), LAT),
    face("Lora", 400, f("lora", "lora-cyrillic-400-italic.woff2"), CYR, "italic"),
    face("Lora", 400, f("lora", "lora-latin-400-italic.woff2"), LAT, "italic"),
  ].join("");
  return fontCss;
}

/** Подписи книги по аудитории: последняя страница, задняя обложка, возрастная маркировка. */
export function bookWording(b: Pick<BookPageData, "heroName" | "audience" | "heroGender">) {
  const girl = b.heroGender === "girl";
  const name = normalizeName(b.heroName);
  switch (b.audience) {
    case "PET":
      return { madeFor: `Эта книга — о ${girl ? "любимице" : "любимце"} по кличке ${name}.`, back: `История, в которой ${name} — ${girl ? "главная героиня" : "главный герой"}.`, rating: "0+" };
    case "ADULT":
      return { madeFor: `Эта книга создана специально для человека по имени ${name}.`, back: `История, в которой ${name} — ${girl ? "главная героиня" : "главный герой"}.`, rating: "12+" };
    case "TEEN":
      return { madeFor: `Эта книга создана специально для ${girl ? "героини" : "героя"} по имени ${name}.`, back: `История, в которой ${name} — ${girl ? "главная героиня" : "главный герой"}.`, rating: "6+" };
    default:
      return { madeFor: `Эта книга создана специально для ${girl ? "героини" : "героя"} по имени ${name}.`, back: `Сказка, в которой ${name} — ${girl ? "главная героиня" : "главный герой"}.`, rating: "0+" };
  }
}

/** Звёздочка-разделитель (как FairyDivider на экране). */
const STAR = `<svg viewBox="0 0 24 24" width="1em" height="1em" style="display:block"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z" fill="currentColor"/></svg>`;
export const fairyDivider = (widthMm: number) => `<span class="fk-div" style="width:${widthMm}mm">${STAR}</span>`;

/** «Сказочные» строки (rev 19, src/lib/book-layout.ts): имя крупно Yeseva One, ключевые слова — акцентом, курсив Lora. */
export function fairyHtml(lines: FairyLine[], fsPt: number, nameMaxPt: number, widthMm: number) {
  const name = lines[0]?.[0]?.k === "name" ? lines[0][0].t : "";
  // Имя не шире строки: Yeseva ≈ 0,62 em на букву
  const namePt = Math.min(nameMaxPt, (widthMm * 2.835) / (Math.max(6, name.length) * 0.62));
  return `<p class="fk" style="font-size:${fsPt}pt">${lines
    .map((l) =>
      l[0]?.k === "div"
        ? fairyDivider(widthMm * 0.4)
        : `<span class="fk-line fk-line--${l[0]?.k ?? "text"}">${l.map((x) => (x.k === "name" ? `<span class="fk-name" style="font-size:${namePt.toFixed(1)}pt">${esc(x.t)}</span>` : x.k === "key" ? `<em class="fk-key">${esc(x.t)}</em>` : esc(x.t))).join("")}</span>`,
    )
    .join(" ")}</p>`;
}

export const uri = (img: { data: Buffer; contentType: string }) => `data:${img.contentType};base64,${img.data.toString("base64")}`;
export const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

function baseCss(pageW: number, pageH: number) {
  return `${fonts()}
  @page{size:${pageW}mm ${pageH}mm;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${pageW}mm}
  body{font-family:Manrope,sans-serif;color:#1a2b24;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:${pageW}mm;height:${pageH}mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
  .img{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}
  .text{position:absolute;padding:7mm 10mm 10mm;font-family:${BOOK_SERIF};font-size:var(--fs);line-height:1.5;white-space:pre-line;text-align:center;color:var(--fk-ink,#1f2a26);
    text-shadow:0 0 .5em rgba(253,250,242,.95),0 0 .18em rgba(253,250,242,.95);
    background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(253,250,242,.94) 0%,rgba(253,250,242,.86) 58%,rgba(253,250,242,0) 100%)}
  .text.dark{color:#fdf6e3;text-shadow:0 0 .55em rgba(10,14,40,.9),0 0 .2em rgba(10,14,40,.85);background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(18,24,48,.74) 0%,rgba(18,24,48,.6) 58%,rgba(18,24,48,0) 100%)}
  .serif{font-family:${BOOK_SERIF}}
  .fk{font-family:${BOOK_SERIF};color:var(--fk-ink);text-align:center;line-height:1.3}
  .fk[data-back]{text-align:left}
  .fk[data-back] .fk-name{color:#f3d27a}
  .fk-line{display:block}
  .fk-name{font-family:${FAIRY_SERIF};line-height:1.1;color:var(--fk-ink)}
  .fk-line--lead{font-style:italic}
  .fk-key{font-family:${FAIRY_SERIF};font-style:normal;color:var(--fk-accent);letter-spacing:.02em}
  .fk-line--key .fk-key{font-size:1.55em;line-height:1.15}
  .fk-div{display:flex;align-items:center;gap:2mm;margin:2.5mm auto;color:var(--fk-orn);font-size:9pt}
  .fk-div::before,.fk-div::after{content:"";flex:1;height:.25mm;background:linear-gradient(90deg,transparent,currentColor)}
  .fk-div::after{background:linear-gradient(90deg,currentColor,transparent)}
  .orn{position:absolute;border:.35mm solid var(--fk-orn);border-radius:6mm;box-shadow:inset 0 0 0 1.4mm #fdfaf2,inset 0 0 0 1.65mm var(--fk-orn)}
  .orn i{position:absolute;left:50%;width:8mm;margin-left:-4mm;height:4mm;background:#fdfaf2;color:var(--fk-orn);display:flex;justify-content:center;align-items:center;font-size:7pt}
  .blob{position:absolute;inset:14%;border-radius:46% 54% 52% 48% / 55% 45% 55% 45%;background:radial-gradient(circle at 35% 35%,rgba(243,228,194,.95),rgba(227,237,230,.85) 60%,rgba(227,237,230,0) 78%)}
  .frame{position:absolute;border:2.5mm solid #fff;border-radius:3mm;box-shadow:0 1.5mm 5mm rgba(20,54,40,.25);background-size:cover;background-position:50% 50%}
  .brand{font-family:Nunito,sans-serif;font-weight:800;color:#1e4d3b}
  ${SPREAD_PDF_CSS}
  h1{font-family:Nunito,sans-serif;font-weight:800}
  .mark{position:absolute;bottom:1mm;right:1mm;font-size:1pt;color:#fff}`;
}

/**
 * Обложка в выбранном оформлении (rev 13, src/lib/book-layout.ts): 0 — иллюстрация на всю обложку и плашка с названием;
 * 1 — тёмно-синяя со звёздами, иллюстрация в круге; 2 — светлая рамка, иллюстрация с мягкой виньеткой.
 * Содержимое для блока с position:relative/absolute заданного размера (мм).
 */
export function coverInner(b: Pick<BookPageData, "title" | "cover" | "coverVariant">, wMm: number, hMm: number, inset = 0): string {
  const v = COVER_VARIANTS[b.coverVariant === 1 || b.coverVariant === 2 ? b.coverVariant : 0];
  const fs = Math.max(14, Math.min(26, wMm / 8.5));
  const img = `background-image:url(${uri(b.cover)});background-size:cover;background-position:50% 50%`;
  const t = esc(b.title);
  if (v.id === 1) {
    const d = Math.min(wMm, hMm) * 0.62;
    const stars = Array.from({ length: 26 }, (_, i) => `<i style="position:absolute;left:${(i * 37) % 97}%;top:${(i * 53) % 93}%;width:${0.6 + (i % 3) * 0.4}mm;height:${0.6 + (i % 3) * 0.4}mm;border-radius:50%;background:#f6e7b8;opacity:${0.5 + (i % 4) * 0.12}"></i>`).join("");
    return `<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#2c3a78,${v.bg} 70%)">${stars}
      <div style="position:absolute;left:${(wMm - d) / 2}mm;top:${inset + hMm * 0.08}mm;width:${d}mm;height:${d}mm;border-radius:50%;${img};box-shadow:0 0 0 1.6mm #f3d27a,0 0 0 3.2mm rgba(243,210,122,.25)"></div>
      <h1 style="position:absolute;left:${inset + 10}mm;right:${inset + 10}mm;bottom:${inset + hMm * 0.07}mm;text-align:center;color:${v.ink};font-size:${fs}pt;line-height:1.15">${t}</h1></div>`;
  }
  if (v.id === 2) {
    const m = inset + Math.min(wMm, hMm) * 0.07;
    return `<div style="position:absolute;inset:0;background:${v.bg}">
      <div style="position:absolute;inset:${m * 0.55}mm;border:0.5mm solid #c8952f;border-radius:2mm;box-shadow:inset 0 0 0 1.2mm ${v.bg},inset 0 0 0 1.5mm #c8952f"></div>
      <div style="position:absolute;left:${m + 2}mm;right:${m + 2}mm;top:${m + 2}mm;bottom:${hMm * 0.27}mm;${img};-webkit-mask-image:radial-gradient(ellipse 72% 70% at 50% 50%,#000 58%,transparent 100%);mask-image:radial-gradient(ellipse 72% 70% at 50% 50%,#000 58%,transparent 100%)"></div>
      <h1 style="position:absolute;left:${m + 6}mm;right:${m + 6}mm;bottom:${m + hMm * 0.05}mm;text-align:center;color:${v.ink};font-size:${fs}pt;line-height:1.15">${t}</h1></div>`;
  }
  return `<div style="position:absolute;inset:0;${img}"></div>
    <div style="position:absolute;left:0;right:0;top:0;padding:${inset + 8}mm ${inset + 10}mm 7mm;background:linear-gradient(180deg,${v.band} 70%,rgba(252,251,247,0))"><h1 style="text-align:center;color:${v.ink};font-size:${fs}pt;line-height:1.15">${t}</h1></div>`;
}

/**
 * Страницы блока (rev 13): приветствие (имя, автор) → фото → посвящение → 12 разворотов (24 страницы, текст прямо
 * на картинке, слева и справа) → финальная страница.
 */
function blockPages(b: BookPageData, pageW: number, pageH: number, inset: number) {
  const fs = Math.max(9, Math.min(15, pageW / 15)); // pt
  const pages: string[] = [];
  const pad = inset + 12;
  const name = normalizeName(b.heroName);
  const author = authorLine(b.author);
  const art = (img: PdfImage) => `background-image:url(${uri(img)})`;
  // rev 19: «сказочные» цвета по оформлению обложки — как на экране (fairyPalette)
  const pal = fairyPalette(b.coverVariant ?? 0);
  const vars = `--fk-ink:${pal.ink};--fk-accent:${pal.accent};--fk-orn:${pal.orn}`;
  const textW = pageW - 2 * pad;
  // 1. Приветствие: рамка-орнамент, имя крупно, «единственную» акцентом, звёздочка, портрет
  const d = Math.min(pageW, pageH) * 0.33;
  const o = inset + Math.min(pageW, pageH) * 0.035;
  pages.push(`<section class="page" style="text-align:center;background:#fdfaf2;${vars}">
    <div class="orn" style="inset:${o}mm"><i style="top:-2mm">${STAR}</i><i style="bottom:-2mm">${STAR}</i></div>
    <div style="position:absolute;left:${pad}mm;right:${pad}mm;top:${pad}mm">
      <p class="serif" style="font-size:${fs * 0.9}pt;font-style:italic;letter-spacing:.04em;color:var(--fk-ink);opacity:.85;line-height:1.25">${esc(b.title)}</p>
      <div style="margin-top:4mm">${fairyHtml(welcomeLines(name), fs * 1.12, fs * 3, textW)}</div>
      ${fairyDivider(textW * 0.28)}</div>
    <div style="position:absolute;left:${(pageW - d) / 2}mm;top:${pageH * 0.42}mm;width:${d}mm;height:${d}mm;border-radius:50%;background-size:cover;background-position:50% 40%;${art(b.cover)};box-shadow:0 0 0 1mm #fdfaf2,0 0 0 1.3mm ${pal.orn}"></div>
    <div style="position:absolute;left:${pad}mm;right:${pad}mm;bottom:${inset + 11}mm;font-size:${fs * 0.8}pt">
      ${author ? `<p class="serif" style="font-style:italic;margin-bottom:2.5mm;color:var(--fk-ink)">${esc(author)}</p>` : ""}<p class="serif" style="color:#4d5f57;font-style:italic">Создано в <b class="brand" style="font-style:normal">букими</b></p></div></section>`);
  // 2. Фото (как есть, в мягкой рамке) или иллюстрация
  const fw = pageW * 0.62;
  const fh = b.photo ? fw * 1.22 : fw;
  pages.push(`<section class="page" style="background:#fdfaf2">
    <div class="blob" style="inset:10%"></div>
    <div class="frame" style="left:${(pageW - fw) / 2}mm;top:${(pageH - fh) / 2}mm;width:${fw}mm;height:${fh}mm;${art(b.photo ?? b.cover)};transform:rotate(-2deg)${b.photo ? "" : ";border-radius:50%"}"></div></section>`);
  // 3. Посвящение на акварельном пятне
  const ded = b.dedication || bookWording(b).madeFor;
  pages.push(`<section class="page" style="background:#fdfaf2;${vars}">
    <div class="blob"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${pad + pageW * 0.12}mm;text-align:center">
      ${fairyDivider(pageW * 0.22)}<p class="serif" style="font-size:${fs * 1.15}pt;font-style:italic;line-height:1.5;white-space:pre-line;color:var(--fk-ink)">${esc(ded)}</p>${fairyDivider(pageW * 0.22)}</div></section>`);
  // 4. Развороты: текст на картинке — левая и правая страница
  b.spreads.forEach((s, i) => {
    const parts = splitSpread(s.text);
    for (const side of ["left", "right"] as const) {
      const k = side === "left" ? 0 : 1;
      const pos = side === "left" ? "0% 50%" : "100% 50%";
      // Печать: у каждой страницы своя половина разворота в 300 dpi (preparePrint); иначе — весь разворот со сдвигом
      const half = s.halves?.[k];
      const bg = half ? `background-image:url(${uri(half)});background-size:cover;background-position:50% 50%` : `background-image:url(${uri(s.image)});background-size:200% 100%;background-position:${pos}`;
      const tone = b.tones?.[i]?.[k] === "dark" ? " dark" : "";
      pages.push(`<section class="page" style="--fs:${fs}pt;${vars}">
        <div class="img" style="${bg}"></div>
        ${parts[k] ? `<div class="text${tone}" style="left:${inset + 3}mm;right:${inset + 3}mm;top:${inset + 3}mm">${spreadHtml(parts[k])}</div>` : ""}
        <span class="mark">${esc(b.orderCode ?? "")}</span></section>`);
    }
  });
  // 5. Финал
  pages.push(`<section class="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${pad + 4}mm;background:#fdfaf2;${vars}">
    <div class="blob" style="inset:14%"></div>
    <div style="position:relative">${fairyHtml(finalLines(name, b.heroGender), fs * 1.02, fs * 2.6, textW - 8)}
    <p style="margin-top:4mm"><b class="brand">букими</b></p></div></section>`);
  return pages.join("");
}

/** Задняя обложка (экран, А4): тёплая строка с именем и знак. */
function backPage(b: BookPageData, fs: number) {
  const pal = fairyPalette(b.coverVariant ?? 0);
  return `<section class="page" style="background:${pal.ink};color:#f3e4c2;display:flex;flex-direction:column;justify-content:flex-end;padding:14mm;--fk-ink:#f3e4c2;--fk-accent:#f3d27a;--fk-orn:#f3d27a">
    <div style="text-align:left">${fairyHtml(backLines(b.heroName), fs * 1.1, fs * 2.6, 150).replace('class="fk"', 'class="fk" data-back')}</div>
    <p style="font-size:${fs}pt;line-height:1.5;margin-top:4mm"><span class="serif" style="font-style:italic">${esc(bookWording(b).back)}</span><br><b style="font-family:Nunito;font-size:${fs * 1.4}pt">букими</b> · ${bookWording(b).rating}</p></section>`;
}

/** Тон текста на картинке по каждой странице: средняя яркость верхней части половины разворота. */
export async function textTones(b: BookPageData): Promise<("light" | "dark")[][]> {
  const sharp = (await import("sharp")).default;
  const out: ("light" | "dark")[][] = [];
  for (const s of b.spreads) {
    const src = s.image.data.length ? s.image : null;
    if (!src) {
      out.push(["light", "light"]);
      continue;
    }
    try {
      const { data, info } = await sharp(src.data, { density: 24 }).resize(64, 32, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
      const side = (x0: number) => {
        let sum = 0;
        let n = 0;
        for (let y = 0; y < Math.round(info.height * 0.42); y++) for (let x = x0; x < x0 + info.width / 2; x++, n++) sum += data[y * info.width + x];
        return sum / Math.max(1, n) < 105 ? "dark" : "light";
      };
      out.push([side(0), side(info.width / 2)]);
    } catch {
      out.push(["light", "light"]);
    }
  }
  return out;
}

export function bookHtml(b: BookPageData, k: PdfKind): { html: string; wMm: number; hMm: number } {
  if (k.kind === "screen") {
    const W = 210, H = 210;
    const cover = `<section class="page">${coverInner(b, W, H)}</section>`;
    return { html: `<style>${baseCss(W, H)}</style>${cover}${blockPages(b, W, H, 0)}${backPage(b, 12)}`, wMm: W, hMm: H };
  }
  if (k.kind === "a4") {
    // А4 альбомный: разворот целиком (две страницы по 148,5 мм), 2 страницы на листе
    const W = 297, H = 210;
    const pageW = 148.5, pageH = 148.5;
    const inner = blockPages(b, pageW, pageH, 0)
      .split('<section class="page"')
      .filter(Boolean)
      .map((p) => `<div class="cell"><section class="page"${p}</div>`);
    const sheets: string[] = [];
    sheets.push(`<div class="sheet"><div class="cell"><section class="page">${coverInner(b, pageW, pageH)}</section></div>${inner[0]}</div>`);
    for (let i = 1; i < inner.length; i += 2) sheets.push(`<div class="sheet">${inner[i]}${inner[i + 1] ?? ""}</div>`);
    const css = `${baseCss(pageW, pageH)} @page{size:${W}mm ${H}mm;margin:0} html,body{width:${W}mm}
      .sheet{width:${W}mm;height:${H}mm;display:flex;align-items:center;justify-content:center;page-break-after:always;break-after:page}
      .cell .page{page-break-after:auto;break-after:auto}`;
    return { html: `<style>${css}</style>${sheets.join("")}`, wMm: W, hMm: H };
  }
  if (k.kind === "print") {
    const W = k.wMm + BLEED * 2, H = k.hMm + BLEED * 2;
    return { html: `<style>${baseCss(W, H)}</style>${blockPages(b, W, H, BLEED + SAFE)}`, wMm: W, hMm: H };
  }
  // Обложка: задняя | корешок | передняя. Корешок ≈ 0,1 мм на страницу + 4 мм (твёрдая), загиб 17 мм.
  const { spine, wrap, W, H } = coverGeometry(k);
  const html = `<style>${baseCss(W, H)}</style><section class="page">
    <div style="position:absolute;top:0;bottom:0;left:${wrap + k.wMm + spine}mm;right:0;overflow:hidden">${coverInner(b, k.wMm + wrap, H, wrap)}</div>
    <div style="position:absolute;left:0;width:${wrap + k.wMm}mm;top:0;bottom:0;background:${fairyPalette(b.coverVariant ?? 0).ink}"></div>
    <div style="position:absolute;left:${wrap + 15}mm;width:${k.wMm - 30}mm;bottom:${wrap + 15}mm;color:#f3e4c2;font-size:10pt;--fk-ink:#f3e4c2;--fk-accent:#f3d27a;--fk-orn:#f3d27a">${fairyHtml(backLines(b.heroName), 12, 30, k.wMm - 30).replace('class="fk"', 'class="fk" data-back')}<p style="margin-top:3mm;line-height:1.5"><span class="serif" style="font-style:italic">${esc(bookWording(b).back)}</span><br><b style="font-family:Nunito;font-size:14pt">букими</b> · ${bookWording(b).rating}</p></div>
    <div style="position:absolute;left:${wrap + k.wMm}mm;width:${spine}mm;top:0;bottom:0;background:#143628"></div>
    <span class="mark">${esc(b.orderCode ?? "")}</span></section>`;
  return { html, wMm: W, hMm: H };
}

export async function renderPdf(b: BookPageData, k: PdfKind): Promise<Buffer> {
  // Типографии — иллюстрации в 300 dpi под обрезной формат + вылеты; TrimBox/BleedBox — точные
  const prepared = (k.kind === "print" || k.kind === "cover") && b.preparedFor !== kindKey(k) ? (await preparePrint(b, k)).data : b;
  // Тёмная сцена (ночь) — светлый текст на картинке, иначе тёмный на светлой дымке
  const data = prepared.tones || k.kind === "cover" ? prepared : { ...prepared, tones: await textTones(prepared) };
  const { html, wMm, hMm } = bookHtml(data, k);
  const pdf = await renderHtmlPdf(html, wMm, hMm, data);
  if (k.kind === "print") return setBoxes(pdf, k.wMm, k.hMm, BLEED);
  if (k.kind === "cover") {
    const g = coverGeometry(k);
    return setBoxes(pdf, g.W - 2 * g.wrap, g.H - 2 * g.wrap, g.wrap);
  }
  return pdf;
}

// ── Печать: 300 dpi ──
export const PRINT_DPI = 300;
/** Ниже — предупреждение в админке: исходник растянут больше чем на 20 %. */
export const MIN_SOURCE_DPI = 250;
export const mmToPx = (mm: number, dpi = PRINT_DPI) => Math.ceil((mm / 25.4) * dpi);
const kindKey = (k: PdfKind) => (k.kind === "print" || k.kind === "cover" ? `${k.kind}-${k.wMm}x${k.hMm}${k.kind === "cover" ? `-${k.hard ? "h" : "s"}` : ""}` : k.kind);

/** Обложка: корешок, загиб (твёрдая — 17 мм, мягкая — вылет 3 мм), размер листа. */
export function coverGeometry(k: { wMm: number; hMm: number; hard: boolean; pages: number }) {
  const spine = k.hard ? Math.round((k.pages * 0.1 + 4) * 10) / 10 : Math.round(k.pages * 0.1 * 10) / 10;
  const wrap = k.hard ? 17 : BLEED;
  return { spine, wrap, W: k.wMm * 2 + spine + wrap * 2, H: k.hMm + wrap * 2 };
}

export interface LowDpi {
  page: string;
  dpi: number;
}

/**
 * Картинка ровно w×h пикселей (заполнение с обрезкой по центру): SVG — растрируется сразу в нужном разрешении
 * (density), растр — масштабируется Lanczos. Эффективное разрешение исходника < MIN_SOURCE_DPI — в lowDpi.
 */
/**
 * Самый крупный растр каждого SVG-исходника за эту сборку (JPEG q95): фильтры демо-SVG дорого растрировать в 300 dpi,
 * а книге нужны блоки 210 и 150 мм и файл типографии — рисуем один раз в наибольшем размере и уменьшаем Lanczos.
 * WeakMap — память освобождается вместе с данными книги.
 */
const svgRaster = new WeakMap<Buffer, { w: number; h: number; data: Buffer }>();

async function fitImage(img: PdfImage, wPx: number, hPx: number, label: string, low: LowDpi[]): Promise<PdfImage> {
  const sharp = (await import("sharp")).default;
  sharp.cache(false); // большие растры не держим в кэше libvips (воркер — 1 ГБ)
  sharp.concurrency(1);
  const src = img.source ?? img;
  if (!src.data.length) return img;
  const svg = src.contentType.includes("svg");
  let input: Buffer;
  if (svg) {
    const m = await sharp(src.data, { density: 72 }).metadata();
    const scale = Math.max(wPx / (m.width ?? wPx), hPx / (m.height ?? hPx));
    const cached = svgRaster.get(src.data);
    if (cached && cached.w >= Math.ceil((m.width ?? wPx) * scale) && cached.h >= Math.ceil((m.height ?? hPx) * scale)) input = cached.data;
    else {
      input = await sharp(src.data, { density: Math.min(2400, Math.ceil(72 * scale * 1.01)), limitInputPixels: false }).flatten({ background: "#ffffff" }).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
      const rm = await sharp(input).metadata();
      svgRaster.set(src.data, { w: rm.width ?? 0, h: rm.height ?? 0, data: input });
    }
  } else {
    const m = await sharp(src.data).metadata();
    const scale = Math.max(wPx / (m.width ?? 1), hPx / (m.height ?? 1));
    const dpi = Math.round(PRINT_DPI / scale);
    if (dpi < MIN_SOURCE_DPI) low.push({ page: label, dpi });
    input = src.data;
  }
  const data = await sharp(input, { limitInputPixels: false })
    .resize(wPx, hPx, { fit: "cover", position: "centre", kernel: "lanczos3" })
    .flatten({ background: "#ffffff" })
    .withMetadata({ density: PRINT_DPI })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
  return { data, contentType: "image/jpeg" };
}

/**
 * Иллюстрации для типографии в 300 dpi на итоговый размер с вылетами: разворот — 2 × (формат + 2 × 3 мм) по ширине,
 * делится на половины по страницам; обложка — передняя часть с загибом. lowDpi — страницы, где исходник растянут
 * (< 250 dpi): владельцу предупреждение в админке.
 */
export async function preparePrint(b: BookPageData, k: PdfKind): Promise<{ data: BookPageData; lowDpi: LowDpi[] }> {
  const low: LowDpi[] = [];
  if (k.kind === "print") {
    const wPx = mmToPx(k.wMm + 2 * BLEED), hPx = mmToPx(k.hMm + 2 * BLEED);
    const sharp = (await import("sharp")).default;
    const spreads = [];
    for (const [i, s] of b.spreads.entries()) {
      const full = await fitImage(s.image, wPx * 2, hPx, `разворот ${i + 1}`, low);
      const half = async (left: number) => ({ data: await sharp(full.data).extract({ left, top: 0, width: wPx, height: hPx }).withMetadata({ density: PRINT_DPI }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toBuffer(), contentType: "image/jpeg" });
      spreads.push({ ...s, halves: [await half(0), await half(wPx)] as [PdfImage, PdfImage] });
    }
    return { data: { ...b, spreads, preparedFor: kindKey(k) }, lowDpi: low };
  }
  if (k.kind === "cover") {
    const g = coverGeometry(k);
    const cover = await fitImage(b.cover, mmToPx(k.wMm + g.wrap), mmToPx(g.H), "обложка", low);
    return { data: { ...b, cover, preparedFor: kindKey(k) }, lowDpi: low };
  }
  return { data: b, lowDpi: low };
}

const PT = 72 / 25.4;
/** MediaBox/BleedBox — лист целиком (обрезной формат + вылеты), TrimBox — обрезной формат. Chromium округляет размер — ставим точно. */
export async function setBoxes(pdfBytes: Buffer, trimWMm: number, trimHMm: number, bleedMm: number): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBytes);
  const b = bleedMm * PT, w = trimWMm * PT, h = trimHMm * PT;
  for (const p of doc.getPages()) {
    p.setMediaBox(0, 0, w + 2 * b, h + 2 * b);
    p.setBleedBox(0, 0, w + 2 * b, h + 2 * b);
    p.setTrimBox(b, b, w, h);
    p.setCropBox(0, 0, w + 2 * b, h + 2 * b);
  }
  return Buffer.from(await doc.save());
}

/** HTML → PDF страницами w×h мм (Chromium) и метаданные. Общий для книги и файлов допов (src/lib/addon-files.ts). */
export async function renderHtmlPdf(html: string, wMm: number, hMm: number, meta: { title: string; orderCode?: string }): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(meta.title)}</title></head><body>${html}</body></html>`, {
      waitUntil: "load",
    });
    const pdf = await page.pdf({ width: `${wMm}mm`, height: `${hMm}mm`, printBackground: true, preferCSSPageSize: true });
    return await stamp(Buffer.from(pdf), meta);
  } finally {
    await browser.close();
  }
}

/** Метаданные PDF: скрытый номер заказа (защита от копирования). */
async function stamp(pdf: Buffer, b: { title: string; orderCode?: string }) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdf);
  doc.setTitle(b.title);
  doc.setAuthor("БУКИМИ");
  doc.setCreator("bookimi.ru");
  doc.setProducer("bookimi.ru");
  if (b.orderCode) {
    doc.setSubject(`Персональная книга. Заказ ${b.orderCode}`);
    doc.setKeywords([b.orderCode]);
  }
  return Buffer.from(await doc.save());
}
