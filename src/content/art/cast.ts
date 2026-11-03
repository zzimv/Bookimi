// Персонажи сказок на картинках (rev 16): звёздный дракончик, Дед Мороз, Снегурочка, сова и совёнок, лиса, заяц,
// белка, медведь и медвежонок, снегирь, воробей, уточка, лягушка, кит и рыбки, великан, повар, Месяц, Весна,
// робот, ракета, динозавр и его следы… Один простой и милый рисунок на персонажа — одинаковый на всех страницах,
// контур и толщина линии — по стилю картинок. Кто на каком развороте: явный список PlotSpread.cast, иначе —
// по словам сцены (EN) и текста (RU). Обложка — главный спутник книги рядом с героем.
// Рисуется в демо-рендере (render.ts): живая обложка (/obrazec), эскизы и страницы превью, PDF. Без Node API.
import type { ArtStyleDemo, Plot, PlotSpread } from "../types";
import { KIDS_PLOTS } from "../plots/kids";
import { KIDS_MORE_PLOTS } from "../plots/kids-more";
import { NEWYEAR_PLOTS } from "../plots/newyear";
import { KIDS_GROUP_PLOTS } from "../plots/groups";

/** Как персонаж стоит в кадре: на земле, в воздухе (летает, плавает, висит в небе) или следы на земле. */
type Place = "ground" | "air" | "trail";

export interface CastDef {
  key: string;
  /** Имя по-русски — подпись и подсказки. */
  ru: string;
  /** Слова в сцене (EN). */
  en: RegExp;
  /** Слова в тексте (RU). */
  rus?: RegExp;
  place: Place;
  /** Ширина и высота рисунка в единицах героя (ребёнок 6 лет ≈ 230 в высоту). */
  w: number;
  h: number;
  draw: (k: Kit) => string;
}

/** Набор для рисования: контур по стилю, смешение цветов с бумагой стиля. */
interface Kit {
  /** stroke-атрибуты контура (пусто — стиль без линий). */
  s: string;
  /** тонкий контур */
  t: string;
  ink: string;
  c: (hex: string) => string;
  acc: string[];
}

const HEX6 = /^#[0-9a-f]{6}$/i;
function rgb(c: string): [number, number, number] {
  const n = parseInt(HEX6.test(c) ? c.slice(1) : "888888", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
const f = (n: number) => (Math.round(n * 10) / 10).toString();
const eye = (x: number, y: number, r: number, ink: string) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${ink}"/><circle cx="${f(x + r * 0.35)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.35)}" fill="#fff"/>`;
const smile = (x: number, y: number, w: number, ink: string, sw = 2.4) => `<path d="M${f(x - w)} ${f(y)} Q${f(x)} ${f(y + w * 0.8)} ${f(x + w)} ${f(y)}" stroke="${ink}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
const cheek = (x: number, y: number, r: number) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.65)}" fill="#f08a8a" opacity=".45"/>`;

// ── животные ──
function owl(k: Kit, body = "#8a6a4a", belly = "#e9d9b8") {
  const B = k.c(body);
  return `<ellipse cx="0" cy="-6" rx="20" ry="7" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-30 -86 L-24 -112 L-10 -94Z M30 -86 L24 -112 L10 -94Z" fill="${B}"${k.t}/>` +
    `<ellipse cx="0" cy="-52" rx="38" ry="50" fill="${B}"${k.s}/>` +
    `<ellipse cx="0" cy="-38" rx="25" ry="30" fill="${k.c(belly)}"/>` +
    [-1, 1].map((sd) => `<path d="M${sd * 36} -62 Q${sd * 52} -36 ${sd * 30} -14" fill="${mix(B, "#000000", 0.18)}"${k.t}/>`).join("") +
    [-4, 4, -10, 10].map((x, i) => `<path d="M${x - 4} ${-40 + (i > 1 ? 12 : 0)} q4 5 8 0" stroke="${mix(B, "#000000", 0.25)}" stroke-width="2" fill="none"/>`).join("") +
    [-1, 1].map((sd) => `<circle cx="${sd * 15}" cy="-74" r="14" fill="#fffaf0"${k.t}/>${eye(sd * 15, -74, 7, k.ink)}`).join("") +
    `<path d="M-6 -64 L6 -64 L0 -54Z" fill="#f2a640"/>` +
    [-10, 10].map((x) => `<path d="M${x - 6} -4 l3 -6 l3 6 l3 -6 l3 6" stroke="#e39a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`).join("");
}
function fox(k: Kit) {
  const O = k.c("#e0793a");
  return `<ellipse cx="0" cy="-4" rx="66" ry="8" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-40 -46 C-100 -70 -110 -10 -70 -8 C-50 -6 -40 -24 -36 -34Z" fill="${O}"${k.s}/><path d="M-86 -22 C-92 -10 -76 -6 -66 -9 C-74 -14 -80 -18 -86 -22Z" fill="#fff8ee"/>` +
    [-26, -12, 18, 32].map((x) => `<rect x="${x - 5}" y="-34" width="10" height="32" rx="5" fill="${k.c("#5a3322")}"${k.t}/>`).join("") +
    `<ellipse cx="0" cy="-42" rx="46" ry="24" fill="${O}"${k.s}/><ellipse cx="6" cy="-34" rx="26" ry="12" fill="#fff8ee"/>` +
    `<path d="M30 -70 L34 -104 L52 -80 L68 -102 L70 -66Z" fill="${O}"${k.s}/><path d="M36 -78 L38 -96 L48 -82Z M66 -78 L66 -94 L58 -82Z" fill="#3a2a22"/>` +
    `<circle cx="52" cy="-62" r="26" fill="${O}"${k.s}/><path d="M50 -56 Q66 -40 86 -54 Q72 -64 60 -62Z" fill="#fff8ee"${k.t}/><circle cx="86" cy="-55" r="4.5" fill="${k.ink}"/>` +
    eye(48, -68, 4.5, k.ink) + eye(64, -68, 4.5, k.ink) + cheek(42, -56, 6);
}
function hare(k: Kit, fur = "#efe9e0") {
  const F = k.c(fur);
  return `<ellipse cx="0" cy="-3" rx="44" ry="7" fill="rgba(0,0,0,.12)"/>` +
    `<circle cx="-36" cy="-36" r="11" fill="#fff"${k.t}/>` +
    `<ellipse cx="-4" cy="-36" rx="36" ry="32" fill="${F}"${k.s}/>` +
    `<ellipse cx="18" cy="-104" rx="8" ry="30" transform="rotate(-10 18 -104)" fill="${F}"${k.s}/><ellipse cx="36" cy="-102" rx="8" ry="30" transform="rotate(12 36 -102)" fill="${F}"${k.s}/>` +
    `<ellipse cx="18" cy="-104" rx="3.5" ry="20" transform="rotate(-10 18 -104)" fill="#f3c2cc"/><ellipse cx="36" cy="-102" rx="3.5" ry="20" transform="rotate(12 36 -102)" fill="#f3c2cc"/>` +
    `<circle cx="26" cy="-64" r="24" fill="${F}"${k.s}/>` + eye(20, -68, 4, k.ink) + eye(34, -68, 4, k.ink) +
    `<path d="M24 -58 l3 3 l3 -3Z" fill="#e88a9a"/>` + cheek(14, -56, 5) + cheek(40, -56, 5) +
    `<ellipse cx="14" cy="-6" rx="12" ry="6" fill="${F}"${k.t}/><ellipse cx="34" cy="-6" rx="10" ry="5" fill="${F}"${k.t}/>`;
}
function squirrel(k: Kit) {
  const R = k.c("#c8602e");
  return `<ellipse cx="0" cy="-3" rx="36" ry="6" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-14 -18 C-62 -10 -66 -70 -40 -92 C-22 -106 -4 -96 -14 -82 C-38 -74 -36 -40 -10 -30Z" fill="${R}"${k.s}/>` +
    `<ellipse cx="2" cy="-30" rx="20" ry="26" fill="${R}"${k.s}/><ellipse cx="6" cy="-26" rx="11" ry="16" fill="#f4dcb8"/>` +
    `<circle cx="10" cy="-62" r="17" fill="${R}"${k.s}/><path d="M2 -74 L0 -94 L12 -78Z M16 -76 L20 -94 L24 -74Z" fill="${R}"${k.t}/>` +
    eye(14, -64, 3.5, k.ink) + `<circle cx="26" cy="-58" r="2.6" fill="${k.ink}"/>` + cheek(18, -54, 4) +
    `<ellipse cx="16" cy="-38" rx="7" ry="8" fill="#a8743a"${k.t}/><ellipse cx="16" cy="-44" rx="7" ry="3" fill="#7a5028"/>`;
}
function bear(k: Kit, fur = "#8b5a3c") {
  const F = k.c(fur);
  const L = mix(F, "#f5e2c8", 0.55);
  return `<ellipse cx="0" cy="-4" rx="62" ry="9" fill="rgba(0,0,0,.12)"/>` +
    [-1, 1].map((sd) => `<ellipse cx="${sd * 26}" cy="-16" rx="20" ry="16" fill="${F}"${k.s}/>`).join("") +
    `<ellipse cx="0" cy="-66" rx="52" ry="56" fill="${F}"${k.s}/><ellipse cx="0" cy="-56" rx="32" ry="36" fill="${L}"/>` +
    [-1, 1].map((sd) => `<ellipse cx="${sd * 50}" cy="-70" rx="15" ry="30" transform="rotate(${sd * -24} ${sd * 50} -70)" fill="${F}"${k.s}/>`).join("") +
    [-1, 1].map((sd) => `<circle cx="${sd * 32}" cy="-160" r="15" fill="${F}"${k.s}/><circle cx="${sd * 32}" cy="-160" r="7" fill="${L}"/>`).join("") +
    `<circle cx="0" cy="-138" r="40" fill="${F}"${k.s}/><ellipse cx="0" cy="-124" rx="20" ry="15" fill="${L}"${k.t}/><ellipse cx="0" cy="-130" rx="7" ry="5" fill="${k.ink}"/>` +
    smile(0, -122, 7, k.ink) + eye(-15, -146, 5, k.ink) + eye(15, -146, 5, k.ink) + cheek(-24, -130, 6) + cheek(24, -130, 6);
}
function bird(k: Kit, back: string, belly: string, cap?: string, beak = "#e8a43a") {
  const B = k.c(back);
  return `<ellipse cx="0" cy="-2" rx="20" ry="4" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-18 -26 L-42 -36 L-38 -18Z" fill="${mix(B, "#000000", 0.2)}"${k.t}/>` +
    `<ellipse cx="0" cy="-24" rx="24" ry="19" fill="${B}"${k.s}/><ellipse cx="6" cy="-18" rx="15" ry="12" fill="${k.c(belly)}"/>` +
    `<path d="M-12 -28 Q0 -18 10 -26" fill="${mix(B, "#000000", 0.22)}"${k.t}/>` +
    `<circle cx="16" cy="-40" r="14" fill="${B}"${k.s}/>` + (cap ? `<path d="M4 -46 Q16 -60 28 -44 Q16 -50 4 -46Z" fill="${cap}"/>` : "") +
    eye(20, -42, 3.2, k.ink) + `<path d="M29 -42 L40 -38 L29 -34Z" fill="${beak}"${k.t}/>` +
    `<path d="M-2 -6 v6 M8 -6 v6" stroke="#c98a3a" stroke-width="2.4" stroke-linecap="round"/>`;
}
function duck(k: Kit) {
  const Y = k.c("#f6cf4a");
  return `<ellipse cx="0" cy="-3" rx="34" ry="6" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-34 -30 C-40 -6 30 -2 34 -26 C30 -40 -20 -44 -34 -30Z" fill="${Y}"${k.s}/><path d="M-34 -32 L-46 -40 L-38 -24Z" fill="${Y}"${k.t}/>` +
    `<path d="M-16 -30 Q0 -20 14 -30" fill="${mix(Y, "#c08a10", 0.35)}"${k.t}/>` +
    `<circle cx="18" cy="-50" r="17" fill="${Y}"${k.s}/>` + eye(22, -54, 3.5, k.ink) + cheek(14, -46, 4) +
    `<path d="M32 -50 Q48 -48 46 -42 Q38 -38 30 -44Z" fill="#f08a2c"${k.t}/>` +
    `<path d="M-8 -6 l-6 5 h12z M8 -6 l-6 5 h12z" fill="#f08a2c"/>`;
}
function goose(k: Kit) {
  const W = k.c("#f4f2ec");
  return `<ellipse cx="0" cy="-3" rx="42" ry="7" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-44 -36 C-50 -6 34 -4 40 -30 C36 -48 -30 -52 -44 -36Z" fill="${W}"${k.s}/><path d="M-44 -40 L-58 -48 L-50 -30Z" fill="${W}"${k.t}/>` +
    `<path d="M24 -38 C30 -70 18 -88 28 -104 L44 -100 C38 -84 46 -66 38 -36Z" fill="${W}"${k.s}/>` +
    `<circle cx="36" cy="-104" r="13" fill="${W}"${k.s}/>` + eye(38, -108, 3, k.ink) +
    `<path d="M47 -106 L64 -100 L47 -96Z" fill="#f08a2c"${k.t}/><path d="M-20 -32 Q-2 -22 16 -32" stroke="#d8d4ca" stroke-width="3" fill="none"/>` +
    `<path d="M-8 -6 v6 M10 -6 v6" stroke="#f08a2c" stroke-width="4" stroke-linecap="round"/>`;
}
function frog(k: Kit) {
  const G = k.c("#6cbf4a");
  return `<ellipse cx="0" cy="-2" rx="34" ry="6" fill="rgba(0,0,0,.12)"/>` +
    [-1, 1].map((sd) => `<ellipse cx="${sd * 26}" cy="-10" rx="14" ry="9" fill="${G}"${k.t}/>`).join("") +
    `<ellipse cx="0" cy="-26" rx="32" ry="24" fill="${G}"${k.s}/><ellipse cx="0" cy="-18" rx="20" ry="12" fill="${mix(G, "#fff8d8", 0.55)}"/>` +
    [-1, 1].map((sd) => `<circle cx="${sd * 14}" cy="-48" r="11" fill="${G}"${k.s}/><circle cx="${sd * 14}" cy="-48" r="7" fill="#fff"/>${eye(sd * 14, -48, 4, k.ink)}`).join("") +
    smile(0, -30, 13, k.ink) + cheek(-20, -28, 5) + cheek(20, -28, 5);
}
function fish(k: Kit, color: string, x: number, y: number, sz: number, whisk = false) {
  const C = k.c(color);
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(sz)})"><path d="M-30 0 L-46 -14 L-46 14Z" fill="${mix(C, "#000000", 0.15)}"${k.t}/><ellipse cx="0" cy="0" rx="32" ry="20" fill="${C}"${k.s}/>` +
    `<path d="M-4 -18 Q4 -30 14 -18" fill="${mix(C, "#000000", 0.15)}"${k.t}/><path d="M-8 -14 Q-2 0 -8 14" stroke="${mix(C, "#ffffff", 0.4)}" stroke-width="3" fill="none"/>` +
    eye(16, -4, 4, k.ink) + `<path d="M24 6 q4 2 6 -1" stroke="${k.ink}" stroke-width="2" fill="none"/>` +
    (whisk ? `<path d="M28 4 q14 6 20 18 M28 6 q10 12 10 24" stroke="${k.ink}" stroke-width="2.2" fill="none"/>` : "") + `</g>`;
}
function fishes(k: Kit) {
  const cols = ["#f28c38", "#f2c94c", "#5bb3e0", "#e8607a"];
  return [[-50, -30, 0.8], [10, -60, 1], [50, -20, 0.7], [-10, -4, 0.6]].map(([x, y, s], i) => fish(k, cols[i % cols.length], x, y, s)).join("") +
    [[-70, -80], [70, -70], [30, -96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#ffffff" stroke-width="2" opacity=".7"/>`).join("");
}
function whale(k: Kit) {
  const B = k.c("#5b86b8");
  const L = mix(B, "#eaf2fa", 0.6);
  return `<path d="M-150 -70 C-150 -150 60 -160 120 -110 C150 -86 150 -40 120 -30 C40 -6 -100 -10 -150 -70Z" fill="${B}"${k.s}/>` +
    `<path d="M-120 -40 C-40 -10 60 -14 120 -32 C80 -50 -40 -40 -120 -40Z" fill="${L}"/>` +
    `<path d="M-146 -78 C-180 -110 -200 -120 -210 -96 C-196 -90 -186 -80 -184 -70 C-196 -60 -204 -46 -198 -30 C-180 -40 -160 -58 -146 -66Z" fill="${B}"${k.s}/>` +
    eye(78, -84, 7, k.ink) + smile(104, -60, 16, k.ink, 3) + cheek(84, -66, 9) +
    `<path d="M-20 -150 q-6 -26 -20 -32 M-20 -150 q4 -28 16 -34 M-20 -150 v-34" stroke="#bfe3f7" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path d="M10 -40 q20 26 44 10" fill="${mix(B, "#000000", 0.12)}"${k.t}/>`;
}
function octopus(k: Kit) {
  const P = k.c("#b06ad0");
  const legs = [-40, -24, -8, 8, 24, 40]
    .map((x, i) => `<path d="M${x} -40 q${i % 2 ? 14 : -14} 18 ${i % 2 ? -6 : 6} 34 q${i % 2 ? 10 : -10} 8 ${i % 2 ? 14 : -14} 2" stroke="${P}" stroke-width="13" fill="none" stroke-linecap="round"/>`)
    .join("");
  return (k.s ? legs.replace(/stroke="[^"]+" stroke-width="13"/g, `stroke="${k.ink}" stroke-width="17"`) : "") + legs +
    `<ellipse cx="0" cy="-74" rx="48" ry="46" fill="${P}"${k.s}/><ellipse cx="-16" cy="-96" rx="10" ry="6" fill="#fff" opacity=".35"/>` +
    eye(-16, -72, 6, k.ink) + eye(16, -72, 6, k.ink) + smile(0, -56, 10, k.ink) + cheek(-28, -60, 6) + cheek(28, -60, 6) +
    `<rect x="40" y="-64" width="34" height="26" rx="3" fill="#f2e2b8"${k.t}/><path d="M46 -56 l10 6 l8 -8 l6 6" stroke="#c0503a" stroke-width="2" fill="none" stroke-dasharray="3 2"/>`;
}
function hedgehog(k: Kit) {
  const S = k.c("#7a5a42");
  let spikes = "M-46 -8";
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (1 + i / 12);
    const r = i % 2 ? 50 : 40;
    spikes += ` L${f(-6 + Math.cos(a) * r)} ${f(-14 + Math.sin(a) * r * 0.8)}`;
  }
  return `<ellipse cx="0" cy="-2" rx="44" ry="6" fill="rgba(0,0,0,.12)"/>` +
    `<path d="${spikes} L34 -10Z" fill="${S}"${k.s}/>` +
    `<path d="M14 -34 C34 -36 52 -22 58 -12 C46 -4 24 -4 12 -8Z" fill="${k.c("#e8cfae")}"${k.s}/>` +
    `<circle cx="58" cy="-12" r="4.5" fill="${k.ink}"/>` + eye(36, -24, 3.5, k.ink) + cheek(34, -14, 4);
}
function cat(k: Kit, fur = "#9a9aa2") {
  const F = k.c(fur);
  return `<ellipse cx="0" cy="-3" rx="34" ry="6" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-24 -10 C-60 -10 -56 -50 -36 -46" stroke="${F}" stroke-width="10" fill="none" stroke-linecap="round"/>` +
    `<path d="M-24 -4 C-30 -40 -14 -62 0 -62 C14 -62 30 -40 24 -4Z" fill="${F}"${k.s}/><ellipse cx="0" cy="-22" rx="12" ry="16" fill="${mix(F, "#ffffff", 0.55)}"/>` +
    `<path d="M-22 -84 L-24 -108 L-6 -94Z M22 -84 L24 -108 L6 -94Z" fill="${F}"${k.s}/>` +
    `<circle cx="0" cy="-82" r="24" fill="${F}"${k.s}/>` + eye(-9, -86, 4, k.ink) + eye(9, -86, 4, k.ink) +
    `<path d="M-3 -77 h6 l-3 3z" fill="#e88a9a"/><path d="M-26 -78 h-14 M-26 -74 l-12 4 M26 -78 h14 M26 -74 l12 4" stroke="${k.ink}" stroke-width="1.6"/>` + cheek(-14, -74, 4) + cheek(14, -74, 4);
}
function dog(k: Kit, fur = "#d8b07a") {
  const F = k.c(fur);
  const D = mix(F, "#5a3a22", 0.45);
  return `<ellipse cx="0" cy="-3" rx="40" ry="7" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-26 -20 q-22 -14 -20 -34" stroke="${F}" stroke-width="9" fill="none" stroke-linecap="round"/>` +
    `<path d="M-28 -4 C-34 -44 -14 -64 2 -64 C18 -64 34 -44 28 -4Z" fill="${F}"${k.s}/><ellipse cx="2" cy="-24" rx="13" ry="16" fill="${mix(F, "#ffffff", 0.5)}"/>` +
    `<circle cx="2" cy="-86" r="27" fill="${F}"${k.s}/><ellipse cx="14" cy="-92" rx="9" ry="8" fill="${D}" opacity=".7"/>` +
    [-1, 1].map((sd) => `<ellipse cx="${2 + sd * 26}" cy="-82" rx="10" ry="20" transform="rotate(${sd * -18} ${2 + sd * 26} -82)" fill="${D}"${k.s}/>`).join("") +
    `<ellipse cx="2" cy="-74" rx="13" ry="10" fill="${mix(F, "#ffffff", 0.55)}"${k.t}/><ellipse cx="2" cy="-78" rx="5.5" ry="4" fill="${k.ink}"/>` +
    eye(-8, -92, 4, k.ink) + eye(12, -92, 4, k.ink) + `<path d="M0 -68 q3 8 6 0" fill="#e86a7a"/>`;
}
function snail(k: Kit) {
  return `<ellipse cx="0" cy="-2" rx="34" ry="5" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-30 -2 C-30 -12 20 -14 34 -8 C40 -20 40 -38 34 -44 M38 -40 l-4 -14 M42 -40 l6 -12" stroke="${k.ink}" stroke-width="2" fill="none"/>` +
    `<path d="M-30 -2 C-30 -14 20 -14 34 -6 C44 -16 44 -34 36 -40 C28 -32 30 -20 26 -12 C18 -8 -18 -8 -30 -2Z" fill="${k.c("#c8d8a0")}"${k.s}/>` +
    `<circle cx="-4" cy="-26" r="22" fill="${k.c("#d9a05a")}"${k.s}/><path d="M-4 -26 m-12 0 a12 12 0 1 0 12 -12 a8 8 0 1 0 -8 8" stroke="${mix("#d9a05a", "#5a3a22", 0.5)}" stroke-width="2.5" fill="none"/>` +
    eye(36, -40, 2.6, k.ink);
}
function mouse(k: Kit) {
  const G = k.c("#a9a6ae");
  return `<ellipse cx="0" cy="-2" rx="24" ry="4" fill="rgba(0,0,0,.12)"/><path d="M-20 -8 q-20 4 -26 -10" stroke="${G}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="-14" rx="22" ry="13" fill="${G}"${k.s}/><circle cx="14" cy="-30" r="10" fill="${G}"${k.t}/><circle cx="14" cy="-30" r="5" fill="#f3c2cc"/>` +
    `<circle cx="20" cy="-18" r="9" fill="${G}"${k.t}/>` + eye(22, -20, 2.4, k.ink) + `<circle cx="29" cy="-16" r="2.4" fill="#e88a9a"/>`;
}
function firefly(k: Kit) {
  return `<circle cx="0" cy="-20" r="24" fill="#fff3a0" opacity=".45"/><circle cx="0" cy="-20" r="14" fill="#fff6b8" opacity=".7"/>` +
    `<ellipse cx="-4" cy="-30" rx="9" ry="6" fill="#e8f4ff" opacity=".85"${k.t}/><ellipse cx="6" cy="-30" rx="9" ry="6" fill="#e8f4ff" opacity=".85"${k.t}/>` +
    `<ellipse cx="0" cy="-20" rx="7" ry="9" fill="#f6d84a"${k.t}/><circle cx="0" cy="-30" r="5" fill="#4a4a52"/>`;
}
function goat(k: Kit) {
  const W = k.c("#ece6dc");
  return `<ellipse cx="0" cy="-3" rx="48" ry="7" fill="rgba(0,0,0,.12)"/>` +
    [-30, -16, 16, 30].map((x) => `<rect x="${x - 5}" y="-46" width="10" height="44" rx="4" fill="${W}"${k.t}/>`).join("") +
    `<ellipse cx="0" cy="-58" rx="44" ry="24" fill="${W}"${k.s}/><path d="M-42 -62 l-10 -8" stroke="${W}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M30 -100 C26 -120 40 -128 46 -118 M44 -100 C44 -120 58 -126 60 -114" stroke="#9a8a70" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="44" cy="-86" rx="17" ry="22" fill="${W}"${k.s}/><path d="M42 -66 l2 14 l6 -14z" fill="${W}"${k.t}/>` + eye(50, -90, 3.6, k.ink) +
    `<ellipse cx="28" cy="-92" rx="10" ry="5" fill="${W}"${k.t}/><ellipse cx="50" cy="-74" rx="5" ry="3" fill="#e8b0a0"/>`;
}
function deer(k: Kit) {
  const B = k.c("#a0703e");
  return `<ellipse cx="0" cy="-3" rx="56" ry="8" fill="rgba(0,0,0,.12)"/>` +
    [-36, -20, 24, 40].map((x) => `<rect x="${x - 5}" y="-74" width="10" height="72" rx="5" fill="${mix(B, "#000000", 0.15)}"${k.t}/>`).join("") +
    `<ellipse cx="0" cy="-90" rx="54" ry="28" fill="${B}"${k.s}/><ellipse cx="4" cy="-80" rx="34" ry="12" fill="${mix(B, "#ffffff", 0.45)}"/>` +
    `<path d="M34 -104 C40 -130 46 -146 52 -156 L66 -150 C60 -130 54 -114 50 -98Z" fill="${B}"${k.s}/>` +
    `<path d="M56 -168 C50 -196 40 -204 30 -214 M48 -192 l-18 -2 M66 -168 C74 -194 86 -202 96 -210 M74 -190 l18 -4" stroke="#8a6a44" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="62" cy="-162" rx="18" ry="16" fill="${B}"${k.s}/><circle cx="76" cy="-156" r="6" fill="#d8443a"/>` + eye(62, -166, 3.6, k.ink);
}
function dragon(k: Kit, big = false) {
  const B = k.c(big ? "#6fa3d8" : "#7fc4e8");
  const G = "#f6d75a";
  const star = (x: number, y: number, r: number) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      d += `${i ? "L" : "M"}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
    }
    return `<path d="${d}Z" fill="${G}"${k.t}/>`;
  };
  return `<ellipse cx="0" cy="-60" rx="96" ry="72" fill="#fff6c0" opacity=".28"/>` +
    `<path d="M-30 -60 C-80 -60 -96 -30 -110 -40" stroke="${B}" stroke-width="16" fill="none" stroke-linecap="round"/>` + star(-114, -44, 13) +
    `<path d="M-8 -84 C-30 -140 -80 -130 -80 -104 C-64 -112 -54 -100 -40 -100 C-38 -88 -24 -82 -8 -84Z" fill="${mix(B, "#ffffff", 0.35)}"${k.s}/>` +
    `<ellipse cx="-4" cy="-58" rx="40" ry="32" fill="${B}"${k.s}/><ellipse cx="4" cy="-50" rx="24" ry="18" fill="${G}" opacity=".85"/>` +
    [-16, 12].map((x) => `<ellipse cx="${x}" cy="-28" rx="9" ry="7" fill="${B}"${k.t}/>`).join("") +
    `<path d="M26 -100 l-2 -18 l10 12 Z M44 -102 l4 -18 l6 16Z" fill="${G}"${k.t}/>` +
    `<ellipse cx="38" cy="-86" rx="30" ry="24" fill="${B}"${k.s}/><ellipse cx="58" cy="-78" rx="14" ry="10" fill="${mix(B, "#ffffff", 0.3)}"${k.t}/>` +
    eye(34, -92, 5.5, k.ink) + `<circle cx="62" cy="-80" r="2" fill="${k.ink}"/>` + smile(50, -72, 8, k.ink) + cheek(26, -78, 6) +
    star(6, -50, 8);
}
function moon(k: Kit) {
  const Y = k.c("#f6dc7a");
  return `<circle cx="0" cy="-70" r="86" fill="#fff6c8" opacity=".25"/>` +
    `<path d="M-10 -140 A70 70 0 1 0 -10 0 A54 54 0 1 1 -10 -140Z" fill="${Y}"${k.s}/>` +
    `<path d="M-40 -82 q8 6 16 0" stroke="${k.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>` + smile(-38, -54, 10, k.ink, 3) + cheek(-50, -66, 7);
}
function robot(k: Kit) {
  const M = k.c("#dfe5ec");
  const acc = k.acc[0] ?? "#3e8ed0";
  return `<ellipse cx="0" cy="-3" rx="36" ry="6" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M0 -112 v-14" stroke="${k.ink}" stroke-width="3"/><circle cx="0" cy="-130" r="6" fill="#f2c94c"${k.t}/>` +
    [-1, 1].map((sd) => `<path d="M${sd * 34} -60 q${sd * 16} 10 ${sd * 12} 28" stroke="${M}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join("") +
    `<circle cx="0" cy="-56" r="44" fill="${M}"${k.s}/><rect x="-28" y="-84" width="56" height="34" rx="12" fill="#26324a"${k.t}/>` +
    `<circle cx="-11" cy="-68" r="5" fill="#8ff0ff"/><circle cx="11" cy="-68" r="5" fill="#8ff0ff"/><path d="M-8 -59 q8 6 16 0" stroke="#8ff0ff" stroke-width="2.4" fill="none"/>` +
    `<circle cx="0" cy="-28" r="6" fill="${acc}"/>` + [-1, 1].map((sd) => `<ellipse cx="${sd * 20}" cy="-8" rx="11" ry="7" fill="#9aa4b2"${k.t}/>`).join("");
}
function rocket(k: Kit) {
  return `<path d="M0 -10 q-16 30 -40 40 M0 -10 q4 34 0 50 M0 -10 q16 30 40 40" stroke="#9ad4f2" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M-20 -40 L-34 -10 L-18 -18Z M20 -40 L34 -10 L18 -18Z" fill="#e0503a"${k.t}/>` +
    `<path d="M-18 -14 L-18 -110 C-18 -130 18 -130 18 -110 L18 -14Z" fill="#cfeaf6" opacity=".95"${k.s}/><rect x="-18" y="-56" width="36" height="40" fill="#7fc4e8" opacity=".6"/>` +
    `<path d="M-12 -120 C-12 -150 12 -150 12 -120Z" fill="#e0503a"${k.t}/><rect x="-6" y="-18" width="12" height="8" fill="#5a6070"/>`;
}
function dino(k: Kit) {
  const G = k.c("#78b86a");
  const baby = `<g transform="translate(-110 0) scale(.42)"><path d="M-40 -60 C-90 -60 -110 -40 -130 -50 C-110 -30 -70 -20 -40 -26Z" fill="${G}"${k.s}/><ellipse cx="0" cy="-60" rx="44" ry="34" fill="${mix(G, "#f6e6a0", 0.3)}"${k.s}/><rect x="-16" y="-34" width="14" height="34" rx="6" fill="${G}"/><rect x="10" y="-34" width="14" height="34" rx="6" fill="${G}"/><circle cx="40" cy="-100" r="30" fill="${mix(G, "#f6e6a0", 0.3)}"${k.s}/>${eye(48, -106, 6, k.ink)}${smile(54, -88, 8, k.ink)}</g>`;
  return `<ellipse cx="-20" cy="-4" rx="110" ry="9" fill="rgba(0,0,0,.12)"/>` + baby +
    `<path d="M-50 -110 C-120 -110 -150 -80 -180 -96 C-150 -60 -100 -60 -50 -66Z" fill="${G}"${k.s}/>` +
    [-24, 22].map((x) => `<path d="M${x - 12} -70 L${x - 12} -6 L${x + 16} -6 L${x + 12} -70Z" fill="${mix(G, "#000000", 0.1)}"${k.t}/>`).join("") +
    `<ellipse cx="0" cy="-104" rx="66" ry="52" fill="${G}"${k.s}/><ellipse cx="8" cy="-90" rx="40" ry="28" fill="${mix(G, "#f6e6a0", 0.55)}"/>` +
    `<path d="M40 -140 C50 -180 60 -200 70 -210 L96 -200 C86 -180 76 -150 64 -120Z" fill="${G}"${k.s}/>` +
    `<ellipse cx="94" cy="-210" rx="34" ry="24" fill="${G}"${k.s}/>` + eye(96, -218, 6, k.ink) + smile(112, -200, 10, k.ink) + cheek(86, -202, 7) +
    [-40, -20, 0, 20].map((x, i) => `<path d="M${x - 10} ${-152 + i * 2} l10 -16 l10 16Z" fill="#f2a640"${k.t}/>`).join("") +
    `<path d="M50 -110 q16 8 20 22" stroke="${G}" stroke-width="10" stroke-linecap="round" fill="none"/>`;
}
function tracks(k: Kit) {
  const C = k.c("#8a6e52");
  const foot = (x: number, y: number, s: number) =>
    `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)}) rotate(90)" fill="${C}" opacity=".8"><ellipse cx="0" cy="0" rx="10" ry="8"/><path d="M-4 -4 L-22 -18 L-6 -2Z M0 -6 L0 -28 L6 -4Z M4 -4 L22 -18 L6 2Z"/></g>`;
  return [0, 1, 2, 3, 4].map((i) => foot(-150 + i * 72, -6 + (i % 2 ? -14 : 0), 1.3)).join("") + [0, 1, 2, 3, 4, 5].map((i) => foot(-140 + i * 54, 22 + (i % 2 ? -10 : 0), 0.7)).join("");
}
function bell(k: Kit) {
  const Y = k.c("#e2b23c");
  return `<path d="M0 -92 v-14" stroke="#c0503a" stroke-width="5"/><path d="M-14 -106 q14 -12 28 0" stroke="#c0503a" stroke-width="5" fill="none"/>` +
    `<path d="M-34 -10 C-30 -40 -28 -86 0 -92 C28 -86 30 -40 34 -10 Q0 -2 -34 -10Z" fill="${Y}"${k.s}/><circle cx="0" cy="-4" r="8" fill="${mix(Y, "#5a3a10", 0.4)}"${k.t}/>` +
    `<path d="M-18 -70 q-6 20 -6 40" stroke="#fff6c8" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>` +
    eye(-10, -50, 3.6, k.ink) + eye(10, -50, 3.6, k.ink) + smile(0, -38, 7, k.ink) + cheek(-16, -40, 5) + cheek(16, -40, 5);
}

// ── люди-персонажи: один «книжный» человечек с разной одеждой ──
interface PersonO {
  coat: string;
  trim?: string;
  skin?: string;
  hair?: string;
  beard?: string;
  hat?: "frost" | "kokoshnik" | "chef" | "wide" | "cap" | "fur" | "wreath" | "pompom" | "none";
  hatColor?: string;
  long?: boolean;
  braid?: boolean;
  staff?: boolean;
  glasses?: boolean;
  apron?: boolean;
  /** Что в руке: ключ, звезда. */
  holding?: "key" | "star" | "watch";
}
function person(k: Kit, o: PersonO) {
  const C = k.c(o.coat);
  const T = o.trim ? k.c(o.trim) : mix(C, "#ffffff", 0.6);
  const skin = o.skin ?? "#f2d0b4";
  const hair = o.hair ?? "#6a4a32";
  const hc = -250;
  let out = `<ellipse cx="0" cy="-4" rx="58" ry="9" fill="rgba(0,0,0,.12)"/>`;
  if (o.braid) out += `<path d="M18 ${hc + 10} C40 ${hc + 60} 36 ${hc + 120} 28 ${hc + 150}" stroke="${hair}" stroke-width="14" fill="none" stroke-linecap="round"/>`;
  if (o.staff) out += `<path d="M66 -4 L60 ${hc - 10}" stroke="#c9d8e8" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="${hc - 18}" r="13" fill="#eaf6ff"${k.t}/>`;
  if (!o.long) out += [-14, 14].map((x) => `<rect x="${x - 9}" y="-90" width="18" height="86" rx="6" fill="${k.c("#4a5068")}"${k.t}/>`).join("");
  out += [-16, 16].map((x) => `<ellipse cx="${x}" cy="-6" rx="16" ry="8" fill="#4a3a32"${k.t}/>`).join("");
  const hem = o.long ? -8 : -86;
  out += `<path d="M-30 ${hc + 64} Q0 ${hc + 52} 30 ${hc + 64} L${o.long ? 58 : 40} ${hem} Q0 ${hem + 10} ${o.long ? -58 : -40} ${hem}Z" fill="${C}"${k.s}/>`;
  if (o.trim) out += `<path d="M${o.long ? -56 : -40} ${hem - 6} Q0 ${hem + 4} ${o.long ? 56 : 40} ${hem - 6}" stroke="${T}" stroke-width="12" fill="none"/><path d="M0 ${hc + 60} V${hem}" stroke="${T}" stroke-width="10"/>`;
  if (o.apron) out += `<path d="M-22 ${hc + 120} H22 L26 ${hem + 30} H-26Z" fill="#ffffff"${k.t}/>`;
  out += [-1, 1].map((sd) => `<path d="M${sd * 28} ${hc + 70} Q${sd * 48} ${hc + 120} ${sd * 44} ${hc + 160}" stroke="${C}" stroke-width="20" fill="none" stroke-linecap="round"/>${o.trim ? `<path d="M${sd * 44} ${hc + 148} v8" stroke="${T}" stroke-width="22"/>` : ""}<circle cx="${sd * 44}" cy="${hc + 166}" r="10" fill="${skin}"${k.t}/>`).join("");
  if (o.holding === "key") out += `<g transform="translate(52 ${hc + 168}) rotate(30)"><rect x="-4" y="0" width="8" height="40" fill="#e2b23c"/><circle cx="0" cy="-6" r="10" fill="none" stroke="#e2b23c" stroke-width="6"/><rect x="4" y="30" width="10" height="6" fill="#e2b23c"/></g>`;
  if (o.holding === "watch") out += `<circle cx="-44" cy="${hc + 178}" r="11" fill="#f2c94c"${k.t}/><circle cx="-44" cy="${hc + 178}" r="7" fill="#fffaf0"/>`;
  out += `<circle cx="0" cy="${hc}" r="38" fill="${skin}"${k.s}/>`;
  if (o.hat !== "frost" && o.hat !== "fur" && o.hat !== "pompom") out += `<path d="M-38 ${hc} C-40 ${hc - 50} 40 ${hc - 50} 38 ${hc} C30 ${hc - 26} -30 ${hc - 26} -38 ${hc}Z" fill="${hair}"${k.t}/>`;
  if (o.long && !o.beard && o.hat !== "fur") out += [-1, 1].map((sd) => `<path d="M${sd * 36} ${hc - 6} Q${sd * 46} ${hc + 40} ${sd * 34} ${hc + 70}" stroke="${hair}" stroke-width="12" fill="none" stroke-linecap="round"/>`).join("");
  out += eye(-13, hc - 4, 4.5, k.ink) + eye(13, hc - 4, 4.5, k.ink) + cheek(-20, hc + 10, 6) + cheek(20, hc + 10, 6);
  if (o.glasses) out += `<g fill="none" stroke="${k.ink}" stroke-width="2.5"><circle cx="-13" cy="${hc - 4}" r="10"/><circle cx="13" cy="${hc - 4}" r="10"/><path d="M-3 ${hc - 4} h6"/></g>`;
  if (o.beard) out += `<path d="M-32 ${hc + 4} C-34 ${hc + 70} -10 ${hc + 96} 0 ${hc + 100} C10 ${hc + 96} 34 ${hc + 70} 32 ${hc + 4} C20 ${hc + 26} -20 ${hc + 26} -32 ${hc + 4}Z" fill="${o.beard}"${k.t}/><path d="M-16 ${hc + 14} q16 -8 32 0" stroke="${o.beard}" stroke-width="10" stroke-linecap="round"/>`;
  else out += smile(0, hc + 14, 9, k.ink);
  const H = o.hatColor ? k.c(o.hatColor) : C;
  switch (o.hat) {
    case "frost":
      out += `<path d="M-36 ${hc - 16} C-36 ${hc - 70} 36 ${hc - 70} 36 ${hc - 16}Z" fill="${H}"${k.s}/><rect x="-40" y="${hc - 24}" width="80" height="16" rx="8" fill="#fbfaf6"${k.t}/>`;
      break;
    case "fur":
      out += `<path d="M-38 ${hc - 14} C-38 ${hc - 62} 38 ${hc - 62} 38 ${hc - 14}Z" fill="${H}"${k.s}/><rect x="-42" y="${hc - 24}" width="84" height="18" rx="9" fill="${mix(H, "#ffffff", 0.3)}"${k.t}/>`;
      break;
    case "pompom":
      out += `<circle cx="0" cy="${hc - 64}" r="12" fill="#fbfaf6"${k.t}/><path d="M-36 ${hc - 14} C-36 ${hc - 66} 36 ${hc - 66} 36 ${hc - 14}Z" fill="${H}"${k.s}/><rect x="-38" y="${hc - 22}" width="76" height="12" rx="6" fill="${mix(H, "#000000", 0.15)}"/>`;
      break;
    case "kokoshnik":
      out += `<path d="M-40 ${hc - 16} C-40 ${hc - 76} 40 ${hc - 76} 40 ${hc - 16} C24 ${hc - 26} -24 ${hc - 26} -40 ${hc - 16}Z" fill="${H}"${k.s}/>` + [-20, 0, 20].map((x) => `<circle cx="${x}" cy="${hc - 48 + Math.abs(x) * 0.4}" r="4" fill="#ffffff"/>`).join("");
      break;
    case "chef":
      out += `<rect x="-28" y="${hc - 50}" width="56" height="28" fill="#ffffff"${k.t}/><circle cx="-20" cy="${hc - 62}" r="18" fill="#ffffff"${k.t}/><circle cx="20" cy="${hc - 62}" r="18" fill="#ffffff"${k.t}/><circle cx="0" cy="${hc - 72}" r="22" fill="#ffffff"${k.t}/>`;
      break;
    case "wide":
      out += `<ellipse cx="0" cy="${hc - 26}" rx="64" ry="12" fill="${H}"${k.s}/><path d="M-30 ${hc - 28} C-30 ${hc - 64} 30 ${hc - 64} 30 ${hc - 28}Z" fill="${H}"${k.s}/>`;
      break;
    case "cap":
      out += `<path d="M-36 ${hc - 18} C-36 ${hc - 62} 36 ${hc - 62} 36 ${hc - 18}Z" fill="${H}"${k.s}/><path d="M10 ${hc - 22} Q44 ${hc - 26} 56 ${hc - 16} Q30 ${hc - 12} 10 ${hc - 16}Z" fill="${mix(H, "#000000", 0.2)}"${k.t}/>`;
      break;
    case "wreath":
      out += [-34, -20, -6, 8, 22, 34].map((x, i) => `<circle cx="${x}" cy="${hc - 30 - (i % 2) * 6 + Math.abs(x) * 0.25}" r="9" fill="${["#f28fb1", "#f6d75a", "#ffffff", "#9b72cf", "#f28fb1", "#f6d75a"][i]}"${k.t}/>`).join("") + `<path d="M-38 ${hc - 22} Q0 ${hc - 46} 38 ${hc - 22}" stroke="#5cae6a" stroke-width="5" fill="none"/>`;
      break;
  }
  if (o.holding === "star") out += `<circle cx="44" cy="${hc + 150}" r="16" fill="#f6d75a"${k.t}/>`;
  return out;
}
function giant(k: Kit) {
  // сидит у тропинки, держит большой ключ
  const C = k.c("#7a8f5a");
  return `<ellipse cx="0" cy="-4" rx="110" ry="12" fill="rgba(0,0,0,.12)"/>` +
    `<path d="M-70 -10 C-80 -70 -40 -90 0 -90 C40 -90 80 -70 70 -10Z" fill="${k.c("#5a4a3a")}"${k.s}/>` +
    [-1, 1].map((sd) => `<ellipse cx="${sd * 50}" cy="-12" rx="28" ry="14" fill="#4a3a32"${k.t}/>`).join("") +
    `<path d="M-64 -80 Q0 -100 64 -80 L54 -200 Q0 -220 -54 -200Z" fill="${C}"${k.s}/>` +
    `<path d="M54 -180 Q100 -140 70 -100" stroke="${C}" stroke-width="30" fill="none" stroke-linecap="round"/><circle cx="70" cy="-96" r="17" fill="#f2d0b4"${k.t}/>` +
    `<g transform="translate(84 -116) rotate(-30)"><rect x="-6" y="0" width="12" height="70" fill="#e2b23c"${k.t}/><circle cx="0" cy="-12" r="18" fill="none" stroke="#e2b23c" stroke-width="9"/><rect x="6" y="54" width="18" height="10" fill="#e2b23c"/></g>` +
    `<path d="M-54 -180 Q-90 -140 -60 -100" stroke="${C}" stroke-width="30" fill="none" stroke-linecap="round"/><circle cx="-60" cy="-96" r="17" fill="#f2d0b4"${k.t}/>` +
    `<circle cx="0" cy="-250" r="56" fill="#f2d0b4"${k.s}/><path d="M-50 -246 C-56 -180 56 -180 50 -246 C30 -220 -30 -220 -50 -246Z" fill="#a0703e"${k.t}/>` +
    `<path d="M-56 -260 C-60 -320 60 -320 56 -260 C40 -290 -40 -290 -56 -260Z" fill="#a0703e"${k.t}/>` +
    eye(-18, -258, 6, k.ink) + eye(18, -258, 6, k.ink) + `<ellipse cx="0" cy="-240" rx="9" ry="7" fill="#e8a888"/>` + smile(0, -222, 12, k.ink) + cheek(-32, -238, 8) + cheek(32, -238, 8);
}

/** Каталог персонажей. Порядок важен для подписи: первыми — главные спутники. */
export const CAST: CastDef[] = [
  { key: "dragon", ru: "звёздный дракончик", en: /\bdragon\b/i, rus: /дракон/i, place: "air", w: 230, h: 150, draw: (k) => dragon(k) },
  { key: "dragon-mother", ru: "мама-дракониха", en: /mother (star )?dragon/i, place: "air", w: 230, h: 150, draw: (k) => dragon(k, true) },
  { key: "ded-moroz", ru: "Дед Мороз", en: /grandfather frost|ded moroz|father frost/i, rus: /дед[а-я]* мороз/i, place: "ground", w: 150, h: 330, draw: (k) => person(k, { coat: "#c8343a", trim: "#fbfaf6", beard: "#fbfaf6", hair: "#f4f4f4", hat: "frost", long: true, staff: true }) },
  { key: "snegurochka", ru: "Снегурочка", en: /snow maiden/i, rus: /снегурочк/i, place: "ground", w: 130, h: 300, draw: (k) => person(k, { coat: "#7fb8e0", trim: "#fbfaf6", hair: "#e6c27a", hat: "kokoshnik", hatColor: "#3d6fc4", long: true, braid: true }) },
  { key: "owl", ru: "сова", en: /\b(?<!plasticine )owls?\b/i, rus: /(?<![а-яё])сов(а|ы|у|ой|е)(?![а-яё])/i, place: "air", w: 110, h: 120, draw: (k) => owl(k) },
  { key: "owlet", ru: "совёнок", en: /\bowlets?\b/i, rus: /совён|совят/i, place: "air", w: 70, h: 76, draw: (k) => `<g transform="scale(.62)">${owl(k, "#b4946e", "#f4ead2")}</g>` },
  { key: "fox", ru: "лиса", en: /\bfox(es)?\b/i, rus: /(?<![а-яё])лис(а|ы|у|ой|ичк|ёнок|ица)/i, place: "ground", w: 200, h: 110, draw: (k) => fox(k) },
  { key: "hare", ru: "заяц", en: /\b(?<!plush |toy )(hares?|bunny|rabbit)\b/i, rus: /(?<![а-яё])(заяц|зайк|зайч|зайц)/i, place: "ground", w: 100, h: 136, draw: (k) => hare(k) },
  { key: "squirrel", ru: "белка", en: /\bsquirrels?\b/i, rus: /белк|бельчон/i, place: "ground", w: 90, h: 100, draw: (k) => squirrel(k) },
  { key: "bear", ru: "медведица", en: /\b(mother bear|big (kind )?bear)\b/i, rus: /медведиц/i, place: "ground", w: 140, h: 180, draw: (k) => bear(k) },
  { key: "bear-cub", ru: "медвежонок", en: /\bbear cubs?\b/i, rus: /медвеж|мишутк/i, place: "ground", w: 90, h: 110, draw: (k) => `<g transform="scale(.6)">${bear(k, "#9a6a46")}</g>` },
  { key: "bullfinch", ru: "снегирь", en: /\bbullfinch(es)?\b/i, rus: /снегир/i, place: "air", w: 80, h: 60, draw: (k) => bird(k, "#5a6072", "#e0503a", "#26262c", "#3a3a3a") },
  { key: "sparrow", ru: "воробей", en: /\b(sparrows?|little birds?)\b/i, rus: /вороб/i, place: "air", w: 80, h: 60, draw: (k) => bird(k, "#a07850", "#eadcc4", "#7a5434") },
  { key: "crow", ru: "ворона", en: /\bcrows?\b/i, rus: /ворон(а|ы|у|ой)/i, place: "air", w: 80, h: 60, draw: (k) => bird(k, "#3a3a44", "#6a6a74", undefined, "#4a4a4a") },
  { key: "pigeon", ru: "голубь", en: /\bpigeons?\b/i, rus: /голуб(ь|и|ей)/i, place: "air", w: 80, h: 60, draw: (k) => bird(k, "#8a96aa", "#c8b0c8") },
  { key: "duck", ru: "уточка", en: /\bducks?\b/i, rus: /(?<![а-яё])ут(к|оч|ён)/i, place: "ground", w: 90, h: 70, draw: (k) => duck(k) },
  { key: "goose", ru: "гусь", en: /\bgeese|goose\b/i, rus: /(?<![а-яё])гус(ь|я|ю|ём|и)/i, place: "ground", w: 120, h: 120, draw: (k) => goose(k) },
  { key: "frog", ru: "лягушка", en: /\bfrogs?\b/i, rus: /лягуш/i, place: "ground", w: 80, h: 62, draw: (k) => frog(k) },
  { key: "whale", ru: "кит", en: /\bwhales?\b/i, rus: /(?<![а-яё])кит(|а|у|ом|ы)(?![а-яё])/i, place: "air", w: 400, h: 170, draw: (k) => whale(k) },
  { key: "fish", ru: "рыбки", en: /\bfish\b/i, rus: /(?<![а-яё])рыб(к|ы|ок)/i, place: "air", w: 150, h: 110, draw: (k) => fishes(k) },
  { key: "catfish", ru: "сом", en: /\bcatfish\b/i, rus: /(?<![а-яё])сом(|а|у|ом)(?![а-яё])/i, place: "air", w: 140, h: 60, draw: (k) => fish(k, "#7a8a6a", 0, -30, 1.6, true) },
  { key: "octopus", ru: "осьминог", en: /\boctopus\b/i, rus: /осьминог/i, place: "air", w: 130, h: 130, draw: (k) => octopus(k) },
  { key: "hedgehog", ru: "ёжик", en: /\b(?<!plasticine )hedgehogs?\b/i, rus: /(?<![а-яё])(ёж|ёжик|ежик|ежонок|ёжич)/i, place: "ground", w: 110, h: 60, draw: (k) => hedgehog(k) },
  { key: "cat", ru: "кошка", en: /\b(cat|kitten|kitty)s?\b(?! in a sun hat)/i, rus: /(?<![а-яё])(кот|кош|котён|котик)(?!ор)/i, place: "ground", w: 80, h: 110, draw: (k) => cat(k) },
  { key: "dog", ru: "собака", en: /\b(dog|puppy)s?\b/i, rus: /(?<![а-яё])(собак|щен|пёс|пса)/i, place: "ground", w: 90, h: 116, draw: (k) => dog(k) },
  { key: "snail", ru: "улитка", en: /\bsnails?\b/i, rus: /улитк/i, place: "ground", w: 90, h: 50, draw: (k) => snail(k) },
  { key: "mouse", ru: "мышка", en: /\b(mouse|mice)\b/i, rus: /(?<![а-яё])мыш/i, place: "ground", w: 60, h: 40, draw: (k) => mouse(k) },
  { key: "firefly", ru: "светлячок", en: /\bfirefl(y|ies)\b/i, rus: /светлячк|светлячок/i, place: "air", w: 50, h: 50, draw: (k) => firefly(k) },
  { key: "goat", ru: "коза", en: /\bgoats?\b/i, rus: /(?<![а-яё])коз(а|ы|у|ой|ёл|оч)/i, place: "ground", w: 130, h: 132, draw: (k) => goat(k) },
  { key: "reindeer", ru: "олень", en: /\b(reindeer|deer)\b/i, rus: /олен/i, place: "ground", w: 170, h: 220, draw: (k) => deer(k) },
  { key: "moon", ru: "Месяц", en: /\b(crescent moon|smiling moon)\b/i, rus: /(?<![а-яё])месяц/i, place: "air", w: 150, h: 150, draw: (k) => moon(k) },
  { key: "giant", ru: "великан", en: /\b(?<!drawings of )giants?\b(?! with backpacks)/i, rus: /великан/i, place: "ground", w: 210, h: 320, draw: (k) => giant(k) },
  { key: "cook", ru: "повар", en: /\bcook\b/i, rus: /(?<![а-яё])повар/i, place: "ground", w: 120, h: 330, draw: (k) => person(k, { coat: "#f4f2ec", trim: "#e05a4f", hat: "chef", beard: undefined, apron: true }) },
  { key: "spring", ru: "Весна", en: /\bSpring as\b|\bSpring\b(?= )/, rus: /(?<![а-яё])Весн(а|у|ой|е|ы)/, place: "ground", w: 130, h: 300, draw: (k) => person(k, { coat: "#7cc47a", trim: "#f6d75a", hair: "#d9a05a", hat: "wreath", long: true, braid: true }) },
  { key: "winter", ru: "Зима", en: /\bWinter as\b/, rus: /(?<![а-яё])Зим(а|ушк)(?![а-яё]*\s+(?:приш|был))/, place: "ground", w: 130, h: 300, draw: (k) => person(k, { coat: "#e4eef8", trim: "#9cc4e8", hair: "#f4f4f4", hat: "kokoshnik", hatColor: "#cfe2f4", long: true }) },
  { key: "robot", ru: "робот", en: /\brobot\b/i, rus: /робот/i, place: "ground", w: 100, h: 140, draw: (k) => robot(k) },
  { key: "rocket", ru: "ракета", en: /\brocket\b/i, rus: /ракет/i, place: "air", w: 80, h: 150, draw: (k) => rocket(k) },
  { key: "dinosaur", ru: "динозавр", en: /\bdinosaurs?\b(?! footprints)/i, rus: /динозавр(?![а-яё]*\s+след)/i, place: "ground", w: 300, h: 240, draw: (k) => dino(k) },
  { key: "tracks", ru: "следы динозавра", en: /\b(three-toed )?footprints?\b/i, rus: /след(ы|ов|ам)?(?![а-яё])/i, place: "trail", w: 320, h: 40, draw: (k) => tracks(k) },
  { key: "bell", ru: "колокольчик", en: /\b(shy |little |brass )bell\b(?=[^.]*\b(face|smile|braver|blushing|worried|tiny)\b)/i, place: "air", w: 80, h: 110, draw: (k) => bell(k) },
  { key: "tiny-girl", ru: "крошечная девочка", en: /\btiny girl\b/i, place: "air", w: 50, h: 100, draw: (k) => `<g transform="scale(.3)">${person(k, { coat: "#e05a4f", trim: "#fbfaf6", hat: "pompom", hatColor: "#3d6fc4", hair: "#a0703e", long: true, holding: "watch" })}</g>` },
  { key: "scientist", ru: "учёная", en: /\bscientist\b/i, place: "ground", w: 120, h: 300, draw: (k) => person(k, { coat: "#c9a66b", hat: "wide", hatColor: "#e8d6a6", hair: "#6a4a32", long: false }) },
  { key: "engineer", ru: "сосед-инженер", en: /\bengineer\b/i, place: "ground", w: 120, h: 300, draw: (k) => person(k, { coat: "#6a7a5a", hat: "cap", hatColor: "#4a5068", hair: "#c9c9c9", beard: undefined, glasses: true }) },
  { key: "janitor", ru: "дворник", en: /\bjanitor\b/i, rus: /дворник/i, place: "ground", w: 120, h: 300, draw: (k) => person(k, { coat: "#4a5a72", hat: "fur", hatColor: "#7a5a42", hair: "#7a5a42", beard: "#9a8a7a" }) },
];
const BY_KEY = new Map(CAST.map((c) => [c.key, c]));
export const castDef = (key: string) => BY_KEY.get(key);

/** Кто в сцене: по словам сцены (EN), иначе — по тексту (RU). «Совёнок» не даёт «сову», «мама-дракониха» — дракона рядом. */
export function castFromText(scene?: string, text?: string): string[] {
  const out: string[] = [];
  for (const c of CAST) if ((scene && c.en.test(scene)) || (!scene && text && c.rus?.test(text))) out.push(c.key);
  // owlet без отдельной совы в сцене: /owl/ не ловит owlet (граница слова), ок
  return out;
}

const CHILD_PLOTS: Plot[] = [...KIDS_PLOTS, ...KIDS_MORE_PLOTS, ...NEWYEAR_PLOTS, ...KIDS_GROUP_PLOTS];
const PLOT_BY_SLUG = new Map(CHILD_PLOTS.map((p) => [p.slug, p]));

/** Персонажи разворота: явный список (PlotSpread.cast), иначе — по сцене и тексту. */
export function spreadCast(s: Pick<PlotSpread, "scene" | "text" | "cast">): string[] {
  return (s.cast ?? castFromText(s.scene, s.text)).filter((k) => BY_KEY.has(k));
}

/**
 * Обложка: главный спутник книги рядом с героем — первый, кого называет сцена обложки (дракончик, Дед Мороз, сова),
 * а если сцена никого не называет — кто чаще всех на разворотах (от трёх раз). Следы на земле — в придачу.
 */
export function coverCast(p: Pick<Plot, "coverScene" | "spreads">): string[] {
  const freq = new Map<string, number>();
  for (const s of p.spreads) for (const k of spreadCast(s)) freq.set(k, (freq.get(k) ?? 0) + 1);
  const scene = p.coverScene ?? "";
  // Только те, кто есть на разворотах (явный список книги главнее слов сцены обложки)
  const fromCover = castFromText(scene).filter((k) => freq.has(k));
  const at = (k: string) => scene.search(BY_KEY.get(k)!.en);
  const main = fromCover.filter((k) => BY_KEY.get(k)!.place !== "trail").sort((a, b) => at(a) - at(b));
  const pool = main.length ? main : [...freq.keys()].filter((k) => (freq.get(k) ?? 0) >= 3 && BY_KEY.get(k)!.place !== "trail").sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
  return [...pool.slice(0, 1), ...fromCover.filter((k) => BY_KEY.get(k)!.place === "trail")];
}

/** Персонажи на картинке книги slug: 0 — обложка, 1..12 — развороты. Чужая книга — по сцене. */
export function castFor(slug: string, index: number, scene?: string): string[] {
  const p = PLOT_BY_SLUG.get(slug);
  if (!p) return scene ? castFromText(scene) : [];
  if (index === 0) return coverCast(p);
  const s = p.spreads[index - 1];
  return s ? spreadCast(s) : [];
}

/** Рисует персонажа: ступни в (x, y), масштаб, взгляд к герою (flip — смотрит влево). */
export function drawCast(key: string, o: { x: number; y: number; scale: number; flip?: boolean; style: ArtStyleDemo }): string {
  const c = BY_KEY.get(key);
  if (!c) return "";
  const st = o.style;
  const lw = { thin: 2.2, bold: 4, sketch: 3, none: 0 }[st.line];
  const ink = st.palette.ink;
  const dash = st.line === "sketch" ? ` stroke-dasharray="16 3"` : "";
  const kit: Kit = {
    s: lw ? ` stroke="${ink}" stroke-width="${lw}" stroke-linejoin="round"${dash}` : "",
    t: lw ? ` stroke="${ink}" stroke-width="${f(Math.max(1.3, lw * 0.6))}" stroke-linejoin="round"` : "",
    ink: mix(ink, "#2b2320", 0.5),
    // Цвета персонажа чуть тянутся к бумаге стиля — чтобы жил в той же палитре
    c: (hex) => mix(hex, st.palette.paper, 0.1),
    acc: st.palette.accents,
  };
  return `<g data-cast="${key}" transform="translate(${f(o.x)} ${f(o.y)}) scale(${f(o.flip ? -o.scale : o.scale)} ${f(o.scale)})">${c.draw(kit)}</g>`;
}

/** Слоты для персонажей: свободные полосы кадра вне героев (и мимо водяного знака и текста). */
export function layoutCast(keys: string[], o: { W: number; H: number; zoneLo: number; zoneHi: number; feet: number; heroScale: number; heroX: number; textBottom: number; crowd?: boolean }) {
  const list = keys.map((k) => BY_KEY.get(k)!).filter(Boolean).slice(0, 8);
  if (!list.length) return [];
  const M = 22;
  const segs = ([[M, o.zoneLo - M], [o.zoneHi + M, o.W - M]] as [number, number][]).filter(([a, b]) => b - a > 40);
  const free = segs.reduce((s, [a, b]) => s + b - a, 0);
  if (!free) return [];
  // Не выше нижнего края текста: высокие (Дед Мороз, великан) ужимаются, чтобы голова не уходила под текст
  const k0 = o.heroScale * (o.crowd ? 0.75 : 1);
  const scaleOf = (c: CastDef) => {
    let s = k0;
    if (c.place === "ground") s = Math.min(s, (o.feet - o.textBottom) / c.h);
    if (c.place === "air") s = Math.min(s, ((o.feet - o.textBottom) * 0.62) / c.h);
    return s;
  };
  const need = list.reduce((w, c) => w + c.w * scaleOf(c) + 18, 0);
  const fit = Math.min(1, Math.max(0.45, free / need));
  // Раскладка: от героя наружу, сначала в большую полосу
  const order = segs.map((s, i) => ({ s, i, near: i === 0 ? s[1] : s[0], dir: i === 0 ? -1 : 1 })).sort((a, b) => b.s[1] - b.s[0] - (a.s[1] - a.s[0]));
  const out: { key: string; x: number; y: number; scale: number; flip: boolean }[] = [];
  const cursor = order.map((g) => g.near);
  let gi = 0;
  for (const c of list) {
    const scale = scaleOf(c) * fit;
    const w = c.w * scale;
    let placed = false;
    for (let t = 0; t < order.length && !placed; t++) {
      const g = (gi + t) % order.length;
      const { s, dir } = order[g];
      const from = cursor[g];
      const x = from + dir * (w / 2 + 6);
      if (x - w / 2 < s[0] - 1 || x + w / 2 > s[1] + 1) continue;
      cursor[g] = x + dir * (w / 2 + 12);
      // на разворотах — не на сгибе посередине
      const xx = o.W > o.H * 1.5 && Math.abs(x - o.W / 2) < 50 ? x + (x < o.W / 2 ? -50 : 50) : x;
      const ground = o.feet - (o.crowd ? 6 : 14);
      const y = c.place === "air" ? Math.max(o.textBottom + c.h * scale + 10, o.feet - (o.feet - o.textBottom) * 0.42) : c.place === "trail" ? o.feet + 34 : ground;
      out.push({ key: c.key, x: xx, y, scale, flip: xx > o.heroX });
      placed = true;
      gi = g;
    }
  }
  return out;
}
