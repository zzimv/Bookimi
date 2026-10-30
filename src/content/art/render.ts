// Общий демо-рендер иллюстраций (владелец — агент 1). SVG-строка без GPU.
// Порядок: тема сюжета (plot.theme) → фон (theme.scene или стандартный) → доп. герои → главный герой
// (рисовальщик по plot.heroKind) → фактура стиля → настроение (applyMood) → подпись → водяной знак.
// Без фреймворков и Node API: собирается в демо-HTML (esbuild) и работает на сервере.

import type { ArtStyle, DemoExtra, DemoLook, DemoSceneCtx, ExtraDrawKind, HeroKind, Mood, Plot } from "../types";
import { artStyle as artStyleById, extraDrawKind, heroDrawer, themeFor } from "./index";
import { applyMood } from "./mood";
import { MOODS } from "../moods";
import { drawDeco, escapeXml, HAIR_COLORS, rnd } from "./shared";
import { FIGURE_FILTERS, PROP_BACKDROPS, fxBackdrop, fxDefs, fxLayers } from "./fx";
import { sceneProps } from "./props";

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
  /**
   * Слой для мультфильма (параллакс): background — сцена без героев; mask — силуэт героев белым на чёрном
   * (альфа для вырезания героев из полной картинки). По умолчанию — вся иллюстрация.
   */
  layer?: "background" | "mask";
  /** Описание сцены разворота (англ.): по нему — реквизит (река, окно, сани, подарки…) и тон неба (art/props.ts). */
  scene?: string;
  /**
   * Группа на заднем плане (дети группы/класса и взрослые, до 40): маленькие фигуры рядами, как на общей
   * фотографии, никогда не заходят на героя и доп. героев. Внешность — crowdLooks(...). Рисуется, если передана.
   */
  crowd?: DemoCrowdMember[];
  /** around — герой на своём месте, группа по сторонам; photo — «общая фотография»: герой в центре первого ряда. */
  crowdLayout?: "around" | "photo";
}

/** Фигура группы для демо. */
export interface DemoCrowdMember {
  kind?: "child" | "teen" | "adult";
  look: DemoLook;
}

/** Детей группы на картинке — до 40 (плюс до 3 взрослых). */
export const CROWD_MAX = 40;

const CROWD_HAIR = Object.keys(HAIR_COLORS).filter((h) => h !== "седые" && h !== "с проседью");
const CROWD_SKIN = ["светлый", "светлый", "светлый", "смуглый", "тёмный"];
const CROWD_OUTFIT = ["#e07a5f", "#3d85c6", "#f2cc8f", "#81b29a", "#9b72cf", "#f28482", "#4ea8de", "#ffb703", "#6a994e", "#d1495b"];

/**
 * Внешность группы для демо: пол и приметы из анкеты (описание «рыжие, очки, косички»), остальное —
 * детерминированно по номеру (seed), чтобы на всех разворотах ребёнок выглядел одинаково.
 */
export function crowdLooks(
  members: { gender?: string; description?: string }[],
  adults: { gender?: string }[] = [],
  opts: { kind?: "child" | "teen"; age?: number; seed?: number } = {},
): DemoCrowdMember[] {
  const r = rnd(97 + (opts.seed ?? 0));
  const kids = members.slice(0, CROWD_MAX).map((m, i): DemoCrowdMember => {
    const d = (m.description ?? "").toLowerCase();
    const rh = r();
    const rs = r();
    const rg = r();
    const hair = CROWD_HAIR.find((h) => d.includes(h.slice(0, 4))) ?? CROWD_HAIR[Math.floor(rh * CROWD_HAIR.length)];
    const skin = (["светлый", "смуглый", "тёмный"] as const).find((x) => d.includes(x.slice(0, 5))) ?? CROWD_SKIN[Math.floor(rs * CROWD_SKIN.length)];
    return {
      kind: opts.kind ?? "child",
      look: {
        gender: m.gender ?? (rg < 0.5 ? "boy" : "girl"),
        age: opts.age ?? 6,
        hair,
        skin,
        hairstyle: /кос|хвост|кудр|каре|коротк/.test(d) ? d : "",
        glasses: /очк/.test(d) || rg > 0.92,
        freckles: /веснуш/.test(d),
        outfit: CROWD_OUTFIT[(i * 7 + Math.floor(rs * 3)) % CROWD_OUTFIT.length],
      },
    };
  });
  const grown = adults.slice(0, 3).map((a, i): DemoCrowdMember => ({ kind: "adult", look: { gender: a.gender ?? "girl", age: 40, hair: CROWD_HAIR[(i + 2) % CROWD_HAIR.length], outfit: CROWD_OUTFIT[(i * 3 + 5) % CROWD_OUTFIT.length] } }));
  return [...kids, ...grown];
}

export interface CrowdSlot {
  /** Номер фигуры в crowd. */
  i: number;
  x: number;
  /** Ступни. */
  feet: number;
  scale: number;
  /** Полуширина фигуры с учётом масштаба. */
  halfWidth: number;
}

/**
 * Раскладка группы рядами (как на общей фотографии): до 4 рядов, задние — выше и рисуются раньше.
 * Фигуры стоят только вне полосы [zoneLo, zoneHi] (герой и доп. герои) и в пределах кадра; если не влезают —
 * уменьшаются.
 */
export function crowdLayout(o: { W: number; H: number; count: number; kinds: (HeroKind | "adult")[]; heroFeet: number; heroScale: number; zoneLo: number; zoneHi: number }): CrowdSlot[] {
  const N = Math.min(o.count, CROWD_MAX + 3);
  if (N <= 0) return [];
  const M = 14; // край кадра и зазор до героя
  const segs = ([
    [M, o.zoneLo - M],
    [o.zoneHi + M, o.W - M],
  ] as [number, number][]).filter(([a, b]) => b - a > 0);
  const hwOf = (k: HeroKind | "adult") => halfWidth(k === "adult" ? "adult" : k) * (k === "adult" ? 1.12 : 1);
  const maxHw = Math.max(72, ...o.kinds.slice(0, N).map(hwOf));
  let s = o.heroScale * 0.62;
  for (let step = 0; step < 40; step++, s *= 0.92) {
    const hw = maxHw * s;
    const pitch = hw * 1.5; // соседи чуть заходят друг за друга — как на фото, но не на героя
    const rowStep = 95 * s;
    const caps = segs.map(([a, b]) => (b - a >= 2 * hw ? Math.floor((b - a - 2 * hw) / pitch) + 1 : 0));
    const cap = caps.reduce((x, y) => x + y, 0);
    if (!cap) continue;
    const rows = Math.ceil(N / cap);
    const backFeet = o.heroFeet - 30 - (rows - 1) * rowStep;
    if (rows > 4 || backFeet - 250 * s < 8) continue;
    const out: CrowdSlot[] = [];
    let i = 0;
    for (let r = 0; r < rows && i < N; r++) {
      const inRow = Math.min(cap, N - i);
      // Ряд делится между сторонами пропорционально вместимости
      const share = caps.map((c) => Math.floor((c / cap) * inRow));
      let left = inRow - share.reduce((x, y) => x + y, 0);
      for (let k = 0; left > 0; k = (k + 1) % caps.length) if (share[k] < caps[k]) (share[k]++, left--);
      segs.forEach(([a, b], k) => {
        const n = share[k];
        const span = b - a - 2 * hw;
        const off = r % 2 && n < caps[k] ? pitch / 2 : 0;
        for (let j = 0; j < n; j++) {
          const x = a + hw + (n === 1 ? span / 2 : off + (j * (span - off)) / (n - 1));
          const sc = o.kinds[i] === "adult" ? s * 1.12 : s;
          out.push({ i, x, feet: o.heroFeet - 30 - r * rowStep, scale: sc, halfWidth: halfWidth(o.kinds[i] === "adult" ? "adult" : (o.kinds[i] ?? "child")) * sc });
          i++;
        }
      });
    }
    // Задние ряды — первыми (под передними)
    return out.sort((x, y) => x.feet - y.feet);
  }
  return [];
}

const GAP = 26;

/** Полуширина фигуры в единицах рисовальщика (масштаб 1), с запасом на руки, хвост и платье. */
function halfWidth(kind: HeroKind | ExtraDrawKind): number {
  return { child: 72, teen: 74, adult: 82, pet: 150, toy: 70, custom: 90 }[kind];
}

/** Масштаб доп. героя относительно главного: пара — на равных, хозяева рядом с питомцем — чуть дальше. */
function extraScale(kind: ExtraDrawKind, heroKind: HeroKind, role: string): number {
  if (kind === "toy") return 0.55;
  if (kind === "custom") return 0.65;
  if (kind === "pet") return heroKind === "pet" ? 0.85 : 0.55;
  if (kind === "adult") {
    if (heroKind === "adult") return role === "partner" ? 1 : 0.95;
    if (heroKind === "pet") return 0.88;
    return heroKind === "teen" ? 0.95 : 0.9;
  }
  if (kind === "child") return heroKind === "child" ? 0.9 : 0.8;
  return heroKind === kind ? 0.95 : 0.85; // teen
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

/** Разбивка заголовка на 1–2 строки по словам (не длиннее max символов, если можно). */
function titleLines(t: string, max: number): string[] {
  if (t.length <= max) return [t];
  const words = t.split(/\s+/);
  let best = [t];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const w = Math.max(a.length, b.length);
    if (w < bestW) {
      bestW = w;
      best = [a, b];
    }
  }
  return best;
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
  const bgTheme = theme.scene ? theme.scene(ctx) : standardBackground(ctx);
  // Обработка фона стилем (пробные стили: размытый живописный фон, контур тушью, выбеленный…) — art/fx.ts
  // Новые фоны (PROP_BACKDROPS) обрабатывают фон вместе с реквизитом сцены — см. ниже; прочие — как раньше
  const propsInBg = !!style.backdrop && PROP_BACKDROPS.includes(style.backdrop);
  const bg = style.backdrop && !propsInBg ? fxBackdrop(style, bgTheme, W, H) : bgTheme;

  const heroKind = o.hero.kind ?? o.plot.heroKind;
  const left = idx % 2 === 1;
  const photo = o.crowdLayout === "photo" && !!o.crowd?.length;
  const hx = photo ? W / 2 : left ? W * 0.62 : W * 0.38;
  const heroScale = idx === 0 ? 1.5 : 1.25;
  const heroFeet = H * 0.6 + 190 * heroScale;
  // Доп. герои стоят рядом, не перекрывая героя: шаг = полуширина соседа + полуширина героя + зазор,
  // в сторону центра кадра. Если группа не влезает в кадр — сдвигаем её целиком (герой остаётся в группе).
  const dir = left ? -1 : 1;
  const heroHw = halfWidth(heroKind) * heroScale;
  let edge = heroHw;
  const placed = (o.extras ?? []).slice(0, 3).map((e, i) => {
    const kind = e.kind ?? extraDrawKind(e.role, heroKind);
    const scale = heroScale * extraScale(kind, heroKind, e.role);
    const hw = halfWidth(kind) * scale;
    const dx = edge + GAP + hw;
    edge = dx + hw;
    return { e, i, kind, scale, dx };
  });
  const lo = dir > 0 ? hx - heroHw : hx - edge;
  const hi = dir > 0 ? hx + edge : hx + heroHw;
  const shift = hi > W - 12 ? W - 12 - hi : lo < 12 ? 12 - lo : 0;
  const heroX = hx + shift;
  const extras = placed.map(({ e, i, kind, scale, dx }) => {
    // Люди рядом с питомцем стоят чуть дальше (выше по кадру) — питомец остаётся главным
    const feet = heroFeet - (heroKind === "pet" && kind !== "pet" ? 34 : 10);
    const drawKind = kind === "toy" || kind === "custom" ? heroKind : kind;
    return heroDrawer(kind)({ kind: drawKind, look: e.look, x: heroX + dir * dx, y: feet - 190 * scale, scale, style, index: idx + i + 1, flip: !left });
  });
  // Группа: рядами по сторонам, вне полосы героя и доп. героев
  const zoneLo = dir > 0 ? heroX - heroHw : heroX - edge;
  const zoneHi = dir > 0 ? heroX + edge : heroX + heroHw;
  const crowdList = (o.crowd ?? []).slice(0, CROWD_MAX + 3);
  const crowdKinds = crowdList.map((c) => c.kind ?? (heroKind === "teen" ? "teen" : "child"));
  const crowd = crowdLayout({ W, H, count: crowdList.length, kinds: crowdKinds, heroFeet, heroScale, zoneLo, zoneHi }).map((c) => {
    const k = crowdKinds[c.i];
    return heroDrawer(k)({ kind: k, look: crowdList[c.i].look, x: c.x, y: c.feet - 190 * c.scale, scale: c.scale, style, index: idx + c.i + 3, flip: c.x > heroX });
  });
  const hero = heroDrawer(heroKind)({ kind: heroKind, look: o.hero, x: heroX, y: H * 0.6, scale: heroScale, style, index: idx, flip: left && heroKind === "pet" });
  // Реквизит сцены — на свободной от героев стороне, за героями (у каждого разворота свой кадр)
  const props = sceneProps(o.scene, { W, H, zoneLo, zoneHi, feet: heroFeet, theme, ink: style.palette.ink, seed: idx });

  // Фильтр стиля — только на фигуры: на фоне он рвёт края кадра
  const fx = style.filter && ["wobble", "posterize", "soft", ...FIGURE_FILTERS].includes(style.filter) ? ` filter="url(#${style.filter})"` : "";
  const extraFx = Boolean(style.backdrop || style.overlays?.length || (style.filter && (FIGURE_FILTERS as readonly string[]).includes(style.filter)));
  const layers = style.overlays?.length ? fxLayers(style, { W, H, heroX, feet: heroFeet, scale: heroScale, index: idx }) : { behind: "", above: "" };
  if (o.layer === "mask") {
    const white = `<filter id="mask-white" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${white}${textureDefs(style)}${extraFx ? fxDefs(style, W, H) : ""}</defs><rect width="${W}" height="${H}" fill="#000"/><g filter="url(#mask-white)"><g${fx}>${crowd.join("")}${extras.join("")}${hero}</g></g></svg>`;
  }
  const figures = o.layer === "background" ? "" : `<g${fx}>${crowd.join("")}${extras.join("")}${hero}</g>`;
  const scenery = propsInBg ? fxBackdrop(style, `${bg}${props.sky}${props.behind}`, W, H) : `${bg}${props.sky}${props.behind}`;
  const art = `${scenery}${layers.behind}${figures}${layers.above}${textureOverlay(style, W, H)}`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${theme.sky[0]}"/><stop offset="1" stop-color="${theme.sky[1]}"/></linearGradient>${textureDefs(style)}${extraFx ? fxDefs(style, W, H) : ""}</defs>
  ${art}
</svg>`;
  svg = applyMood(svg, resolveMood(o.mood));

  let over = "";
  if (o.title && idx === 0) {
    // Длинное название — в две строки и мельче, чтобы не вылезало за край обложки
    const lines = titleLines(o.title, 26);
    const fs = Math.min(56, Math.floor((W * 0.92) / (Math.max(...lines.map((l) => l.length)) * 0.56)));
    const band = 40 + lines.length * fs * 1.2;
    over += `<rect x="0" y="0" width="${W}" height="${band}" fill="${style.palette.paper}" opacity=".85"/>`;
    lines.forEach((l, i) => {
      over += `<text x="${W / 2}" y="${Math.round(20 + fs * (1 + i * 1.2))}" text-anchor="middle" font-family="sans-serif" font-size="${fs}" font-weight="700" fill="${style.palette.ink}">${escapeXml(l)}</text>`;
    });
  }
  if (o.caption) over += `<text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#fff" opacity=".8">${escapeXml(o.caption)}</text>`;
  if (o.watermark) over += watermark(W, H);
  return over ? svg.replace(/<\/svg>\s*$/, `${over}</svg>`) : svg;
}

/** Обложка: квадрат 1024×1024, герой крупнее, необязательный заголовок. */
export function renderDemoCover(o: Omit<DemoRenderOpts, "spreadIndex">): string {
  return renderDemoSpread({ ...o, spreadIndex: 0, wide: o.wide ?? false });
}
