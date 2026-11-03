// ВЛАДЕЛЕЦ: агент 10 (настроения иллюстраций). Никто другой этот файл не меняет.
//  • applyMood(svg, mood) — тонирует готовый SVG демо-иллюстрации: насыщенность, тон, яркость, контраст
//    (один SVG-фильтр на всё содержимое), «свет времени суток» (градиенты поверх), декор и эффекты.
//  • moodPrompt(prompt, negative, mood) — добавки настроения к промпту и негативу Qwen.
// Только строковые операции: без DOM, фреймворков и Node API (модуль попадает в демо-бандл).
//
// Идемпотентность: всё, что добавляет applyMood, помечено (data-mood-*, <!--mood:end-->). Повторный вызов
// сначала снимает прежнее настроение, затем накладывает новое — двойного оборачивания не бывает;
// нейтральное настроение (или null) на уже тонированном SVG возвращает исходник.
//
// Аудитории настроения — Mood.audiences (types.ts), фильтр — moodsFor(audience) в moods.ts.

import type { Mood } from "../types";
import { drawDeco, rnd } from "./shared";

/** Необязательные расширения демо-блока настроения (поверх Mood["demo"]). */
export interface MoodDemoFx {
  /** Сила тонировки 0..1 (умножение на tint). По умолчанию .3. */
  tintStrength?: number;
  /** Контраст: 1 — без изменений. */
  contrast?: number;
  /** «Свет времени суток»: вертикальная заливка поверх, сверху и снизу. */
  light?: { top: string; topOpacity: number; bottom: string; bottomOpacity: number };
  /** Мягкий источник света (солнце, луна, сияние): доли кадра. */
  glow?: { color: string; x: number; y: number; r: number; opacity: number };
  /** Затемнение/высветление краёв. */
  vignette?: { color: string; opacity: number };
  /** Собственные эффекты настроения. */
  fx?: ("fireflies" | "sunrays" | "bokeh" | "grain" | "snowfall" | "garland")[];
  /** Цвет декора extraDeco (сердечки, листья, флажки); по умолчанию tint. */
  decoColor?: string;
  /** Сколько элементов extraDeco. */
  decoCount?: number;
}

export type MoodDemo = Mood["demo"] & MoodDemoFx;

const START = "<!--mood:start-->";
const END = "<!--mood:end-->";
const BODY_OPEN = /<g data-mood-body="[^"]*"[^>]*>/;
const BODY_CLOSE = `</g><g data-mood-over`;

const n3 = (x: number) => String(Math.round(x * 1000) / 1000);
const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [1, 1, 1];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
const safeColor = (c: string | undefined, fb: string) => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : fb);
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_") || "x";

/** Снимает ранее наложенное applyMood настроение (если его нет — возвращает строку как есть). */
export function stripMood(svg: string): string {
  const s = svg.indexOf(START);
  const e = svg.indexOf(END, s);
  if (s < 0 || e < 0) return svg;
  const chunk = svg.slice(s, e);
  const open = BODY_OPEN.exec(chunk);
  const close = chunk.lastIndexOf(BODY_CLOSE);
  if (!open || close < 0) return svg;
  const body = chunk.slice(open.index + open[0].length, close);
  return svg.slice(0, s) + body + svg.slice(e + END.length);
}

/** Настроение ничего не меняет («как задумал художник»). */
export function isNeutralMood(mood: Mood | null | undefined): boolean {
  if (!mood) return true;
  const d = mood.demo as MoodDemo;
  const [r, g, b] = hex(d.tint);
  const noTint = (d.tintStrength ?? 0.3) === 0 || (r === 1 && g === 1 && b === 1);
  return (
    noTint &&
    d.saturation === 1 &&
    d.brightness === 1 &&
    (d.contrast ?? 1) === 1 &&
    (!d.extraDeco || d.extraDeco === "none") &&
    !d.light &&
    !d.glow &&
    !d.vignette &&
    !(d.fx && d.fx.length)
  );
}

function fxLayer(kind: NonNullable<MoodDemoFx["fx"]>[number], id: string, W: number, H: number, r: () => number, d: MoodDemo): string {
  switch (kind) {
    case "fireflies": {
      let out = "";
      for (let i = 0; i < 22; i++) {
        const x = Math.round(40 + r() * (W - 80));
        const y = Math.round(H * 0.25 + r() * H * 0.6);
        const k = 0.6 + r() * 0.9;
        out += `<circle cx="${x}" cy="${y}" r="${n3(16 * k)}" fill="url(#${id}-ff)"/><circle cx="${x}" cy="${y}" r="${n3(2.6 * k)}" fill="#fffbd0"/>`;
      }
      return `<g data-fx="fireflies">${out}</g>`;
    }
    case "sunrays": {
      const g = d.glow ?? { x: 0.8, y: 0.12, color: "#fff2c4", r: 0.3, opacity: 0.5 };
      const cx = g.x * W;
      const cy = g.y * H;
      const L = Math.hypot(W, H);
      let out = "";
      const rays = 9;
      for (let i = 0; i < rays; i++) {
        const a = Math.PI * (0.52 + (i / (rays - 1)) * 0.5) + (r() - 0.5) * 0.06;
        const w = 0.025 + r() * 0.03;
        const x1 = cx + Math.cos(a - w) * L;
        const y1 = cy + Math.sin(a - w) * L;
        const x2 = cx + Math.cos(a + w) * L;
        const y2 = cy + Math.sin(a + w) * L;
        out += `<path d="M${n3(cx)} ${n3(cy)}L${n3(x1)} ${n3(y1)}L${n3(x2)} ${n3(y2)}Z"/>`;
      }
      return `<g data-fx="sunrays" fill="url(#${id}-ray)" opacity=".55">${out}</g>`;
    }
    case "bokeh": {
      let out = "";
      for (let i = 0; i < 16; i++) {
        const x = Math.round(r() * W);
        const y = Math.round(r() * H * 0.75);
        out += `<circle cx="${x}" cy="${y}" r="${n3(18 + r() * 46)}" fill="url(#${id}-bk)"/>`;
      }
      return `<g data-fx="bokeh">${out}</g>`;
    }
    case "grain":
      return `<rect data-fx="grain" width="${W}" height="${H}" filter="url(#${id}-grain)" opacity=".13"/>`;
    case "snowfall": {
      // rev 17 «Зимнее»: крупные снежинки-звёздочки поверх мелкого снега
      let out = "";
      const k = H / 1024;
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        const y = r() * H * 0.95;
        const s = (7 + r() * 9) * k;
        out += `<g transform="translate(${n3(x)} ${n3(y)}) rotate(${Math.round(r() * 60)})"><path d="M${n3(-s)} 0H${n3(s)}M${n3(-s / 2)} ${n3(-s * 0.866)}L${n3(s / 2)} ${n3(s * 0.866)}M${n3(-s / 2)} ${n3(s * 0.866)}L${n3(s / 2)} ${n3(-s * 0.866)}"/></g>`;
      }
      return `<g data-fx="snowfall" stroke="#ffffff" stroke-width="${n3(2.4 * (H / 1024))}" stroke-linecap="round" opacity=".9">${out}</g>`;
    }
    case "garland": {
      // rev 17 «Праздничное»: гирлянда-огоньки вдоль верхнего края (тонко — не мешает тексту)
      const k = H / 1024;
      const spans = Math.max(2, Math.round(W / (H * 0.55)));
      const cols = ["#ff5a5a", "#ffd23f", "#3ec7a5", "#5aa8ff", "#ff8fd1"];
      let wire = "";
      let bulbs = "";
      let n = 0;
      for (let i = 0; i < spans; i++) {
        const x0 = (i * W) / spans;
        const x1 = ((i + 1) * W) / spans;
        const sag = 34 * k;
        wire += `M${n3(x0)} ${n3(6 * k)} Q${n3((x0 + x1) / 2)} ${n3(6 * k + sag * 2)} ${n3(x1)} ${n3(6 * k)}`;
        for (let j = 1; j < 8; j++) {
          const t = j / 8;
          const x = x0 + (x1 - x0) * t;
          const y = 6 * k + 2 * t * (1 - t) * sag * 2;
          const c = cols[n++ % cols.length];
          bulbs += `<circle cx="${n3(x)}" cy="${n3(y + 10 * k)}" r="${n3(18 * k)}" fill="${c}" opacity=".28"/><ellipse cx="${n3(x)}" cy="${n3(y + 10 * k)}" rx="${n3(6 * k)}" ry="${n3(9 * k)}" fill="${c}"/>`;
        }
      }
      return `<g data-fx="garland"><path d="${wire}" stroke="#3b3a2a" stroke-width="${n3(2.2 * k)}" fill="none"/>${bulbs}</g>`;
    }
  }
}

/** Применяет настроение к SVG-строке (корневой <svg> с viewBox). Без настроения — возвращает как есть. */
export function applyMood(svg: string, mood: Mood | null | undefined): string {
  if (typeof svg !== "string") return svg;
  const clean = stripMood(svg);
  if (!mood || isNeutralMood(mood)) return clean;
  const open = clean.match(/<svg\b[^>]*>/);
  const close = clean.lastIndexOf("</svg>");
  if (!open || open.index === undefined || close < open.index) return clean;
  if (/\/>\s*$/.test(open[0])) return clean; // <svg/> без содержимого
  const vb = open[0].match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*["']/);
  const wA = open[0].match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/);
  const hA = open[0].match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/);
  const W = vb ? Number(vb[1]) : wA ? Number(wA[1]) : 1024;
  const H = vb ? Number(vb[2]) : hA ? Number(hA[1]) : 1024;

  const d = mood.demo as MoodDemo;
  const id = `mood-${safeId(mood.id)}`;
  const r = rnd(hash(mood.id) + W * 7 + H);

  // Цвет: насыщенность → (тон × яркость) и контраст одной матрицей.
  const k = Math.max(0, Math.min(1, d.tintStrength ?? 0.3));
  const t = hex(d.tint);
  const b = d.brightness;
  const c = d.contrast ?? 1;
  const f = t.map((x) => (1 - k + k * x) * b * c);
  const off = 0.5 * (1 - c);
  const matrix = `${n3(f[0])} 0 0 0 ${n3(off)} 0 ${n3(f[1])} 0 0 ${n3(off)} 0 0 ${n3(f[2])} 0 ${n3(off)} 0 0 0 1 0`;
  const defs: string[] = [
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${n3(d.saturation)}"/><feColorMatrix type="matrix" values="${matrix}"/></filter>`,
  ];
  const over: string[] = [];

  if (d.light) {
    const L = d.light;
    defs.push(
      `<linearGradient id="${id}-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${safeColor(L.top, "#fff")}" stop-opacity="${n3(L.topOpacity)}"/><stop offset=".55" stop-color="${safeColor(L.top, "#fff")}" stop-opacity="0"/><stop offset=".6" stop-color="${safeColor(L.bottom, "#000")}" stop-opacity="0"/><stop offset="1" stop-color="${safeColor(L.bottom, "#000")}" stop-opacity="${n3(L.bottomOpacity)}"/></linearGradient>`,
    );
    over.push(`<rect width="${W}" height="${H}" fill="url(#${id}-light)"/>`);
  }
  if (d.glow) {
    const g = d.glow;
    const gc = safeColor(g.color, "#fff");
    defs.push(`<radialGradient id="${id}-glow"><stop offset="0" stop-color="${gc}" stop-opacity="${n3(g.opacity)}"/><stop offset=".45" stop-color="${gc}" stop-opacity="${n3(g.opacity * 0.35)}"/><stop offset="1" stop-color="${gc}" stop-opacity="0"/></radialGradient>`);
    const R = g.r * Math.max(W, H);
    over.push(`<circle cx="${n3(g.x * W)}" cy="${n3(g.y * H)}" r="${n3(R)}" fill="url(#${id}-glow)"/>`);
  }
  if (d.vignette) {
    const vc = safeColor(d.vignette.color, "#000");
    defs.push(`<radialGradient id="${id}-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="${vc}" stop-opacity="0"/><stop offset="1" stop-color="${vc}" stop-opacity="${n3(d.vignette.opacity)}"/></radialGradient>`);
    over.push(`<rect width="${W}" height="${H}" fill="url(#${id}-vig)"/>`);
  }
  for (const kind of d.fx ?? []) {
    if (kind === "fireflies") defs.push(`<radialGradient id="${id}-ff"><stop offset="0" stop-color="#fff3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd84a" stop-opacity="0"/></radialGradient>`);
    if (kind === "sunrays") defs.push(`<linearGradient id="${id}-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${safeColor(d.glow?.color, "#fff2c4")}" stop-opacity=".5"/><stop offset=".8" stop-color="${safeColor(d.glow?.color, "#fff2c4")}" stop-opacity="0"/></linearGradient>`);
    if (kind === "bokeh") defs.push(`<radialGradient id="${id}-bk"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="${safeColor(d.decoColor ?? d.tint, "#fff")}" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
    if (kind === "grain") defs.push(`<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 .35 0 0 0 0 .25 0 0 0 0 .15 0 0 0 1.4 -.35"/></filter>`);
    over.push(fxLayer(kind, id, W, H, r, d));
  }
  if (d.extraDeco && d.extraDeco !== "none") {
    over.push(`<g data-fx="deco" opacity=".85">${drawDeco(d.extraDeco, W, H, r, safeColor(d.decoColor ?? d.tint, "#ffffff"), d.decoCount ?? 22)}</g>`);
  }

  const start = open.index + open[0].length;
  const body = clean.slice(start, close);
  return (
    clean.slice(0, start) +
    START +
    `<defs data-mood-defs="${safeId(mood.id)}">${defs.join("")}</defs>` +
    `<g data-mood-body="${safeId(mood.id)}" filter="url(#${id})">${body}${BODY_CLOSE}="${safeId(mood.id)}">${over.join("")}</g>` +
    END +
    clean.slice(close)
  );
}

// ---------------------------------------------------------------------------
// Промпт Qwen
// ---------------------------------------------------------------------------

/** Чистит текст промпта: пробелы, двойные запятые, запятые перед точкой, висячие разделители. */
function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;])(\s*[,;])+/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .replace(/^[\s,;.]+|[\s,;]+$/g, "")
    .trim();
}

/** Список через запятую без повторов (без учёта регистра). */
function mergeList(...parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts)
    for (const item of p.split(/[,;\n]/)) {
      const v = tidy(item);
      const key = v.toLowerCase();
      if (v && !seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
  return out.join(", ");
}

/** Добавки настроения к промпту и негативу Qwen. Без настроения/с пустыми добавками — вход как есть. */
export function moodPrompt(prompt: string, negative: string, mood: Mood | null | undefined): { prompt: string; negative: string } {
  if (!mood || (!mood.promptAdd.trim() && !mood.negativeAdd.trim())) return { prompt, negative };
  let p = prompt;
  const add = tidy(mood.promptAdd);
  if (add) {
    const base = tidy(prompt).replace(/[,;:]+$/, "");
    p = base ? `${base}${/[.!?]$/.test(base) ? "" : "."} Mood: ${add}` : `Mood: ${add}`;
  }
  const neg = mood.negativeAdd.trim() ? mergeList(negative, mood.negativeAdd) : negative;
  return { prompt: p, negative: neg };
}
