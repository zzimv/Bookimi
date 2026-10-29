// Реквизит сцены для демо-иллюстраций: по описанию сцены разворота (scene, англ.) — река, мост, окно, кровать,
// сани, подарки, наряженная ёлка, домики с огнями, салют, зайчонок, коробка, пылесос… и время суток (тон неба).
// Рисуется на свободной от героев стороне, за героями. Без Node API: модуль собирается и в демо-стенд.
// Зачем: у демо-темы один фон на всю книгу, и развороты выглядели одинаково; теперь у каждого — свой кадр.
import type { DemoTheme } from "../types";

export interface PropsCtx {
  W: number;
  H: number;
  /** Где стоят герои: [lo, hi] по X. */
  zoneLo: number;
  zoneHi: number;
  /** Линия ног героев. */
  feet: number;
  theme: DemoTheme;
  ink: string;
  seed: number;
  /** Сцена в помещении (стена и пол поверх уличного фона темы). */
  indoor?: boolean;
}

type Prop = { key: string; re: RegExp; draw: (x: number, c: PropsCtx, w: number) => string; width: number; sky?: boolean; band?: boolean };

const fir = (x: number, base: number, h: number, snow: boolean, deco = false) => {
  const w = h * 0.55;
  const tiers = [0, 1, 2].map((i) => {
    const top = base - h + i * h * 0.26;
    const bw = w * (0.55 + i * 0.22);
    return `<path d="M${x} ${top} L${x + bw / 2} ${top + h * 0.42} L${x - bw / 2} ${top + h * 0.42}Z" fill="#2f6b4f"/>${snow ? `<path d="M${x} ${top} L${x + bw * 0.18} ${top + h * 0.12} L${x - bw * 0.18} ${top + h * 0.12}Z" fill="#fff" opacity=".9"/>` : ""}`;
  });
  const balls = deco
    ? [0.35, 0.55, 0.75, 0.5, 0.82].map((t, i) => `<circle cx="${x + (i % 2 ? 1 : -1) * w * 0.12 * (i + 1) * 0.6}" cy="${base - h + h * t}" r="${h * 0.035}" fill="${["#e04f5f", "#f2c14e", "#4fa3e0", "#f28c28", "#e04f5f"][i]}"/>`).join("") +
      `<path d="M${x} ${base - h - h * 0.08} l${h * 0.04} ${h * 0.08} l${-h * 0.08} 0z M${x} ${base - h + h * 0.02} l${h * 0.04} ${-h * 0.08} l${-h * 0.08} 0z" fill="#f6d55c"/>`
    : "";
  return `<g><rect x="${x - h * 0.04}" y="${base - h * 0.16}" width="${h * 0.08}" height="${h * 0.16}" fill="#6b4a32"/>${tiers.join("")}${balls}</g>`;
};

const house = (x: number, base: number, s: number, lit: boolean, wall: string) =>
  `<g><rect x="${x - 40 * s}" y="${base - 60 * s}" width="${80 * s}" height="${60 * s}" fill="${wall}"/>` +
  `<path d="M${x - 50 * s} ${base - 58 * s} L${x} ${base - 100 * s} L${x + 50 * s} ${base - 58 * s}Z" fill="#8a4b3c"/>` +
  `<path d="M${x - 50 * s} ${base - 58 * s} L${x} ${base - 100 * s} L${x + 50 * s} ${base - 58 * s}" fill="none" stroke="#fff" stroke-width="${6 * s}" opacity=".85"/>` +
  `<rect x="${x - 22 * s}" y="${base - 44 * s}" width="${18 * s}" height="${18 * s}" fill="${lit ? "#ffd86b" : "#4a5a7a"}"/><rect x="${x + 6 * s}" y="${base - 44 * s}" width="${18 * s}" height="${18 * s}" fill="${lit ? "#ffd86b" : "#4a5a7a"}"/>` +
  (lit ? `<circle cx="${x}" cy="${base - 35 * s}" r="${40 * s}" fill="#ffd86b" opacity=".12"/>` : "") +
  `</g>`;

const PROPS: Prop[] = [
  {
    key: "river",
    re: /\b(river|frozen|ice|lake|stream)\b/i,
    width: 0,
    band: true,
    draw: (_x, c) => {
      const y = c.feet - 150;
      return `<path d="M0 ${y} Q${c.W * 0.3} ${y - 24} ${c.W * 0.55} ${y + 6} T${c.W} ${y - 10} V${y + 70} Q${c.W * 0.6} ${y + 92} ${c.W * 0.3} ${y + 66} T0 ${y + 74}Z" fill="#cfe6f3"/>` +
        [0.12, 0.33, 0.58, 0.8].map((t, i) => `<path d="M${c.W * t} ${y + 26 + (i % 2) * 18} l${70 + i * 10} -6" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>`).join("");
    },
  },
  {
    key: "bridge",
    re: /\bbridge\b/i,
    width: 360,
    draw: (x, c) => {
      const y = c.feet - 140;
      return `<path d="M${x - 170} ${y + 30} Q${x} ${y - 70} ${x + 170} ${y + 30}" fill="none" stroke="#8a5a3c" stroke-width="18"/>` +
        [-120, -60, 0, 60, 120].map((d) => `<line x1="${x + d}" y1="${y + 30 - 50 * (1 - (d / 170) ** 2)}" x2="${x + d}" y2="${y - 14 - 50 * (1 - (d / 170) ** 2)}" stroke="#8a5a3c" stroke-width="8"/>`).join("") +
        `<path d="M${x - 170} ${y + 24} Q${x} ${y - 76} ${x + 170} ${y + 24}" fill="none" stroke="#fff" stroke-width="10" opacity=".9"/>`;
    },
  },
  {
    key: "window",
    re: /\bwindow(sill)?\b/i,
    width: 300,
    draw: (x, c) => {
      // На улице окно — в домике с огнями (окно не висит в небе)
      if (!c.indoor) return house(x, c.feet - 120, 2.6, true, "#e9d8b4");
      const y = c.H * 0.18;
      return `<g><rect x="${x - 130}" y="${y}" width="260" height="300" rx="14" fill="#6b4a32"/><rect x="${x - 112}" y="${y + 18}" width="224" height="264" fill="#20305a"/>` +
        `<circle cx="${x + 50}" cy="${y + 80}" r="30" fill="#f6e7b8"/><circle cx="${x + 62}" cy="${y + 72}" r="26" fill="#20305a"/>` +
        [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${x - 90 + i * 34}" cy="${y + 140 + ((i * 37) % 90)}" r="4" fill="#fff"/>`).join("") +
        `<rect x="${x - 4}" y="${y + 18}" width="8" height="264" fill="#6b4a32"/><rect x="${x - 112}" y="${y + 146}" width="224" height="8" fill="#6b4a32"/>` +
        `<path d="M${x - 112} ${y + 282} q40 -40 80 0 q40 -36 80 0 q34 -30 64 0" fill="#e8f4fb" opacity=".85"/><rect x="${x - 150}" y="${y + 296}" width="300" height="20" rx="6" fill="#8a6244"/></g>`;
    },
  },
  {
    key: "bed",
    re: /\b(bed|pillow|waking|wakes)\b/i,
    width: 420,
    draw: (x, c) => {
      const b = c.feet - 10;
      return `<g><rect x="${x - 200}" y="${b - 210}" width="26" height="210" rx="8" fill="#8a5a3c"/><rect x="${x + 174}" y="${b - 140}" width="26" height="140" rx="8" fill="#8a5a3c"/>` +
        `<rect x="${x - 190}" y="${b - 120}" width="380" height="70" rx="16" fill="#f4efe6"/><path d="M${x - 120} ${b - 118} h300 v60 q-150 30 -300 0z" fill="#6d9ad6"/>` +
        `<ellipse cx="${x - 140}" cy="${b - 132}" rx="56" ry="26" fill="#fff"/><rect x="${x - 190}" y="${b - 52}" width="380" height="22" fill="#8a5a3c"/>` +
        `<path d="M${x - 160} ${b - 140} q20 -8 40 0" stroke="#c0c0c8" stroke-width="5" fill="none"/></g>`;
    },
  },
  {
    key: "sleigh",
    re: /\bsleigh\b/i,
    width: 380,
    draw: (x, c) => {
      const b = c.feet - 30;
      return `<g><path d="M${x - 170} ${b} H${x + 150} q40 0 40 -40" stroke="#c9a227" stroke-width="12" fill="none" stroke-linecap="round"/>` +
        `<path d="M${x - 150} ${b - 30} H${x + 110} L${x + 140} ${b - 120} H${x - 40} Q${x - 120} ${b - 120} ${x - 150} ${b - 30}Z" fill="#c0392b"/>` +
        `<path d="M${x - 120} ${b - 60} H${x + 100}" stroke="#f2c14e" stroke-width="8"/>` +
        `<path d="M${x - 100} ${b - 120} q20 -70 70 -60 q40 -50 80 0 q40 -10 40 60z" fill="#a0703f"/><path d="M${x - 40} ${b - 160} h50 M${x - 15} ${b - 185} v50" stroke="#f2c14e" stroke-width="8"/>` +
        `<line x1="${x - 110}" y1="${b - 30}" x2="${x - 110}" y2="${b}" stroke="#c9a227" stroke-width="8"/><line x1="${x + 90}" y1="${b - 30}" x2="${x + 90}" y2="${b}" stroke="#c9a227" stroke-width="8"/></g>`;
    },
  },
  {
    key: "gifts",
    re: /\b(gifts?|presents?|sacks?)\b/i,
    width: 260,
    draw: (x, c) => {
      const b = c.feet - 6;
      const box = (bx: number, w: number, h: number, col: string, rib: string) =>
        `<rect x="${bx - w / 2}" y="${b - h}" width="${w}" height="${h}" rx="6" fill="${col}"/><rect x="${bx - 7}" y="${b - h}" width="14" height="${h}" fill="${rib}"/><path d="M${bx} ${b - h} q-30 -30 -34 0 M${bx} ${b - h} q30 -30 34 0" stroke="${rib}" stroke-width="8" fill="none"/>`;
      return `<g>${box(x - 70, 110, 90, "#e04f5f", "#f6d55c")}${box(x + 50, 90, 120, "#4fa3e0", "#fff")}${box(x - 10, 70, 56, "#5cb85c", "#e04f5f")}</g>`;
    },
  },
  {
    key: "tree",
    re: /\b(new year tree|christmas tree|decorated tree|fir tree|\btree\b)/i,
    width: 300,
    draw: (x, c) => fir(x, c.feet - 4, 460, true, true),
  },
  {
    key: "houses",
    re: /\b(city|town|village|houses?|lights below|rooftop|roof|chimney|street)\b/i,
    width: 0,
    band: true,
    draw: (_x, c) => {
      const base = c.feet - 200;
      const walls = ["#e9d8b4", "#d9b99b", "#c9d6e3", "#e3c4c4"];
      return Array.from({ length: Math.round(c.W / 260) }, (_, i) => house(80 + i * 260 + ((i * 53) % 60), base - ((i * 31) % 30), 0.9 + ((i * 7) % 3) * 0.12, true, walls[i % walls.length])).join("");
    },
  },
  {
    key: "fireworks",
    re: /\b(fireworks?|salute|midnight)\b/i,
    width: 0,
    sky: true,
    draw: (_x, c) =>
      [0.18, 0.45, 0.78].map((t, k) => {
        const cx = c.W * t;
        const cy = c.H * (0.16 + (k % 2) * 0.08);
        const col = ["#f6d55c", "#ff7aa8", "#7ad3ff"][k];
        return Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return `<line x1="${cx + Math.cos(a) * 16}" y1="${cy + Math.sin(a) * 16}" x2="${cx + Math.cos(a) * 62}" y2="${cy + Math.sin(a) * 62}" stroke="${col}" stroke-width="6" stroke-linecap="round"/>`;
        }).join("") + `<circle cx="${cx}" cy="${cy}" r="10" fill="${col}"/>`;
      }).join(""),
  },
  {
    key: "forest",
    re: /\b(forest|woods|pines?)\b/i,
    width: 0,
    band: true,
    draw: (_x, c) => Array.from({ length: Math.round(c.W / 150) }, (_, i) => fir(60 + i * 150 + ((i * 41) % 50), c.feet - 190 - ((i * 23) % 26), 170 + ((i * 37) % 60), true)).join(""),
  },
  {
    key: "hare",
    re: /\b(hare|bunny|rabbit)\b/i,
    width: 160,
    draw: (x, c) => {
      const b = c.feet - 4;
      return `<g><ellipse cx="${x}" cy="${b - 44}" rx="48" ry="40" fill="#f1ece4"/><circle cx="${x + 34}" cy="${b - 96}" r="28" fill="#f1ece4"/>` +
        `<ellipse cx="${x + 24}" cy="${b - 150}" rx="9" ry="34" fill="#f1ece4"/><ellipse cx="${x + 44}" cy="${b - 148}" rx="9" ry="34" fill="#f1ece4"/>` +
        `<ellipse cx="${x + 24}" cy="${b - 150}" rx="4" ry="22" fill="#f3c6cf"/><ellipse cx="${x + 44}" cy="${b - 148}" rx="4" ry="22" fill="#f3c6cf"/>` +
        `<circle cx="${x + 44}" cy="${b - 100}" r="4" fill="#2a2522"/><circle cx="${x - 46}" cy="${b - 46}" r="12" fill="#fff"/><ellipse cx="${x}" cy="${b}" rx="54" ry="8" fill="rgba(0,0,0,.12)"/></g>`;
    },
  },
  {
    key: "vacuum",
    re: /\bvacuum\b/i,
    width: 220,
    draw: (x, c) => {
      const b = c.feet - 6;
      return `<g><rect x="${x - 70}" y="${b - 90}" width="120" height="86" rx="34" fill="#c0392b"/><circle cx="${x - 40}" cy="${b - 4}" r="14" fill="#333"/><circle cx="${x + 26}" cy="${b - 4}" r="14" fill="#333"/>` +
        `<path d="M${x + 40} ${b - 60} q70 -40 60 -150" stroke="#555" stroke-width="12" fill="none"/><rect x="${x + 80}" y="${b - 30}" width="80" height="18" rx="8" fill="#555"/><path d="M${x + 100} ${b - 210} L${x + 120} ${b - 30}" stroke="#888" stroke-width="10"/></g>`;
    },
  },
  {
    key: "door",
    re: /\b(door|doorway)\b/i,
    width: 220,
    draw: (x, c) => {
      const b = c.feet - 120;
      return `<g><rect x="${x - 95}" y="${b - 420}" width="190" height="420" fill="#8a5a3c"/><rect x="${x - 78}" y="${b - 404}" width="156" height="404" fill="#b07a50"/><rect x="${x - 60}" y="${b - 380}" width="120" height="150" rx="6" fill="#a06a42"/><rect x="${x - 60}" y="${b - 200}" width="120" height="170" rx="6" fill="#a06a42"/><circle cx="${x + 52}" cy="${b - 210}" r="9" fill="#f2c14e"/></g>`;
    },
  },
  {
    key: "wardrobe",
    re: /\b(wardrobe|cupboard|closet|cabinet)\b/i,
    width: 260,
    draw: (x, c) => {
      const b = c.feet - 60;
      return `<g><rect x="${x - 120}" y="${b - 520}" width="240" height="520" rx="8" fill="#9b6b45"/><line x1="${x}" y1="${b - 510}" x2="${x}" y2="${b - 10}" stroke="#7a5234" stroke-width="5"/><circle cx="${x - 14}" cy="${b - 270}" r="8" fill="#f2c14e"/><circle cx="${x + 14}" cy="${b - 270}" r="8" fill="#f2c14e"/><rect x="${x - 128}" y="${b - 530}" width="256" height="18" rx="4" fill="#7a5234"/></g>`;
    },
  },
  {
    key: "scratch",
    re: /\b(scratching post|scratcher)\b/i,
    width: 140,
    draw: (x, c) => {
      const b = c.feet - 6;
      const rope = Array.from({ length: 10 }, (_, i) => `<line x1="${x - 18}" y1="${b - 40 - i * 22}" x2="${x + 18}" y2="${b - 30 - i * 22}" stroke="#a07b4f" stroke-width="4"/>`).join("");
      return `<g><rect x="${x - 70}" y="${b - 24}" width="140" height="24" rx="6" fill="#8a6244"/><rect x="${x - 20}" y="${b - 260}" width="40" height="240" fill="#d8b38a"/>${rope}<rect x="${x - 60}" y="${b - 280}" width="120" height="24" rx="6" fill="#8a6244"/></g>`;
    },
  },
  {
    key: "yarn",
    re: /\b(yarn|ball of wool)\b/i,
    width: 100,
    draw: (x, c) => {
      const b = c.feet - 4;
      return `<g><circle cx="${x}" cy="${b - 36}" r="36" fill="#e05a7a"/><path d="M${x - 30} ${b - 50} q30 -20 60 6 M${x - 34} ${b - 30} q34 -18 66 4 M${x - 22} ${b - 12} q24 -12 46 2" stroke="#b83d5c" stroke-width="4" fill="none"/><path d="M${x + 34} ${b - 20} q40 20 90 16" stroke="#e05a7a" stroke-width="4" fill="none"/></g>`;
    },
  },
  {
    key: "tea",
    re: /\b(tea|cup|mug|jam)\b/i,
    width: 170,
    draw: (x, c) => {
      const b = c.feet - 30;
      return `<g><rect x="${x - 70}" y="${b - 110}" width="140" height="14" rx="5" fill="#8a5a3c"/><rect x="${x - 60}" y="${b - 96}" width="10" height="96" fill="#8a5a3c"/><rect x="${x + 50}" y="${b - 96}" width="10" height="96" fill="#8a5a3c"/>` +
        `<path d="M${x - 40} ${b - 150} h44 v30 q0 10 -10 10 h-24 q-10 0 -10 -10z" fill="#fff"/><path d="M${x + 4} ${b - 144} q16 0 14 12 q-2 8 -14 8" stroke="#fff" stroke-width="5" fill="none"/>` +
        `<path d="M${x - 26} ${b - 160} q-8 -14 4 -26 M${x - 12} ${b - 160} q-8 -14 4 -26" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/><rect x="${x + 22}" y="${b - 148}" width="34" height="38" rx="6" fill="#c0392b"/><rect x="${x + 20}" y="${b - 154}" width="38" height="10" rx="3" fill="#f2c14e"/></g>`;
    },
  },
  {
    key: "lamp",
    re: /\b(lamp|lamp light|pool of evening light)\b/i,
    width: 160,
    draw: (x, c) => {
      const b = c.feet - 20;
      return `<g><circle cx="${x}" cy="${b - 330}" r="150" fill="#ffd86b" opacity=".18"/><circle cx="${x}" cy="${b - 330}" r="80" fill="#ffd86b" opacity=".2"/><path d="M${x - 60} ${b - 300} L${x - 36} ${b - 380} H${x + 36} L${x + 60} ${b - 300}Z" fill="#f2c14e"/><rect x="${x - 5}" y="${b - 300}" width="10" height="290" fill="#6b4a32"/><ellipse cx="${x}" cy="${b - 6}" rx="44" ry="10" fill="#6b4a32"/></g>`;
    },
  },
  {
    key: "film",
    re: /\b(plastic|film|wrapped)\b/i,
    width: 180,
    draw: (x, c) => {
      const b = c.feet - 6;
      return `<g><rect x="${x - 80}" y="${b - 60}" width="160" height="56" rx="28" fill="#dfeaf2" opacity=".95"/><ellipse cx="${x + 80}" cy="${b - 32}" rx="16" ry="28" fill="#c6d6e2"/><path d="M${x - 60} ${b - 48} h110 M${x - 50} ${b - 24} h90" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M${x - 80} ${b - 10} q-60 6 -90 -4" stroke="#dfeaf2" stroke-width="10" fill="none" opacity=".9"/></g>`;
    },
  },
  {
    key: "cardboard",
    re: /\bcardboard\b/i,
    width: 220,
    draw: (x, c) => {
      const b = c.feet - 6;
      return `<g><rect x="${x - 90}" y="${b - 120}" width="180" height="120" fill="#c89b6d"/><path d="M${x - 90} ${b - 120} l-30 -40 h120 l30 40z M${x + 90} ${b - 120} l30 -40 h-120" fill="#b5875a"/><rect x="${x - 20}" y="${b - 120}" width="40" height="120" fill="#d8b38a" opacity=".6"/></g>`;
    },
  },
];

const TINTS: { re: RegExp; top: string; op: number }[] = [
  { re: /\b(night|midnight|stars?|moon|evening sky|dark)\b/i, top: "#0b1640", op: 0.32 },
  { re: /\b(morning|sunrise|dawn|sunny)\b/i, top: "#ffd59a", op: 0.22 },
  { re: /\b(evening|sunset|dusk)\b/i, top: "#ff9a6b", op: 0.2 },
];

const INDOOR = /\b(bed|pillow|living room|room|indoors?|windowsill|frosty window|kitchen|fireplace|home at night)\b/i;

/** Комната: стена с обоями до линии пола, плинтус, пол из досок — поверх уличного фона темы. */
function room(c: PropsCtx): string {
  const floorY = c.feet - 130;
  const dots = Array.from({ length: Math.round((c.W / 90) * (floorY / 90)) }, (_, i) => {
    const x = (i * 90) % c.W + ((Math.floor((i * 90) / c.W) % 2) * 45);
    const y = Math.floor((i * 90) / c.W) * 90 + 40;
    return y < floorY - 30 ? `<circle cx="${x}" cy="${y}" r="5" fill="#e9c9a2" opacity=".7"/>` : "";
  }).join("");
  const boards = Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="${floorY + 30 + i * 40}" x2="${c.W}" y2="${floorY + 30 + i * 40}" stroke="#a87b55" stroke-width="3" opacity=".5"/>`).join("");
  return `<rect width="${c.W}" height="${floorY}" fill="#f3e3cc"/>${dots}<rect y="${floorY - 16}" width="${c.W}" height="16" fill="#c49a6c"/><rect y="${floorY}" width="${c.W}" height="${c.H - floorY}" fill="#c8945f"/>${boards}`;
}

/** Реквизит и тон неба по описанию сцены. Не больше двух предметов, широкие полосы (река, домики) — одна. */
export function sceneProps(scene: string | undefined, c: PropsCtx): { sky: string; behind: string; keys: string[] } {
  if (!scene) return { sky: "", behind: "", keys: [] };
  const themeIndoor = /home|room|indoor|flat|apartment/i.test(c.theme.key);
  const drawRoom = INDOOR.test(scene) && !themeIndoor;
  c = { ...c, indoor: drawRoom || themeIndoor };
  let sky = "";
  const tint = TINTS.find((t) => t.re.test(scene));
  if (tint) {
    const id = `tint-${c.seed}`;
    sky = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint.top}" stop-opacity="${tint.op}"/><stop offset=".7" stop-color="${tint.top}" stop-opacity="0"/></linearGradient></defs><rect width="${c.W}" height="${c.H}" fill="url(#${id})"/>`;
  }
  const found = PROPS.filter((p) => p.re.test(scene));
  const bands = found.filter((p) => p.band || p.sky).slice(0, 2);
  // Окно у темы-комнаты уже нарисовано — второе не нужно
  const items = found.filter((p) => !p.band && !p.sky && !(themeIndoor && p.key === "window")).slice(0, 3);
  // Свободная сторона кадра — подальше от героев
  const leftFree = c.zoneLo;
  const rightFree = c.W - c.zoneHi;
  const goLeft = leftFree >= rightFree;
  let cursor = goLeft ? c.zoneLo - 40 : c.zoneHi + 40;
  const parts: string[] = [];
  if (drawRoom) parts.push(room(c));
  // В комнате небо не тонируем; вечер и ночь — тёплый свет лампы по всему кадру
  if (c.indoor) sky = tint && tint.top !== "#ffd59a" ? `<rect width="${c.W}" height="${c.H}" fill="#ffb35c" opacity=".1"/>` : "";
  // В комнате не бывает реки, леса и улицы — только предметы
  for (const b of bands) if (!c.indoor || b.key === "fireworks") parts.push(b.draw(0, c, c.W));
  for (const p of items) {
    const room = goLeft ? cursor : c.W - cursor;
    if (room < p.width * 0.8) continue;
    const x = goLeft ? Math.max(p.width / 2 + 10, cursor - p.width / 2) : Math.min(c.W - p.width / 2 - 10, cursor + p.width / 2);
    parts.push(p.draw(x, c, p.width));
    cursor = goLeft ? x - p.width / 2 - 30 : x + p.width / 2 + 30;
  }
  return { sky, behind: parts.join(""), keys: [...(drawRoom ? ["room"] : []), ...bands, ...items].map((p) => (typeof p === "string" ? p : p.key)) };
}
