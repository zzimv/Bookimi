// ВЛАДЕЛЕЦ: агент 7 (художник книг для взрослых). Никто другой этот файл не меняет.
//
//  • ADULT_ART_STYLES — стили с owner "adults" в ART_STYLE_OWNERS: linocut, retro-poster.
//    Промпты описывают только технику; лица взрослых (и обоих в паре) — узнаваемы по фото.
//  • ADULT_THEMES — все ключи с owner "adults" в DEMO_THEME_KEYS, у каждой свой фон (scene):
//    romance-city, travel-map, office, dacha, home, celebration, starry-sky.
//  • drawAdult — взрослый 20–85 лет: пол (платье / пиджак и брюки), волосы (цвет, седина по возрасту,
//    причёски: короткая, длинные, каре, кудри, пучок, хвост, коса, лысина), борода/усы, очки, тон кожи,
//    одежда (look.outfit). Возраст 60+ — седина по умолчанию, морщинки, ниже рост; бабушке — шаль.
//    Цвет одежды стабилен между разворотами (от внешности), чтобы пара не «переодевалась».
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, DemoHeroDrawer, DemoLook, DemoSceneCtx, DemoTheme } from "../types";
import { colorFrom, drawDeco, HAIR_COLORS, pick, SKIN_COLORS, stroke } from "./shared";

// ---------------------------------------------------------------------------
// Стили
// ---------------------------------------------------------------------------

const ADULT_LIKENESS =
  "the adult faces keep the exact likeness of the people in the reference photos: same face shape, eyes, nose, brows, hairline, hairstyle, skin tone, glasses and facial hair, true age with natural wrinkles, warm natural expression; when two people are shown, both are equally clear, distinct and recognizable, standing close as a couple, fully dressed, tasteful adult proportions";

const ADULT_NEGATIVE =
  "text, letters, words, captions, typography, numbers, logo, brand, watermark, signature, nudity, nude, naked, cleavage, lingerie, underwear, swimsuit, erotic, sexual, suggestive pose, kissing close-up, distorted face, deformed face, asymmetrical eyes, wrong likeness, generic face, face swap artifacts, extra fingers, deformed hands, extra limbs, merged bodies, duplicated person, extra people, childlike adult face, caricature, grotesque, ugly, horror, blood, alcohol bottles, drunk, cigarettes, photo, photorealistic, 3d render, blurry";

export const ADULT_ART_STYLES: ArtStyle[] = [
  {
    id: "linocut",
    title: "Гравюра",
    description:
      "Как оттиск линогравюры: уверенный чёрный штрих, ритм резаных линий и один-два тёплых цвета на кремовой бумаге. Торжественно, благородно, хочется поставить на полку.",
    audiences: ["ADULT"],
    prompt:
      "hand-carved linocut relief print illustration for a keepsake gift book, bold black carved lines, rhythmic parallel gouge hatching for shading, crisp white cut-away highlights, limited palette of black ink plus vermilion red and deep teal, slightly uneven ink coverage and visible warm cream paper texture, strong simple silhouettes, elegant composition with breathing room, " +
      ADULT_LIKENESS +
      ", faces carved with fine careful lines rather than heavy hatching",
    negative: ADULT_NEGATIVE + ", gradients, airbrush, glossy digital painting, neon colors, many colors",
    demo: {
      palette: { paper: "#f2e8d5", ink: "#1c1a19", accents: ["#b8432f", "#2f5d62", "#c9973f", "#5a2e2a"] },
      line: "bold",
      texture: "grain",
      filter: "wobble",
    },
  },
  {
    id: "retro-poster",
    title: "Ретро-плакат",
    description:
      "Плакат середины прошлого века: простые геометричные формы, тёплые приглушённые цвета — горчица, бирюза, терракота — и лёгкая печатная потёртость. Оптимистично и стильно.",
    audiences: ["ADULT", "TEEN"],
    prompt:
      "mid-century travel poster style illustration, flat simplified geometric shapes, clean silhouettes without outlines, muted warm palette of mustard yellow, teal, terracotta, dusty red and cream, subtle screen-print grain and halftone texture, slight print misregistration, long soft shadows, optimistic sunny mood, bold graphic composition, " +
      ADULT_LIKENESS +
      ", faces simplified in shape but keeping each person's features, glasses and hairstyle",
    negative: ADULT_NEGATIVE + ", thick black outlines, photographic lighting, neon, oversaturated, cluttered details",
    demo: {
      palette: { paper: "#f1e4c6", ink: "#2d3a3f", accents: ["#d2643b", "#2f7f7a", "#e2a43b", "#a8463f", "#6f8f6a"] },
      line: "none",
      texture: "halftone",
      filter: "posterize",
    },
  },
];

// ---------------------------------------------------------------------------
// Помощники
// ---------------------------------------------------------------------------

/** Затемнить (k < 0) или осветлить (k > 0) цвет #rrggbb. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const r0 = (v: number) => Math.round(v);

/** Линии стиля для фона: тоньше, чем у героев. */
const sline = (c: DemoSceneCtx, w = 2) => stroke(c.style, w);

function lamp(x: number, y: number, h: number, c: DemoSceneCtx, glow = "#ffd98a") {
  const s = sline(c, 1.6);
  return `<circle cx="${x}" cy="${y - h}" r="70" fill="url(#ad-glow)"/>
  <rect x="${x - 5}" y="${y - h}" width="10" height="${h}" fill="#2b2433"${s}/>
  <path d="M${x - 16} ${y - h + 4} h32 l-6 -30 h-20z" fill="${glow}"${s}/><path d="M${x - 12} ${y - h - 26} h24 l-12 -12z" fill="#2b2433"/>`;
}

const glowDef = (color: string) =>
  `<defs><radialGradient id="ad-glow"><stop offset="0" stop-color="${color}" stop-opacity=".75"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;

// ---------------------------------------------------------------------------
// Фоны тем
// ---------------------------------------------------------------------------

function sceneRomanceCity(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  let city = "";
  for (let x = -20; x < W; ) {
    const w = 60 + r() * 90, h = 120 + r() * 260, top = H * 0.6 - h;
    city += `<rect x="${r0(x)}" y="${r0(top)}" width="${r0(w)}" height="${r0(h)}" fill="${r() > 0.5 ? "#3b2f5c" : "#46366a"}"/>`;
    if (r() > 0.6) city += `<path d="M${r0(x + w / 2)} ${r0(top - 40)} l14 40 h-28z" fill="#3b2f5c"/>`;
    for (let wy = top + 16; wy < H * 0.58; wy += 28)
      for (let wx = x + 10; wx < x + w - 14; wx += 22) if (r() > 0.55) city += `<rect x="${r0(wx)}" y="${r0(wy)}" width="9" height="13" fill="#ffd98a" opacity="${(0.6 + r() * 0.4).toFixed(2)}"/>`;
    x += w + 6;
  }
  let stars = "";
  for (let i = 0; i < 30; i++) stars += `<circle cx="${r0(r() * W)}" cy="${r0(r() * H * 0.3)}" r="${(1 + r() * 2).toFixed(1)}" fill="#fff4d6" opacity=".8"/>`;
  const deckY = H * 0.55;
  let arches = "", posts = "";
  const span = W / 5;
  for (let i = 0; i < 6; i++) {
    const ax = i * span - span / 2;
    arches += `<path d="M${r0(ax + 18)} ${r0(H * 0.68)} V${r0(deckY + 70)} A${r0(span / 2 - 18)} ${r0(span / 3)} 0 0 1 ${r0(ax + span - 18)} ${r0(deckY + 70)} V${r0(H * 0.68)}" fill="none" stroke="#5a3f62" stroke-width="16"/>`;
    posts += `<rect x="${r0(ax - 4)}" y="${r0(deckY - 46)}" width="6" height="46" fill="#2b2433"/><circle cx="${r0(ax - 1)}" cy="${r0(deckY - 50)}" r="9" fill="#ffd98a"/><circle cx="${r0(ax - 1)}" cy="${r0(deckY - 50)}" r="26" fill="url(#ad-glow)"/>`;
  }
  let refl = "";
  for (let i = 0; i < 26; i++) refl += `<rect x="${r0(r() * W)}" y="${r0(H * 0.64 + r() * H * 0.06)}" width="${r0(20 + r() * 50)}" height="3" fill="#ffd98a" opacity=".45"/>`;
  let cobbles = "";
  for (let y = H * 0.76; y < H; y += 26) for (let x = (y / 26) % 2 ? 0 : 30; x < W; x += 60) cobbles += `<rect x="${r0(x)}" y="${r0(y)}" width="52" height="20" rx="8" fill="#55445e" opacity=".55"/>`;
  return `${glowDef("#ffd98a")}<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}
  <circle cx="${r0(W * 0.86)}" cy="150" r="56" fill="#fbe7c2"/><circle cx="${r0(W * 0.86) + 22}" cy="136" r="50" fill="#3a2d5c" opacity=".35"/>
  ${city}
  <rect x="0" y="${r0(H * 0.6)}" width="${W}" height="${r0(H * 0.12)}" fill="#344a78"/>${refl}
  <rect x="0" y="${r0(deckY)}" width="${W}" height="20" fill="#5a3f62"${sline(c)}/>${arches}${posts}
  <rect x="0" y="${r0(H * 0.71)}" width="${W}" height="${r0(H * 0.29)}" fill="${c.theme.ground}"/>${cobbles}
  <path d="M0 ${r0(H * 0.71)} H${W}" stroke="#2b2433" stroke-width="6"/>
  ${[0.06, 0.94].map((f) => lamp(r0(W * f), r0(H * 0.92), 360, c)).join("")}
  ${drawDeco("hearts", W, H * 0.55, r, c.theme.accent, 8)}`;
}

function sceneTravelMap(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  const ink = "#7a5a3a";
  let grid = "";
  for (let x = 0; x < W; x += 128) grid += `<path d="M${x} 0V${H}" stroke="${ink}" stroke-width="1.2" opacity=".18"/>`;
  for (let y = 0; y < H; y += 128) grid += `<path d="M0 ${y}H${W}" stroke="${ink}" stroke-width="1.2" opacity=".18"/>`;
  const land = (cx: number, cy: number, s: number) => {
    let d = "";
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, rad = s * (0.7 + r() * 0.5);
      d += `${i ? "L" : "M"}${r0(cx + Math.cos(a) * rad * 1.5)} ${r0(cy + Math.sin(a) * rad)}`;
    }
    return `<path d="${d}Z" fill="#e8d6a2" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="${d}Z" fill="none" stroke="${ink}" stroke-width="1" opacity=".35" transform="translate(${r0(cx * 0.03)} ${r0(cy * 0.03)}) scale(.97)"/>`;
  };
  const lands = [land(W * 0.16, H * 0.3, 120), land(W * 0.5, H * 0.18, 90), land(W * 0.82, H * 0.38, 140), land(W * 0.42, H * 0.52, 70)].join("");
  const route = `M${r0(W * 0.1)} ${r0(H * 0.36)} C${r0(W * 0.3)} ${r0(H * 0.02)} ${r0(W * 0.45)} ${r0(H * 0.5)} ${r0(W * 0.55)} ${r0(H * 0.2)} S${r0(W * 0.78)} ${r0(H * 0.12)} ${r0(W * 0.86)} ${r0(H * 0.4)}`;
  const pin = (x: number, y: number) =>
    `<path d="M${r0(x)} ${r0(y)} c-18 -26 -18 -44 0 -44 c18 0 18 18 0 44z" fill="${c.theme.accent}" stroke="#5a2a20" stroke-width="2"/><circle cx="${r0(x)}" cy="${r0(y - 30)}" r="6" fill="#fff4e0"/>`;
  const compass = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})" stroke="${ink}" stroke-width="2"><circle r="46" fill="none"/><circle r="38" fill="none" opacity=".5"/><path d="M0 -58 L10 0 L0 58 L-10 0Z" fill="#c9a66b"/><path d="M-58 0 L0 -10 L58 0 L0 10Z" fill="#e8d6a2"/><path d="M0 -58 L10 0 L-10 0Z" fill="${c.theme.accent}"/></g>`;
  const plane = (x: number, y: number) =>
    `<g transform="translate(${r0(x)} ${r0(y)}) rotate(-20)" fill="#f7f1e3" stroke="${ink}" stroke-width="2.5"><path d="M-40 0 Q-40 -8 -30 -8 H34 Q46 -4 46 0 Q46 4 34 6 H-30 Q-40 6 -40 0Z"/><path d="M-4 -6 L-18 -36 H-8 L14 -6Z M-4 5 L-18 34 H-8 L14 5Z M-34 -6 L-42 -22 H-34 L-24 -6Z"/></g>`;
  const suitcase = (x: number, y: number, w: number, h: number, col: string) =>
    `<g${sline(c, 2.4)}><rect x="${r0(x - w / 2)}" y="${r0(y - h)}" width="${w}" height="${h}" rx="12" fill="${col}"/><path d="M${r0(x - 18)} ${r0(y - h)} v-18 h36 v18" fill="none" stroke="#3a2a20" stroke-width="7"/><rect x="${r0(x - w / 2)}" y="${r0(y - h * 0.62)}" width="${w}" height="10" fill="${shade(col, -0.3)}"/><circle cx="${r0(x - w * 0.22)}" cy="${r0(y - h * 0.3)}" r="13" fill="#f2e3b3"/><rect x="${r0(x + w * 0.05)}" y="${r0(y - h * 0.42)}" width="${r0(w * 0.3)}" height="20" rx="4" fill="#e2a43b"/></g>`;
  return `<rect width="${W}" height="${H}" fill="url(#sky)"/>${grid}${lands}
  <path d="${route}" fill="none" stroke="${c.theme.accent}" stroke-width="6" stroke-dasharray="4 16" stroke-linecap="round"/>
  ${pin(W * 0.1, H * 0.36)}${pin(W * 0.55, H * 0.2)}${pin(W * 0.86, H * 0.4)}${plane(W * 0.32, H * 0.13)}${compass(r0(W * 0.07), r0(H * 0.1))}
  <rect width="${W}" height="${H}" fill="none" stroke="${ink}" stroke-width="18" opacity=".3"/>
  <path d="M0 ${r0(H * 0.72)} H${W} V${H} H0Z" fill="${c.theme.ground}"/>
  <path d="M0 ${r0(H * 0.72)} H${W}" stroke="#7a5a3a" stroke-width="6"/>
  ${suitcase(W * 0.08, H * 0.92, 150, 120, "#a8463f")}${suitcase(W * 0.16, H * 0.94, 110, 160, "#2f7f7a")}${suitcase(W * 0.92, H * 0.93, 160, 130, "#c9973f")}`;
}

function sceneOffice(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  const s = sline(c, 2);
  const wx = W * 0.2, ww = W * 0.6, wy = H * 0.08, wh = H * 0.5;
  let city = "";
  for (let x = wx; x < wx + ww; ) {
    const w = 50 + r() * 70, h = 90 + r() * 240;
    city += `<rect x="${r0(x)}" y="${r0(wy + wh - h)}" width="${r0(w)}" height="${r0(h)}" fill="${r() > 0.5 ? "#9fb4c4" : "#b7c7d3"}"/>`;
    for (let yy = wy + wh - h + 12; yy < wy + wh - 10; yy += 22) city += `<rect x="${r0(x + 8)}" y="${r0(yy)}" width="${r0(w - 16)}" height="6" fill="#dfe8ee" opacity=".7"/>`;
    x += w + 8;
  }
  let frames = "";
  for (let i = 0; i <= 4; i++) frames += `<rect x="${r0(wx + (ww / 4) * i - 6)}" y="${r0(wy)}" width="12" height="${r0(wh)}" fill="#5b6770"/>`;
  const desk = `<g${s}><rect x="${r0(-20)}" y="${r0(H * 0.62)}" width="${r0(W * 0.2)}" height="24" fill="#8a6a4a"/><rect x="${r0(W * 0.01)}" y="${r0(H * 0.64)}" width="${r0(W * 0.16)}" height="${r0(H * 0.2)}" fill="#7a5c40"/>
    <rect x="${r0(W * 0.02)}" y="${r0(H * 0.48)}" width="${r0(W * 0.1)}" height="${r0(H * 0.12)}" rx="8" fill="#39434d"/><rect x="${r0(W * 0.028)}" y="${r0(H * 0.49)}" width="${r0(W * 0.088)}" height="${r0(H * 0.1)}" fill="#8fc6d6"/><rect x="${r0(W * 0.065)}" y="${r0(H * 0.6)}" width="12" height="${r0(H * 0.02)}" fill="#39434d"/>
    <rect x="${r0(W * 0.13)}" y="${r0(H * 0.585)}" width="70" height="36" fill="#fbfaf5" transform="rotate(-6 ${r0(W * 0.13)} ${r0(H * 0.6)})"/><rect x="${r0(W * 0.132)}" y="${r0(H * 0.575)}" width="70" height="36" fill="#f3f0e6"/>
    <path d="M${r0(W * 0.155)} ${r0(H * 0.56)} q-6 -14 0 -26 M${r0(W * 0.163)} ${r0(H * 0.56)} q6 -14 0 -28" fill="none" stroke="#9aa3a8" stroke-width="3"/></g>
    <rect x="${r0(W * 0.15)}" y="${r0(H * 0.56)}" width="26" height="${r0(H * 0.06)}" rx="5" fill="${c.theme.accent}"${s}/>`;
  let folders = "";
  const cols = ["#d2643b", "#2f7f7a", "#e2a43b", "#5b6770", "#a8463f"];
  for (let i = 0; i < 7; i++) folders += `<rect x="${r0(W * 0.85 + i * 22)}" y="${r0(H * 0.2)}" width="18" height="${r0(H * 0.12)}" fill="${cols[i % 5]}"${s}/>`;
  const plant = `<g${s}><path d="M${r0(W * 0.9)} ${r0(H * 0.8)} q-90 -120 -40 -260 q30 120 40 260z M${r0(W * 0.9)} ${r0(H * 0.8)} q80 -150 20 -300 q-20 160 -20 300z M${r0(W * 0.9)} ${r0(H * 0.8)} q120 -60 110 -190 q-60 90 -110 190z" fill="#4f8a5b"/><path d="M${r0(W * 0.87)} ${r0(H * 0.8)} h${r0(W * 0.06)} l-14 ${r0(H * 0.12)} h-${r0(W * 0.06) - 28}z" fill="#c46a3b"/></g>`;
  const lamps = [0.35, 0.65].map((f) => `<path d="M${r0(W * f)} 0 V${r0(H * 0.05)}" stroke="#39434d" stroke-width="4"/><path d="M${r0(W * f - 50)} ${r0(H * 0.08)} q50 -40 100 0z" fill="#39434d"/>`).join("");
  return `<rect width="${W}" height="${H}" fill="#e6e1d6"/>
  <rect x="${r0(wx)}" y="${r0(wy)}" width="${r0(ww)}" height="${r0(wh)}" fill="url(#sky)"/>${city}${frames}
  <rect x="${r0(wx - 10)}" y="${r0(wy - 10)}" width="${r0(ww + 20)}" height="${r0(wh + 20)}" fill="none" stroke="#5b6770" stroke-width="14"/>
  <rect x="${r0(W * 0.84)}" y="${r0(H * 0.32)}" width="${r0(W * 0.15)}" height="10" fill="#8a6a4a"/>${folders}${lamps}
  <rect x="0" y="${r0(H * 0.7)}" width="${W}" height="${r0(H * 0.3)}" fill="${c.theme.ground}"/>
  <path d="M0 ${r0(H * 0.7)} H${W}" stroke="#7d868c" stroke-width="8"/>${desk}${plant}`;
}

function appleTree(x: number, y: number, k: number, c: DemoSceneCtx) {
  const s = sline(c, 2);
  let apples = "";
  for (let i = 0; i < 9; i++) apples += `<circle cx="${r0(x + (c.rnd() - 0.5) * 170 * k)}" cy="${r0(y - 250 * k + (c.rnd() - 0.5) * 120 * k)}" r="${r0(10 * k)}" fill="#c8402e"/>`;
  return `<g${s}><path d="M${r0(x - 14 * k)} ${y} q6 -100 -4 -150 h${r0(36 * k)} q-10 50 -4 150z" fill="#7a5134"/>
  <circle cx="${r0(x - 60 * k)}" cy="${r0(y - 230 * k)}" r="${r0(80 * k)}" fill="#5f9a4e"/><circle cx="${r0(x + 60 * k)}" cy="${r0(y - 240 * k)}" r="${r0(85 * k)}" fill="#5f9a4e"/><circle cx="${x}" cy="${r0(y - 300 * k)}" r="${r0(95 * k)}" fill="#6dab58"/></g>${apples}`;
}

function sceneDacha(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  const s = sline(c, 2);
  let forest = "";
  for (let x = 0; x < W + 60; x += 70) forest += `<circle cx="${x}" cy="${r0(H * 0.55 + r() * 20)}" r="${r0(50 + r() * 30)}" fill="#7fae7a"/>`;
  const hx = W * 0.02, hy = H * 0.7, hw = W * 0.2;
  let logs = "";
  for (let y = hy - 200; y < hy; y += 22) logs += `<path d="M${r0(hx)} ${r0(y)} H${r0(hx + hw)}" stroke="#7a5134" stroke-width="3"/>`;
  const house = `<g${s}><rect x="${r0(hx)}" y="${r0(hy - 210)}" width="${r0(hw)}" height="210" fill="#b98352"/>${logs}
    <path d="M${r0(hx - 30)} ${r0(hy - 205)} L${r0(hx + hw / 2)} ${r0(hy - 340)} L${r0(hx + hw + 30)} ${r0(hy - 205)}Z" fill="#a8463f"/>
    <rect x="${r0(hx + hw * 0.3)}" y="${r0(hy - 160)}" width="${r0(hw * 0.4)}" height="90" fill="#cfe9f5" stroke="#f7f1e3" stroke-width="8"/>
    <path d="M${r0(hx + hw * 0.5)} ${r0(hy - 160)} v90 M${r0(hx + hw * 0.3)} ${r0(hy - 115)} h${r0(hw * 0.4)}" stroke="#f7f1e3" stroke-width="6"/>
    <path d="M${r0(hx + hw * 0.42)} ${r0(hy - 280)} a26 26 0 0 1 ${r0(hw * 0.16)} 0" fill="#f7f1e3"/></g>`;
  let fence = "";
  for (let x = hx + hw + 20; x < W; x += 38) fence += `<path d="M${r0(x)} ${r0(H * 0.7)} V${r0(H * 0.6)} l12 -14 l12 14 V${r0(H * 0.7)}z" fill="#efe2c4"${sline(c, 1.4)}/>`;
  fence += `<rect x="${r0(hx + hw)}" y="${r0(H * 0.63)}" width="${W}" height="8" fill="#d9c7a0"/>`;
  let beds = "";
  for (const [bx, bw] of [[0, W * 0.24], [W * 0.78, W * 0.24]] as const)
    for (let i = 0; i < 3; i++) {
      const by = H * 0.8 + i * 62;
      beds += `<rect x="${r0(bx)}" y="${r0(by)}" width="${r0(bw)}" height="34" rx="16" fill="#7a5134"/>`;
      for (let x = bx + 20; x < bx + bw - 10; x += 34) beds += `<path d="M${r0(x)} ${r0(by + 8)} q-12 -22 -2 -30 q4 14 2 30 q8 -18 18 -18 q-6 14 -18 18z" fill="#4f8a3b"/>`;
    }
  const tx = W * 0.92, ty = H * 0.72;
  const samovar = `<g${s}><rect x="${r0(tx - 90)}" y="${r0(ty - 10)}" width="180" height="16" fill="#efe2c4"/><path d="M${r0(tx - 70)} ${r0(ty + 6)} v90 M${r0(tx + 70)} ${r0(ty + 6)} v90" stroke="#7a5134" stroke-width="10"/>
    <path d="M${r0(tx - 36)} ${r0(ty - 10)} h72 l-6 -16 q16 -40 -6 -86 h-48 q-22 46 -6 86z" fill="#d9a441"/><rect x="${r0(tx - 10)}" y="${r0(ty - 140)}" width="20" height="40" fill="#b07d2c"/><path d="M${r0(tx + 34)} ${r0(ty - 46)} h22 v12" fill="none" stroke="#b07d2c" stroke-width="6"/>
    <path d="M${r0(tx - 20)} ${r0(ty - 152)} a20 14 0 0 1 40 0z" fill="#b8432f"/></g>`;
  return `<rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${r0(W * 0.62)}" cy="130" r="64" fill="#fff1b8"/>${drawDeco("clouds", W, H * 0.6, r, "#fff", 10)}${forest}
  <rect x="0" y="${r0(H * 0.62)}" width="${W}" height="${r0(H * 0.38)}" fill="${c.theme.ground}"/>
  ${house}${appleTree(r0(W * 0.32), r0(H * 0.66), 0.85, c)}${fence}${appleTree(r0(W * 0.8), r0(H * 0.68), 1, c)}${beds}${samovar}`;
}

function sceneHome(c: DemoSceneCtx) {
  const { W, H } = c;
  const s = sline(c, 2);
  let paper = "";
  for (let x = 30; x < W; x += 80) for (let y = 30; y < H * 0.7; y += 80) paper += `<path d="M${x} ${y - 7}l7 7 -7 7 -7 -7z" fill="${c.theme.accent}" opacity=".22"/>`;
  const wx = W * 0.4, wy = H * 0.1, ww = W * 0.2, wh = H * 0.34;
  const win = `<rect x="${r0(wx)}" y="${r0(wy)}" width="${r0(ww)}" height="${r0(wh)}" fill="#bfe1ef" stroke="#f7f1e3" stroke-width="12"/>
    <path d="M${r0(wx + ww / 2)} ${r0(wy)} v${r0(wh)} M${r0(wx)} ${r0(wy + wh / 2)} h${r0(ww)}" stroke="#f7f1e3" stroke-width="8"/>
    <path d="M${r0(wx - 40)} ${r0(wy - 20)} h${r0(ww * 0.4)} q-20 ${r0(wh * 0.6)} 10 ${r0(wh + 30)} h-${r0(ww * 0.4) + 10}z M${r0(wx + ww + 40)} ${r0(wy - 20)} h-${r0(ww * 0.4)} q20 ${r0(wh * 0.6)} -10 ${r0(wh + 30)} h${r0(ww * 0.4) + 10}z" fill="${c.theme.accent}"${s}/>
    <rect x="${r0(wx - 60)}" y="${r0(wy - 30)}" width="${r0(ww + 120)}" height="14" rx="7" fill="#7a5134"/>
    <rect x="${r0(wx - 20)}" y="${r0(wy + wh)}" width="${r0(ww + 40)}" height="16" fill="#f7f1e3"${s}/>
    <path d="M${r0(wx + 30)} ${r0(wy + wh)} q-6 -40 14 -50 q10 30 -4 50z" fill="#5f9a4e"/><rect x="${r0(wx + 20)}" y="${r0(wy + wh - 20)}" width="36" height="22" fill="#c46a3b"/>`;
  let shelf = "";
  const jars = ["#e2a43b", "#a8463f", "#6f8f6a", "#f2e3b3"];
  for (const [sx, sy] of [[W * 0.06, H * 0.22], [W * 0.06, H * 0.36]] as const) {
    shelf += `<rect x="${r0(sx)}" y="${r0(sy)}" width="${r0(W * 0.22)}" height="12" fill="#7a5134"/>`;
    for (let i = 0; i < 5; i++) {
      const jx = sx + 20 + i * (W * 0.04);
      shelf += i % 2
        ? `<circle cx="${r0(jx + 20)}" cy="${r0(sy - 30)}" r="30" fill="#f7f1e3"${s}/><circle cx="${r0(jx + 20)}" cy="${r0(sy - 30)}" r="16" fill="none" stroke="#2f7f7a" stroke-width="4"/>`
        : `<rect x="${r0(jx)}" y="${r0(sy - 60)}" width="40" height="60" rx="8" fill="${jars[i % 4]}"${s}/><rect x="${r0(jx - 3)}" y="${r0(sy - 66)}" width="46" height="12" rx="3" fill="#f7f1e3"/>`;
    }
  }
  const lampX = W * 0.75;
  const lampG = `<path d="M${r0(lampX)} 0 V${r0(H * 0.12)}" stroke="#4a3a2a" stroke-width="4"/><circle cx="${r0(lampX)}" cy="${r0(H * 0.2)}" r="140" fill="url(#ad-glow)"/><path d="M${r0(lampX - 70)} ${r0(H * 0.19)} q70 -100 140 0z" fill="${c.theme.accent}"${s}/>`;
  let tiles = "";
  for (let y = H * 0.72, row = 0; y < H; y += 48, row++) for (let x = row % 2 ? 0 : 48; x < W; x += 96) tiles += `<rect x="${r0(x)}" y="${r0(y)}" width="48" height="48" fill="#e9dcc2" opacity=".55"/>`;
  const tx = W * 0.88, ty = H * 0.66;
  const table = `<g${s}><path d="M${r0(tx - 170)} ${r0(ty)} h340 l20 70 h-380z" fill="#f7f1e3"/><path d="M${r0(tx - 190)} ${r0(ty + 70)} h380" stroke="${c.theme.accent}" stroke-width="10"/>
    <path d="M${r0(tx - 150)} ${r0(ty + 70)} v100 M${r0(tx + 150)} ${r0(ty + 70)} v100" stroke="#7a5134" stroke-width="14"/>
    <ellipse cx="${r0(tx - 60)}" cy="${r0(ty - 30)}" rx="46" ry="34" fill="#2f7f7a"/><path d="M${r0(tx - 106)} ${r0(ty - 36)} q-26 -6 -30 -24 M${r0(tx - 14)} ${r0(ty - 40)} q20 -10 20 20" fill="none" stroke="#2f7f7a" stroke-width="8"/><circle cx="${r0(tx - 60)}" cy="${r0(ty - 68)}" r="8" fill="#2f7f7a"/>
    <ellipse cx="${r0(tx + 70)}" cy="${r0(ty - 14)}" rx="66" ry="20" fill="#d9a441"/><path d="M${r0(tx + 10)} ${r0(ty - 16)} q60 -46 120 0" fill="#e2b55a"/></g>`;
  const counter = `<g${s}><rect x="0" y="${r0(H * 0.58)}" width="${r0(W * 0.2)}" height="${r0(H * 0.26)}" fill="#c9a46e"/><rect x="0" y="${r0(H * 0.56)}" width="${r0(W * 0.21)}" height="22" fill="#7a5134"/>
    <rect x="${r0(W * 0.02)}" y="${r0(H * 0.64)}" width="${r0(W * 0.07)}" height="${r0(H * 0.16)}" fill="#d9b67f"/><rect x="${r0(W * 0.11)}" y="${r0(H * 0.64)}" width="${r0(W * 0.07)}" height="${r0(H * 0.16)}" fill="#d9b67f"/></g>`;
  return `${glowDef("#ffd98a")}<rect width="${W}" height="${H}" fill="url(#sky)"/>${paper}${win}${shelf}${lampG}
  <rect x="0" y="${r0(H * 0.72)}" width="${W}" height="${r0(H * 0.28)}" fill="${c.theme.ground}"/>${tiles}
  <path d="M0 ${r0(H * 0.72)} H${W}" stroke="#7a5134" stroke-width="10"/>${counter}${table}`;
}

function sceneCelebration(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  const s = sline(c, 2);
  const cols = ["#e2a43b", "#d2643b", "#2f7f7a", "#f2e3b3", c.theme.accent];
  let drapes = "";
  for (let i = 0; i < W; i += 90) drapes += `<path d="M${i} 0 V${r0(H * 0.72)}" stroke="#000" stroke-width="30" opacity=".06"/>`;
  let lights = "";
  for (let row = 0; row < 2; row++) {
    const y0 = 60 + row * 110;
    let d = `M0 ${y0}`;
    const seg = W / 6;
    for (let i = 0; i < 6; i++) d += ` Q${r0(seg * i + seg / 2)} ${y0 + 90} ${r0(seg * (i + 1))} ${y0}`;
    lights += `<path d="${d}" fill="none" stroke="#3a2030" stroke-width="3"/>`;
    for (let i = 0; i < 6; i++)
      for (let t = 0.1; t < 1; t += 0.2) {
        const x = seg * (i + t), y = y0 + 90 * 2 * t * (1 - t) * 1.0;
        lights += `<circle cx="${r0(x)}" cy="${r0(y + 10)}" r="22" fill="url(#ad-glow)"/><circle cx="${r0(x)}" cy="${r0(y + 10)}" r="7" fill="#fff1b8"/>`;
      }
  }
  let flags = "";
  const fy = 300;
  for (let x = 20; x < W; x += 64) flags += `<path d="M${x} ${fy + 20 * Math.sin(x / 140)} l52 0 l-26 50z" fill="${cols[(x / 64) % cols.length | 0]}"/>`;
  flags += `<path d="M0 ${fy} ${Array.from({ length: Math.ceil(W / 64) + 1 }, (_, i) => `L${i * 64 + 20} ${r0(fy + 20 * Math.sin((i * 64 + 20) / 140))}`).join(" ")}" fill="none" stroke="#3a2030" stroke-width="2"/>`;
  const balloons = (bx: number, by: number) => {
    let b = "";
    for (let i = 0; i < 4; i++) {
      const x = bx + (i - 1.5) * 52 + (r() - 0.5) * 20, y = by - (i % 2) * 60 - r() * 30;
      b += `<path d="M${r0(x)} ${r0(y + 52)} q${r0(10 - i * 6)} 120 ${r0((bx - x) * 0.6)} 240" fill="none" stroke="#f7f1e3" stroke-width="2"/><ellipse cx="${r0(x)}" cy="${r0(y)}" rx="40" ry="50" fill="${cols[i % cols.length]}"${s}/><ellipse cx="${r0(x - 12)}" cy="${r0(y - 18)}" rx="8" ry="14" fill="#fff" opacity=".45"/>`;
    }
    return b;
  };
  const tx = W * 0.88, ty = H * 0.68;
  const glass = (x: number) => `<path d="M${r0(x - 14)} ${r0(ty - 60)} h28 l-4 54 h-20z" fill="#f7f1e3" opacity=".8"${s}/><path d="M${r0(x - 12)} ${r0(ty - 40)} h24 l-3 34 h-18z" fill="#f2a33a"/>`;
  const table = `<g${s}><rect x="${r0(tx - 190)}" y="${r0(ty)}" width="380" height="150" fill="#f7f1e3"/><path d="M${r0(tx - 190)} ${r0(ty + 20)} q95 40 190 0 q95 40 190 0" fill="none" stroke="${c.theme.accent}" stroke-width="6"/></g>
    <g${s}><rect x="${r0(tx - 80)}" y="${r0(ty - 70)}" width="160" height="70" rx="10" fill="#f6d6e0"/><rect x="${r0(tx - 55)}" y="${r0(ty - 130)}" width="110" height="60" rx="10" fill="#fbe9ef"/>
    <path d="M${r0(tx - 80)} ${r0(ty - 52)} q20 18 40 0 q20 18 40 0 q20 18 40 0 q20 18 40 0" fill="none" stroke="#c8402e" stroke-width="5"/></g>
    ${[-30, 0, 30].map((d) => `<rect x="${r0(tx + d - 4)}" y="${r0(ty - 164)}" width="8" height="34" fill="#f2e3b3"/><path d="M${r0(tx + d)} ${r0(ty - 182)} q8 10 0 16 q-8 -6 0 -16z" fill="#f2a33a"/>`).join("")}
    ${glass(tx - 140)}${glass(tx + 140)}`;
  let parquet = "";
  for (let y = H * 0.74, row = 0; y < H; y += 30, row++) for (let x = (row % 2) * 60; x < W; x += 120) parquet += `<rect x="${r0(x)}" y="${r0(y)}" width="114" height="26" fill="#000" opacity=".07"/>`;
  return `${glowDef("#fff1b8")}<rect width="${W}" height="${H}" fill="url(#sky)"/>${drapes}${lights}${flags}
  ${balloons(W * 0.08, H * 0.5)}${balloons(W * 0.72, H * 0.42)}
  <rect x="0" y="${r0(H * 0.74)}" width="${W}" height="${r0(H * 0.26)}" fill="${c.theme.ground}"/>${parquet}
  <path d="M0 ${r0(H * 0.74)} H${W}" stroke="#3a2030" stroke-width="6"/>${table}
  ${drawDeco("confetti", W, H, r, c.theme.accent, 40)}`;
}

function sceneStarrySky(c: DemoSceneCtx) {
  const { W, H, rnd: r } = c;
  const s = sline(c, 2);
  let stars = "";
  for (let i = 0; i < 140; i++) stars += `<circle cx="${r0(r() * W)}" cy="${r0(r() * H * 0.8)}" r="${(0.8 + r() * 2.4).toFixed(1)}" fill="#fff6d8" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  for (let i = 0; i < 10; i++) {
    const x = r0(r() * W), y = r0(r() * H * 0.6), k = 1 + r();
    stars += `<path d="M${x} ${r0(y - 12 * k)}L${r0(x + 3 * k)} ${r0(y - 3 * k)} ${r0(x + 12 * k)} ${y} ${r0(x + 3 * k)} ${r0(y + 3 * k)} ${x} ${r0(y + 12 * k)} ${r0(x - 3 * k)} ${r0(y + 3 * k)} ${r0(x - 12 * k)} ${y} ${r0(x - 3 * k)} ${r0(y - 3 * k)}Z" fill="#fff1b8"/>`;
  }
  const R = Math.max(H * 0.95, W * 0.6), cy = H * 0.72 + R;
  let craters = "";
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.1, d = R - 40 - r() * 160;
    craters += `<ellipse cx="${r0(W / 2 + Math.cos(a) * d)}" cy="${r0(cy + Math.sin(a) * d)}" rx="${r0(20 + r() * 40)}" ry="${r0(8 + r() * 12)}" fill="#000" opacity=".14"/>`;
  }
  const onPlanet = (x: number) => r0(cy - Math.sqrt(Math.max(R * R - (x - W / 2) ** 2, 0)));
  const hx = W * (W > H ? 0.2 : 0.1), hy = onPlanet(hx);
  const house = `<g${s} transform="rotate(-${r0(((W / 2 - hx) / R) * 57)} ${r0(hx)} ${hy})"><rect x="${r0(hx - 50)}" y="${hy - 90}" width="100" height="92" fill="#e9d6b0"/><path d="M${r0(hx - 66)} ${hy - 88} L${r0(hx)} ${hy - 150} L${r0(hx + 66)} ${hy - 88}Z" fill="#b8432f"/><rect x="${r0(hx - 16)}" y="${hy - 64}" width="32" height="30" fill="#ffd98a"/></g><circle cx="${r0(hx)}" cy="${hy - 50}" r="70" fill="url(#ad-glow)"/>`;
  const tx = W * (W > H ? 0.8 : 0.9), ty = onPlanet(tx);
  const tree = `<g${s} transform="rotate(${r0(((tx - W / 2) / R) * 57)} ${r0(tx)} ${ty})"><rect x="${r0(tx - 8)}" y="${ty - 90}" width="16" height="92" fill="#6b4a3a"/><circle cx="${r0(tx)}" cy="${ty - 130}" r="60" fill="#3f7a6a"/></g>`;
  return `${glowDef("#ffe7a0")}<rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="${r0(W * 0.5)}" cy="${r0(H * 0.3)}" rx="${r0(W * 0.7)}" ry="90" fill="#8f86d9" opacity=".14" transform="rotate(-12 ${r0(W * 0.5)} ${r0(H * 0.3)})"/>${stars}
  <path d="M${r0(W * 0.22)} 120 a70 70 0 1 0 56 112 a56 56 0 1 1 -56 -112z" fill="#fbe7a6"/>
  <path d="M${r0(W * 0.62)} 90 l-180 70" stroke="#fff6d8" stroke-width="3" stroke-linecap="round" opacity=".8"/><circle cx="${r0(W * 0.62)}" cy="90" r="6" fill="#fff6d8"/>
  <circle cx="${r0(W * 0.8)}" cy="${r0(H * 0.22)}" r="34" fill="#e0a43b"/><ellipse cx="${r0(W * 0.8)}" cy="${r0(H * 0.22)}" rx="60" ry="12" fill="none" stroke="#f2d48a" stroke-width="5" transform="rotate(-18 ${r0(W * 0.8)} ${r0(H * 0.22)})"/>
  <circle cx="${r0(W / 2)}" cy="${r0(cy)}" r="${r0(R)}" fill="${c.theme.ground}"${s}/>${craters}${house}${tree}`;
}

export const ADULT_THEMES: DemoTheme[] = [
  { key: "romance-city", sky: ["#2b2350", "#e88f7a"], ground: "#4a3b4f", accent: "#e8657a", deco: "hearts", scene: sceneRomanceCity },
  { key: "travel-map", sky: ["#d6e6dc", "#c3d9cf"], ground: "#d9c49a", accent: "#c0392b", deco: "clouds", scene: sceneTravelMap },
  { key: "office", sky: ["#cfe3f2", "#eef5f9"], ground: "#a3a9ad", accent: "#e2a43b", deco: "grid", scene: sceneOffice },
  { key: "dacha", sky: ["#8fcbed", "#e4f3f7"], ground: "#8cbf6a", accent: "#c8402e", deco: "clouds", scene: sceneDacha },
  { key: "home", sky: ["#f6e2c4", "#f0d2a8"], ground: "#c9a46e", accent: "#c4553b", deco: "none", scene: sceneHome },
  { key: "celebration", sky: ["#4e2650", "#a0517a"], ground: "#8a5a3c", accent: "#f2a33a", deco: "confetti", scene: sceneCelebration },
  { key: "starry-sky", sky: ["#0b1030", "#2a3274"], ground: "#4e5fa0", accent: "#fbe7a6", deco: "stars", scene: sceneStarrySky },
];

// ---------------------------------------------------------------------------
// Взрослый герой
// ---------------------------------------------------------------------------

const isFemale = (g?: string) => !!g && /^(girl|female|f|w|woman|ж|жен)/i.test(g);

type HairCut = "short" | "long" | "bob" | "curly" | "bun" | "ponytail" | "braid" | "balding" | "shaved";

function hairCut(h: DemoLook, fem: boolean, old: boolean): HairCut {
  const s = (h.hairstyle ?? "").toLowerCase();
  if (/брит|лысый|налысо|без волос/.test(s)) return "shaved";
  if (/лысин|залысин/.test(s)) return "balding";
  if (/пуч|гульк|шишк/.test(s)) return "bun";
  if (/хвост/.test(s)) return "ponytail";
  if (/кос[аиу]|коса|косы|кос$/.test(s)) return "braid";
  if (/кудр|кудряв|афро|волнист|завит/.test(s)) return "curly";
  if (/каре|боб/.test(s)) return "bob";
  if (/длинн|распущ|до плеч/.test(s) || h.longHair) return "long";
  if (/коротк|ёжик|ежик|стрижк/.test(s)) return "short";
  if (fem) return old ? "bun" : "long";
  return "short";
}

/** Стабильное число по внешности: цвет одежды не меняется от разворота к развороту. */
function lookHash(h: DemoLook) {
  const s = `${h.gender}|${h.hair}|${h.hairstyle}|${h.skin}|${h.age}|${h.glasses}|${h.beard}`;
  let x = 7;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 100003;
  return x;
}

export const drawAdult: DemoHeroDrawer = (o) => {
  const h = o.look;
  const fem = isFemale(h.gender);
  const age = h.age ?? 0;
  const old = age >= 60;
  const veryOld = age >= 72;
  const s = stroke(o.style);
  const sThin = stroke(o.style, 2);
  const ink = o.style.palette.ink;
  const defaultHair = age >= 65 ? "седые" : age >= 50 ? "с проседью" : undefined;
  const hc = colorFrom(HAIR_COLORS, h.hair ?? defaultHair, fem ? "#7a4a2a" : "#4a3222");
  const hcDark = shade(hc, -0.25);
  const skin = colorFrom(SKIN_COLORS, h.skin, "#f4d3b8");
  const skinDark = shade(skin, -0.28);
  const accents = o.style.palette.accents.length ? o.style.palette.accents : ["#3e8ed0", "#d9534f"];
  const lh = lookHash(h);
  const outfit = h.outfit && /^#[0-9a-f]{6}$/i.test(h.outfit) ? h.outfit : pick(accents, lh + (fem ? 1 : 0));
  const second = pick(accents.filter((a) => a !== outfit).length ? accents.filter((a) => a !== outfit) : accents, lh + 2);
  const cut = hairCut(h, fem, old);

  const sh = veryOld ? 10 : old ? 5 : 0; // старше — чуть ниже
  const sY = -88 + sh; // линия плеч
  const R = fem ? 27 : 29;
  const hy = -128 + sh * 1.2; // центр головы
  const hipY = 20;
  const sw = fem ? 38 : 44 + (old ? 3 : 0);
  const ww = fem ? 29 : 38 + (old ? 6 : 0);
  const pose = (o.index ?? 0) % 3;
  const parts: string[] = [];

  parts.push(`<ellipse cx="0" cy="190" rx="66" ry="11" fill="rgba(0,0,0,.2)"/>`);

  // Волосы за головой
  if (cut === "long") parts.push(`<path d="M${-R - 5} ${hy - 4} Q${-R - 14} ${hy + R + 44} ${-R + 2} ${hy + R + 56} L${R - 2} ${hy + R + 56} Q${R + 14} ${hy + R + 44} ${R + 5} ${hy - 4} Z" fill="${hc}"${sThin}/>`);
  if (cut === "bob") parts.push(`<path d="M${-R - 6} ${hy - 6} Q${-R - 10} ${hy + R + 4} ${-R + 4} ${hy + R + 8} L${R - 4} ${hy + R + 8} Q${R + 10} ${hy + R + 4} ${R + 6} ${hy - 6} Z" fill="${hc}"${sThin}/>`);
  if (cut === "ponytail") parts.push(`<path d="M${R - 4} ${hy - 16} Q${R + 30} ${hy - 10} ${R + 18} ${hy + 50} Q${R + 10} ${hy + 70} ${R + 2} ${hy + 64} Q${R + 14} ${hy + 20} ${R - 6} ${hy}Z" fill="${hc}"${sThin}/>`);
  if (cut === "bun") parts.push(`<circle cx="0" cy="${hy - R - 4}" r="${fem ? 15 : 12}" fill="${hc}"${sThin}/>`);

  // Ноги и обувь
  if (fem) {
    const leg = old ? "#5e4e4a" : skin;
    parts.push(`<rect x="-20" y="80" width="12" height="104" rx="5" fill="${leg}"${sThin}/><rect x="8" y="80" width="12" height="104" rx="5" fill="${leg}"${sThin}/>`);
    parts.push(`<ellipse cx="-17" cy="186" rx="13" ry="6" fill="${shade(second, -0.45)}"${sThin}/><ellipse cx="17" cy="186" rx="13" ry="6" fill="${shade(second, -0.45)}"${sThin}/>`);
  } else {
    const trousers = shade(ink, 0.25);
    parts.push(`<path d="M${-ww + 4} ${hipY} L-3 ${hipY} L-5 182 L-30 182Z" fill="${trousers}"${s}/><path d="M${ww - 4} ${hipY} L3 ${hipY} L5 182 L30 182Z" fill="${trousers}"${s}/>`);
    parts.push(`<path d="M-34 188 q0 -12 16 -12 h10 v12z M34 188 q0 -12 -16 -12 h-10 v12z" fill="#2a2220"${sThin}/>`);
  }

  // Руки (за телом — рисуем до туловища, если опущены)
  const armW = fem ? 15 : 18;
  const armL = fem ? 100 : 108;
  const sleeve = old && fem ? second : outfit;
  const arm = (side: -1 | 1, angle: number) => {
    const ax = side * (sw - 7), ay = sY + 10;
    const a = (angle * Math.PI) / 180;
    const ex = ax - armL * Math.sin(a), ey = ay + armL * Math.cos(a);
    return `<g transform="rotate(${angle} ${ax} ${ay})"><rect x="${ax - armW / 2}" y="${ay - 4}" width="${armW}" height="${armL}" rx="${armW / 2}" fill="${sleeve}"${s}/></g><circle cx="${r0(ex)}" cy="${r0(ey)}" r="${fem ? 8 : 9}" fill="${skin}"${sThin}/>`;
  };
  const armsBack: string[] = [], armsFront: string[] = [];
  if (pose === 0) { armsBack.push(arm(-1, 9), arm(1, -9)); }
  else if (pose === 1) { armsBack.push(arm(-1, 9)); armsFront.push(arm(1, -148)); }
  else { armsFront.push(arm(-1, -12), arm(1, 12)); }
  parts.push(...armsBack);

  // Туловище
  if (fem) {
    parts.push(`<path d="M${-sw} ${sY + 12} Q${-sw} ${sY} ${-sw + 14} ${sY} L${sw - 14} ${sY} Q${sw} ${sY} ${sw} ${sY + 12} L${ww} -8 L${-ww} -8 Z" fill="${outfit}"${s}/>`);
    parts.push(`<path d="M${-ww} -12 L${ww} -12 L58 96 Q0 108 -58 96 Z" fill="${outfit}"${s}/>`);
    parts.push(`<rect x="${-ww}" y="-14" width="${ww * 2}" height="8" fill="${shade(outfit, -0.3)}"/>`);
    parts.push(`<path d="M-13 ${sY} Q0 ${sY + 20} 13 ${sY}Z" fill="${skin}"/>`);
    if (old) parts.push(`<path d="M${-sw - 4} ${sY + 6} Q0 ${sY - 8} ${sw + 4} ${sY + 6} L${sw - 2} ${sY + 34} Q0 ${sY + 84} ${-sw + 2} ${sY + 34}Z" fill="${second}"${s}/><path d="M${-sw + 6} ${sY + 38} Q0 ${sY + 80} ${sw - 6} ${sY + 38}" fill="none" stroke="${shade(second, -0.3)}" stroke-width="3" stroke-dasharray="6 5"/>`);
  } else {
    parts.push(`<path d="M${-sw} ${sY + 12} Q${-sw} ${sY} ${-sw + 14} ${sY} L${sw - 14} ${sY} Q${sw} ${sY} ${sw} ${sY + 12} L${ww} ${hipY + 8} L${-ww} ${hipY + 8} Z" fill="${outfit}"${s}/>`);
    parts.push(`<path d="M-14 ${sY} L0 ${sY + 40} L14 ${sY}Z" fill="#f4f1ea"/>`);
    parts.push(`<path d="M-14 ${sY} L0 ${sY + 40} L-6 ${sY + 52} L-24 ${sY + 6}Z M14 ${sY} L0 ${sY + 40} L6 ${sY + 52} L24 ${sY + 6}Z" fill="${shade(outfit, -0.22)}"${sThin}/>`);
    parts.push(`<circle cx="0" cy="${sY + 64}" r="3.5" fill="${shade(outfit, -0.45)}"/><circle cx="0" cy="${sY + 86}" r="3.5" fill="${shade(outfit, -0.45)}"/>`);
  }

  // Шея и голова
  parts.push(`<rect x="-8" y="${hy + R - 8}" width="16" height="${sY - hy - R + 12}" fill="${skinDark}"/>`);
  parts.push(`<circle cx="${-R}" cy="${hy + 3}" r="6" fill="${skin}"${sThin}/><circle cx="${R}" cy="${hy + 3}" r="6" fill="${skin}"${sThin}/>`);
  parts.push(`<ellipse cx="0" cy="${hy}" rx="${R}" ry="${R + 3}" fill="${skin}"${s}/>`);

  // Лицо
  const browY = hy - 9;
  parts.push(`<path d="M-16 ${browY} q6 -4 11 -1 M16 ${browY} q-6 -4 -11 -1" stroke="${old ? shade(hc, -0.15) : hcDark}" stroke-width="${fem ? 2.2 : 3}" fill="none" stroke-linecap="round"/>`);
  parts.push(`<ellipse cx="-10" cy="${hy}" rx="3.2" ry="3.8" fill="#2b2523"/><ellipse cx="10" cy="${hy}" rx="3.2" ry="3.8" fill="#2b2523"/>`);
  if (fem) parts.push(`<path d="M-14 ${hy - 3} l-3 -2 M14 ${hy - 3} l3 -2" stroke="#2b2523" stroke-width="1.6"/>`);
  parts.push(`<path d="M1 ${hy + 2} Q4 ${hy + 10} -1 ${hy + 11}" stroke="${skinDark}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  parts.push(`<circle cx="-17" cy="${hy + 10}" r="5" fill="#e88f84" opacity=".35"/><circle cx="17" cy="${hy + 10}" r="5" fill="#e88f84" opacity=".35"/>`);
  if (old) parts.push(`<path d="M-21 ${hy - 3} l-5 -2 M-21 ${hy + 1} l-5 1 M21 ${hy - 3} l5 -2 M21 ${hy + 1} l5 1 M-12 ${hy + 10} q-4 5 -1 10 M12 ${hy + 10} q4 5 1 10 M-8 ${hy - 16} h16" stroke="${skinDark}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);

  // Борода / усы
  const moustache = !h.beard && /ус/.test((h.hairstyle ?? "").toLowerCase());
  const beardCol = cut === "shaved" || cut === "balding" ? (h.hair ? hc : old ? HAIR_COLORS["седые"] : hc) : hc;
  if (h.beard)
    parts.push(`<path d="M${-R + 2} ${hy + 2} Q${-R + 2} ${hy + R + 16} 0 ${hy + R + 20} Q${R - 2} ${hy + R + 16} ${R - 2} ${hy + 2} L${R - 7} ${hy + 6} Q${R - 9} ${hy + 18} 7 ${hy + 15} Q0 ${hy + 12} -7 ${hy + 15} Q${-R + 9} ${hy + 18} ${-R + 7} ${hy + 6} Z" fill="${beardCol}"${sThin}/>`);
  if (h.beard || moustache) parts.push(`<path d="M-12 ${hy + 15} Q0 ${hy + 8} 12 ${hy + 15} Q6 ${hy + 18} 0 ${hy + 15} Q-6 ${hy + 18} -12 ${hy + 15}Z" fill="${shade(beardCol, -0.15)}"/>`);
  parts.push(
    h.beard
      ? `<path d="M-6 ${hy + 20} Q0 ${hy + 24} 6 ${hy + 20}" stroke="#7a2e28" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : `<path d="M-8 ${hy + 17} Q0 ${hy + 23} 8 ${hy + 17}" stroke="${fem ? "#b5504a" : "#8a3b33"}" stroke-width="${fem ? 3.2 : 2.8}" fill="none" stroke-linecap="round"/>`,
  );

  // Волосы сверху
  const top = hy - R - 3;
  switch (cut) {
    case "shaved":
      parts.push(`<path d="M${-R + 4} ${hy - 12} Q0 ${top - 6} ${R - 4} ${hy - 12}" stroke="${hc}" stroke-width="2" opacity=".35" fill="none"/>`);
      break;
    case "balding":
      parts.push(`<path d="M${-R - 2} ${hy + 4} Q${-R - 4} ${hy - 16} ${-R + 8} ${hy - 22} L${-R + 8} ${hy - 6}Z M${R + 2} ${hy + 4} Q${R + 4} ${hy - 16} ${R - 8} ${hy - 22} L${R - 8} ${hy - 6}Z" fill="${hc}"${sThin}/>`);
      parts.push(`<path d="M-8 ${top + 8} q4 -3 8 -1" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>`);
      break;
    case "curly": {
      let c = "";
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * (1.05 + (0.9 * i) / n);
        c += `<circle cx="${r0(Math.cos(a) * (R + 2))}" cy="${r0(hy - 4 + Math.sin(a) * (R + 4))}" r="${fem ? 11 : 9}" fill="${hc}"/>`;
      }
      if (fem) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) c += `<circle cx="${sx * (R + 4)}" cy="${hy + 6 + k * 16}" r="10" fill="${hc}"/>`;
      parts.push(`<g${sThin}>${c}</g>`);
      break;
    }
    case "short":
      parts.push(
        fem
          ? `<path d="M${-R - 3} ${hy + 4} Q${-R - 6} ${top - 10} 2 ${top - 6} Q${R + 6} ${top - 8} ${R + 3} ${hy + 2} Q${R - 2} ${hy - 18} 6 ${top + 12} Q${-R + 2} ${top + 18} ${-R - 3} ${hy + 4}Z" fill="${hc}"${sThin}/>`
          : `<path d="M${-R - 1} ${hy + 2} Q${-R - 3} ${top - 8} 0 ${top - 6} Q${R + 3} ${top - 8} ${R + 1} ${hy + 2} L${R - 3} ${hy - 6} Q${R - 6} ${top + 12} 6 ${top + 10} Q${-R + 6} ${top + 8} ${-R + 3} ${hy - 6} Z" fill="${hc}"${sThin}/>`,
      );
      break;
    default:
      // длинные, каре, пучок, хвост, коса — общая «шапочка» с пробором
      parts.push(`<path d="M${-R - 3} ${hy + 8} Q${-R - 6} ${top - 10} 0 ${top - 8} Q${R + 6} ${top - 10} ${R + 3} ${hy + 8} Q${R - 2} ${hy - 16} 4 ${top + 10} Q${-R + 4} ${top + 14} ${-R - 3} ${hy + 8}Z" fill="${hc}"${sThin}/>`);
  }
  if (cut === "braid") {
    let b = "";
    for (let k = 0; k < 6; k++) b += `<ellipse cx="${R - 2 + (k % 2 ? 2 : -2)}" cy="${hy + R + k * 15}" rx="9" ry="10" fill="${hc}"${sThin}/>`;
    parts.push(b + `<circle cx="${R - 2}" cy="${hy + R + 92}" r="5" fill="${second}"/>`);
  }

  // Очки
  if (h.glasses)
    parts.push(`<g fill="#fff" fill-opacity=".18" stroke="#2b2523" stroke-width="2.6"><rect x="-19" y="${hy - 7}" width="16" height="13" rx="5"/><rect x="3" y="${hy - 7}" width="16" height="13" rx="5"/><path d="M-3 ${hy - 2} h6 M-19 ${hy - 3} l-9 -2 M19 ${hy - 3} l9 -2" fill="none"/></g>`);

  // Руки спереди и предмет (поза 2 — держит книгу)
  parts.push(...armsFront);
  if (pose === 2) {
    const by = sY + armL + 14;
    parts.push(`<g${sThin}><rect x="-17" y="${by - 34}" width="34" height="42" rx="3" fill="${second}"/><rect x="-11" y="${by - 26}" width="22" height="12" rx="2" fill="#f4f1ea"/></g>`);
  }

  return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.scale : o.scale} ${o.scale})">${parts.join("")}</g>`;
};
