// Рендер книги HTML → PDF (Chromium) во всех форматах. Один шаблон вёрстки адаптируется под форматы.
//  screen    — для экрана, квадратные страницы, облегчённые картинки
//  a4        — домашняя печать: А4 альбомный, разворот (2 страницы) на листе
//  print     — для типографии и копицентра: страница w×h + вылеты 3 мм, безопасные поля 5 мм, 300 dpi
//  cover     — обложка для типографии: задняя + корешок + передняя (для твёрдой — с загибами)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spreadHtml, SPREAD_PDF_CSS } from "./spread-markup";

export interface BookPageData {
  title: string;
  dedication: string;
  heroName: string;
  /** Аудитория книги — от неё зависят подписи на последней странице и обложке. */
  audience?: "CHILD" | "TEEN" | "ADULT" | "PET";
  /** Пол героя (boy | girl) — для «главный герой / главная героиня». */
  heroGender?: string;
  cover: { data: Buffer; contentType: string };
  spreads: { text: string; image: { data: Buffer; contentType: string } }[];
  orderCode?: string;
}

export type PdfKind =
  | { kind: "screen" }
  | { kind: "a4" }
  | { kind: "print"; wMm: number; hMm: number }
  | { kind: "cover"; wMm: number; hMm: number; hard: boolean; pages: number };

const BLEED = 3;
const SAFE = 5;

let fontCss: string | null = null;
function fonts() {
  if (fontCss) return fontCss;
  const f = (pkg: string, file: string) =>
    readFileSync(join(process.cwd(), "node_modules/@fontsource", pkg, "files", file)).toString("base64");
  const face = (family: string, weight: number, b64: string, range: string) =>
    `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`;
  const CYR = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
  const LAT = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  fontCss = [
    face("Nunito", 800, f("nunito", "nunito-cyrillic-800-normal.woff2"), CYR),
    face("Nunito", 800, f("nunito", "nunito-latin-800-normal.woff2"), LAT),
    face("Manrope", 500, f("manrope", "manrope-cyrillic-500-normal.woff2"), CYR),
    face("Manrope", 500, f("manrope", "manrope-latin-500-normal.woff2"), LAT),
  ].join("");
  return fontCss;
}

/** Подписи книги по аудитории: последняя страница, задняя обложка, возрастная маркировка. */
export function bookWording(b: Pick<BookPageData, "heroName" | "audience" | "heroGender">) {
  const girl = b.heroGender === "girl";
  const name = b.heroName;
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

const uri = (img: { data: Buffer; contentType: string }) => `data:${img.contentType};base64,${img.data.toString("base64")}`;
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);

function baseCss(pageW: number, pageH: number) {
  return `${fonts()}
  @page{size:${pageW}mm ${pageH}mm;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${pageW}mm}
  body{font-family:Manrope,sans-serif;color:#1a2b24;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{width:${pageW}mm;height:${pageH}mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
  .img{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}
  .text{position:absolute;background:rgba(255,255,255,.88);border-radius:4mm;padding:4mm 5mm;font-size:var(--fs);line-height:1.45;white-space:pre-line}
  ${SPREAD_PDF_CSS}
  h1{font-family:Nunito,sans-serif;font-weight:800}
  .mark{position:absolute;bottom:1mm;right:1mm;font-size:1pt;color:#fff}`;
}

/** Страницы блока: посвящение, 12 разворотов (24 страницы), финальная страница. */
function blockPages(b: BookPageData, pageW: number, pageH: number, inset: number) {
  const fs = Math.max(9, Math.min(15, pageW / 15)); // pt
  const pages: string[] = [];
  pages.push(`<section class="page" style="display:flex;align-items:center;justify-content:center;padding:${inset + 12}mm;text-align:center">
    <div><h1 style="font-size:${fs * 1.6}pt;color:#1e4d3b;margin-bottom:8mm">${esc(b.title)}</h1>
    ${b.dedication ? `<p style="font-size:${fs}pt;font-style:italic;max-width:80%;margin:0 auto;white-space:pre-line">${esc(b.dedication)}</p>` : ""}</div></section>`);
  b.spreads.forEach((s, i) => {
    const textLeft = i % 2 === 0;
    for (const side of ["left", "right"] as const) {
      const pos = side === "left" ? "0% 50%" : "100% 50%";
      const hasText = (side === "left") === textLeft;
      pages.push(`<section class="page" style="--fs:${fs}pt">
        <div class="img" style="background-image:url(${uri(s.image)});background-size:200% 100%;background-position:${pos}"></div>
        ${hasText ? `<div class="text" style="left:${inset + 4}mm;right:${inset + 4}mm;bottom:${inset + 4}mm">${spreadHtml(s.text)}</div>` : ""}
        <span class="mark">${esc(b.orderCode ?? "")}</span></section>`);
    }
  });
  pages.push(`<section class="page" style="display:flex;align-items:center;justify-content:center;text-align:center;padding:${inset + 12}mm">
    <p style="font-size:${fs}pt">${esc(bookWording(b).madeFor)}<br><br><b style="font-family:Nunito">букими</b></p></section>`);
  return pages.join("");
}

export function bookHtml(b: BookPageData, k: PdfKind): { html: string; wMm: number; hMm: number } {
  if (k.kind === "screen") {
    const W = 210, H = 210;
    const cover = `<section class="page"><div class="img" style="background-image:url(${uri(b.cover)})"></div>
      <h1 style="position:absolute;left:10mm;right:10mm;bottom:12mm;color:#fff;font-size:22pt;text-shadow:0 1mm 4mm rgba(0,0,0,.4)">${esc(b.title)}</h1></section>`;
    return { html: `<style>${baseCss(W, H)}</style>${cover}${blockPages(b, W, H, 0)}`, wMm: W, hMm: H };
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
    sheets.push(`<div class="sheet"><div class="cell"><section class="page"><div class="img" style="background-image:url(${uri(b.cover)})"></div></section></div>${inner[0]}</div>`);
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
  const spine = k.hard ? Math.round((k.pages * 0.1 + 4) * 10) / 10 : Math.round(k.pages * 0.1 * 10) / 10;
  const wrap = k.hard ? 17 : BLEED;
  const W = k.wMm * 2 + spine + wrap * 2, H = k.hMm + wrap * 2;
  const html = `<style>${baseCss(W, H)}</style><section class="page">
    <div class="img" style="left:${wrap + k.wMm + spine}mm;right:0;background-image:url(${uri(b.cover)})"></div>
    <h1 style="position:absolute;left:${wrap + k.wMm + spine + 10}mm;width:${k.wMm - 20}mm;bottom:${wrap + 14}mm;color:#fff;font-size:20pt;text-shadow:0 1mm 4mm rgba(0,0,0,.4)">${esc(b.title)}</h1>
    <div style="position:absolute;left:0;width:${wrap + k.wMm}mm;top:0;bottom:0;background:#1e4d3b"></div>
    <p style="position:absolute;left:${wrap + 15}mm;width:${k.wMm - 30}mm;bottom:${wrap + 15}mm;color:#f3e4c2;font-size:10pt">${esc(bookWording(b).back)}<br><b style="font-family:Nunito;font-size:14pt">букими</b> · ${bookWording(b).rating}</p>
    <div style="position:absolute;left:${wrap + k.wMm}mm;width:${spine}mm;top:0;bottom:0;background:#143628"></div>
    <span class="mark">${esc(b.orderCode ?? "")}</span></section>`;
  return { html, wMm: W, hMm: H };
}

export async function renderPdf(b: BookPageData, k: PdfKind): Promise<Buffer> {
  const { chromium } = await import("playwright-core");
  const { html, wMm, hMm } = bookHtml(b, k);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(b.title)}</title></head><body>${html}</body></html>`, {
      waitUntil: "load",
    });
    const pdf = await page.pdf({ width: `${wMm}mm`, height: `${hMm}mm`, printBackground: true, preferCSSPageSize: true });
    return await stamp(Buffer.from(pdf), b);
  } finally {
    await browser.close();
  }
}

/** Метаданные PDF: скрытый номер заказа (защита от копирования). */
async function stamp(pdf: Buffer, b: BookPageData) {
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
