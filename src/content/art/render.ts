// Общий демо-рендер иллюстраций (владелец — агент 1). SVG-строка без GPU.
// Порядок: тема сюжета (plot.theme) → фон (theme.scene или стандартный) → доп. герои → главный герой
// (рисовальщик по plot.heroKind) → фактура стиля → настроение (applyMood) → подпись → водяной знак.
// Без фреймворков и Node API: собирается в демо-HTML (esbuild) и работает на сервере.

import type { ArtStyle, DemoExtra, DemoLook, DemoSceneCtx, HeroKind, Mood, Plot } from "../types";
import { artStyle as artStyleById, extraDrawKind, heroDrawer, themeFor } from "./index";
import { applyMood } from "./mood";
import { MOODS } from "../moods";
import { drawDeco, escapeXml, rnd } from "./shared";

const DEFAULT_STYLE: ArtStyle["demo"] = { palette: { paper: "#fbf8f1", ink: "#3a3a44", accents: ["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c"] }, line: "none", texture: "none" };

export interface DemoRenderOpts {
  plot: Pick<Plot, "slug" | "theme" | "heroKind">;
  /** 0 — обложка, 1..12 — развороты. */
  spreadIndex: number;
  /** Стиль картинок: объект, id или null (нейтральный). */
  artStyle?: ArtStyle | string | null;
  /** Настроение: объект, id или null (без настроения). */
  mood?: Mood | string | null;
  hero: DemoLook & { kind?: HeroKind };
  extras?: DemoExtra[];
  watermark?: boolean;
  caption?: string;
  /** Разворот 2:1 (по умолчанию — разворот широкий, обложка квадратная). */
  wide?: boolean;
  /** Заголовок на обложке (уже с подставленным именем). */
  title?: string;
}

function resolveStyle(s: DemoRenderOpts["artStyle"]): ArtStyle["demo"] {
  if (!s) return DEFAULT_STYLE;
  if (typeof s === "string") return artStyleById(s)?.demo ?? DEFAULT_STYLE;
  return s.demo;
}

function resolveMood(m: DemoRenderOpts["mood"]): Mood | null {
  if (!m) return null;
  if (typeof m === "string") return MOODS.find((x) => x.id === m) ?? null;
  return m;
}

function standardBackground(ctx: DemoSceneCtx) {
  const { W, H, theme: t, rnd: r } = ctx;
  const big =
    t.deco === "moon"
      ? `<path d="M${W * 0.78} 120 a90 90 0 1 0 70 140 a70 70 0 1 1 -70 -140z" fill="#f6e7b8"/>`
      : `<circle cx="${W * 0.8}" cy="170" r="70" fill="#f6e7b8" opacity=".9"/>`;
  return `<rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${big}${drawDeco(t.deco, W, H, r, t.accent)}
  <path d="M0 ${H * 0.72} Q${W * 0.3} ${H * 0.62} ${W * 0.55} ${H * 0.7} T${W} ${H * 0.66} V${H} H0Z" fill="${t.ground}"/>`;
}

function textureDefs(style: ArtStyle["demo"]) {
  const f: string[] = [];
  f.push(`<filter id="tx-noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${style.texture === "grain" ? 0.9 : 0.55}" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>`);
  f.push(`<pattern id="tx-dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1.6" fill="${style.palette.ink}"/></pattern>`);
  f.push(`<filter id="wobble"><feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="6"/></filter>`);
  f.push(`<filter id="posterize" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="discrete" tableValues="0 .25 .5 .75 1"/><feFuncG type="discrete" tableValues="0 .25 .5 .75 1"/><feFuncB type="discrete" tableValues="0 .25 .5 .75 1"/></feComponentTransfer></filter>`);
  f.push(`<filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>`);
  return f.join("");
}

function textureOverlay(style: ArtStyle["demo"], W: number, H: number) {
  switch (style.texture) {
    case "paper":
      return `<rect width="${W}" height="${H}" fill="${style.palette.paper}" opacity=".22"/><rect width="${W}" height="${H}" filter="url(#tx-noise)" opacity=".08"/>`;
    case "grain":
      return `<rect width="${W}" height="${H}" filter="url(#tx-noise)" opacity=".16"/>`;
    case "halftone":
      return `<rect width="${W}" height="${H}" fill="url(#tx-dots)" opacity=".08"/>`;
    default:
      return "";
  }
}

export function watermark(W: number, H: number) {
  let marks = "";
  for (let y = 120; y < H; y += 220) for (let x = -200; x < W; x += 420) marks += `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})">БУКИМИ · ПРЕВЬЮ</text>`;
  return `<g font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" opacity=".28">${marks}</g>`;
}

/** Иллюстрация разворота (или обложки при spreadIndex = 0). */
export function renderDemoSpread(o: DemoRenderOpts): string {
  const style = resolveStyle(o.artStyle);
  const theme = themeFor(o.plot.theme);
  const idx = o.spreadIndex;
  const W = (o.wide ?? idx > 0) ? 2048 : 1024;
  const H = 1024;
  const r = rnd(idx * 97 + o.plot.theme.length * 13 + o.plot.slug.length * 7 + 7);
  const ctx: DemoSceneCtx = { W, H, index: idx, theme, style, rnd: r };
  const bg = theme.scene ? theme.scene(ctx) : standardBackground(ctx);

  const heroKind = o.hero.kind ?? o.plot.heroKind;
  const left = idx % 2 === 1;
  const hx = left ? W * 0.62 : W * 0.38;
  const heroScale = idx === 0 ? 1.5 : 1.25;
  const extras = (o.extras ?? []).slice(0, 3).map((e, i) => {
    const kind = e.kind ?? extraDrawKind(e.role, heroKind);
    const k = kind === "pet" || kind === "toy" ? 0.55 : kind === "custom" ? 0.65 : kind === "adult" && heroKind !== "adult" ? 0.9 : 0.75;
    const x = hx + (i + 1) * 170 * (left ? -1 : 1);
    return heroDrawer(kind)({ kind: kind === "toy" || kind === "custom" ? heroKind : kind, look: e.look, x, y: H * 0.66, scale: heroScale * k, style, index: idx + i + 1, flip: !left });
  });
  const hero = heroDrawer(heroKind)({ kind: heroKind, look: o.hero, x: hx, y: H * 0.6, scale: heroScale, style, index: idx, flip: left && heroKind === "pet" });

  // Фильтр стиля — только на фигуры: на фоне он рвёт края кадра
  const fx = style.filter && ["wobble", "posterize", "soft"].includes(style.filter) ? ` filter="url(#${style.filter})"` : "";
  const art = `${bg}<g${fx}>${extras.join("")}${hero}</g>${textureOverlay(style, W, H)}`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.sky[0]}"/><stop offset="1" stop-color="${theme.sky[1]}"/></linearGradient>${textureDefs(style)}</defs>
  ${art}
</svg>`;
  svg = applyMood(svg, resolveMood(o.mood));

  let over = "";
  if (o.title && idx === 0)
    over += `<rect x="0" y="0" width="${W}" height="150" fill="${style.palette.paper}" opacity=".85"/><text x="${W / 2}" y="95" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="700" fill="${style.palette.ink}">${escapeXml(o.title)}</text>`;
  if (o.caption) over += `<text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#fff" opacity=".8">${escapeXml(o.caption)}</text>`;
  if (o.watermark) over += watermark(W, H);
  return over ? svg.replace(/<\/svg>\s*$/, `${over}</svg>`) : svg;
}

/** Обложка: квадрат 1024×1024, герой крупнее, необязательный заголовок. */
export function renderDemoCover(o: Omit<DemoRenderOpts, "spreadIndex">): string {
  return renderDemoSpread({ ...o, spreadIndex: 0, wide: o.wide ?? false });
}
