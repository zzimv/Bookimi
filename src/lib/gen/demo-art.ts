// Демо-иллюстрации (SVG) — пока не подключён GPU-сервер. Показывают сцену сюжета, героя
// с цветом волос из анкеты и подпись «демо». Настоящие иллюстрации рисует Qwen (gpu.ts).

const THEMES: Record<string, { sky: [string, string]; ground: string; accent: string; deco: "snow" | "flags" | "stars" | "bubbles" | "moon" }> = {
  winter: { sky: ["#1f3f5c", "#4b7598"], ground: "#eef4f7", accent: "#b8352c", deco: "snow" },
  kingdom: { sky: ["#f6c8a8", "#f9e7c7"], ground: "#5b9a63", accent: "#8e4b6e", deco: "flags" },
  dragon: { sky: ["#141f45", "#2d3d77"], ground: "#1d4a3a", accent: "#5bbf9a", deco: "stars" },
  ocean: { sky: ["#0d4f66", "#1d86a3"], ground: "#0a3d50", accent: "#f2c443", deco: "bubbles" },
  sleep: { sky: ["#2e2b57", "#4b4785"], ground: "#26244a", accent: "#f6e7b8", deco: "moon" },
};

export const THEME_BY_STORY: Record<string, string> = {
  "novogodnee-puteshestvie-s-dedom-morozom": "winter",
  "den-rozhdeniya-v-skazochnom-korolevstve": "kingdom",
  "imya-i-zvyozdnyj-drakonchik": "dragon",
  "kapitan-podvodnoj-lodki": "ocean",
  "sonnaya-strana": "sleep",
};

const HAIR_COLORS: Record<string, string> = {
  светлые: "#e8c77a",
  русые: "#b48a5a",
  каштановые: "#7a4a2a",
  тёмные: "#4a3222",
  рыжие: "#c8642c",
  чёрные: "#231a16",
};

function rnd(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export interface DemoHero {
  hair?: string;
  gender?: string;
  glasses?: boolean;
  longHair?: boolean;
}

function child(x: number, y: number, scale: number, h: DemoHero, shirt: string) {
  const hair = HAIR_COLORS[h.hair ?? ""] ?? "#9a6b45";
  const long = h.longHair || h.gender === "girl";
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <ellipse cx="0" cy="190" rx="70" ry="12" fill="rgba(0,0,0,.18)"/>
    <rect x="-34" y="110" width="22" height="80" rx="10" fill="#3b4a6b"/>
    <rect x="12" y="110" width="22" height="80" rx="10" fill="#3b4a6b"/>
    <path d="M-52 120 Q-50 40 0 36 Q50 40 52 120 Z" fill="${shirt}"/>
    <rect x="-74" y="48" width="22" height="70" rx="11" fill="${shirt}" transform="rotate(14 -63 48)"/>
    <rect x="52" y="48" width="22" height="70" rx="11" fill="${shirt}" transform="rotate(-24 63 48)"/>
    ${long ? `<path d="M-46 -20 Q-56 60 -30 70 L30 70 Q56 60 46 -20 Z" fill="${hair}"/>` : ""}
    <circle cx="0" cy="-10" r="44" fill="#f4d3b8"/>
    <path d="M-46 -14 Q-40 -62 0 -60 Q40 -62 46 -14 Q30 -38 0 -36 Q-26 -40 -46 -14Z" fill="${hair}"/>
    <circle cx="-15" cy="-8" r="4.5" fill="#2b2b2b"/><circle cx="15" cy="-8" r="4.5" fill="#2b2b2b"/>
    ${h.glasses ? `<g fill="none" stroke="#2b2b2b" stroke-width="3"><circle cx="-15" cy="-8" r="11"/><circle cx="15" cy="-8" r="11"/><path d="M-4 -8h8"/></g>` : ""}
    <circle cx="-26" cy="8" r="7" fill="#f0a7a0" opacity=".55"/><circle cx="26" cy="8" r="7" fill="#f0a7a0" opacity=".55"/>
    <path d="M-12 14 Q0 24 12 14" stroke="#9b3b33" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  </g>`;
}

export function demoSceneSvg(opts: {
  theme: string;
  index: number; // 0 — обложка
  hero: DemoHero;
  caption?: string;
  extras?: number;
  watermark?: boolean;
  wide?: boolean;
}) {
  const t = THEMES[opts.theme] ?? THEMES.dragon;
  const W = opts.wide ? 2048 : 1024;
  const H = 1024;
  const r = rnd(opts.index * 97 + opts.theme.length * 13 + 7);
  const shirt = ["#d9534f", "#3e8ed0", "#f0ad4e", "#5cb85c", "#9b59b6"][opts.index % 5];
  let deco = "";
  for (let i = 0; i < 26; i++) {
    const x = Math.round(r() * W);
    const y = Math.round(r() * H * 0.6);
    if (t.deco === "snow") deco += `<circle cx="${x}" cy="${y}" r="${3 + r() * 5}" fill="#fff" opacity=".85"/>`;
    if (t.deco === "stars") deco += `<path d="M${x} ${y - 7}l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#f6e7b8"/>`;
    if (t.deco === "bubbles") deco += `<circle cx="${x}" cy="${y}" r="${4 + r() * 10}" fill="none" stroke="#cfeff6" stroke-width="2" opacity=".7"/>`;
    if (t.deco === "moon" && i < 18) deco += `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff8d9"/>`;
    if (t.deco === "flags" && i < 6) deco += `<path d="M${x} ${y + 150}v-60l40 15-40 15" fill="${t.accent}" stroke="#5a2c45" stroke-width="3"/>`;
  }
  const hx = opts.index % 2 ? W * 0.62 : W * 0.38;
  const extras = Array.from({ length: Math.min(opts.extras ?? 0, 3) }, (_, i) =>
    child(hx + (i + 1) * 150 * (opts.index % 2 ? -1 : 1), H * 0.66, 0.85, { hair: ["тёмные", "русые", "рыжие"][i] }, ["#7f8c8d", "#e67e22", "#16a085"][i]),
  ).join("");
  const big = t.deco === "moon" ? `<path d="M${W * 0.78} 120 a90 90 0 1 0 70 140 a70 70 0 1 1 -70 -140z" fill="#f6e7b8"/>` : `<circle cx="${W * 0.8}" cy="170" r="70" fill="#f6e7b8" opacity=".9"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.sky[0]}"/><stop offset="1" stop-color="${t.sky[1]}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${big}${deco}
  <path d="M0 ${H * 0.72} Q${W * 0.3} ${H * 0.62} ${W * 0.55} ${H * 0.7} T${W} ${H * 0.66} V${H} H0Z" fill="${t.ground}"/>
  ${extras}
  ${child(hx, H * 0.6, opts.index === 0 ? 1.5 : 1.25, opts.hero, shirt)}
  ${opts.caption ? `<text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#fff" opacity=".8">${escapeXml(opts.caption)}</text>` : ""}
  ${opts.watermark ? watermark(W, H) : ""}
</svg>`;
}

export function watermark(W: number, H: number) {
  let marks = "";
  for (let y = 120; y < H; y += 220) for (let x = -200; x < W; x += 420) marks += `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})">БУКИМИ · ПРЕВЬЮ</text>`;
  return `<g font-family="sans-serif" font-size="44" font-weight="700" fill="#fff" opacity=".28">${marks}</g>`;
}

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
