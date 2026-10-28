// ВЛАДЕЛЕЦ: агент 5 (художник подростковых книг). Никто другой этот файл не меняет.
//
//  • TEEN_ART_STYLES — стили с owner "teens" в ART_STYLE_OWNERS: graphic-novel, painterly-fantasy,
//    risograph-zine. Взрослая подача: подросток стесняется «детского» вида — в промптах реалистичные
//    подростковые пропорции, лицо с фото узнаваемо, никакого «чиби».
//  • TEEN_THEMES — все ключи с owner "teens" в DEMO_THEME_KEYS, у каждого свой фон (scene):
//    game-world, city-night, orbit, mountains, museum, stage.
//  • drawTeen — подросток 11–17: высокая стройная фигура (голова ≈ 1/5.5 роста), причёска из анкеты,
//    тон кожи, очки, веснушки, худи; поза меняется по номеру разворота, одежда — одна на всю книгу.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, ArtStyleDemo, DemoHeroDrawer, DemoSceneCtx, DemoTheme } from "../types";
import { colorFrom, HAIR_COLORS, pick, SKIN_COLORS, stroke } from "./shared";

// ---------------------------------------------------------------------------
// Стили
// ---------------------------------------------------------------------------

const TEEN_IDENTITY =
  "the main character is a teenager aged 11 to 17 with realistic teen proportions: long legs, slim build, natural head-to-body ratio, mature expressive face; keep the facial features, face shape, skin tone and hairstyle from the reference photo clearly recognizable and consistent";

const TEEN_NEGATIVE =
  "text, letters, words, numbers, captions, speech bubbles, sound effects lettering, watermark, signature, logo, brand names, brand clothing, franchise characters, copyrighted characters, video game characters, chibi, toddler proportions, oversized head, big baby eyes, baby face, cutesy kids cartoon, distorted face, asymmetric eyes, extra fingers, deformed hands, extra limbs, multiple copies of the main character, gore, blood, wounds, weapons aimed at people, horror, sexualized, suggestive pose, revealing clothing, cleavage, kissing, makeup glamour, alcohol, cigarettes";

export const TEEN_ART_STYLES: ArtStyle[] = [
  {
    id: "graphic-novel",
    title: "Графический роман",
    description:
      "Как кадр из взрослого комикса: уверенная чёрная линия, резкие тени, сдержанная палитра с одним ярким цветом и киношные ракурсы. Выглядит круто, а не «по-детски».",
    audiences: ["TEEN", "ADULT"],
    prompt:
      `contemporary graphic novel panel illustration, confident bold black ink contour with varied line weight, flat cel colors with hard-edged spot black shadows, limited muted palette of slate blue, warm grey and off-white with one saturated red accent, subtle halftone dot shading, cinematic composition with dramatic low or high camera angle, strong rim light, crisp clean inking, ${TEEN_IDENTITY}, no lettering`,
    negative: `${TEEN_NEGATIVE}, panel borders, multiple panels, photorealistic, 3d render, soft watercolor, pastel`,
    demo: { palette: { paper: "#f1ece2", ink: "#16161c", accents: ["#cf3a2e", "#2f5f86", "#e9b23c", "#4a4a55"] }, line: "bold", texture: "halftone" },
  },
  {
    id: "painterly-fantasy",
    title: "Цифровое фэнтези",
    description:
      "Живописная цифровая картина: видимые мазки, глубокий свет, туман и сияние, эпичные пейзажи в сумеречных цветах. Как обложка большого приключенческого романа.",
    audiences: ["TEEN"],
    prompt:
      `epic painterly digital fantasy illustration, visible textured brush strokes, rich atmospheric lighting with volumetric light rays and soft glow, deep dusk palette of violet, teal and warm amber, dramatic sky, sense of scale and wonder, detailed environment with depth haze, heroic yet natural pose, ${TEEN_IDENTITY}, painted face rendered with care and subtle realism`,
    negative: `${TEEN_NEGATIVE}, flat vector, thick black outlines, comic style, photorealistic photo, 3d plastic render, oversaturated neon, dark gloomy horror`,
    demo: { palette: { paper: "#ece3d1", ink: "#2a2238", accents: ["#6b4fb5", "#e48a3a", "#2c8f8b", "#c6475e"] }, line: "none", texture: "grain", filter: "soft" },
  },
  {
    id: "risograph-zine",
    title: "Ризограф",
    description:
      "Будто напечатано на ризографе для самиздат-журнала: 2–3 сочных цвета внахлёст, зерно, лёгкий сдвиг слоёв и крупные смелые формы. Дерзко и по-взрослому.",
    audiences: ["TEEN", "ADULT"],
    prompt:
      `risograph print illustration in an indie zine style, only three spot inks: fluorescent pink, bright blue and sunflower yellow overlapping into new colors, visible grain and ink speckle, slight layer misregistration, bold simplified shapes, flat graphic composition, uncoated off-white paper, ${TEEN_IDENTITY}, face drawn with clean simplified but accurate features`,
    negative: `${TEEN_NEGATIVE}, gradients, photorealistic, 3d render, glossy, watercolor, full color painting, more than three colors`,
    demo: { palette: { paper: "#f5f0e6", ink: "#2848c4", accents: ["#ff4d8a", "#ffcf3a", "#2848c4", "#14a38b"] }, line: "thin", texture: "grain", filter: "posterize" },
  },
];

// ---------------------------------------------------------------------------
// Цветовые помощники
// ---------------------------------------------------------------------------

const HEX6 = /^#[0-9a-f]{6}$/i;
function mix(a: string, b: string, t: number) {
  if (!HEX6.test(a) || !HEX6.test(b)) return a;
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const dark = (c: string, k = 0.3) => mix(c, "#000000", k);
const light = (c: string, k = 0.3) => mix(c, "#ffffff", k);

/** Толщина контура как в stroke() (база 3). */
const lineW = (s: ArtStyleDemo, base = 3) => ({ thin: base * 0.6, bold: base * 1.6, sketch: base, none: 0 })[s.line];

// ---------------------------------------------------------------------------
// Темы (свои фоны)
// ---------------------------------------------------------------------------

const f = (n: number) => n.toFixed(0);
const sk = (ctx: DemoSceneCtx) => stroke(ctx.style, 2);
const sky = (W: number, H: number) => `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;

/** Мир-игра: пиксельные облака, парящие платформы из блоков, монетки, земля из блоков. */
function gameWorld(ctx: DemoSceneCtx) {
  const { W, H, rnd: r, index } = ctx;
  const B = 48;
  let o = sky(W, H);
  // пиксельное солнце
  o += `<rect x="${W - 260}" y="90" width="${B * 3}" height="${B * 3}" fill="#ffe27a"/><rect x="${W - 260 - 24}" y="${90 + 24}" width="${B * 3 + 48}" height="${B * 3 - 48}" fill="#ffe27a"/>`;
  // облака из квадратов
  for (let i = 0; i < Math.round(W / 420); i++) {
    const x = Math.round((r() * W) / B) * B;
    const y = 80 + Math.round((r() * 200) / B) * B;
    o += `<g fill="#ffffff" opacity=".92"><rect x="${x}" y="${y}" width="${B * 4}" height="${B}"/><rect x="${x + B}" y="${y - B}" width="${B * 2}" height="${B}"/><rect x="${x - B / 2}" y="${y + B}" width="${B * 5}" height="${B / 2}"/></g>`;
  }
  // далёкие пиксельные холмы
  for (let x = 0; x < W; x += B) {
    const h = 3 + Math.round(2 * Math.sin(x / 260 + index) + r());
    o += `<rect x="${x}" y="${H * 0.78 - h * B}" width="${B}" height="${h * B}" fill="#5fae7a" opacity=".55"/>`;
  }
  // парящие платформы
  const block = (x: number, y: number, top: boolean) =>
    `<rect x="${x}" y="${y}" width="${B}" height="${B}" fill="${top ? "#8a5a34" : "#a8693c"}"${sk(ctx)}/>` +
    (top ? `<rect x="${x}" y="${y}" width="${B}" height="${B / 3}" fill="#5cc35a"/>` : `<path d="M${x} ${y + B / 2}h${B}M${x + B / 2} ${y}v${B / 2}M${x + B / 4} ${y + B / 2}v${B / 2}" stroke="#7a4626" stroke-width="3"/>`);
  const plats = Math.max(2, Math.round(W / 700));
  for (let i = 0; i < plats; i++) {
    const n = 3 + Math.floor(r() * 3);
    const x = Math.round(((i + 0.15 + r() * 0.5) * W) / plats / B) * B;
    const y = 300 + Math.round((r() * 160) / B) * B;
    for (let k = 0; k < n; k++) o += block(x + k * B, y, true);
    // монетки над платформой
    for (let k = 0; k < n - 1; k++) o += `<rect x="${x + k * B + B * 0.7}" y="${y - B * 1.3}" width="${B * 0.5}" height="${B * 0.7}" rx="4" fill="${ctx.theme.accent}" stroke="#b57a10" stroke-width="3"/>`;
  }
  // блок-сюрприз
  o += `<rect x="${Math.round((W * 0.12) / B) * B}" y="${B * 9}" width="${B}" height="${B}" fill="#f2b632"${sk(ctx)}/><rect x="${Math.round((W * 0.12) / B) * B + 18}" y="${B * 9 + 12}" width="12" height="24" fill="#fff6c9"/>`;
  // земля из блоков
  const gy = Math.round((H * 0.84) / B) * B;
  for (let x = 0; x < W; x += B) {
    o += block(x, gy, true);
    for (let y = gy + B; y < H; y += B) o += block(x, y, false);
  }
  return o;
}

/** Ночной город: силуэты домов с окнами, луна, крыша на переднем плане с гирляндой. */
function cityNight(ctx: DemoSceneCtx) {
  const { W, H, rnd: r } = ctx;
  let o = sky(W, H);
  for (let i = 0; i < 40; i++) o += `<circle cx="${f(r() * W)}" cy="${f(r() * H * 0.4)}" r="${(1 + r() * 1.8).toFixed(1)}" fill="#fff" opacity=".7"/>`;
  o += `<circle cx="${W * 0.82}" cy="170" r="64" fill="#f7efcf"/><circle cx="${W * 0.82}" cy="170" r="110" fill="#f7efcf" opacity=".12"/>`;
  // два слоя домов
  for (const [layer, col, base, hMax] of [
    [0, "#2a2f5a", H * 0.7, 360],
    [1, "#1b1e3d", H * 0.76, 300],
  ] as const) {
    let x = -20;
    while (x < W) {
      const w = 90 + r() * 140;
      const h = 140 + r() * hMax;
      o += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h + 40)}" fill="${col}"/>`;
      if (r() > 0.6) o += `<rect x="${f(x + w / 2 - 3)}" y="${f(base - h - 50)}" width="6" height="50" fill="${col}"/><circle cx="${f(x + w / 2)}" cy="${f(base - h - 52)}" r="5" fill="#ff5a6e"/>`;
      for (let wy = base - h + 22; wy < base - 10; wy += 34)
        for (let wx = x + 14; wx < x + w - 20; wx += 28)
          if (r() > (layer ? 0.55 : 0.68)) o += `<rect x="${f(wx)}" y="${f(wy)}" width="14" height="18" fill="${r() > 0.85 ? "#8fe3ff" : "#ffd772"}" opacity="${layer ? 0.95 : 0.6}"/>`;
      x += w + 6;
    }
  }
  // крыша
  const ry = H * 0.82;
  o += `<rect x="0" y="${ry}" width="${W}" height="${H - ry}" fill="#3a3550"${sk(ctx)}/><rect x="0" y="${ry - 18}" width="${W}" height="22" fill="#4b4566"${sk(ctx)}/>`;
  o += `<g transform="translate(${W * 0.1} ${ry - 18})"><rect x="0" y="-150" width="110" height="150" rx="10" fill="#5a516e"${sk(ctx)}/><path d="M-6 -150 Q55 -190 116 -150Z" fill="#665c7d"${sk(ctx)}/></g>`;
  o += `<path d="M${W * 0.93} ${ry - 18}v-200m0 30h-40m40 40h-30" stroke="#5a516e" stroke-width="7" fill="none"/>`;
  // гирлянда
  let gar = `<path d="M0 ${H * 0.5} Q${W / 2} ${H * 0.62} ${W} ${H * 0.48}" stroke="#2a2438" stroke-width="3" fill="none"/>`;
  for (let i = 1; i < 18; i++) {
    const t = i / 18;
    const x = t * W;
    const y = (1 - t) * (1 - t) * H * 0.5 + 2 * (1 - t) * t * H * 0.62 + t * t * H * 0.48;
    gar += `<circle cx="${f(x)}" cy="${f(y + 8)}" r="7" fill="${pick(["#ffd772", ctx.theme.accent, "#8fe3ff"], i)}"/><circle cx="${f(x)}" cy="${f(y + 8)}" r="16" fill="#ffd772" opacity=".18"/>`;
  }
  return o + gar;
}

/** Орбитальная станция: панели, иллюминатор с Землёй, огоньки приборов, пол-решётка. */
function orbit(ctx: DemoSceneCtx) {
  const { W, H, rnd: r, index } = ctx;
  let o = `<rect width="${W}" height="${H}" fill="#2b3442"/>`;
  // панели стен
  for (let x = 0; x < W; x += 256) {
    o += `<rect x="${x + 8}" y="40" width="240" height="${H * 0.78 - 60}" rx="18" fill="#3a4659"${sk(ctx)}/>`;
    for (let k = 0; k < 4; k++) o += `<circle cx="${x + 30 + k * 60}" cy="${H * 0.7}" r="6" fill="${pick(["#5df2c6", "#ff6b6b", "#ffd166", "#6bc6ff"], k + x / 256 + index)}"/>`;
    o += `<rect x="${x + 30}" y="${H * 0.56}" width="190" height="40" rx="6" fill="#222a36"/><path d="M${x + 40} ${H * 0.58 + 10}h${50 + r() * 100}" stroke="#5df2c6" stroke-width="4"/>`;
  }
  // иллюминатор
  const cx = (index % 2 === 1 ? 0.26 : 0.74) * W;
  const cy = H * 0.36;
  const R = Math.min(W, H) * 0.27;
  const clip = `teen-orbit-${index}-${W}`;
  o += `<clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`;
  o += `<circle cx="${cx}" cy="${cy}" r="${R + 34}" fill="#596779"${sk(ctx)}/><g clip-path="url(#${clip})"><circle cx="${cx}" cy="${cy}" r="${R}" fill="#05081a"/>`;
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * R * 0.95;
    o += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="#fff"/>`;
  }
  const ex = cx - R * 0.25;
  const ey = cy + R * 0.55;
  const er = R * 0.8;
  o += `<circle cx="${ex}" cy="${ey}" r="${er + 10}" fill="#7fd0ff" opacity=".35"/><circle cx="${ex}" cy="${ey}" r="${er}" fill="#2a6fd6"/>`;
  o += `<path d="M${ex - er * 0.6} ${ey - er * 0.5} q${er * 0.3} ${-er * 0.2} ${er * 0.5} ${er * 0.05} t${er * 0.2} ${er * 0.4} q${-er * 0.4} ${er * 0.2} ${-er * 0.6} ${-er * 0.1}z M${ex + er * 0.2} ${ey - er * 0.8} q${er * 0.4} ${er * 0.1} ${er * 0.5} ${er * 0.5} q${-er * 0.3} ${er * 0.1} ${-er * 0.4} ${-er * 0.2}z" fill="#4fae6a"/>`;
  o += `<path d="M${ex - er * 0.9} ${ey - er * 0.1} q${er * 0.5} ${-er * 0.15} ${er * 1.2} 0" stroke="#fff" stroke-width="10" opacity=".7" fill="none" stroke-linecap="round"/>`;
  o += `</g>`;
  // рама иллюминатора поверх Земли
  o += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#8796aa" stroke-width="14"/>`;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    o += `<circle cx="${f(cx + Math.cos(a) * (R + 18))}" cy="${f(cy + Math.sin(a) * (R + 18))}" r="6" fill="#3a4659"/>`;
  }
  o += `<path d="M${cx - R * 0.6} ${cy - R * 0.5} q${R * 0.3} ${-R * 0.3} ${R * 0.7} ${-R * 0.35}" stroke="#fff" stroke-width="8" opacity=".25" fill="none" stroke-linecap="round"/>`;
  // поручень и пол
  o += `<path d="M0 ${H * 0.52}H${W}" stroke="#ffd166" stroke-width="10" opacity=".8"/>`;
  const fy = H * 0.8;
  o += `<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="#1e2530"${sk(ctx)}/>`;
  for (let x = 0; x < W; x += 40) o += `<path d="M${x} ${fy}l${(x - W / 2) * 0.25} ${H - fy}" stroke="#36404f" stroke-width="3"/>`;
  o += `<path d="M0 ${fy + 40}H${W}M0 ${fy + 100}H${W}" stroke="#36404f" stroke-width="3"/>`;
  // парящий предмет
  o += `<g transform="translate(${W * (index % 2 ? 0.86 : 0.14)} ${H * 0.25}) rotate(${f(r() * 60 - 30)})"><rect x="-26" y="-18" width="52" height="36" rx="6" fill="${ctx.theme.accent}"${sk(ctx)}/><rect x="-16" y="-8" width="32" height="6" fill="#fff" opacity=".6"/></g>`;
  return o;
}

/** Горы: слои хребтов в рассветной дымке, снег, ели, тропа пунктиром с крестиком клада и флажком. */
function mountains(ctx: DemoSceneCtx) {
  const { W, H, rnd: r, index } = ctx;
  let o = sky(W, H);
  o += `<circle cx="${W * (index % 2 ? 0.2 : 0.78)}" cy="${H * 0.3}" r="80" fill="#ffe2a8" opacity=".9"/><circle cx="${W * (index % 2 ? 0.2 : 0.78)}" cy="${H * 0.3}" r="130" fill="#ffe2a8" opacity=".25"/>`;
  const ranges: [string, number, number][] = [
    ["#9a8fb8", H * 0.5, 260],
    ["#6d6a9c", H * 0.6, 220],
    ["#47507a", H * 0.7, 160],
  ];
  ranges.forEach(([col, base, amp], li) => {
    let d = `M0 ${H}V${f(base)}`;
    let caps = "";
    let flag: P | null = null;
    let x = 0;
    while (x < W) {
      const w = 160 + r() * 220;
      const peak = base - amp * (0.5 + r() * 0.6);
      const px = x + w / 2;
      d += `L${f(px)} ${f(peak)}L${f(x + w)} ${f(base - r() * 40)}`;
      // снежная шапка повторяет склоны: на 60px ниже вершины ширина ≈ w/2 * 60/(peak-depth)
      const dy = 56;
      const half = ((w / 2) * dy) / Math.max(60, base - peak);
      if (li < 2) caps += `<path d="M${f(px - half)} ${f(peak + dy)}L${f(px)} ${f(peak)}L${f(px + half)} ${f(peak + dy)}L${f(px + half * 0.3)} ${f(peak + dy - 14)}L${f(px - half * 0.2)} ${f(peak + dy + 6)}Z" fill="#f4f1fb" opacity="${li ? 0.7 : 1}"/>`;
      if (li === 0 && (!flag || Math.abs(px - W * 0.62) < Math.abs(flag[0] - W * 0.62))) flag = [px, peak];
      x += w;
    }
    o += `<path d="${d}V${H}Z" fill="${col}"${li === 2 ? sk(ctx) : ""}/>${caps}`;
    if (flag) o += `<path d="M${f(flag[0])} ${f(flag[1] + 2)}v-60l40 14-40 14" fill="${ctx.theme.accent}" stroke="#3a2c4a" stroke-width="3"/>`;
  });
  // передний план: луг и тропа
  const gy = H * 0.8;
  o += `<path d="M0 ${gy} Q${W * 0.4} ${gy - 40} ${W} ${gy + 10} V${H} H0Z" fill="#3f6b4f"${sk(ctx)}/>`;
  o += `<path d="M${W * 0.08} ${H} C${W * 0.25} ${H * 0.86} ${W * 0.6} ${H * 0.9} ${W * 0.72} ${H * 0.66} S${W * 0.8} ${H * 0.5} ${W * 0.66} ${H * 0.44}" stroke="#f6e7b8" stroke-width="8" stroke-dasharray="22 16" fill="none" stroke-linecap="round" opacity=".9"/>`;
  o += `<path d="M${W * 0.66 - 20} ${H * 0.44 - 20}l40 40m0 -40l-40 40" stroke="${ctx.theme.accent}" stroke-width="10" stroke-linecap="round"/>`;
  // ели
  for (let i = 0; i < Math.round(W / 220); i++) {
    const x = r() * W;
    if (Math.abs(x - W * 0.5) < W * 0.18) continue;
    const s = 0.7 + r() * 0.7;
    const y = gy - 10 + r() * 60;
    o += `<path d="M${f(x)} ${f(y - 170 * s)}L${f(x + 50 * s)} ${f(y - 60 * s)}H${f(x + 20 * s)}L${f(x + 62 * s)} ${f(y)}H${f(x - 62 * s)}L${f(x - 20 * s)} ${f(y - 60 * s)}H${f(x - 50 * s)}Z" fill="#244a3a"${sk(ctx)}/>`;
  }
  return o;
}

/** Музей ночью: колонны, рамы с абстракциями, витрины с артефактами, луч фонарика, шахматный пол. */
function museum(ctx: DemoSceneCtx) {
  const { W, H, rnd: r, index } = ctx;
  let o = sky(W, H);
  const fy = H * 0.76;
  // окна с лунным светом
  o += `<rect x="${W * 0.44}" y="60" width="${W * 0.12}" height="${H * 0.36}" rx="${W * 0.06}" fill="#3b4d7a"/><path d="M${W * 0.5} 60V${60 + H * 0.36}M${W * 0.44} ${60 + H * 0.2}H${W * 0.56}" stroke="#1a1f33" stroke-width="8"/>`;
  o += `<path d="M${W * 0.44} ${60 + H * 0.36}L${W * 0.36} ${fy}H${W * 0.66}L${W * 0.56} ${60 + H * 0.36}Z" fill="#9fb6ff" opacity=".1"/>`;
  // колонны
  for (const cx of [0.06, 0.32, 0.68, 0.94]) {
    const x = cx * W;
    o += `<rect x="${x - 34}" y="40" width="68" height="${fy - 40}" fill="#3e3a52"${sk(ctx)}/><rect x="${x - 46}" y="30" width="92" height="26" fill="#4a4562"${sk(ctx)}/><rect x="${x - 46}" y="${fy - 26}" width="92" height="26" fill="#4a4562"${sk(ctx)}/>`;
    for (let k = -20; k <= 20; k += 20) o += `<path d="M${x + k} 60V${fy - 30}" stroke="#2c293d" stroke-width="4"/>`;
  }
  // картины без надписей
  const frames = [0.19, 0.81];
  frames.forEach((cx, i) => {
    const x = cx * W - 90;
    const y = 150;
    const c = pick(["#c8553d", "#2f8f8b", "#e9b23c", "#6b4fb5"], i + index);
    o += `<rect x="${x - 14}" y="${y - 14}" width="208" height="248" fill="#b9902f"${sk(ctx)}/><rect x="${x}" y="${y}" width="180" height="220" fill="#1f2033"/>`;
    o += i % 2 ? `<circle cx="${x + 90}" cy="${y + 90}" r="50" fill="${c}" opacity=".8"/><path d="M${x} ${y + 170}L${x + 70} ${y + 120}L${x + 180} ${y + 190}V${y + 220}H${x}Z" fill="#3d5a6c"/>` : `<rect x="${x + 30}" y="${y + 40}" width="70" height="120" fill="${c}" opacity=".8"/><circle cx="${x + 120}" cy="${y + 140}" r="34" fill="#e8d9b5" opacity=".7"/>`;
  });
  // пол шахматкой
  o += `<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="#2b2838"/>`;
  const rows = 5;
  for (let j = 0; j < rows; j++) {
    const y0 = fy + ((H - fy) * j) / rows;
    const y1 = fy + ((H - fy) * (j + 1)) / rows;
    for (let i = -6; i < 30; i++) {
      if ((i + j) % 2) continue;
      const k0 = 1 + j * 0.25;
      const k1 = 1 + (j + 1) * 0.25;
      const t0 = W / 2 + (i * 120 - W / 2) * k0;
      const t1 = W / 2 + ((i + 1) * 120 - W / 2) * k0;
      const b0 = W / 2 + (i * 120 - W / 2) * k1;
      const b1 = W / 2 + ((i + 1) * 120 - W / 2) * k1;
      o += `<path d="M${f(t0)} ${f(y0)}L${f(t1)} ${f(y0)}L${f(b1)} ${f(y1)}L${f(b0)} ${f(y1)}Z" fill="#3b374d"/>`;
    }
  }
  // витрины
  const cases = W > 1500 ? [0.12, 0.88] : [0.14];
  cases.forEach((cx, i) => {
    const x = cx * W;
    const y = fy + 40;
    o += `<rect x="${x - 70}" y="${y - 70}" width="140" height="80" fill="#4a4562"${sk(ctx)}/>`;
    o += `<rect x="${x - 64}" y="${y - 220}" width="128" height="150" fill="#bfe6ff" opacity=".18"${sk(ctx)}/>`;
    o += i % 2
      ? `<path d="M${x} ${y - 180}L${x + 28} ${y - 130}L${x} ${y - 90}L${x - 28} ${y - 130}Z" fill="${ctx.theme.accent}"/><path d="M${x - 14} ${y - 150}L${x} ${y - 180}L${x + 4} ${y - 130}Z" fill="#fff" opacity=".6"/>`
      : `<path d="M${x - 24} ${y - 90}Q${x - 40} ${y - 140} ${x - 14} ${y - 160}V${y - 178}H${x + 14}V${y - 160}Q${x + 40} ${y - 140} ${x + 24} ${y - 90}Z" fill="#c8553d"${sk(ctx)}/><path d="M${x - 28} ${y - 130}H${x + 28}" stroke="#e9b23c" stroke-width="6"/>`;
    o += `<path d="M${x - 50} ${y - 210}l24 0" stroke="#fff" stroke-width="5" opacity=".5"/>`;
  });
  // луч фонарика
  const bx = W * (index % 2 ? 0.25 : 0.75);
  o += `<path d="M${W * 0.5} ${H * 0.55}L${bx - 160} ${H * 0.2}A170 120 0 0 1 ${bx + 160} ${H * 0.28}Z" fill="#fff4c2" opacity=".14"/>`;
  o += `<g fill="#fff4c2" opacity=".5">${Array.from({ length: 10 }, () => `<circle cx="${f(bx + (r() - 0.5) * 260)}" cy="${f(H * 0.25 + r() * 120)}" r="2"/>`).join("")}</g>`;
  return o;
}

/** Сцена: занавес, лучи прожекторов, доски сцены, усилители, микрофон, силуэты зала внизу. */
function stage(ctx: DemoSceneCtx) {
  const { W, H, rnd: r, index } = ctx;
  let o = sky(W, H);
  const fy = H * 0.8;
  // лучи
  const cols = ["#ff4d8a", "#6bc6ff", "#ffd166", "#9b6bff", ctx.theme.accent];
  const n = Math.max(3, Math.round(W / 400));
  for (let i = 0; i < n; i++) {
    const sx = ((i + 0.5) / n) * W;
    const tx = W / 2 + (sx - W / 2) * 0.3 + (r() - 0.5) * 200;
    const c = pick(cols, i + index);
    o += `<path d="M${f(sx - 14)} 0L${f(tx - 170)} ${f(fy)}H${f(tx + 170)}L${f(sx + 14)} 0Z" fill="${c}" opacity=".22"/><ellipse cx="${f(tx)}" cy="${f(fy + 30)}" rx="180" ry="30" fill="${c}" opacity=".25"/>`;
    o += `<rect x="${f(sx - 26)}" y="0" width="52" height="34" rx="8" fill="#1a1a22"/><circle cx="${f(sx)}" cy="30" r="14" fill="${c}"/>`;
  }
  // ферма
  o += `<rect x="0" y="0" width="${W}" height="22" fill="#2a2a34"/><path d="${Array.from({ length: Math.ceil(W / 40) }, (_, i) => `M${i * 40} 0l20 22l20 -22`).join("")}" stroke="#4a4a58" stroke-width="3" fill="none"/>`;
  // занавес
  const curtain = (x0: number, dir: number) => {
    let s = "";
    for (let k = 0; k < 4; k++) s += `<path d="M${x0 + dir * k * 40} 0Q${x0 + dir * (k * 40 + 30)} ${H * 0.4} ${x0 + dir * (k * 40 + 10)} ${fy}H${x0 + dir * (k * 40 + 40)}Q${x0 + dir * (k * 40 + 60)} ${H * 0.4} ${x0 + dir * (k * 40 + 40)} 0Z" fill="${k % 2 ? "#8e1f34" : "#a8283f"}"${sk(ctx)}/>`;
    return s;
  };
  o += curtain(0, 1) + curtain(W, -1);
  // сцена
  o += `<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="#3a2a24"${sk(ctx)}/>`;
  for (let x = 0; x < W; x += 110) o += `<path d="M${x} ${fy}V${H}" stroke="#2a1d18" stroke-width="3"/>`;
  o += `<rect x="0" y="${fy}" width="${W}" height="8" fill="#5a4034"/>`;
  // усилители
  const amp = (x: number) => `<g transform="translate(${x} ${fy})"><rect x="-70" y="-150" width="140" height="150" rx="8" fill="#1d1d24"${sk(ctx)}/><circle cx="0" cy="-95" r="42" fill="#2e2e38"/><circle cx="0" cy="-95" r="16" fill="#3e3e4a"/><circle cx="0" cy="-30" r="20" fill="#2e2e38"/></g>`;
  o += amp(W * 0.1) + amp(W * 0.9);
  // микрофон
  const mx = W * (index % 2 ? 0.3 : 0.7);
  o += `<path d="M${mx} ${fy}V${fy - 210}" stroke="#bfbfc8" stroke-width="6"/><path d="M${mx - 40} ${fy}L${mx} ${fy - 20}L${mx + 40} ${fy}" stroke="#bfbfc8" stroke-width="6" fill="none"/><rect x="${mx - 9}" y="${fy - 250}" width="18" height="44" rx="9" fill="#2a2a30"${sk(ctx)}/>`;
  // искры над сценой
  for (let i = 0; i < 18; i++) o += `<circle cx="${f(r() * W)}" cy="${f(60 + r() * H * 0.45)}" r="${(2 + r() * 3).toFixed(1)}" fill="${pick(cols, i)}" opacity=".7"/>`;
  // силуэты зала
  let crowd = "";
  for (let x = -20; x < W + 40; x += 46 + r() * 20) {
    const y = H - 30 - r() * 30;
    crowd += `<circle cx="${f(x)}" cy="${f(y)}" r="24"/><rect x="${f(x - 30)}" y="${f(y + 16)}" width="60" height="60" rx="24"/>`;
    if (r() > 0.8) crowd += `<path d="M${f(x + 18)} ${f(y)}l20 -70" stroke="#0c0b12" stroke-width="12" stroke-linecap="round"/>`;
  }
  return o + `<g fill="#0c0b12">${crowd}</g>`;
}

export const TEEN_THEMES: DemoTheme[] = [
  { key: "game-world", sky: ["#5ec8f2", "#c4f1ff"], ground: "#5cc35a", accent: "#ffcc2e", deco: "grid", scene: gameWorld },
  { key: "city-night", sky: ["#0f1230", "#4a2d6b"], ground: "#3a3550", accent: "#ff7a59", deco: "stars", scene: cityNight },
  { key: "orbit", sky: ["#05081a", "#1a2342"], ground: "#1e2530", accent: "#ff8a3d", deco: "stars", scene: orbit },
  { key: "mountains", sky: ["#f7b98a", "#8fc4d4"], ground: "#3f6b4f", accent: "#e8433a", deco: "clouds", scene: mountains },
  { key: "museum", sky: ["#141625", "#272a40"], ground: "#2b2838", accent: "#5df2c6", deco: "none", scene: museum },
  { key: "stage", sky: ["#0d0a18", "#2a1640"], ground: "#3a2a24", accent: "#5dff9b", deco: "sparkles", scene: stage },
];

// ---------------------------------------------------------------------------
// Подросток
// ---------------------------------------------------------------------------

type HairCut = "short" | "messy" | "buzz" | "curly" | "long" | "bob" | "ponytail" | "braids" | "bun" | "locs";

/** Причёска из свободного текста анкеты; без текста — по полу и longHair. */
function hairCut(style: string | undefined, gender: string | undefined, longHair: boolean | undefined): HairCut {
  const t = (style ?? "").toLowerCase();
  if (/лыс|под ноль|бритый|бритая|ёжик|ежик|машинк/.test(t)) return "buzz";
  if (/дред|афрокос|locs/.test(t)) return "locs";
  if (/кос/.test(t)) return "braids";
  if (/хвост/.test(t)) return "ponytail";
  if (/пуч|гульк/.test(t)) return "bun";
  if (/кудр|кудряв|афро|завит|волнист/.test(t)) return "curly";
  if (/каре|боб|до плеч/.test(t)) return "bob";
  if (/длинн|распущ/.test(t)) return "long";
  if (/лохмат|растр|торч|ирокез|андеркат|челк|чёлк/.test(t)) return "messy";
  if (/коротк/.test(t)) return "short";
  if (longHair === true) return "long";
  if (longHair === false) return "messy";
  return gender === "girl" ? "long" : "messy";
}

type P = [number, number];
const pts = (ps: P[]) => ps.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");

/** Конечность — толстая линия с контуром в цвете туши (если у стиля есть линия). */
function limb(ps: P[], color: string, width: number, s: ArtStyleDemo) {
  const lw = lineW(s, 2.5);
  const d = pts(ps);
  const under = lw ? `<path d="${d}" fill="none" stroke="${s.palette.ink}" stroke-width="${(width + lw * 2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
  return `${under}<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

interface Pose {
  armL: P[];
  armR: P[];
  legL: P[];
  legR: P[];
  pocket: boolean;
  smile: "soft" | "grin" | "smirk";
  tilt: number;
  item?: "phone" | "torch";
}

// Опоры: плечи (±36,-72), бёдра (±14,40), стопы ≈ y 182. Голова — центр (0,-125).
const POSES: Pose[] = [
  // руки в карманах худи — уверенно (обложка)
  { armL: [[-36, -72], [-48, -24], [-18, 14]], armR: [[36, -72], [48, -24], [18, 14]], legL: [[-14, 40], [-16, 110], [-20, 180]], legR: [[14, 40], [16, 110], [22, 180]], pocket: true, smile: "smirk", tilt: 0 },
  // машет рукой
  { armL: [[-36, -72], [-46, -20], [-46, 30]], armR: [[36, -72], [70, -110], [78, -160]], legL: [[-14, 40], [-18, 110], [-24, 180]], legR: [[14, 40], [18, 110], [24, 180]], pocket: false, smile: "grin", tilt: -4 },
  // шаг вперёд, руки в движении
  { armL: [[-36, -72], [-58, -28], [-70, 18]], armR: [[36, -72], [46, -22], [30, 22]], legL: [[-14, 40], [-38, 108], [-52, 178]], legR: [[14, 40], [26, 112], [40, 182]], pocket: false, smile: "soft", tilt: 3 },
  // держит фонарик / телефон
  { armL: [[-36, -72], [-46, -20], [-44, 30]], armR: [[36, -72], [56, -30], [64, -60]], legL: [[-14, 40], [-16, 110], [-22, 180]], legR: [[14, 40], [20, 110], [28, 180]], pocket: false, smile: "soft", tilt: 2, item: "torch" },
  // рука у подбородка — задумался
  { armL: [[-36, -72], [-46, -20], [-46, 30]], armR: [[36, -72], [40, -30], [12, -88]], legL: [[-14, 40], [-12, 110], [-6, 180]], legR: [[14, 40], [22, 110], [30, 180]], pocket: false, smile: "smirk", tilt: -3 },
];

/** Подросток 11–17 лет: высокая стройная фигура, взрослое лицо, худи и джинсы. */
export const drawTeen: DemoHeroDrawer = (o) => {
  const h = o.look;
  const st = o.style;
  const s = stroke(st, 2.5);
  const ink = st.palette.ink;
  const idx = o.index ?? 0;
  const pose = idx === 0 ? POSES[0] : POSES[1 + ((idx - 1) % (POSES.length - 1))];
  const hair = colorFrom(HAIR_COLORS, h.hair, "#6b4630");
  const hairD = dark(hair, 0.28);
  const skin = colorFrom(SKIN_COLORS, h.skin, "#f1cfb1");
  const skinD = dark(skin, 0.16);
  const accents = st.palette.accents.length ? st.palette.accents : ["#3e8ed0"];
  // одежда одна на всю книгу: от look.outfit или первого акцента стиля
  const top = h.outfit && HEX6.test(h.outfit) ? h.outfit : accents[0];
  const topD = dark(top, 0.22);
  const jeans = st.texture === "grain" && st.filter === "posterize" ? mix(accents[2] ?? "#2d3a58", "#1c2340", 0.35) : "#2d3a58";
  const shoe = "#f4f2ee";
  const girl = h.gender === "girl";
  const cut = hairCut(h.hairstyle, h.gender, h.longHair);
  const age = Math.min(17, Math.max(11, h.age ?? 14));
  // младшие чуть ниже и с чуть крупнее головой — но всё равно не «малыши»
  const k = 0.92 + ((age - 11) / 6) * 0.1;
  const headK = 1.06 - ((age - 11) / 6) * 0.08;
  const shade = st.line === "bold" ? 0.28 : 0.16;
  const rim = st.line === "none";

  // ── волосы: задний слой ──
  let hairBack = "";
  switch (cut) {
    case "long":
      // две пряди по бокам лица, шея и худи видны
      hairBack = `<path d="M-30 -140 Q-38 -96 -38 -50 Q-30 -44 -18 -52 Q-22 -80 -20 -112 L20 -112 Q22 -80 18 -52 Q30 -44 38 -50 Q38 -96 30 -140Z" fill="${hair}"${s}/>`;
      break;
    case "bob":
      hairBack = `<path d="M-33 -138 Q-40 -100 -36 -86 Q-20 -80 0 -88 Q20 -80 36 -86 Q40 -100 33 -138Z" fill="${hair}"${s}/>`;
      break;
    case "ponytail":
      hairBack = `<path d="M18 -150 Q52 -150 50 -110 Q48 -70 34 -52 Q40 -88 26 -118Z" fill="${hair}"${s}/>`;
      break;
    case "braids":
      hairBack = [-1, 1]
        .map((d) => `<g fill="${hair}"${s}>${[0, 1, 2, 3].map((i) => `<ellipse cx="${d * (30 + i * 1.5)}" cy="${-104 + i * 18}" rx="8" ry="11"/>`).join("")}</g><path d="M${d * 34} -36l${d * 2} 10" stroke="${accents[1] ?? top}" stroke-width="5" stroke-linecap="round"/>`)
        .join("");
      break;
    case "bun":
      hairBack = `<circle cx="0" cy="-166" r="17" fill="${hair}"${s}/>`;
      break;
    case "curly":
      hairBack = [[-30, -150], [-38, -126], [-36, -102], [30, -150], [38, -126], [36, -102], [-16, -166], [14, -168]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="${hair}"${s}/>`)
        .join("");
      break;
    case "locs":
      hairBack = [-30, -22, -14, 14, 22, 30].map((x) => limb([[x, -140], [x * 1.15, -100], [x * 1.2, -64]], hair, 9, st)).join("");
      break;
    default:
      break;
  }

  // ── волосы: передний слой (шапка + чёлка) ──
  let hairFront: string;
  switch (cut) {
    case "buzz":
      hairFront = `<path d="M-27 -132 Q-27 -162 0 -162 Q27 -162 27 -132 Q14 -150 0 -150 Q-14 -150 -27 -132Z" fill="${hair}" opacity=".85"/>`;
      break;
    case "messy":
      hairFront = `<path d="M-30 -118 Q-36 -150 -22 -162 L-24 -176 L-8 -166 L0 -182 L10 -166 L26 -174 L22 -160 Q36 -150 30 -118 Q26 -138 14 -144 Q4 -132 -10 -142 Q-22 -136 -30 -118Z" fill="${hair}"${s}/>`;
      break;
    case "short":
      hairFront = `<path d="M-29 -120 Q-32 -166 2 -166 Q34 -164 29 -120 Q26 -142 12 -146 Q-6 -136 -26 -138Z" fill="${hair}"${s}/>`;
      break;
    case "curly":
      hairFront = [[-22, -156], [-6, -162], [10, -160], [24, -152], [-28, -138], [28, -138]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="${hair}"${s}/>`)
        .join("");
      break;
    case "locs":
      hairFront = `<path d="M-29 -126 Q-30 -164 0 -164 Q30 -164 29 -126 Q14 -148 0 -146 Q-14 -148 -29 -126Z" fill="${hair}"${s}/>`;
      break;
    default:
      // гладкие: пробор сбоку и косая чёлка
      hairFront = `<path d="M-30 -110 Q-36 -164 0 -166 Q34 -166 31 -114 Q30 -140 18 -148 Q4 -132 -20 -128 Q-26 -120 -30 -110Z" fill="${hair}"${s}/><path d="M4 -160 Q-6 -144 -18 -134" stroke="${hairD}" stroke-width="2" fill="none"/>`;
  }

  // ── лицо ──
  const eyeY = -125;
  const eye = (x: number) =>
    `<path d="M${x - 6.5} ${eyeY} Q${x} ${eyeY - 6} ${x + 6.5} ${eyeY} Q${x} ${eyeY + 4.5} ${x - 6.5} ${eyeY}Z" fill="#fff"/><circle cx="${x}" cy="${eyeY - 0.5}" r="3.4" fill="#3a2a20"/><circle cx="${x + 1}" cy="${eyeY - 1.6}" r="1" fill="#fff"/>` +
    `<path d="M${x - 7} ${eyeY - 0.5} Q${x} ${eyeY - 6.8} ${x + 7} ${eyeY - 0.5}" stroke="#2a1d18" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    (girl ? `<path d="M${x + (x > 0 ? 6.5 : -6.5)} ${eyeY - 1}l${x > 0 ? 3 : -3} -2.5" stroke="#2a1d18" stroke-width="1.5" stroke-linecap="round"/>` : "");
  const brows = `<path d="M-16 -135 Q-10 -139 -3 -136 M3 -136 Q10 ${pose.smile === "smirk" ? -141 : -139} 16 -135" stroke="${hairD}" stroke-width="${girl ? 2.2 : 3}" fill="none" stroke-linecap="round"/>`;
  const nose = `<path d="M1 -122 Q-3 -113 2 -110" stroke="${dark(skin, 0.3)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const mouth =
    pose.smile === "grin"
      ? `<path d="M-8 -102 Q0 -95 8 -102 Q0 -99 -8 -102Z" fill="#fff" stroke="#8a3b33" stroke-width="2" stroke-linejoin="round"/>`
      : pose.smile === "smirk"
        ? `<path d="M-6 -101 Q2 -99 8 -104" stroke="#8a3b33" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
        : `<path d="M-6 -102 Q0 -98 6 -102" stroke="#8a3b33" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const cheeks = `<ellipse cx="-16" cy="-110" rx="5" ry="3" fill="#e08a7a" opacity=".22"/><ellipse cx="16" cy="-110" rx="5" ry="3" fill="#e08a7a" opacity=".22"/>`;
  const freckles = h.freckles
    ? `<g fill="${dark(skin, 0.38)}" opacity=".7">${[[-15, -115], [-11, -112], [-7, -115], [7, -115], [11, -112], [15, -115], [-2, -116], [3, -117]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/>`).join("")}</g>`
    : "";
  const glasses = h.glasses
    ? `<g fill="none" stroke="#1d1d24" stroke-width="2.2"><rect x="-18.5" y="-132" width="16" height="13" rx="4"/><rect x="2.5" y="-132" width="16" height="13" rx="4"/><path d="M-2.5 -127 Q0 -129 2.5 -127 M-18.5 -127 L-26 -129 M18.5 -127 L26 -129"/></g><path d="M-15 -130 l4 0 M6 -130 l4 0" stroke="#fff" stroke-width="1.6" opacity=".7"/>`
    : "";

  // ── тело ──
  const legs = limb(pose.legL, jeans, 22, st) + limb(pose.legR, jeans, 22, st);
  const foot = ([x, y]: P, dir: number) => `<path d="M${x - 12 * dir} ${y - 6} Q${x + 2 * dir} ${y - 14} ${x + 16 * dir} ${y - 4} Q${x + 22 * dir} ${y + 4} ${x + 14 * dir} ${y + 8} L${x - 12 * dir} ${y + 8}Z" fill="${shoe}"${s}/><path d="M${x - 12 * dir} ${y + 4}H${x + 18 * dir}" stroke="${accents[1] ?? topD}" stroke-width="3"/>`;
  const feet = foot(pose.legL[2], -1) + foot(pose.legR[2], 1);
  const torsoD = "M-36 -80 Q-46 -72 -44 -40 L-38 46 Q0 54 38 46 L44 -40 Q46 -72 36 -80 Q18 -88 0 -88 Q-18 -88 -36 -80Z";
  const torso = `<path d="${torsoD}" fill="${top}"${s}/><path d="M12 -86 Q40 -82 44 -40 L38 46 Q26 50 16 50 Q26 -10 12 -86Z" fill="${ink}" opacity="${shade}"/><rect x="-38" y="36" width="76" height="12" rx="5" fill="${topD}"/>`;
  const hood = `<path d="M-26 -84 Q-30 -104 -14 -102 Q0 -92 14 -102 Q30 -104 26 -84 Q0 -72 -26 -84Z" fill="${topD}"${s}/>`;
  const strings = `<path d="M-7 -80 v24 M7 -80 v20" stroke="${light(top, 0.6)}" stroke-width="2.4" stroke-linecap="round"/>`;
  const pocket = `<path d="M-26 4 H26 L30 32 H-30Z" fill="${topD}"${pose.pocket ? s : ""}/>`;
  const hand = ([x, y]: P) => `<circle cx="${x}" cy="${y}" r="8.5" fill="${skin}"${s}/>`;
  // без контура рукав чуть темнее худи, чтобы рука читалась на фоне тела
  const sleeve = (a: P[]) => limb(a, st.line === "none" ? dark(top, 0.12) : top, 17, st);
  const armL = sleeve(pose.armL) + (pose.pocket ? "" : hand(pose.armL[2]));
  const armR = sleeve(pose.armR) + (pose.pocket ? "" : hand(pose.armR[2]));
  const [ix, iy] = pose.armR[2];
  const item =
    pose.item === "torch"
      ? `<rect x="${ix - 5}" y="${iy - 30}" width="10" height="26" rx="3" fill="#3a3a44"${s}/><path d="M${ix} ${iy - 30}L${ix - 60} ${iy - 140}L${ix + 40} ${iy - 150}Z" fill="#fff4c2" opacity=".28"/>`
      : "";
  const neck = `<rect x="-9" y="-104" width="18" height="22" fill="${skin}"/><rect x="-9" y="-104" width="18" height="8" fill="${skinD}"/>`;
  const head = `<path d="M-27 -128 Q-27 -160 0 -160 Q27 -160 27 -128 Q27 -106 15 -96 Q0 -88 -15 -96 Q-27 -106 -27 -128Z" fill="${skin}"${s}/>`;
  const ears = `<ellipse cx="-27" cy="-123" rx="5" ry="8" fill="${skin}"${s}/><ellipse cx="27" cy="-123" rx="5" ry="8" fill="${skin}"${s}/>`;
  const rimLight = rim ? `<path d="M-44 -40 Q-46 -72 -36 -80" stroke="${light(accents[1] ?? "#ffd9a0", 0.4)}" stroke-width="4" fill="none" opacity=".8" stroke-linecap="round"/><path d="M-26 -140 Q-24 -156 -8 -160" stroke="${light(accents[1] ?? "#ffd9a0", 0.5)}" stroke-width="3" fill="none" opacity=".7"/>` : "";
  // ризограф: сдвиг печатного слоя — розовый контур фигуры чуть в стороне
  const misreg =
    st.texture === "grain" && st.filter === "posterize"
      ? `<g transform="translate(6 4)" opacity=".55" style="mix-blend-mode:multiply"><path d="${torsoD}" fill="${accents[0]}"/>${limb(pose.legL, accents[0], 22, { ...st, line: "none" })}${limb(pose.legR, accents[0], 22, { ...st, line: "none" })}</g>`
      : "";

  const headGroup = `<g transform="rotate(${pose.tilt} 0 -96) translate(0 -125) scale(${headK.toFixed(3)}) translate(0 125)">${hairBack}${ears}${head}${cheeks}${freckles}${eye(-10)}${eye(10)}${brows}${nose}${mouth}${glasses}${hairFront}</g>`;
  const handOverFace = pose.armR[2][1] < -80;

  return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.scale : o.scale} ${o.scale})"><g transform="translate(0 190) scale(${k.toFixed(3)}) translate(0 -190)">
    <ellipse cx="0" cy="190" rx="62" ry="10" fill="rgba(0,0,0,.2)"/>
    ${misreg}${legs}${feet}${neck}${hood}${torso}${strings}${pose.pocket ? armL + armR + pocket : pocket + armL + (handOverFace ? "" : armR)}${item}${rimLight}
    ${headGroup}${handOverFace ? armR : ""}
  </g></g>`;
};
