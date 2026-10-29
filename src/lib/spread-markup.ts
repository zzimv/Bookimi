// Разметка текста разворота — общая для экрана (src/components/SpreadText.tsx) и PDF (src/lib/pdf.ts).
// Текст хранится как есть (стихи — строки через \n, комикс — подписи [в скобках], мысли (в круглых), звуки КАПСОМ!).
// Здесь — только разбор на строки и кусочки, без React и без Node API (работает и в демо-стенде).

export type SpreadInline = { t: "text" | "sound"; v: string };
export type SpreadLine =
  | { kind: "gap" } // пустая строка — граница строфы
  | { kind: "caption" | "thought" | "line"; parts: SpreadInline[] };

/** Звукоподражание: слово заглавными (от 2 букв, можно через дефис) с «!» или «?!»: ВЖЖЖ!, ДЗЫНЬ!, ТУК-ТУК! */
const SOUND = /(^|[^A-Za-zА-Яа-яЁё])([А-ЯЁ]{2,}(?:-[А-ЯЁ]{2,})*[!?]*!+)(?=$|[^A-Za-zА-Яа-яЁё])/g;

export function splitSounds(s: string): SpreadInline[] {
  const out: SpreadInline[] = [];
  let last = 0;
  for (const m of s.matchAll(SOUND)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push({ t: "text", v: s.slice(last, start) });
    out.push({ t: "sound", v: m[2] });
    last = start + m[2].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

/** Текст разворота → строки: подпись рассказчика [..], мысль (..), обычная строка; пустая строка — пауза. */
export function parseSpread(text: string | null | undefined): SpreadLine[] {
  const lines = (text ?? "").replace(/\r\n?/g, "\n").trim().split("\n");
  const out: SpreadLine[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) {
      if (out.length && out[out.length - 1].kind !== "gap") out.push({ kind: "gap" });
      continue;
    }
    const cap = /^\[(.+)\]$/.exec(l);
    if (cap) {
      out.push({ kind: "caption", parts: splitSounds(cap[1].trim()) });
      continue;
    }
    if (/^\(.+\)$/.test(l)) {
      out.push({ kind: "thought", parts: splitSounds(l) });
      continue;
    }
    out.push({ kind: "line", parts: splitSounds(l) });
  }
  return out;
}

/** Без разметки — для субтитров, озвучки и превью в одну строку. */
export function plainSpread(text: string): string {
  return parseSpread(text)
    .map((l) => (l.kind === "gap" ? null : l.parts.map((p) => p.v).join("")))
    .filter((l): l is string => l !== null)
    .join("\n");
}

const escHtml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** HTML для PDF: те же классы, что на экране (sp-*); стили — SPREAD_PDF_CSS. */
export function spreadHtml(text: string): string {
  return parseSpread(text)
    .map((l) => {
      if (l.kind === "gap") return `<span class="sp-gap"></span>`;
      const inner = l.parts.map((p) => (p.t === "sound" ? `<b class="sp-sound">${escHtml(p.v)}</b>` : escHtml(p.v))).join("");
      return `<span class="sp-${l.kind === "caption" ? "cap" : l.kind === "thought" ? "thought" : "line"}">${inner}</span>`;
    })
    .join("");
}

/** Стили разметки для PDF (на экране — globals.css, те же правила). */
export const SPREAD_PDF_CSS = `.sp-line,.sp-thought{display:block}
  .sp-gap{display:block;height:.55em}
  .sp-thought{font-style:italic}
  .sp-cap{display:table;margin:.25em 0;padding:.15em .55em;background:#f6e7b8;border:.35mm solid #1a2b24;border-radius:1mm;font-weight:600;font-size:.92em;box-shadow:.6mm .6mm 0 #1a2b24}
  .sp-cap:first-child{margin-top:0}
  .sp-sound{font-family:Nunito,sans-serif;font-weight:800;letter-spacing:.03em;color:#b23a1e;font-size:1.12em}`;
