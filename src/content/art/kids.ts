// ВЛАДЕЛЕЦ: агент 3 (художник детских книг). Никто другой этот файл не меняет.
//
//  • KIDS_ART_STYLES — все стили с owner "kids" в ART_STYLE_OWNERS (src/content/types.ts):
//    watercolor-air, kind-classic, folk-lubok, ink-humor, cozy-detail (id не менять), naive-watercolor,
//    pen-ink-1920s. prompt/negative — EN для Qwen-Image-Edit: только техника (без имён художников, брендов,
//    франшиз) + сохранение лица ребёнка с фото и детские пропорции. demo — палитра, линия, фактура.
//  • KIDS_THEMES — демо-темы всех ключей с owner "kids" в DEMO_THEME_KEYS, у каждой свой фон (scene).
//    Фон подстраивается под стиль: акварельные стили «размывают» цвета к бумаге, графические — обводка
//    и штриховка тушью.
//  • drawChild — ребёнок 2–10 лет: возраст меняет пропорции, причёски (короткая, ёжик, кудри, длинные,
//    каре, хвост, косички, пучок), цвет волос, тон кожи, очки, веснушки, цвет одежды, платье/брюки по полу,
//    5 поз по номеру разворота.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, ArtStyleDemo, DemoHeroDrawer, DemoSceneCtx, DemoTheme } from "../types";
import { colorFrom, HAIR_COLORS, pick, SKIN_COLORS } from "./shared";

// ---------------------------------------------------------------------------
// Цвет
// ---------------------------------------------------------------------------

const HEX6 = /^#[0-9a-f]{6}$/i;

function rgb(c: string): [number, number, number] {
  const n = parseInt(HEX6.test(c) ? c.slice(1) : "888888", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Смешать два цвета #rrggbb: t = 0 → a, t = 1 → b. */
function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

// ---------------------------------------------------------------------------
// Стили картинок
// ---------------------------------------------------------------------------

/** Сохранение лица и детские пропорции — добавляется к каждому стилю. */
const KIDS_IDENTITY =
  "The child keeps the exact face from the reference photo: same face shape, eye shape and eye color, eyebrows, nose, mouth, ears, hairline, hairstyle, hair color and skin tone, instantly recognizable as the same child; only the drawing technique changes, never the identity. Child-appropriate proportions of a young child: slightly larger head, round soft cheeks, short limbs, small hands with five fingers, age-appropriate everyday clothes, natural friendly expression.";

const KIDS_NEGATIVE_BASE =
  "photo, photorealistic, 3d render, CGI, glossy plastic look, different person, altered facial features, aged-up face, adult proportions, adult body, makeup, distorted face, asymmetrical eyes, cross-eyed, changed hair color, changed skin tone, extra fingers, missing fingers, fused fingers, deformed hands, extra limbs, extra arms, text, letters, words, numbers, captions, speech bubbles, watermark, logo, signature, frame, border, multiple copies of the child, duplicate child, scary, horror, creepy, menacing shadows, monsters with teeth, blood, injury, weapons, violence, brand characters, cartoon mascots, franchise characters, superhero costumes, toy brand logos, sexualized, revealing clothing";

const neg = (extra: string) => `${KIDS_NEGATIVE_BASE}, ${extra}`;
const prompt = (technique: string) => `${technique} ${KIDS_IDENTITY}`;

export const KIDS_ART_STYLES: ArtStyle[] = [
  {
    id: "watercolor-air",
    title: "Воздушная акварель",
    description:
      "Тонкая, чуть дрожащая линия пером и прозрачные акварельные пятна: голубой, сливочно-жёлтый, нежно-зелёный. Много белой бумаги и воздуха — светлая, спокойная книжка.",
    audiences: ["CHILD", "PET"],
    prompt: prompt(
      "Delicate children's picture book illustration. Thin, slightly wobbly pen-and-ink outline, transparent layered watercolor washes with soft blooms and gentle bleeding edges, lots of untouched white paper around the figures, visible cold-press paper grain. Palette of pale sky blue, butter yellow, soft leaf green and a touch of peach. Simple naive shapes, airy uncluttered composition, quiet poetic light mood.",
    ),
    negative: neg("heavy saturated colors, thick outlines, dense dark background, digital gradients, airbrush"),
    demo: { palette: { paper: "#fbf8f1", ink: "#4a4a55", accents: ["#8fbfe0", "#f0d27a", "#a3cf98", "#f2ae9f"] }, line: "thin", texture: "paper", filter: "wobble" },
  },
  {
    id: "kind-classic",
    title: "Добрая классика",
    description:
      "Как в любимых книжках из детства: уверенный чёрный контур, мягкие плоские цвета, круглые добрые формы и выразительные лица.",
    audiences: ["CHILD", "ADULT"],
    prompt: prompt(
      "Classic mid-century children's book illustration. Confident clean black ink contour of even weight, flat soft colors with gentle simple shading, warm cream paper background with subtle offset-print texture. Round friendly forms, expressive kind faces, clear readable silhouettes, cheerful balanced composition with a calm storybook feel. Palette of tomato red, cornflower blue, sunflower yellow and grass green softened by cream.",
    ),
    negative: neg("sketchy messy lines, gritty texture, neon colors, harsh contrast, dramatic lighting"),
    demo: { palette: { paper: "#f6efe0", ink: "#222222", accents: ["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c"] }, line: "bold", texture: "paper" },
  },
  {
    id: "folk-lubok",
    title: "Народная сказка",
    description:
      "Праздничная гуашь в духе русской народной росписи: плоские декоративные формы, цветочные узоры, красный, охра, изумруд и кремовый.",
    audiences: ["CHILD", "ADULT"],
    prompt: prompt(
      "Russian folk naive painting for a children's book, matte opaque gouache. Bold flat decorative shapes outlined in black, ornamental flowers, berries, curling leaves and patterned details on clothes and background, stylized hills and trees, rhythmic symmetrical composition. Deep red, ochre gold, emerald green, black and warm cream palette, cheerful festive fairy-tale mood. The child's face is painted softly and carefully, keeping a natural recognizable likeness.",
    ),
    negative: neg("realistic perspective, soft gradients, pastel colors, photographic lighting, mask-like face, icon painting"),
    demo: { palette: { paper: "#f3e6c8", ink: "#1d1a17", accents: ["#b8352c", "#d9a441", "#1f7a5a", "#2c4f8a"] }, line: "bold", texture: "grain", filter: "posterize" },
  },
  {
    id: "ink-humor",
    title: "Весёлая графика",
    description:
      "Живая чёрная линия тушью, лёгкая штриховка и один яркий тёплый цвет на белом листе. Смешно, легко и очень по-детски.",
    audiences: ["CHILD", "TEEN", "ADULT", "PET"],
    prompt: prompt(
      "Lively black ink line drawing for a children's book. Expressive spontaneous gesture lines, light cross-hatching for shadows, mostly white background, a single warm accent color (tangerine orange) used in a few flat spots, gentle visual humor and playful body language. The face is drawn with careful realistic proportions so the child stays recognizable, while the body and scene stay loose and sketchy.",
    ),
    negative: neg("full color painting, many colors, gradients, heavy shading, dark background, caricature, exaggerated big nose"),
    demo: { palette: { paper: "#ffffff", ink: "#111111", accents: ["#ef6b3a"] }, line: "sketch", texture: "none" },
  },
  {
    id: "cozy-detail",
    title: "Уютные подробности",
    description:
      "Тушь и тёплая акварель, сцены полны мелочей: чашки, книжки, спрятанные мышки и жучки — каждую страницу хочется разглядывать.",
    audiences: ["CHILD"],
    prompt: prompt(
      "Richly detailed ink and watercolor children's book illustration. Careful fine linework, warm earthy palette of terracotta, olive green, honey ochre and plum, soft golden daylight. Cozy scene full of tiny objects to discover: books, cups, plants, lanterns and small hidden friendly creatures like mice, snails and beetles. The child stays the clear focal point with a calm readable background.",
    ),
    negative: neg("empty background, minimalism, flat vector art, neon colors, cold harsh light, cluttered face"),
    demo: { palette: { paper: "#f7efe2", ink: "#3d2d22", accents: ["#c46a3b", "#8a9a5b", "#d9b26f", "#7a5c8e"] }, line: "thin", texture: "paper" },
  },
  {
    id: "naive-watercolor",
    title: "Маленькая планета",
    description:
      "Наивная детская акварель: лёгкий неровный контур тонким пером, мягкие полупрозрачные заливки и много белого. Пастельные бледно-голубой, песочно-жёлтый и нежно-розовый, крошечная планета в звёздном небе — мечтательно, тихо и чуть грустно.",
    audiences: ["CHILD", "ADULT"],
    prompt: prompt(
      "Naive children's illustration in watercolor. Light uneven outline drawn with a thin dip pen, soft semi-transparent washes that do not fill the shapes completely, generous empty white space. Pastel palette of pale blue, sandy yellow and tender pink with tiny touches of muted red. Simple figures with childlike proportions, a tiny planet and small scattered stars in a quiet sky, minimal props, small figures in a big calm space. Dreamy, quiet, slightly wistful atmosphere, like a remembered fairy tale.",
    ),
    negative: neg("saturated bright colors, thick bold outlines, busy detailed background, glossy finish, digital gradients, dramatic action, crowded composition"),
    demo: { palette: { paper: "#fdfaf3", ink: "#6c7088", accents: ["#a9cbe6", "#ecd49a", "#f2c3cb", "#c7c1e4"] }, line: "thin", texture: "paper", filter: "soft" },
  },
  {
    id: "pen-ink-1920s",
    title: "Старый лес",
    description:
      "Тонкий рисунок пером и тушью с лёгкой штриховкой и прозрачной подкраской, как в книжках 1920-х: старый лес, поляна, мостик через ручей, мягкие плюшевые звери и добрый юмор.",
    audiences: ["CHILD", "ADULT", "PET"],
    prompt: prompt(
      "Vintage 1920s storybook illustration. Fine pen and black ink drawing with light hatching and cross-hatching, slightly sketchy searching line, delicate pale watercolor tint over the ink (muted sage green, dusty blue, ochre and faded rose), lots of air and unpainted cream paper. English countryside setting: an old forest with gnarled trees, a sunny clearing, a small wooden footbridge over a brook. Soft plush-like toy animals as companions, gentle good-natured humor, calm unhurried composition.",
    ),
    negative: neg("modern digital look, bright saturated colors, thick cartoon outlines, vector art, anime style, heavy black fills, glossy shading"),
    demo: { palette: { paper: "#f4ecd8", ink: "#2e2a26", accents: ["#9db08a", "#8fa9b8", "#d6b46a", "#c99a8c"] }, line: "sketch", texture: "grain", filter: "wobble" },
  },
];

// ---------------------------------------------------------------------------
// Фоны тем: инструменты
// ---------------------------------------------------------------------------

/** Насколько фон «размыт» к бумаге в каждом стиле (акварель светлее, лубок — чистые цвета). */
const WASH: Record<string, number> = {
  "watercolor-air": 0.32,
  "naive-watercolor": 0.42,
  "pen-ink-1920s": 0.36,
  "cozy-detail": 0.1,
  "kind-classic": 0.05,
  "folk-lubok": 0,
  "ink-humor": 0.45,
};

function styleIdOf(style: ArtStyleDemo) {
  return KIDS_ART_STYLES.find((s) => s.demo === style || (s.demo.palette.paper === style.palette.paper && s.demo.palette.ink === style.palette.ink))?.id;
}

interface Kit {
  W: number;
  H: number;
  /** Горизонт. */
  gy: number;
  r: () => number;
  /** Герой стоит справа (нечётные развороты) — крупные предметы фона ставим слева. */
  heroRight: boolean;
  wash: number;
  ink: string;
  /** Цвет темы с поправкой на стиль. */
  c: (col: string) => string;
  /** Обводка фона по стилю. */
  ol: (w?: number) => string;
  /** Заливка-фигура: цвет, обводка и штриховка (для эскизных стилей). */
  p: (d: string, fill: string, w?: number, extra?: string) => string;
  defs: string[];
}

function kit(ctx: DemoSceneCtx): Kit {
  const id = styleIdOf(ctx.style);
  const wash = id ? WASH[id] : 0.08;
  const { paper, ink } = ctx.style.palette;
  const line = ctx.style.line;
  const c = (col: string) => (wash ? mix(col, paper, wash) : col);
  const ol = (w = 2.5) =>
    line === "none"
      ? ""
      : ` stroke="${ink}" stroke-width="${f(line === "bold" ? w * 1.4 : w)}" stroke-opacity="${line === "bold" ? 0.85 : 0.55}" stroke-linejoin="round" stroke-linecap="round"${line === "sketch" ? ` stroke-dasharray="${f(w * 7)} ${f(w * 1.3)}"` : ""}`;
  const hatch = line === "sketch";
  const defs: string[] = [];
  if (hatch)
    defs.push(
      `<pattern id="ks-hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0V12" stroke="${ink}" stroke-width="1.3" opacity=".32"/></pattern>`,
    );
  const p = (d: string, fill: string, w = 2.5, extra = "") =>
    `<path d="${d}" fill="${fill}"${ol(w)}${extra}/>` + (hatch && w >= 2 ? `<path d="${d}" fill="url(#ks-hatch)"/>` : "");
  return { W: ctx.W, H: ctx.H, gy: ctx.H * 0.7, r: ctx.rnd, heroRight: ctx.index % 2 === 1, wash, ink, c, ol, p, defs };
}

/** Небо-градиент темы (с поправкой на стиль). */
function sky(k: Kit, t: DemoTheme, extraStops = "") {
  k.defs.push(
    `<linearGradient id="ks-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.c(t.sky[0])}"/>${extraStops}<stop offset="1" stop-color="${k.c(t.sky[1])}"/></linearGradient>`,
  );
  return `<rect width="${k.W}" height="${k.H}" fill="url(#ks-sky)"/>`;
}

/** Финал фона: defs и (для акварельных стилей) белые поля бумаги по краям. */
function finish(k: Kit, body: string) {
  let vig = "";
  if (k.wash >= 0.3) {
    k.defs.push(
      `<radialGradient id="ks-vig" cx=".5" cy=".55" r=".75"><stop offset=".62" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#fffdf8" stop-opacity=".85"/></radialGradient>`,
    );
    vig = `<rect width="${k.W}" height="${k.H}" fill="url(#ks-vig)"/>`;
  }
  return `<defs>${k.defs.join("")}</defs>${body}${vig}`;
}

/** Волнистая земля от y0 до низа кадра. */
function groundPath(k: Kit, y0: number, amp: number, phase = 0) {
  const { W, H } = k;
  return `M0 ${f(y0 + amp * Math.sin(phase))} C${f(W * 0.2)} ${f(y0 - amp)} ${f(W * 0.35)} ${f(y0 + amp)} ${f(W * 0.55)} ${f(y0 + amp * 0.2)} S${f(W * 0.85)} ${f(y0 - amp * 0.8)} ${W} ${f(y0 + amp * 0.3)} V${H} H0Z`;
}

const star = (x: number, y: number, s: number, fill: string) =>
  `<path d="M${f(x)} ${f(y - s)}L${f(x + s * 0.3)} ${f(y - s * 0.3)} ${f(x + s)} ${f(y)} ${f(x + s * 0.3)} ${f(y + s * 0.3)} ${f(x)} ${f(y + s)} ${f(x - s * 0.3)} ${f(y + s * 0.3)} ${f(x - s)} ${f(y)} ${f(x - s * 0.3)} ${f(y - s * 0.3)}Z" fill="${fill}"/>`;

function stars(k: Kit, n: number, maxY: number, fill = "#fff6d5") {
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = k.r() * k.W;
    const y = k.r() * maxY;
    out += i % 4 === 0 ? star(x, y, 5 + k.r() * 7, fill) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + k.r() * 2.2)}" fill="${fill}" opacity="${f(0.5 + k.r() * 0.5)}"/>`;
  }
  return out;
}

function cloud(k: Kit, x: number, y: number, s: number, fill: string, op = 0.9) {
  const d = `M${f(x - 80 * s)} ${f(y)} a${f(34 * s)} ${f(30 * s)} 0 0 1 ${f(40 * s)} ${f(-34 * s)} a${f(44 * s)} ${f(42 * s)} 0 0 1 ${f(78 * s)} ${f(-10 * s)} a${f(36 * s)} ${f(32 * s)} 0 0 1 ${f(48 * s)} ${f(44 * s)}Z`;
  return `<path d="${d}" fill="${fill}" opacity="${op}"${k.ol(1.6)}/>`;
}

function crescent(x: number, y: number, R: number, fill: string, glow: string) {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 2.2)}" fill="${glow}" opacity=".12"/><path d="M${f(x)} ${f(y - R)} a${f(R)} ${f(R)} 0 1 0 ${f(R * 0.9)} ${f(R * 1.55)} a${f(R * 0.82)} ${f(R * 0.82)} 0 1 1 ${f(-R * 0.9)} ${f(-R * 1.55)}Z" fill="${fill}"/>`;
}

function fir(k: Kit, x: number, base: number, h: number, green: string, snow: boolean, bauble?: string) {
  let out = `<rect x="${f(x - h * 0.04)}" y="${f(base - h * 0.12)}" width="${f(h * 0.08)}" height="${f(h * 0.12)}" fill="${k.c("#5a3b28")}"/>`;
  for (let i = 0; i < 3; i++) {
    const top = base - h + i * h * 0.26;
    const bot = top + h * 0.42;
    const ww = h * (0.18 + i * 0.1);
    out += k.p(`M${f(x)} ${f(top)} L${f(x + ww)} ${f(bot)} Q${f(x)} ${f(bot + h * 0.04)} ${f(x - ww)} ${f(bot)}Z`, green, 2);
    if (snow) out += `<path d="M${f(x)} ${f(top)} L${f(x + ww * 0.45)} ${f(top + (bot - top) * 0.45)} Q${f(x + ww * 0.15)} ${f(top + (bot - top) * 0.36)} ${f(x)} ${f(top + (bot - top) * 0.5)} Q${f(x - ww * 0.15)} ${f(top + (bot - top) * 0.36)} ${f(x - ww * 0.45)} ${f(top + (bot - top) * 0.45)}Z" fill="#fbfdff"/>`;
    if (bauble) out += `<circle cx="${f(x + ww * 0.5)}" cy="${f(bot - 6)}" r="${f(h * 0.03)}" fill="${bauble}"/><circle cx="${f(x - ww * 0.35)}" cy="${f(bot - 10)}" r="${f(h * 0.025)}" fill="#f2c443"/>`;
  }
  return out;
}

function roundTree(k: Kit, x: number, base: number, h: number, crown: string, trunk: string) {
  const R = h * 0.32;
  return (
    k.p(`M${f(x - h * 0.05)} ${f(base)} L${f(x - h * 0.035)} ${f(base - h * 0.55)} L${f(x + h * 0.035)} ${f(base - h * 0.55)} L${f(x + h * 0.05)} ${f(base)}Z`, trunk, 2) +
    k.p(
      `M${f(x - R)} ${f(base - h * 0.62)} a${f(R * 0.7)} ${f(R * 0.7)} 0 0 1 ${f(R * 0.3)} ${f(-R * 0.9)} a${f(R * 0.8)} ${f(R * 0.8)} 0 0 1 ${f(R * 1.3)} ${f(-R * 0.1)} a${f(R * 0.7)} ${f(R * 0.7)} 0 0 1 ${f(R * 0.4)} ${f(R * 1.1)} a${f(R * 0.75)} ${f(R * 0.6)} 0 0 1 ${f(-R * 2)} ${f(-R * 0.1)}Z`,
      crown,
      2.5,
    )
  );
}

function flower(x: number, y: number, s: number, petal: string, stem: string) {
  let out = `<path d="M${f(x)} ${f(y)} q${f(-3 * s)} ${f(14 * s)} 0 ${f(28 * s)}" stroke="${stem}" stroke-width="${f(2.2 * s)}" fill="none"/>`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    out += `<circle cx="${f(x + Math.cos(a) * 5 * s)}" cy="${f(y + Math.sin(a) * 5 * s)}" r="${f(4.2 * s)}" fill="${petal}"/>`;
  }
  return out + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3 * s)}" fill="#f6d55c"/>`;
}

function house(k: Kit, x: number, base: number, s: number, wall: string, roof: string, light: string) {
  return (
    k.p(`M${f(x - 40 * s)} ${f(base)} V${f(base - 50 * s)} H${f(x + 40 * s)} V${f(base)}Z`, wall, 2) +
    k.p(`M${f(x - 50 * s)} ${f(base - 48 * s)} L${f(x)} ${f(base - 90 * s)} L${f(x + 50 * s)} ${f(base - 48 * s)}Z`, roof, 2) +
    `<rect x="${f(x - 12 * s)}" y="${f(base - 38 * s)}" width="${f(24 * s)}" height="${f(20 * s)}" fill="${light}"/><path d="M${f(x)} ${f(base - 38 * s)}v${f(20 * s)}M${f(x - 12 * s)} ${f(base - 28 * s)}h${f(24 * s)}" stroke="${k.c("#5a3b28")}" stroke-width="${f(2 * s)}"/>`
  );
}

// ---------------------------------------------------------------------------
// Сцены тем
// ---------------------------------------------------------------------------

function winterScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  s += stars(k, 40, H * 0.4);
  s += crescent(k.heroRight ? W * 0.16 : W * 0.84, H * 0.15, 46, k.c("#f8eebf"), "#f8eebf");
  s += k.p(groundPath(k, H * 0.6, 22, 1), k.c("#c9dbe8"), 2);
  for (const [fx, sc] of [[0.3, 0.55], [0.47, 0.45], [0.7, 0.5]] as const) s += fir(k, W * fx, H * 0.63, 170 * sc, k.c("#2f5d55"), true);
  s += house(k, k.heroRight ? W * 0.12 : W * 0.88, H * 0.64, 1.1, k.c("#a8573f"), k.c("#eef4f7"), k.c("#ffd66b"));
  s += k.p(groundPath(k, gy, 18), k.c(t.ground), 2.5);
  s += `<g fill="${k.c("#d3e3ee")}">${[0.2, 0.55, 0.85].map((x) => `<ellipse cx="${f(W * x)}" cy="${f(H * 0.9)}" rx="${f(W * 0.12)}" ry="14"/>`).join("")}</g>`;
  s += fir(k, W * 0.04, H * 0.86, 330, k.c("#1f4d3f"), true, k.c(t.accent));
  s += fir(k, W * 0.96, H * 0.88, 380, k.c("#1f4d3f"), true, k.c(t.accent));
  for (let i = 0; i < 70; i++) s += `<circle cx="${f(k.r() * W)}" cy="${f(k.r() * H * 0.95)}" r="${f(2.5 + k.r() * 5)}" fill="#ffffff" opacity="${f(0.55 + k.r() * 0.4)}"/>`;
  return finish(k, s);
}

function kingdomScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  s += `<circle cx="${f(k.heroRight ? W * 0.12 : W * 0.88)}" cy="${f(H * 0.17)}" r="58" fill="${k.c("#fff1b8")}"/>`;
  s += cloud(k, W * 0.3, H * 0.2, 0.9, k.c("#ffffff")) + cloud(k, W * 0.66, H * 0.13, 0.7, k.c("#ffffff"));
  s += k.p(groundPath(k, H * 0.6, 26, 2), k.c("#8fbf7a"), 2);
  // замок
  const cx = k.heroRight ? W * 0.27 : W * 0.73;
  const base = H * 0.62;
  const wall = k.c("#efe2c6");
  const roof = k.c(t.accent);
  s += k.p(`M${f(cx - 120)} ${f(base)} V${f(base - 130)} H${f(cx + 120)} V${f(base)}Z`, wall, 2.5);
  let cren = "";
  for (let i = 0; i < 6; i++) cren += `<rect x="${f(cx - 120 + i * 44)}" y="${f(base - 146)}" width="26" height="18" fill="${wall}"${k.ol(1.6)}/>`;
  s += cren;
  for (const [dx, th, tw] of [[-135, 230, 52], [135, 230, 52], [0, 290, 64]] as const) {
    const x = cx + dx;
    s += k.p(`M${f(x - tw / 2)} ${f(base)} V${f(base - th)} H${f(x + tw / 2)} V${f(base)}Z`, wall, 2.5);
    s += k.p(`M${f(x - tw / 2 - 10)} ${f(base - th)} L${f(x)} ${f(base - th - tw * 1.4)} L${f(x + tw / 2 + 10)} ${f(base - th)}Z`, roof, 2.5);
    s += `<path d="M${f(x)} ${f(base - th - tw * 1.4)} v-40" stroke="${k.c("#5a3b28")}" stroke-width="3"/><path d="M${f(x)} ${f(base - th - tw * 1.4 - 40)} l34 10 -34 10z" fill="${k.c("#f2c443")}"/>`;
    s += `<path d="M${f(x - 8)} ${f(base - th + 40)} a8 8 0 0 1 16 0 v22 h-16z" fill="${k.c("#5b4a7a")}"/>`;
  }
  s += `<path d="M${f(cx - 26)} ${f(base)} v-52 a26 26 0 0 1 52 0 v52z" fill="${k.c("#7a4a2a")}"${k.ol(2)}/>`;
  // земля, дорога, гирлянда
  s += k.p(groundPath(k, gy, 16), k.c(t.ground), 2.5);
  s += `<path d="M${f(cx - 26)} ${f(base + 2)} Q${f(cx - 60)} ${f(H * 0.8)} ${f(W * 0.5 - 140)} ${H} H${f(W * 0.5 + 140)} Q${f(cx + 40)} ${f(H * 0.8)} ${f(cx + 26)} ${f(base + 2)}Z" fill="${k.c("#e8cf9a")}" opacity=".9"/>`;
  const flagCols = [t.accent, "#f2c443", "#3e9ea8", "#e9775b"].map(k.c);
  let bunting = `<path d="M0 30 Q${f(W / 2)} 150 ${W} 30" stroke="${k.c("#5a3b28")}" stroke-width="3" fill="none"/>`;
  const n = Math.round(W / 70);
  for (let i = 1; i < n; i++) {
    const tt = i / n;
    const x = tt * W;
    const y = (1 - tt) * (1 - tt) * 30 + 2 * (1 - tt) * tt * 150 + tt * tt * 30;
    bunting += `<path d="M${f(x - 18)} ${f(y)} L${f(x + 18)} ${f(y)} L${f(x)} ${f(y + 40)}Z" fill="${pick(flagCols, i)}"${k.ol(1.4)}/>`;
  }
  s += bunting;
  for (let i = 0; i < 18; i++) s += flower(k.r() * W, H * 0.78 + k.r() * H * 0.2, 0.9, pick(flagCols, i), k.c("#3f7a45"));
  return finish(k, s);
}

function dragonScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  s += stars(k, 70, H * 0.55);
  const mx = k.heroRight ? W * 0.2 : W * 0.8;
  s += `<circle cx="${f(mx)}" cy="${f(H * 0.2)}" r="170" fill="#f8eebf" opacity=".1"/><circle cx="${f(mx)}" cy="${f(H * 0.2)}" r="72" fill="${k.c("#f8eebf")}"/>`;
  // маленький дракончик на фоне луны
  s += `<g transform="translate(${f(mx - 40)} ${f(H * 0.2 + 6)}) scale(.9)" fill="${k.c("#1d2a55")}"><path d="M-40 0 Q-10 -18 20 -6 Q40 -4 52 -16 L58 -10 Q48 2 26 6 Q-6 14 -40 0Z"/><path d="M-6 -6 L4 -44 L22 -20 Z"/><path d="M-40 0 L-62 8 L-46 -4Z"/></g>`;
  s += k.p(groundPath(k, H * 0.6, 20, 1), k.c("#22553f"), 2);
  // фонарики на верёвке
  s += `<path d="M0 60 Q${f(W * 0.5)} 190 ${W} 60" stroke="${k.c("#7a6a4a")}" stroke-width="2.5" fill="none"/>`;
  const n = Math.max(4, Math.round(W / 220));
  for (let i = 1; i < n; i++) {
    const tt = i / n;
    const x = tt * W;
    const y = (1 - tt) * (1 - tt) * 60 + 2 * (1 - tt) * tt * 190 + tt * tt * 60;
    s += `<circle cx="${f(x)}" cy="${f(y + 26)}" r="38" fill="#ffd66b" opacity=".18"/><rect x="${f(x - 14)}" y="${f(y + 8)}" width="28" height="36" rx="12" fill="${k.c(i % 2 ? "#ffcf5a" : "#ff9f6b")}"${k.ol(1.5)}/>`;
  }
  s += k.p(groundPath(k, gy, 14), k.c(t.ground), 2.5);
  // кусты и деревья по краям
  for (const x of [0.02, 0.98]) s += roundTree(k, W * x, H * 0.95, 520, k.c("#1b3d33"), k.c("#3a2a22"));
  for (const x of [0.16, 0.85, 0.5]) s += k.p(`M${f(W * x - 90)} ${f(H * 0.76)} a50 46 0 0 1 60 -50 a54 50 0 0 1 80 4 a44 40 0 0 1 40 46Z`, k.c("#2b6650"), 2);
  // светлячки
  k.defs.push(`<radialGradient id="ks-fly"><stop offset="0" stop-color="${k.c(t.accent)}" stop-opacity="1"/><stop offset="1" stop-color="${k.c(t.accent)}" stop-opacity="0"/></radialGradient>`);
  for (let i = 0; i < 26; i++) s += `<circle cx="${f(k.r() * W)}" cy="${f(H * 0.35 + k.r() * H * 0.5)}" r="${f(10 + k.r() * 10)}" fill="url(#ks-fly)"/>`;
  for (let i = 0; i < 12; i++) s += flower(k.r() * W, H * 0.8 + k.r() * H * 0.16, 0.8, k.c(i % 2 ? "#9ad7ff" : "#f6b8e0"), k.c("#3d7a5a"));
  return finish(k, s);
}

function oceanScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  // лучи света
  for (let i = 0; i < 6; i++) {
    const x = W * (0.1 + i * 0.17);
    s += `<path d="M${f(x)} 0 L${f(x + 90)} 0 L${f(x + 260)} ${f(H * 0.75)} L${f(x + 120)} ${f(H * 0.75)}Z" fill="#ffffff" opacity=".07"/>`;
  }
  // дальние скалы
  s += k.p(`M0 ${f(H * 0.66)} Q${f(W * 0.1)} ${f(H * 0.5)} ${f(W * 0.22)} ${f(H * 0.6)} Q${f(W * 0.35)} ${f(H * 0.55)} ${f(W * 0.45)} ${f(H * 0.66)} L${f(W * 0.6)} ${f(H * 0.64)} Q${f(W * 0.8)} ${f(H * 0.48)} ${W} ${f(H * 0.62)} V${H} H0Z`, k.c("#2a7f8f"), 2);
  // рыбки
  const fishCols = [t.accent, "#ff8a65", "#f6f1e9", "#8fd3c7"].map(k.c);
  for (let i = 0; i < 9; i++) {
    const x = k.r() * W;
    const y = H * 0.12 + k.r() * H * 0.42;
    const sc = 0.6 + k.r() * 0.7;
    const dir = k.r() > 0.5 ? 1 : -1;
    s += `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sc * dir)} ${f(sc)})"><path d="M-30 0 Q0 -22 30 0 Q0 22 -30 0Z M-28 0 L-50 -16 L-46 0 L-50 16Z" fill="${pick(fishCols, i)}"${k.ol(1.6)}/><circle cx="16" cy="-4" r="3.5" fill="#1d2a33"/></g>`;
  }
  s += k.p(groundPath(k, gy, 16), k.c(t.ground), 2.5);
  // водоросли
  for (let i = 0; i < 9; i++) {
    const x = pick([0.02, 0.06, 0.1, 0.9, 0.94, 0.98, 0.3, 0.55, 0.75], i) * W;
    const hh = 160 + k.r() * 220;
    const b = H * 0.78 + k.r() * H * 0.15;
    s += `<path d="M${f(x)} ${f(b)} q-30 ${f(-hh * 0.25)} 0 ${f(-hh * 0.5)} t0 ${f(-hh * 0.5)}" stroke="${k.c(i % 2 ? "#3f9a6a" : "#2e7d5b")}" stroke-width="${f(12 + k.r() * 8)}" fill="none" stroke-linecap="round"/>`;
  }
  // кораллы
  const coral = (x: number, b: number, sc: number, col: string) =>
    `<g transform="translate(${f(x)} ${f(b)}) scale(${f(sc)})" stroke="${col}" stroke-width="16" stroke-linecap="round" fill="none"><path d="M0 0 V-90 M0 -40 Q-40 -50 -44 -100 M0 -60 Q36 -70 40 -120 M-44 -100 L-60 -126 M40 -120 L56 -140"/></g>`;
  s += coral(k.heroRight ? W * 0.14 : W * 0.86, H * 0.86, 1.3, k.c("#f07f7f"));
  s += coral(k.heroRight ? W * 0.22 : W * 0.78, H * 0.92, 0.9, k.c(t.accent));
  // ракушки и звёзды на песке
  for (let i = 0; i < 6; i++) {
    const x = k.r() * W;
    const y = H * 0.82 + k.r() * H * 0.14;
    s += i % 2 ? star(x, y, 16, k.c("#f28b6b")) : `<path d="M${f(x - 14)} ${f(y)} a14 14 0 0 1 28 0Z" fill="${k.c("#f7e1c4")}"${k.ol(1.4)}/>`;
  }
  for (let i = 0; i < 40; i++) s += `<circle cx="${f(k.r() * W)}" cy="${f(k.r() * H * 0.8)}" r="${f(4 + k.r() * 12)}" fill="#ffffff" fill-opacity=".08" stroke="#dff7fb" stroke-width="2" opacity=".75"/>`;
  return finish(k, s);
}

function sleepScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  s += stars(k, 50, H * 0.55, k.c("#fff6d5"));
  s += crescent(k.heroRight ? W * 0.18 : W * 0.82, H * 0.22, 80, k.c("#f8eebf"), "#f8eebf");
  // звёзды на ниточках
  for (let i = 0; i < Math.round(W / 260); i++) {
    const x = W * 0.07 + i * 260 + k.r() * 60;
    const l = 70 + k.r() * 140;
    s += `<path d="M${f(x)} 0 V${f(l)}" stroke="${k.c("#d8cfa8")}" stroke-width="1.6" opacity=".7"/>${star(x, l + 14, 16, k.c(t.accent))}`;
  }
  s += cloud(k, W * 0.35, H * 0.4, 1.1, k.c("#8a80c0"), 0.7) + cloud(k, W * 0.72, H * 0.33, 0.8, k.c("#8a80c0"), 0.6);
  s += k.p(groundPath(k, H * 0.62, 30, 2), k.c("#3d3870"), 2);
  for (const [x, sc] of [[0.12, 0.8], [0.25, 0.65], [0.78, 0.7], [0.9, 0.85]] as const)
    s += house(k, W * x, H * 0.64 + sc * 10, sc, k.c("#5b5394"), k.c("#2e2a5a"), k.c("#ffd66b"));
  s += k.p(groundPath(k, gy, 18), k.c(t.ground), 2.5);
  // подушки-облачка на переднем плане
  s += cloud(k, W * 0.08, H * 0.98, 1.6, k.c("#6e64a8"), 0.85) + cloud(k, W * 0.98, H * 1.0, 1.8, k.c("#6e64a8"), 0.85);
  return finish(k, s);
}

function forestScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  // солнечные лучи сквозь листву
  for (let i = 0; i < 5; i++) {
    const x = W * (0.15 + i * 0.18);
    s += `<path d="M${f(x)} 0 L${f(x + 60)} 0 L${f(x + 220)} ${f(H * 0.8)} L${f(x + 120)} ${f(H * 0.8)}Z" fill="#fffbe0" opacity=".18"/>`;
  }
  // дальний лес
  for (let i = 0; i < Math.round(W / 120); i++) s += roundTree(k, i * 120 + k.r() * 50, H * 0.64, 260 + k.r() * 90, k.c(i % 2 ? "#9cc489" : "#88b77a"), k.c("#8a6a50"));
  s += k.p(groundPath(k, gy, 14), k.c(t.ground), 2.5);
  // тропинка
  s += `<path d="M${f(W * 0.46)} ${f(gy + 4)} C${f(W * 0.38)} ${f(H * 0.8)} ${f(W * 0.62)} ${f(H * 0.86)} ${f(W * 0.42)} ${H} H${f(W * 0.66)} C${f(W * 0.78)} ${f(H * 0.86)} ${f(W * 0.5)} ${f(H * 0.8)} ${f(W * 0.52)} ${f(gy + 4)}Z" fill="${k.c("#e6d3a3")}"${k.ol(1.6)}/>`;
  // крупные стволы по краям
  for (const [x, w] of [[0.03, 70], [0.12, 46], [0.9, 52], [0.985, 80]] as const)
    s += k.p(`M${f(W * x - w / 2)} ${H} L${f(W * x - w * 0.4)} 0 H${f(W * x + w * 0.4)} L${f(W * x + w / 2)} ${H}Z`, k.c("#7a5236"), 2.5);
  s += k.p(`M0 0 H${W} V${f(H * 0.08)} Q${f(W * 0.85)} ${f(H * 0.2)} ${f(W * 0.7)} ${f(H * 0.1)} Q${f(W * 0.5)} ${f(H * 0.2)} ${f(W * 0.3)} ${f(H * 0.09)} Q${f(W * 0.12)} ${f(H * 0.22)} 0 ${f(H * 0.1)}Z`, k.c("#4f8d4f"), 2.5);
  // грибы и папоротники
  const mush = (x: number, y: number, sc: number) =>
    `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sc)})"><path d="M-8 0 V-26 H8 V0Z" fill="${k.c("#f4ead6")}"${k.ol(1.4)}/><path d="M-26 -24 Q0 -60 26 -24Z" fill="${k.c(t.accent)}"${k.ol(1.6)}/><circle cx="-9" cy="-34" r="4" fill="#fff"/><circle cx="8" cy="-38" r="3" fill="#fff"/></g>`;
  for (let i = 0; i < 6; i++) s += mush(k.r() * W, H * 0.8 + k.r() * H * 0.16, 0.8 + k.r() * 0.6);
  for (let i = 0; i < 8; i++) {
    const x = pick([0.06, 0.18, 0.28, 0.72, 0.82, 0.95], i) * W;
    const y = H * 0.9 + k.r() * H * 0.08;
    s += `<path d="M${f(x)} ${f(y)} q-30 -50 -70 -60 M${f(x)} ${f(y)} q10 -60 -10 -100 M${f(x)} ${f(y)} q40 -40 70 -50" stroke="${k.c("#3f7a45")}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < 16; i++) {
    const x = k.r() * W;
    const y = k.r() * H * 0.7;
    s += `<path d="M${f(x)} ${f(y)}q10 -9 20 0q-10 9 -20 0z" fill="${k.c(i % 2 ? "#e9a23b" : "#9cc04f")}" transform="rotate(${Math.round(k.r() * 360)} ${f(x)} ${f(y)})"/>`;
  }
  return finish(k, s);
}

function spaceScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  s += stars(k, 110, H * 0.75);
  const px = k.heroRight ? W * 0.18 : W * 0.8;
  s += `<ellipse cx="${f(px)}" cy="${f(H * 0.24)}" rx="150" ry="34" fill="none" stroke="${k.c("#f6d38a")}" stroke-width="12" transform="rotate(-14 ${f(px)} ${f(H * 0.24)})"/>`;
  s += `<circle cx="${f(px)}" cy="${f(H * 0.24)}" r="80" fill="${k.c(t.accent)}"${k.ol(2.5)}/><path d="M${f(px - 76)} ${f(H * 0.24 - 10)} Q${f(px)} ${f(H * 0.24 + 14)} ${f(px + 78)} ${f(H * 0.24 - 4)}" stroke="${k.c("#e0742a")}" stroke-width="10" fill="none"/>`;
  s += `<path d="M${f(px - 150)} ${f(H * 0.24 + 4)} A150 34 0 0 0 ${f(px + 150)} ${f(H * 0.24 - 4)}" fill="none" stroke="${k.c("#f6d38a")}" stroke-width="12" transform="rotate(-14 ${f(px)} ${f(H * 0.24)})"/>`;
  s += `<circle cx="${f(W * 0.45)}" cy="${f(H * 0.12)}" r="34" fill="${k.c("#7ec8e3")}"${k.ol(2)}/><circle cx="${f(W * 0.45 - 10)}" cy="${f(H * 0.12 - 8)}" r="9" fill="${k.c("#5aa9c8")}"/>`;
  s += `<path d="M${f(W * 0.62)} ${f(H * 0.08)} l-180 60" stroke="#ffffff" stroke-width="5" opacity=".5" stroke-linecap="round"/><circle cx="${f(W * 0.62)}" cy="${f(H * 0.08)}" r="9" fill="#fff8d9"/>`;
  // ракета
  const rx = k.heroRight ? W * 0.36 : W * 0.6;
  const ry = H * 0.4;
  s += `<g transform="translate(${f(rx)} ${f(ry)}) rotate(28)"><path d="M0 -70 Q26 -40 22 30 H-22 Q-26 -40 0 -70Z" fill="${k.c("#f2efe9")}"${k.ol(2.2)}/><circle cx="0" cy="-18" r="11" fill="${k.c("#7ec8e3")}"${k.ol(2)}/><path d="M-22 6 L-40 40 L-20 30Z M22 6 L40 40 L20 30Z" fill="${k.c("#e4572e")}"${k.ol(2)}/><path d="M-12 32 Q0 80 12 32Z" fill="${k.c("#ffcf5a")}"/></g>`;
  // лунная поверхность
  s += k.p(groundPath(k, gy, 20), k.c(t.ground), 2.5);
  for (let i = 0; i < 9; i++) {
    const x = k.r() * W;
    const y = H * 0.76 + k.r() * H * 0.2;
    const rr = 20 + k.r() * 40;
    s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rr)}" ry="${f(rr * 0.32)}" fill="${k.c("#8f87b8")}"${k.ol(1.4)}/>`;
  }
  return finish(k, s);
}

function schoolScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  // обои в полоску
  for (let x = 30; x < W; x += 80) s += `<rect x="${x}" y="0" width="26" height="${f(gy)}" fill="#ffffff" opacity=".18"/>`;
  // доска с рисунками мелом (без букв)
  const bx = k.heroRight ? W * 0.08 : W * 0.5;
  const bw = Math.min(W * 0.42, 820);
  const by = H * 0.12;
  const bh = H * 0.36;
  s += `<rect x="${f(bx - 16)}" y="${f(by - 16)}" width="${f(bw + 32)}" height="${f(bh + 32)}" rx="8" fill="${k.c("#a8744a")}"${k.ol(2.5)}/><rect x="${f(bx)}" y="${f(by)}" width="${f(bw)}" height="${f(bh)}" fill="${k.c("#2f5d50")}"/>`;
  const ch = `stroke="#f4f1e6" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"`;
  s += `<circle cx="${f(bx + bw * 0.15)}" cy="${f(by + bh * 0.3)}" r="28" ${ch}/>`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s += `<path d="M${f(bx + bw * 0.15 + Math.cos(a) * 40)} ${f(by + bh * 0.3 + Math.sin(a) * 40)} l${f(Math.cos(a) * 16)} ${f(Math.sin(a) * 16)}" ${ch}/>`;
  }
  s += `<path d="M${f(bx + bw * 0.4)} ${f(by + bh * 0.8)} v-70 l60 -50 60 50 v70z M${f(bx + bw * 0.4 + 46)} ${f(by + bh * 0.8)} v-34 h28 v34" ${ch}/>`;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) s += `<circle cx="${f(bx + bw * 0.7 + i * 26)}" cy="${f(by + bh * 0.25 + row * 50)}" r="9" fill="${pick(["#f6b8a8", "#f6e7a8", "#a8e0f6"], row)}" opacity=".85"/>`;
  s += `<path d="M${f(bx + bw * 0.68)} ${f(by + bh * 0.25)} h150 M${f(bx + bw * 0.68)} ${f(by + bh * 0.25 + 50)} h150 M${f(bx + bw * 0.68)} ${f(by + bh * 0.25 + 100)} h150" ${ch.replace('stroke-width="4"', 'stroke-width="2"')}/>`;
  // окно
  const wx = k.heroRight ? W * 0.82 : W * 0.06;
  s += `<rect x="${f(wx)}" y="${f(H * 0.12)}" width="${f(Math.min(W * 0.14, 240))}" height="${f(H * 0.36)}" fill="${k.c("#bfe3f2")}"${k.ol(2.5)}/>`;
  s += `<circle cx="${f(wx + 60)}" cy="${f(H * 0.22)}" r="26" fill="${k.c("#ffe08a")}"/><path d="M${f(wx)} ${f(H * 0.3)} h${f(Math.min(W * 0.14, 240))} M${f(wx + Math.min(W * 0.07, 120))} ${f(H * 0.12)} v${f(H * 0.36)}" stroke="${k.c("#ffffff")}" stroke-width="10"/>`;
  s += `<rect x="${f(wx - 14)}" y="${f(H * 0.48)}" width="${f(Math.min(W * 0.14, 240) + 28)}" height="14" fill="${k.c("#a8744a")}"${k.ol(1.6)}/>`;
  s += `<path d="M${f(wx + 30)} ${f(H * 0.48)} q-10 -40 10 -60 q20 20 6 60z M${f(wx + 40)} ${f(H * 0.48)} q20 -30 40 -30" fill="${k.c("#5cb85c")}" stroke="${k.c("#3f7a45")}" stroke-width="3"/><rect x="${f(wx + 22)}" y="${f(H * 0.46)}" width="30" height="22" fill="${k.c("#e9775b")}"/>`;
  // часы
  const cxk = k.heroRight ? W * 0.68 : W * 0.32;
  s += `<circle cx="${f(cxk)}" cy="${f(H * 0.14)}" r="44" fill="#fffdf6"${k.ol(3)}/><path d="M${f(cxk)} ${f(H * 0.14)} v-28 M${f(cxk)} ${f(H * 0.14)} h20" stroke="${k.ink}" stroke-width="5" stroke-linecap="round"/>`;
  // пол
  s += `<rect x="0" y="${f(gy)}" width="${W}" height="${f(H - gy)}" fill="${k.c(t.ground)}"/><rect x="0" y="${f(gy - 18)}" width="${W}" height="20" fill="${k.c("#8a5a3a")}"${k.ol(1.6)}/>`;
  for (let y = gy + 40; y < H; y += 56) s += `<path d="M0 ${f(y)} H${W}" stroke="${k.c("#a8744a")}" stroke-width="2.5"/>`;
  // стопка книг, глобус, колокольчик
  const sx = k.heroRight ? W * 0.12 : W * 0.86;
  const bookCols = ["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c", t.accent].map(k.c);
  for (let i = 0; i < 5; i++) s += `<rect x="${f(sx - 70 + (i % 2) * 10)}" y="${f(H * 0.92 - i * 26)}" width="140" height="24" rx="4" fill="${bookCols[i]}"${k.ol(1.6)}/>`;
  s += `<circle cx="${f(sx)}" cy="${f(H * 0.92 - 5 * 26 - 40)}" r="40" fill="${k.c("#7ec8e3")}"${k.ol(2)}/><path d="M${f(sx - 20)} ${f(H * 0.92 - 170)} q20 10 10 30 q-14 10 6 24" fill="${k.c("#7cc06a")}"/>`;
  const bellX = k.heroRight ? W * 0.3 : W * 0.72;
  s += `<path d="M${f(bellX)} ${f(H * 0.85)} m-36 30 q4 -60 36 -64 q32 4 36 64z" fill="${k.c("#f2c443")}"${k.ol(2)}/><circle cx="${f(bellX)}" cy="${f(H * 0.85 + 36)}" r="7" fill="${k.c("#b8862c")}"/><path d="M${f(bellX)} ${f(H * 0.85 - 34)} q-30 -20 -10 -30 q20 4 10 30 q30 -24 34 -6 q0 14 -34 6" fill="${k.c(t.accent)}"/>`;
  return finish(k, s);
}

function meadowScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  const sx = k.heroRight ? W * 0.14 : W * 0.86;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s += `<path d="M${f(sx + Math.cos(a) * 82)} ${f(H * 0.17 + Math.sin(a) * 82)} L${f(sx + Math.cos(a) * 120)} ${f(H * 0.17 + Math.sin(a) * 120)}" stroke="${k.c("#ffd34d")}" stroke-width="8" stroke-linecap="round"/>`;
  }
  s += `<circle cx="${f(sx)}" cy="${f(H * 0.17)}" r="66" fill="${k.c("#ffd34d")}"${k.ol(2.5)}/>`;
  s += cloud(k, W * 0.3, H * 0.18, 1, "#ffffff") + cloud(k, W * 0.6, H * 0.1, 0.75, "#ffffff") + cloud(k, W * 0.5, H * 0.3, 0.6, "#ffffff", 0.8);
  s += k.p(groundPath(k, H * 0.6, 30, 2), k.c("#b6d98a"), 2);
  s += roundTree(k, k.heroRight ? W * 0.3 : W * 0.7, H * 0.64, 300, k.c("#6aa85a"), k.c("#8a5a3a"));
  s += k.p(groundPath(k, gy, 20), k.c(t.ground), 2.5);
  const cols = ["#f28b8b", "#ffffff", "#f6d55c", "#b38be0", t.accent].map(k.c);
  for (let i = 0; i < 46; i++) s += flower(k.r() * W, gy + 20 + k.r() * (H - gy - 30), 0.7 + k.r() * 0.6, pick(cols, i), k.c("#4f8d4f"));
  for (let i = 0; i < 5; i++) {
    const x = k.r() * W;
    const y = H * 0.3 + k.r() * H * 0.35;
    const c = pick(["#f28b8b", "#f6d55c", "#7ec8e3"], i);
    s += `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 0 q-20 -26 -26 -6 q2 14 26 6z M0 0 q20 -26 26 -6 q-2 14 -26 6z" fill="${k.c(c)}"${k.ol(1.2)}/><path d="M0 -8 v14" stroke="${k.ink}" stroke-width="2.5"/></g>`;
  }
  return finish(k, s);
}

function dinoScene(ctx: DemoSceneCtx) {
  const k = kit(ctx);
  const t = ctx.theme;
  const { W, H, gy } = k;
  let s = sky(k, t);
  const vx = k.heroRight ? W * 0.24 : W * 0.74;
  // вулкан с дымом
  for (let i = 0; i < 5; i++) s += `<circle cx="${f(vx + i * 22 - 10)}" cy="${f(H * 0.3 - i * 46)}" r="${f(26 + i * 10)}" fill="${k.c("#b9a8a0")}" opacity="${f(0.7 - i * 0.1)}"/>`;
  s += k.p(`M${f(vx - 260)} ${f(H * 0.64)} L${f(vx - 50)} ${f(H * 0.33)} H${f(vx + 50)} L${f(vx + 260)} ${f(H * 0.64)}Z`, k.c("#7a5a50"), 2.5);
  s += `<path d="M${f(vx - 50)} ${f(H * 0.33)} H${f(vx + 50)} L${f(vx + 30)} ${f(H * 0.4)} L${f(vx + 6)} ${f(H * 0.36)} L${f(vx - 18)} ${f(H * 0.42)} L${f(vx - 34)} ${f(H * 0.37)}Z" fill="${k.c(t.accent)}"/>`;
  // плато и длинношеий динозавр вдали
  s += k.p(groundPath(k, H * 0.62, 18, 1), k.c("#b7b86a"), 2);
  const dx = k.heroRight ? W * 0.48 : W * 0.4;
  s += `<path d="M${f(dx)} ${f(H * 0.62)} v-24 q-4 -26 30 -30 q24 -2 40 -40 q6 -30 20 -32 q12 2 6 10 q-10 0 -12 26 q-6 40 -34 52 q30 4 46 22 l-6 16 h-10 v-12 h-50 v12z" fill="${k.c("#5f7d5a")}"${k.ol(1.6)}/>`;
  // птеродактили
  for (let i = 0; i < 3; i++) {
    const x = W * (0.3 + i * 0.18) + k.r() * 60;
    const y = H * (0.12 + k.r() * 0.15);
    s += `<path d="M${f(x - 34)} ${f(y)} q16 -14 34 4 q18 -18 34 -4 q-18 -2 -34 12 q-16 -14 -34 -12z" fill="${k.c("#5b4a5a")}"/>`;
  }
  s += k.p(groundPath(k, gy, 16), k.c(t.ground), 2.5);
  // папоротники и пальмы по краям
  const frond = (x: number, b: number, sc: number, flip: number) => {
    let o = `<g transform="translate(${f(x)} ${f(b)}) scale(${f(sc * flip)} ${f(sc)})" fill="${k.c("#3f7a45")}">`;
    for (let i = 0; i < 5; i++) o += `<path d="M0 0 Q${-70 + i * 30} -100 ${-120 + i * 60} -${150 + (i % 2) * 30} Q${-10 + i * 25} -70 0 0Z"${k.ol(1.6)}/>`;
    return o + "</g>";
  };
  s += frond(W * 0.04, H * 0.98, 2.2, 1) + frond(W * 0.96, H * 1.0, 2.4, -1) + frond(W * 0.16, H * 0.92, 1.1, 1) + frond(W * 0.86, H * 0.9, 1.2, -1);
  // яйца в гнезде и камни
  const nx = k.heroRight ? W * 0.32 : W * 0.68;
  s += `<ellipse cx="${f(nx)}" cy="${f(H * 0.92)}" rx="70" ry="22" fill="${k.c("#a07a4a")}"${k.ol(2)}/><ellipse cx="${f(nx - 20)}" cy="${f(H * 0.885)}" rx="20" ry="27" fill="${k.c("#f2ecd8")}"${k.ol(1.8)}/><ellipse cx="${f(nx + 18)}" cy="${f(H * 0.89)}" rx="18" ry="24" fill="${k.c("#dfe9c8")}"${k.ol(1.8)}/>`;
  for (let i = 0; i < 5; i++) s += `<ellipse cx="${f(k.r() * W)}" cy="${f(H * 0.8 + k.r() * H * 0.16)}" rx="${f(18 + k.r() * 24)}" ry="${f(10 + k.r() * 10)}" fill="${k.c("#9a8a7a")}"${k.ol(1.6)}/>`;
  return finish(k, s);
}

export const KIDS_THEMES: DemoTheme[] = [
  { key: "winter", sky: ["#1f3f5c", "#5a86a8"], ground: "#eef4f7", accent: "#c8402f", deco: "snow", scene: winterScene },
  { key: "kingdom", sky: ["#f6c8a8", "#fbeacc"], ground: "#6ea86a", accent: "#8e4b6e", deco: "flags", scene: kingdomScene },
  { key: "dragon", sky: ["#141f45", "#34478a"], ground: "#1d4a3a", accent: "#7ff0c0", deco: "stars", scene: dragonScene },
  { key: "ocean", sky: ["#4fc0d6", "#0d4f66"], ground: "#e6cf98", accent: "#f2c443", deco: "bubbles", scene: oceanScene },
  { key: "sleep", sky: ["#2e2b57", "#6b5f9e"], ground: "#2a2650", accent: "#f6e7b8", deco: "moon", scene: sleepScene },
  { key: "forest", sky: ["#d6ecc4", "#f6f2d4"], ground: "#7fb069", accent: "#e4572e", deco: "leaves", scene: forestScene },
  { key: "space", sky: ["#0b1030", "#33246b"], ground: "#b9b3d6", accent: "#ff9f43", deco: "stars", scene: spaceScene },
  { key: "school", sky: ["#f8ecd4", "#f0dcb4"], ground: "#c49a6c", accent: "#e94f37", deco: "none", scene: schoolScene },
  { key: "meadow", sky: ["#8fd0f0", "#e6f5fb"], ground: "#8cc084", accent: "#f2a65a", deco: "clouds", scene: meadowScene },
  { key: "dino", sky: ["#f7b267", "#fde3b4"], ground: "#9bb05a", accent: "#e4572e", deco: "leaves", scene: dinoScene },
];

// ---------------------------------------------------------------------------
// Ребёнок
// ---------------------------------------------------------------------------

type HairCut = "short" | "buzz" | "curly" | "curlyLong" | "long" | "bob" | "ponytail" | "braids" | "bun";

function hairCut(hairstyle: string | undefined, longHair: boolean | undefined, girl: boolean): HairCut {
  const hs = (hairstyle ?? "").toLowerCase();
  const long = longHair ?? (/длинн|распущ|long/.test(hs) || (girl && !/коротк|short/.test(hs)));
  if (/лыс|налысо|наголо|ёжик|ежик|под машинк|buzz|bald/.test(hs)) return "buzz";
  if (/кос[аиыу]|косич|braid/.test(hs)) return "braids";
  if (/хвост|pony/.test(hs)) return "ponytail";
  if (/пуч|гульк|bun/.test(hs)) return "bun";
  if (/кудр|кудряв|завит|локон|кучеряв|афро|curl/.test(hs)) return long ? "curlyLong" : "curly";
  if (/каре|боб|bob/.test(hs)) return "bob";
  if (/длинн|распущ|long/.test(hs)) return "long";
  if (/коротк|стрижк|ч[её]лк|short/.test(hs)) return "short";
  return long ? "long" : "short";
}

type Pt = [number, number];
type Pose = "wave" | "stand" | "walk" | "cheer" | "point";
const POSES: Pose[] = ["wave", "stand", "walk", "cheer", "point"];

/** Ребёнок 2–10 лет. Точка опоры (0, 190) — ступни; рост ~230 при 6 годах. */
export const drawChild: DemoHeroDrawer = (o) => {
  const h = o.look;
  const st = o.style;
  const age = Math.min(10, Math.max(2, Number.isFinite(h.age) ? (h.age as number) : 6));
  const girl = h.gender === "girl";
  const idx = o.index ?? 0;
  const pose = POSES[((idx % POSES.length) + POSES.length) % POSES.length];

  // цвета
  const ink = st.palette.ink;
  const faceInk = mix(ink, "#2b2320", 0.6);
  const hair = colorFrom(HAIR_COLORS, h.hair, "#8a5a36");
  const hairDark = mix(hair, "#1a120c", 0.35);
  const skin = colorFrom(SKIN_COLORS, h.skin, "#f4d3b8");
  const blush = mix(skin, "#e8606a", 0.35);
  const acc = st.palette.accents.length ? st.palette.accents : ["#3e8ed0"];
  const shirt = h.outfit && HEX6.test(h.outfit) ? h.outfit : pick(acc, idx);
  const others = acc.filter((c) => c.toLowerCase() !== shirt.toLowerCase());
  const trim = others.length ? pick(others, idx + 1) : mix(shirt, "#ffffff", 0.55);
  const pants = girl ? mix(shirt, "#2b2b3a", 0.5) : mix("#3b4a6b", st.palette.paper, 0.08);
  const shoes = girl ? mix(trim, "#2a1a14", 0.35) : mix("#7a4a32", "#2a1a14", 0.2);

  // линия по стилю
  const lw = { thin: 2.2, bold: 4.2, sketch: 3, none: 0 }[st.line];
  const dash = st.line === "sketch" ? ` stroke-dasharray="16 3"` : "";
  const s = lw ? ` stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"${dash}` : "";
  const sThin = lw ? ` stroke="${ink}" stroke-width="${f(Math.max(1.4, lw * 0.6))}" stroke-linejoin="round" stroke-linecap="round"` : "";
  const limb = (pts: Pt[], color: string, w: number) => {
    const d = pts.length === 3 ? `M${f(pts[0][0])} ${f(pts[0][1])} Q${f(pts[1][0])} ${f(pts[1][1])} ${f(pts[2][0])} ${f(pts[2][1])}` : `M${f(pts[0][0])} ${f(pts[0][1])} L${f(pts[1][0])} ${f(pts[1][1])}`;
    return (lw ? `<path d="${d}" stroke="${ink}" stroke-width="${f(w + lw * 2)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : "") + `<path d="${d}" stroke="${color}" stroke-width="${f(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  };

  // пропорции по возрасту: малыши — крупная голова и короткие ножки
  const footY = 184;
  const legLen = 50 + age * 3;
  const torso = 58 + age * 1.8;
  const R = 47 - age * 0.75;
  const hipY = footY - legLen;
  const shY = hipY - torso;
  const hc = shY - R * 0.84;
  const sw = 22 + age * 0.9;
  const armW = 12 + age * 0.45;
  const legW = 14 + age * 0.6;

  // позы: [плечо, локоть, кисть]
  const shL: Pt = [-sw + 3, shY + 9];
  const shR: Pt = [sw - 3, shY + 9];
  const down = (side: -1 | 1): Pt[] => [side < 0 ? shL : shR, [side * (sw + 9), shY + torso * 0.45], [side * (sw + 7), hipY + 4]];
  let armL = down(-1);
  let armR = down(1);
  let legL: Pt[] = [[-legW * 0.55, hipY], [-legW * 0.6, footY]];
  let legR: Pt[] = [[legW * 0.55, hipY], [legW * 0.6, footY]];
  let tilt = 0;
  if (pose === "wave") {
    armR = [shR, [sw + 38, shY + 2], [sw + 40, shY - 44]];
    tilt = -4;
  } else if (pose === "cheer") {
    armL = [shL, [-sw - 22, shY - 6], [-sw - 30, shY - 46]];
    armR = [shR, [sw + 22, shY - 6], [sw + 30, shY - 46]];
    legL = [[-legW * 0.55, hipY], [-legW * 1.2, footY - 4]];
    legR = [[legW * 0.55, hipY], [legW * 1.2, footY - 4]];
  } else if (pose === "walk") {
    armL = [shL, [-sw - 2, shY + torso * 0.45], [-sw + 14, hipY - 4]];
    armR = [shR, [sw + 14, shY + torso * 0.42], [sw + 26, hipY - 10]];
    legL = [[-legW * 0.4, hipY], [-legW * 1.1, hipY + legLen * 0.5], [-legW * 1.9, footY]];
    legR = [[legW * 0.4, hipY], [legW * 1.0, hipY + legLen * 0.55], [legW * 1.5, footY - 6]];
    tilt = 3;
  } else if (pose === "point") {
    armR = [shR, [sw + 30, shY + 12], [sw + 58, shY + 2]];
    tilt = 4;
  }

  const cut = hairCut(h.hairstyle, h.longHair, girl);
  const framed = cut === "long" || cut === "bob" || cut === "braids" || cut === "curlyLong";

  // ── волосы сзади ──
  let back = "";
  if (cut === "long")
    back = `<path d="M${f(-R * 1.08)} ${f(hc - R * 0.25)} C${f(-R * 1.3)} ${f(hc + R * 1.1)} ${f(-R * 1.1)} ${f(hc + R * 1.6)} ${f(-R * 0.55)} ${f(hc + R * 1.62)} Q0 ${f(hc + R * 1.5)} ${f(R * 0.55)} ${f(hc + R * 1.62)} C${f(R * 1.1)} ${f(hc + R * 1.6)} ${f(R * 1.3)} ${f(hc + R * 1.1)} ${f(R * 1.08)} ${f(hc - R * 0.25)}Z" fill="${hair}"${s}/>`;
  else if (cut === "bob")
    back = `<path d="M${f(-R * 1.1)} ${f(hc - R * 0.2)} C${f(-R * 1.22)} ${f(hc + R * 0.6)} ${f(-R * 1.1)} ${f(hc + R * 0.9)} ${f(-R * 0.7)} ${f(hc + R * 0.92)} H${f(R * 0.7)} C${f(R * 1.1)} ${f(hc + R * 0.9)} ${f(R * 1.22)} ${f(hc + R * 0.6)} ${f(R * 1.1)} ${f(hc - R * 0.2)}Z" fill="${hair}"${s}/>`;
  else if (cut === "ponytail")
    back = `<path d="M${f(R * 0.5)} ${f(hc - R * 0.8)} C${f(R * 1.65)} ${f(hc - R * 1.0)} ${f(R * 1.7)} ${f(hc + R * 0.4)} ${f(R * 1.2)} ${f(hc + R * 1.2)} C${f(R * 1.25)} ${f(hc + R * 0.4)} ${f(R * 1.1)} ${f(hc - R * 0.2)} ${f(R * 0.45)} ${f(hc - R * 0.45)}Z" fill="${hair}"${s}/><circle cx="${f(R * 0.86)}" cy="${f(hc - R * 0.72)}" r="${f(R * 0.13)}" fill="${trim}"${sThin}/>`;
  else if (cut === "bun") back = `<circle cx="${f(R * 0.1)}" cy="${f(hc - R * 1.02)}" r="${f(R * 0.4)}" fill="${hair}"${s}/>`;
  else if (cut === "curlyLong") {
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) back += `<circle cx="${f(side * R * (1.0 + (j % 2) * 0.12))}" cy="${f(hc - R * 0.1 + j * R * 0.32)}" r="${f(R * 0.3)}" fill="${hair}"${sThin}/>`;
  }

  // ── косички (поверх плеч, под головой) ──
  let braids = "";
  if (cut === "braids")
    for (const side of [-1, 1]) {
      for (let j = 0; j < 4; j++) braids += `<ellipse cx="${f(side * R * (0.98 + j * 0.05))}" cy="${f(hc + R * 0.55 + j * R * 0.3)}" rx="${f(R * 0.2)}" ry="${f(R * 0.18)}" fill="${hair}"${sThin}/>`;
      const by = hc + R * 0.55 + 4 * R * 0.3;
      const bx = side * R * 1.18;
      braids += `<path d="M${f(bx)} ${f(by - 4)} l${f(-R * 0.2)} ${f(-R * 0.12)} v${f(R * 0.24)}z M${f(bx)} ${f(by - 4)} l${f(R * 0.2)} ${f(-R * 0.12)} v${f(R * 0.24)}z" fill="${trim}"${sThin}/><path d="M${f(bx)} ${f(by)} q${f(-R * 0.06)} ${f(R * 0.2)} 0 ${f(R * 0.26)} q${f(R * 0.06)} ${f(-R * 0.1)} 0 ${f(-R * 0.26)}" fill="${hair}"/>`;
    }

  // ── ноги и обувь ──
  const legs = [legL, legR]
    .map((L) => {
      const foot = L[L.length - 1];
      return (
        limb(L, pants, legW) +
        (girl ? `<path d="M${f(foot[0] - legW * 0.5)} ${f(foot[1] - 8)} h${f(legW)}" stroke="#ffffff" stroke-width="5" opacity=".9"/>` : "") +
        `<ellipse cx="${f(foot[0] + legW * 0.35)}" cy="${f(foot[1] + 1)}" rx="${f(legW * 0.82)}" ry="${f(legW * 0.48)}" fill="${shoes}"${sThin}/>`
      );
    })
    .join("");

  // ── туловище: платье или футболка с брюками ──
  let body: string;
  if (girl) {
    const hem = hipY + legLen * 0.32;
    body =
      `<path d="M${f(-sw + 2)} ${f(shY + 4)} Q0 ${f(shY - 4)} ${f(sw - 2)} ${f(shY + 4)} L${f(sw + 4)} ${f(shY + torso * 0.45)} L${f(sw + 18)} ${f(hem)} Q0 ${f(hem + 10)} ${f(-sw - 18)} ${f(hem)} L${f(-sw - 4)} ${f(shY + torso * 0.45)}Z" fill="${shirt}"${s}/>` +
      `<path d="M${f(-sw - 15)} ${f(hem - 10)} Q0 ${f(hem)} ${f(sw + 15)} ${f(hem - 10)}" stroke="${trim}" stroke-width="7" fill="none"/>` +
      `<path d="M-14 ${f(shY + 1)} q7 12 14 1 q7 11 14 -1" fill="#ffffff" stroke="${mix(shirt, "#000000", 0.25)}" stroke-width="1.6"/>`;
  } else {
    body =
      `<path d="M${f(-sw - 2)} ${f(hipY - 6)} H${f(sw + 2)} L${f(sw + 2)} ${f(hipY + 14)} H${f(-sw - 2)}Z" fill="${pants}"${s}/>` +
      `<path d="M${f(-sw + 1)} ${f(shY + 4)} Q0 ${f(shY - 4)} ${f(sw - 1)} ${f(shY + 4)} L${f(sw + 3)} ${f(hipY + 4)} Q0 ${f(hipY + 9)} ${f(-sw - 3)} ${f(hipY + 4)}Z" fill="${shirt}"${s}/>` +
      `<path d="M${f(-sw)} ${f(shY + torso * 0.42)} H${f(sw + 1)}" stroke="${trim}" stroke-width="${f(torso * 0.11)}"/>` +
      `<path d="M-11 ${f(shY + 1)} Q0 ${f(shY + 12)} 11 ${f(shY + 1)}" stroke="${mix(shirt, "#000000", 0.3)}" stroke-width="2.5" fill="none"/>`;
  }
  const neck = `<rect x="${f(-R * 0.18)}" y="${f(hc + R * 0.7)}" width="${f(R * 0.36)}" height="${f(shY - hc - R * 0.6)}" fill="${skin}"/>`;

  // ── руки ──
  const arm = (A: Pt[]) => limb(A, shirt, armW) + `<circle cx="${f(A[2][0])}" cy="${f(A[2][1])}" r="${f(armW * 0.62)}" fill="${skin}"${sThin}/>`;

  // ── голова ──
  const ear = framed ? "" : [-1, 1].map((sd) => `<ellipse cx="${f(sd * R * 0.97)}" cy="${f(hc + R * 0.12)}" rx="${f(R * 0.16)}" ry="${f(R * 0.2)}" fill="${skin}"${sThin}/>`).join("");
  const headShape = `<path d="M${f(-R)} ${f(hc - R * 0.05)} C${f(-R)} ${f(hc - R * 1.32)} ${f(R)} ${f(hc - R * 1.32)} ${f(R)} ${f(hc - R * 0.05)} C${f(R)} ${f(hc + R * 0.72)} ${f(R * 0.5)} ${f(hc + R * 0.98)} 0 ${f(hc + R * 0.98)} C${f(-R * 0.5)} ${f(hc + R * 0.98)} ${f(-R)} ${f(hc + R * 0.72)} ${f(-R)} ${f(hc - R * 0.05)}Z" fill="${skin}"${s}/>`;

  // лицо
  const ex = R * 0.37;
  const ey = hc + R * 0.14;
  const happy = pose === "cheer";
  const eyes = happy
    ? [-1, 1].map((sd) => `<path d="M${f(sd * ex - R * 0.12)} ${f(ey + 2)} Q${f(sd * ex)} ${f(ey - R * 0.14)} ${f(sd * ex + R * 0.12)} ${f(ey + 2)}" stroke="${faceInk}" stroke-width="${f(R * 0.07)}" fill="none" stroke-linecap="round"/>`).join("")
    : [-1, 1]
        .map(
          (sd) =>
            `<ellipse cx="${f(sd * ex)}" cy="${f(ey)}" rx="${f(R * 0.085)}" ry="${f(R * 0.11)}" fill="${faceInk}"/><circle cx="${f(sd * ex + R * 0.03)}" cy="${f(ey - R * 0.04)}" r="${f(R * 0.032)}" fill="#ffffff"/>` +
            (girl ? `<path d="M${f(sd * (ex + R * 0.07))} ${f(ey - R * 0.07)} l${f(sd * R * 0.07)} ${f(-R * 0.05)}" stroke="${faceInk}" stroke-width="${f(R * 0.035)}" stroke-linecap="round"/>` : ""),
        )
        .join("");
  const brows = [-1, 1].map((sd) => `<path d="M${f(sd * ex - R * 0.1)} ${f(ey - R * 0.24)} Q${f(sd * ex)} ${f(ey - R * 0.3)} ${f(sd * ex + R * 0.1)} ${f(ey - R * 0.24)}" stroke="${hairDark}" stroke-width="${f(R * 0.05)}" fill="none" stroke-linecap="round" opacity=".85"/>`).join("");
  const cheeks = [-1, 1].map((sd) => `<ellipse cx="${f(sd * R * 0.6)}" cy="${f(hc + R * 0.42)}" rx="${f(R * 0.15)}" ry="${f(R * 0.1)}" fill="${blush}" opacity=".55"/>`).join("");
  const nose = `<path d="M${f(-R * 0.05)} ${f(hc + R * 0.34)} Q0 ${f(hc + R * 0.4)} ${f(R * 0.05)} ${f(hc + R * 0.34)}" stroke="${mix(skin, "#7a3b2a", 0.45)}" stroke-width="${f(R * 0.045)}" fill="none" stroke-linecap="round"/>`;
  const my = hc + R * 0.53;
  const mouth =
    pose === "cheer" || pose === "wave"
      ? `<path d="M${f(-R * 0.17)} ${f(my)} Q0 ${f(my + R * 0.3)} ${f(R * 0.17)} ${f(my)}Z" fill="#9b3b33"/><path d="M${f(-R * 0.08)} ${f(my + R * 0.13)} Q0 ${f(my + R * 0.06)} ${f(R * 0.08)} ${f(my + R * 0.13)} Q0 ${f(my + R * 0.2)} ${f(-R * 0.08)} ${f(my + R * 0.13)}Z" fill="#e87d7d"/>`
      : `<path d="M${f(-R * 0.15)} ${f(my)} Q0 ${f(my + R * 0.16)} ${f(R * 0.15)} ${f(my)}" stroke="#9b3b33" stroke-width="${f(R * 0.06)}" fill="none" stroke-linecap="round"/>`;
  const freckles = h.freckles
    ? `<g fill="${mix(skin, "#8a4a2a", 0.55)}" opacity=".75">${[[-0.5, 0.3], [-0.38, 0.38], [-0.56, 0.42], [-0.3, 0.29], [0.5, 0.3], [0.38, 0.38], [0.56, 0.42], [0.3, 0.29], [0, 0.26]]
        .map(([x, y]) => `<circle cx="${f(x * R)}" cy="${f(hc + y * R)}" r="${f(R * 0.03)}"/>`)
        .join("")}</g>`
    : "";
  const glasses = h.glasses
    ? `<g fill="#ffffff" fill-opacity=".18" stroke="${faceInk}" stroke-width="${f(R * 0.055)}"><circle cx="${f(-ex)}" cy="${f(ey)}" r="${f(R * 0.25)}"/><circle cx="${f(ex)}" cy="${f(ey)}" r="${f(R * 0.25)}"/><path d="M${f(-ex + R * 0.25)} ${f(ey - 2)} Q0 ${f(ey - R * 0.08)} ${f(ex - R * 0.25)} ${f(ey - 2)} M${f(-ex - R * 0.25)} ${f(ey - 2)} L${f(-R * 0.97)} ${f(ey - R * 0.06)} M${f(ex + R * 0.25)} ${f(ey - 2)} L${f(R * 0.97)} ${f(ey - R * 0.06)}" fill="none"/></g>`
    : "";

  // ── волосы спереди ──
  let front: string;
  const top = (k: number) => hc - R * k;
  if (cut === "buzz") {
    front = `<path d="M${f(-R * 0.98)} ${f(hc - R * 0.05)} C${f(-R * 1.02)} ${f(top(1.36))} ${f(R * 1.02)} ${f(top(1.36))} ${f(R * 0.98)} ${f(hc - R * 0.05)} C${f(R * 0.8)} ${f(top(0.62))} ${f(-R * 0.8)} ${f(top(0.62))} ${f(-R * 0.98)} ${f(hc - R * 0.05)}Z" fill="${hair}" opacity=".8"/>`;
  } else if (cut === "short") {
    front =
      `<path d="M${f(-R * 1.05)} ${f(hc + R * 0.05)} C${f(-R * 1.15)} ${f(top(1.42))} ${f(R * 1.15)} ${f(top(1.42))} ${f(R * 1.05)} ${f(hc + R * 0.05)} L${f(R * 0.88)} ${f(top(0.2))} L${f(R * 0.66)} ${f(top(0.46))} L${f(R * 0.42)} ${f(top(0.32))} L${f(R * 0.18)} ${f(top(0.52))} L${f(-R * 0.08)} ${f(top(0.36))} L${f(-R * 0.34)} ${f(top(0.54))} L${f(-R * 0.6)} ${f(top(0.38))} L${f(-R * 0.84)} ${f(top(0.46))} L${f(-R * 0.94)} ${f(top(0.1))}Z" fill="${hair}"${s}/>` +
      `<path d="M${f(R * 0.05)} ${f(top(1.02))} q${f(R * 0.1)} ${f(-R * 0.3)} ${f(R * 0.3)} ${f(-R * 0.26)} q${f(-R * 0.16)} ${f(R * 0.06)} ${f(-R * 0.12)} ${f(R * 0.28)}" fill="${hair}"${sThin}/>`;
  } else if (cut === "curly" || cut === "curlyLong") {
    front = `<path d="M${f(-R * 1.02)} ${f(hc)} C${f(-R * 1.1)} ${f(top(1.4))} ${f(R * 1.1)} ${f(top(1.4))} ${f(R * 1.02)} ${f(hc)} C${f(R * 0.7)} ${f(top(0.5))} ${f(-R * 0.7)} ${f(top(0.5))} ${f(-R * 1.02)} ${f(hc)}Z" fill="${hair}"/>`;
    for (let i = 0; i <= 9; i++) {
      const a = Math.PI * (1.02 + (i / 9) * 0.96);
      front += `<circle cx="${f(Math.cos(a) * R * 0.96)}" cy="${f(hc - R * 0.12 + Math.sin(a) * R * 0.95)}" r="${f(R * 0.27)}" fill="${hair}"${sThin}/>`;
    }
    for (let i = 0; i < 4; i++) front += `<circle cx="${f(-R * 0.45 + i * R * 0.3)}" cy="${f(top(0.55) + (i % 2) * 4)}" r="${f(R * 0.2)}" fill="${hair}"/>`;
  } else {
    // гладкие волосы с чёлкой; у длинных/каре/косичек — пряди по бокам лица
    const side = framed ? R * 0.78 : R * 0.05;
    const inner = framed ? R * 0.82 : R * 1.0;
    front =
      `<path d="M${f(-R * 1.08)} ${f(hc + side)} C${f(-R * 1.2)} ${f(top(1.45))} ${f(R * 1.2)} ${f(top(1.45))} ${f(R * 1.08)} ${f(hc + side)} L${f(inner)} ${f(hc + side)} C${f(inner)} ${f(top(0.2))} ${f(R * 0.55)} ${f(top(0.48))} ${f(R * 0.18)} ${f(top(0.44))} C${f(-R * 0.12)} ${f(top(0.66))} ${f(-inner * 0.9)} ${f(top(0.45))} ${f(-inner)} ${f(hc + side)}Z" fill="${hair}"${s}/>` +
      `<path d="M${f(R * 0.1)} ${f(top(0.95))} Q${f(R * 0.3)} ${f(top(0.7))} ${f(R * 0.18)} ${f(top(0.46))}" stroke="${hairDark}" stroke-width="${f(R * 0.04)}" fill="none" opacity=".6"/>`;
  }
  // блик на волосах
  if (cut !== "buzz") front += `<path d="M${f(-R * 0.58)} ${f(top(0.7))} Q${f(-R * 0.4)} ${f(top(0.88))} ${f(-R * 0.16)} ${f(top(0.92))}" stroke="#ffffff" stroke-width="${f(R * 0.07)}" fill="none" stroke-linecap="round" opacity=".28"/>`;

  const rot = `rotate(${tilt} 0 ${f(shY)})`;
  const head = `<g transform="${rot}">${ear}${headShape}${cheeks}${freckles}${brows}${eyes}${nose}${mouth}${front}${glasses}</g>`;

  return `<g transform="translate(${f(o.x)} ${f(o.y)}) scale(${f(o.flip ? -o.scale : o.scale)} ${f(o.scale)})">
    <ellipse cx="0" cy="${footY + 6}" rx="${f(56 + age)}" ry="10" fill="rgba(0,0,0,.16)"/>
    ${back ? `<g transform="${rot}">${back}</g>` : ""}${arm(armL)}${legs}${body}${neck}${braids}${head}${arm(armR)}
  </g>`;
};
