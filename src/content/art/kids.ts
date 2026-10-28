// ВЛАДЕЛЕЦ: агент 3 (художник детских книг). Никто другой этот файл не меняет.
//
// Должно быть:
//  • KIDS_ART_STYLES — все стили с owner "kids" в ART_STYLE_OWNERS (src/content/types.ts):
//    watercolor-air, kind-classic, folk-lubok, ink-humor, cozy-detail (перенесены агентом 1 из
//    STYLE_PROMPTS — промпты можно улучшать, id не менять), + naive-watercolor, pen-ink-1920s.
//    Для каждого: title/description (ru, для покупателя), prompt/negative (EN для Qwen, только техника —
//    без имён художников, брендов, франшиз), demo (палитра, линия, фактура).
//  • KIDS_THEMES — демо-темы для всех ключей с owner "kids" в DEMO_THEME_KEYS:
//    winter, kingdom, dragon, ocean, sleep (перенесены), + forest, space, school, meadow, dino.
//    Можно задать свой фон через scene: DemoScene.
//  • drawChild: DemoHeroDrawer — ребёнок 2–10 лет: волосы, причёска, тон кожи, очки, веснушки, одежда.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, DemoHeroDrawer, DemoTheme } from "../types";
import { colorFrom, HAIR_COLORS, pick, SKIN_COLORS, stroke } from "./shared";

const KIDS_NEGATIVE =
  "photo, photorealistic, 3d render, adult face, distorted face, extra fingers, deformed hands, text, letters, watermark, logo, signature, frame, multiple copies of the child, scary, dark horror";

export const KIDS_ART_STYLES: ArtStyle[] = [
  {
    id: "watercolor-air",
    title: "Воздушная акварель",
    description: "Тонкая линия, прозрачные акварельные пятна, много воздуха.",
    audiences: ["CHILD", "PET"],
    prompt:
      "delicate children's book illustration, thin slightly wobbly pen-and-ink outline, transparent watercolor washes, lots of untouched white paper, pale sky blue, butter yellow and soft green, naive simple shapes, quiet poetic mood",
    negative: KIDS_NEGATIVE,
    demo: { palette: { paper: "#fbf8f1", ink: "#4a4a55", accents: ["#9cc7e4", "#f3dc8a", "#a9d3a0", "#f2b5a8"] }, line: "thin", texture: "paper", filter: "wobble" },
  },
  {
    id: "kind-classic",
    title: "Добрая классика",
    description: "Чёткий контур и мягкие цвета, как в любимых книжках из детства.",
    audiences: ["CHILD", "ADULT"],
    prompt:
      "classic mid-century children's book illustration, confident clean black ink contour, flat soft colors with gentle shading, pale paper background, round friendly forms, expressive kind faces, subtle printed paper texture",
    negative: KIDS_NEGATIVE,
    demo: { palette: { paper: "#f6efe0", ink: "#222222", accents: ["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c"] }, line: "bold", texture: "paper" },
  },
  {
    id: "folk-lubok",
    title: "Народная сказка",
    description: "Яркие узоры и праздничные цвета русской росписи.",
    audiences: ["CHILD", "ADULT"],
    prompt:
      "Russian folk naive painting for a children's book, matte gouache, bold flat decorative shapes, ornamental flowers and patterned borders, deep red, ochre, black, emerald and cream palette, cheerful festive mood",
    negative: KIDS_NEGATIVE,
    demo: { palette: { paper: "#f3e6c8", ink: "#1d1a17", accents: ["#b8352c", "#d9a441", "#1f7a5a", "#1d1a17"] }, line: "bold", texture: "grain", filter: "posterize" },
  },
  {
    id: "ink-humor",
    title: "Весёлая графика",
    description: "Живая чёрная линия и один яркий цвет — с юмором.",
    audiences: ["CHILD", "TEEN", "ADULT", "PET"],
    prompt:
      "lively black ink line drawing for a children's book, expressive gesture, light cross-hatching, white background, one warm accent color, gentle humor, face drawn with careful realistic proportions",
    negative: KIDS_NEGATIVE,
    demo: { palette: { paper: "#ffffff", ink: "#111111", accents: ["#ef6b3a"] }, line: "sketch", texture: "none" },
  },
  {
    id: "cozy-detail",
    title: "Уютные подробности",
    description: "Тёплые цвета и множество мелочей, которые интересно разглядывать.",
    audiences: ["CHILD"],
    prompt:
      "richly detailed ink and watercolor children's book illustration, warm earthy palette, cozy scene full of tiny objects and small hidden creatures, soft daylight, careful fine linework",
    negative: KIDS_NEGATIVE,
    demo: { palette: { paper: "#f7efe2", ink: "#3d2d22", accents: ["#c46a3b", "#8a9a5b", "#d9b26f", "#7a5c8e"] }, line: "thin", texture: "paper" },
  },
];

export const KIDS_THEMES: DemoTheme[] = [
  { key: "winter", sky: ["#1f3f5c", "#4b7598"], ground: "#eef4f7", accent: "#b8352c", deco: "snow" },
  { key: "kingdom", sky: ["#f6c8a8", "#f9e7c7"], ground: "#5b9a63", accent: "#8e4b6e", deco: "flags" },
  { key: "dragon", sky: ["#141f45", "#2d3d77"], ground: "#1d4a3a", accent: "#5bbf9a", deco: "stars" },
  { key: "ocean", sky: ["#0d4f66", "#1d86a3"], ground: "#0a3d50", accent: "#f2c443", deco: "bubbles" },
  { key: "sleep", sky: ["#2e2b57", "#4b4785"], ground: "#26244a", accent: "#f6e7b8", deco: "moon" },
];

/** Ребёнок 2–10 лет (перенесён из src/lib/gen/demo-art.ts, учитывает стиль и тон кожи). */
export const drawChild: DemoHeroDrawer = (o) => {
  const h = o.look;
  const hair = colorFrom(HAIR_COLORS, h.hair, "#9a6b45");
  const skin = colorFrom(SKIN_COLORS, h.skin, "#f4d3b8");
  const shirt = h.outfit ?? pick(["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c", "#9b59b6"], o.index ?? 0);
  const long = h.longHair ?? h.gender === "girl";
  const s = stroke(o.style);
  return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.scale : o.scale} ${o.scale})">
    <ellipse cx="0" cy="190" rx="70" ry="12" fill="rgba(0,0,0,.18)"/>
    <rect x="-34" y="110" width="22" height="80" rx="10" fill="#3b4a6b"${s}/>
    <rect x="12" y="110" width="22" height="80" rx="10" fill="#3b4a6b"${s}/>
    <path d="M-52 120 Q-50 40 0 36 Q50 40 52 120 Z" fill="${shirt}"${s}/>
    <rect x="-74" y="48" width="22" height="70" rx="11" fill="${shirt}" transform="rotate(14 -63 48)"${s}/>
    <rect x="52" y="48" width="22" height="70" rx="11" fill="${shirt}" transform="rotate(-24 63 48)"${s}/>
    ${long ? `<path d="M-46 -20 Q-56 60 -30 70 L30 70 Q56 60 46 -20 Z" fill="${hair}"/>` : ""}
    <circle cx="0" cy="-10" r="44" fill="${skin}"${s}/>
    <path d="M-46 -14 Q-40 -62 0 -60 Q40 -62 46 -14 Q30 -38 0 -36 Q-26 -40 -46 -14Z" fill="${hair}"/>
    <circle cx="-15" cy="-8" r="4.5" fill="#2b2b2b"/><circle cx="15" cy="-8" r="4.5" fill="#2b2b2b"/>
    ${h.glasses ? `<g fill="none" stroke="#2b2b2b" stroke-width="3"><circle cx="-15" cy="-8" r="11"/><circle cx="15" cy="-8" r="11"/><path d="M-4 -8h8"/></g>` : ""}
    ${h.freckles ? `<g fill="#b9764f" opacity=".6"><circle cx="-24" cy="4" r="2"/><circle cx="-18" cy="7" r="2"/><circle cx="24" cy="4" r="2"/><circle cx="18" cy="7" r="2"/></g>` : ""}
    <circle cx="-26" cy="8" r="7" fill="#f0a7a0" opacity=".55"/><circle cx="26" cy="8" r="7" fill="#f0a7a0" opacity=".55"/>
    <path d="M-12 14 Q0 24 12 14" stroke="#9b3b33" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>`;
};
