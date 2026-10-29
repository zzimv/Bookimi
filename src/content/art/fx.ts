// Эффекты стиля для демо-рендера (владелец — агент «стили картинок», подключает render.ts).
// ArtStyleDemo.backdrop — обработка фона темы отдельно от фигур; ArtStyleDemo.overlays — доп. слои
// (за фигурами и поверх); фигурные фильтры ink / sepia / cel / xerox. Стили без этих полей не меняются.
// Только строки SVG: без DOM и Node API (модуль попадает в демо-бандл).

import type { ArtStyleDemo, DemoOverlay } from "../types";
import { rnd } from "./shared";

/** Числа в готовом SVG — не больше двух знаков после точки (короче строка, тот же рисунок). */
const short = (svg: string) => svg.replace(/(\d\.\d\d)\d+/g, "$1");
const rgb = (c: string) => {
  const v = parseInt(/^#[0-9a-f]{6}$/i.test(c) ? c.slice(1) : "888888", 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
const acc = (s: ArtStyleDemo, i: number) => s.palette.accents[((i % s.palette.accents.length) + s.palette.accents.length) % s.palette.accents.length];

/** Фильтры фигур, которые знает рендер (помимо wobble, posterize, soft из render.ts). */
export const FIGURE_FILTERS = ["ink", "sepia", "cel", "xerox"] as const;

const BEHIND: DemoOverlay[] = ["town", "cutaway", "splash", "floor", "crosses"];

/** <defs> эффектов стиля. */
export function fxDefs(s: ArtStyleDemo, W: number, H: number): string {
  const box = `filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB"`;
  const lum = `<feColorMatrix type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0"/>`;
  // Карта краёв: яркость → лапласиан → утолщение → порог (1 — край, 0 — пусто)
  const edges = `${lum}<feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" edgeMode="duplicate" preserveAlpha="true"/><feMorphology operator="dilate" radius="1.2"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 1 1 1 1 1 1 1"/><feFuncG type="discrete" tableValues="0 1 1 1 1 1 1 1"/><feFuncB type="discrete" tableValues="0 1 1 1 1 1 1 1"/></feComponentTransfer>`;
  const [pr, pg, pb] = rgb(s.palette.paper);
  const [ir, ig, ib] = rgb(s.palette.ink);
  const f: string[] = [
    // Фигуры
    `<filter id="ink" ${box}>${lum}<feComponentTransfer><feFuncR type="discrete" tableValues="0 1 1 1"/><feFuncG type="discrete" tableValues="0 1 1 1"/><feFuncB type="discrete" tableValues="0 1 1 1"/></feComponentTransfer></filter>`,
    `<filter id="sepia" ${box}><feColorMatrix type="matrix" values=".39 .77 .19 0 0 .35 .69 .17 0 0 .27 .53 .13 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR type="linear" slope=".92" intercept=".04"/><feFuncG type="linear" slope=".9" intercept=".03"/><feFuncB type="linear" slope=".85"/></feComponentTransfer></filter>`,
    `<filter id="cel" ${box}><feColorMatrix type="saturate" values="1.35"/><feComponentTransfer><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1"/><feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1"/></feComponentTransfer></filter>`,
    `<filter id="xerox" ${box}><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`,
    // Фон
    `<filter id="bd-blur" ${box}><feGaussianBlur stdDeviation="13" edgeMode="duplicate"/><feColorMatrix type="saturate" values=".6"/><feColorMatrix type="matrix" values="1 0 0 0 .05 0 .97 0 0 .03 0 0 .9 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>`,
    `<filter id="bd-lines" ${box}>${edges}<feComponentTransfer><feFuncR type="linear" slope="${ir - pr}" intercept="${pr}"/><feFuncG type="linear" slope="${ig - pg}" intercept="${pg}"/><feFuncB type="linear" slope="${ib - pb}" intercept="${pb}"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>`,
    `<filter id="bd-lineonly" ${box}>${edges}<feColorMatrix type="matrix" values="0 0 0 0 ${ir} 0 0 0 0 ${ig} 0 0 0 0 ${ib} 1 0 0 0 0"/></filter>`,
    `<filter id="bd-flat" ${box}><feColorMatrix type="saturate" values="1.1"/><feComponentTransfer><feFuncR type="discrete" tableValues=".1 .32 .52 .7 .86 .97"/><feFuncG type="discrete" tableValues=".1 .32 .52 .7 .86 .97"/><feFuncB type="discrete" tableValues=".1 .32 .52 .7 .86 .97"/></feComponentTransfer></filter>`,
    `<filter id="bd-paint" ${box}><feGaussianBlur stdDeviation="2.2" edgeMode="duplicate"/><feColorMatrix type="saturate" values="1.3"/><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>`,
    `<filter id="bd-dream" ${box}><feGaussianBlur stdDeviation="5" edgeMode="duplicate"/><feColorMatrix type="saturate" values="1.15"/><feComponentTransfer><feFuncR type="linear" slope=".82" intercept=".17"/><feFuncG type="linear" slope=".82" intercept=".13"/><feFuncB type="linear" slope=".82" intercept=".06"/><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>`,
    `<linearGradient id="fx-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c2" stop-opacity=".55"/><stop offset="1" stop-color="#fff2c2" stop-opacity="0"/></linearGradient>`,
    `<filter id="fx-blob" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="60"/><feGaussianBlur stdDeviation="2"/></filter>`,
    `<filter id="fx-fog" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>`,
    `<radialGradient id="fx-glow" cx=".72" cy=".2" r=".7"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".7"/><stop offset=".45" stop-color="#ffc870" stop-opacity=".22"/><stop offset="1" stop-color="#ffc870" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="fx-dark" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#2a1608" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".5"/></radialGradient>`,
    `<radialGradient id="fx-vig" cx=".5" cy=".55" r=".62"><stop offset=".5" stop-color="${s.palette.paper}" stop-opacity="0"/><stop offset=".86" stop-color="${s.palette.paper}" stop-opacity=".92"/><stop offset="1" stop-color="${s.palette.paper}" stop-opacity="1"/></radialGradient>`,
    `<radialGradient id="fx-aged" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#8a5a24" stop-opacity="0"/><stop offset="1" stop-color="#8a5a24" stop-opacity=".42"/></radialGradient>`,
    `<pattern id="fx-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(42)"><path d="M0 0V9" stroke="${s.palette.ink}" stroke-width="1.4"/></pattern>`,
    `<pattern id="fx-hatch2" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)"><path d="M0 0V13" stroke="${s.palette.ink}" stroke-width="1.1"/></pattern>`,
  ];
  return short(f.join(""));
}

/** Фон темы с обработкой стиля. */
export function fxBackdrop(s: ArtStyleDemo, bg: string, W: number, H: number): string {
  switch (s.backdrop) {
    case "blur":
      return `<g filter="url(#bd-blur)">${bg}</g>`;
    case "wash":
      return `${bg}<rect width="${W}" height="${H}" fill="${s.palette.paper}" opacity=".62"/>`;
    case "lines": {
      // Пробная «чистая тушь» (фильтр ink) — без цвета; остальные — с лёгкой подкраской исходного фона
      const tint = s.filter === "ink" ? "" : `<g opacity=".2">${bg}</g>`;
      return `<g filter="url(#bd-lines)">${bg}</g>${tint}`;
    }
    case "offset":
      return `<g filter="url(#bd-flat)">${bg}</g><g transform="translate(9 6)" opacity=".85"><g filter="url(#bd-lineonly)">${bg}</g></g>`;
    case "dream":
      return `<g filter="url(#bd-dream)">${bg}</g><rect width="${W}" height="${H}" fill="url(#fx-glow)" opacity=".8"/>`;
    case "glow":
      return `<g filter="url(#bd-paint)">${bg}</g><rect width="${W}" height="${H}" fill="url(#fx-glow)"/>`;
    default:
      return bg;
  }
}

export interface FxPlace {
  W: number;
  H: number;
  /** Центр главного героя по x и линия ступней. */
  heroX: number;
  feet: number;
  scale: number;
  /** Номер разворота (для разнообразия). */
  index: number;
}

/** Доп. слои стиля: behind — между фоном и фигурами, above — поверх фигур. */
export function fxLayers(s: ArtStyleDemo, p: FxPlace): { behind: string; above: string } {
  let behind = "";
  let above = "";
  for (const o of s.overlays ?? []) {
    const out = short(LAYER[o]?.(s, p, rnd(p.index * 31 + o.length * 7 + 3)) ?? "");
    if (BEHIND.includes(o)) behind += out;
    else above += out;
  }
  return { behind, above };
}

type Layer = (s: ArtStyleDemo, p: FxPlace, r: () => number) => string;

const LAYER: Record<DemoOverlay, Layer> = {
  // Городок с высоты: два ряда домиков, рынок, велосипеды, прохожие
  town(s, { W, H, heroX, scale }, r) {
    const ink = s.palette.ink;
    let out = `<g stroke="${ink}" stroke-width="2.2" stroke-linejoin="round">`;
    for (const [base, k, op] of [
      [H * 0.5, 0.62, 0.85],
      [H * 0.66, 1, 1],
    ] as const) {
      let x = -30 + r() * 40;
      let i = Math.floor(r() * 9);
      while (x < W) {
        const w = (80 + r() * 70) * k;
        const h = (90 + r() * 110) * k;
        const wall = acc(s, i);
        const roof = acc(s, i + 2);
        out += `<g opacity="${op}"><rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${wall}"/>`;
        out += `<path d="M${x - 6 * k} ${base - h} L${x + w / 2} ${base - h - 46 * k} L${x + w + 6 * k} ${base - h}Z" fill="${roof}"/>`;
        for (let wy = base - h + 18 * k; wy < base - 34 * k; wy += 34 * k)
          for (let wx = x + 12 * k; wx < x + w - 22 * k; wx += 28 * k) out += `<rect x="${wx}" y="${wy}" width="${14 * k}" height="${16 * k}" fill="#fdf6df" stroke-width="1.4"/>`;
        out += `<rect x="${x + w / 2 - 9 * k}" y="${base - 30 * k}" width="${18 * k}" height="${30 * k}" fill="${acc(s, i + 3)}" stroke-width="1.6"/></g>`;
        x += w + 4 + r() * 10;
        i++;
      }
    }
    // Улица: рынок, велосипеды и прохожие (вдали от героя)
    const away = (x: number) => Math.abs(x - heroX) > 170 * scale;
    for (let j = 0; j < 4; j++) {
      const x = r() * (W - 160) + 40;
      if (!away(x)) continue;
      const y = H * 0.7;
      let stripes = "";
      for (let k = 0; k < 6; k++) stripes += `<rect x="${x + k * 22}" y="${y - 70}" width="22" height="22" fill="${k % 2 ? "#fff" : acc(s, j + 1)}" stroke-width="1.4"/>`;
      out += `${stripes}<rect x="${x + 6}" y="${y - 48}" width="120" height="48" fill="${acc(s, j + 4)}"/>`;
      for (let k = 0; k < 5; k++) out += `<circle cx="${x + 20 + k * 22}" cy="${y - 54}" r="7" fill="${acc(s, k)}" stroke-width="1.2"/>`;
    }
    for (let j = 0; j < 26; j++) {
      const x = r() * W;
      if (!away(x)) continue;
      const y = H * (0.69 + r() * 0.16);
      const kk = 0.8 + (y / H - 0.69) * 2.4;
      if (r() < 0.25) out += `<g fill="none" stroke-width="2"><circle cx="${x - 12 * kk}" cy="${y}" r="${9 * kk}"/><circle cx="${x + 12 * kk}" cy="${y}" r="${9 * kk}"/><path d="M${x - 12 * kk} ${y} L${x} ${y - 12 * kk} L${x + 12 * kk} ${y} M${x} ${y - 12 * kk} V${y - 26 * kk}"/></g><circle cx="${x}" cy="${y - 40 * kk}" r="${7 * kk}" fill="#f4d3b8"/>`;
      else out += `<rect x="${x - 6 * kk}" y="${y - 26 * kk}" width="${12 * kk}" height="${22 * kk}" rx="${4 * kk}" fill="${acc(s, j)}" stroke-width="1.5"/><circle cx="${x}" cy="${y - 33 * kk}" r="${7 * kk}" fill="#f4d3b8" stroke-width="1.5"/>`;
    }
    return out + `</g>`;
  },

  // Дом в разрезе: кривоватая крыша и балки, полки с банками, лампа, мышки
  cutaway(s, { W, H, heroX }, r) {
    const ink = s.palette.ink;
    const side = heroX > W / 2 ? 0 : 1; // полки — с другой стороны от героя
    const sx = side === 0 ? W * 0.05 : W * 0.6;
    const sw = W * 0.34;
    // Тёплая стена дома: фон темы виден только «в окне» за героем
    let out = `<path d="M${W * 0.07} ${H * 0.3} L${W * 0.49} ${H * 0.06} L${W * 0.93} ${H * 0.285} V${H * 0.9} H${W * 0.07}Z" fill="${acc(s, 0)}" opacity=".5"/>`;
    out += `<g stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" fill="none">`;
    out += `<path d="M${W * 0.02} ${H * 0.3} L${W * 0.49} ${H * 0.05} L${W * 0.98} ${H * 0.27}" stroke-width="9"/>`;
    out += `<path d="M${W * 0.07} ${H * 0.29} L${W * 0.065} ${H * 0.9} M${W * 0.935} ${H * 0.28} L${W * 0.94} ${H * 0.9} M${W * 0.07} ${H * 0.3} L${W * 0.93} ${H * 0.285}" stroke-width="6"/>`;
    for (let i = 1; i < 8; i++) out += `<path d="M${W * 0.49 + (i - 4) * W * 0.11} ${H * 0.3 - (4 - Math.abs(i - 4)) * H * 0.055} V${H * 0.3}" stroke-width="2.5" opacity=".7"/>`;
    out += `<path d="M0 ${H * 0.9} L${W} ${H * 0.895}" stroke-width="6"/>`;
    for (let x = 30; x < W; x += 120 + r() * 60) out += `<path d="M${x} ${H * 0.9} l${-20 + r() * 10} ${H * 0.1}" stroke-width="2" opacity=".6"/>`;
    // Полки
    for (const y of [H * 0.4, H * 0.55]) {
      out += `<path d="M${sx} ${y} h${sw}" stroke-width="6"/><path d="M${sx + 20} ${y} l20 26 M${sx + sw - 20} ${y} l-20 26" stroke-width="3"/>`;
      let x = sx + 14;
      let i = 0;
      while (x < sx + sw - 60) {
        const w = 34 + r() * 26;
        const h = 44 + r() * 46;
        if (r() < 0.2) {
          out += `<g stroke-width="2"><ellipse cx="${x + 18}" cy="${y - 10}" rx="16" ry="9" fill="#a39a92"/><circle cx="${x + 6}" cy="${y - 22}" r="5" fill="#cbb9b0"/><path d="M${x + 34} ${y - 6} q22 -4 26 -24" stroke-width="2"/></g>`;
          x += 64;
        } else {
          out += `<g stroke-width="2.4"><rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="8" fill="${acc(s, i)}" fill-opacity=".75"/><rect x="${x - 3}" y="${y - h - 10}" width="${w + 6}" height="12" rx="3" fill="${acc(s, i + 1)}"/></g>`;
          x += w + 12;
        }
        i++;
      }
    }
    // Инструменты на стене и лампа
    const tx = side === 0 ? W * 0.12 : W * 0.68;
    out += `<g stroke-width="3"><path d="M${tx} ${H * 0.62} v120 M${tx - 14} ${H * 0.62} h28"/><path d="M${tx + 70} ${H * 0.62} v110 M${tx + 60} ${H * 0.62 + 110} h20 l-10 24z"/><circle cx="${tx + 150}" cy="${H * 0.66}" r="30"/></g>`;
    const lx = W * 0.5 + (side === 0 ? -W * 0.1 : W * 0.1);
    out += `</g><circle cx="${lx}" cy="${H * 0.36}" r="210" fill="#ffd98a" opacity=".22"/><circle cx="${lx}" cy="${H * 0.36}" r="110" fill="#ffe7b0" opacity=".3"/>`;
    out += `<g stroke="${ink}" stroke-width="3"><path d="M${lx} ${H * 0.17} V${H * 0.31}" fill="none"/><path d="M${lx - 34} ${H * 0.36} Q${lx} ${H * 0.27} ${lx + 34} ${H * 0.36}Z" fill="${acc(s, 2)}"/><circle cx="${lx}" cy="${H * 0.375}" r="10" fill="#fff3c4"/></g>`;
    return out;
  },

  // Акварельные пятна чистого цвета за героем и по краям
  splash(s, { W, H, heroX, feet, scale }, r) {
    let out = `<g filter="url(#fx-blob)">`;
    for (let i = 0; i < 7; i++) {
      const near = i < 3;
      const x = near ? heroX + (r() - 0.5) * 300 * scale : r() * W;
      const y = near ? feet - (140 + r() * 220) * scale : H * (0.15 + r() * 0.6);
      out += `<ellipse cx="${x}" cy="${y}" rx="${(near ? 150 : 90) + r() * 90}" ry="${70 + r() * 70}" fill="${acc(s, i)}" opacity="${near ? 0.3 : 0.22}"/>`;
    }
    return out + `</g>`;
  },

  // Пара линий пола и тень под ногами — как в немом газетном комиксе
  floor(s, { W, H, feet }, r) {
    const ink = s.palette.ink;
    const y = feet + 8;
    let out = `<g stroke="${ink}" fill="none" stroke-linecap="round"><rect x="0" y="${y - 4}" width="${W}" height="${H - y + 4}" fill="${s.palette.paper}" stroke="none"/>`;
    out += `<path d="M${W * 0.04} ${y} C${W * 0.3} ${y - 3} ${W * 0.6} ${y + 4} ${W * 0.96} ${y - 1}" stroke-width="5"/>`;
    out += `<path d="M${W * 0.12 + r() * 40} ${y + 48} h${W * 0.18} M${W * 0.55 + r() * 40} ${y + 62} h${W * 0.22} M${W * 0.3} ${y + 96} h${W * 0.12}" stroke-width="3"/>`;
    return out + `</g>`;
  },

  hatch(_s, { W, H }) {
    return `<rect y="${H * 0.64}" width="${W}" height="${H * 0.36}" fill="url(#fx-hatch)" opacity=".13"/><rect width="${W * 0.18}" height="${H}" fill="url(#fx-hatch2)" opacity=".07"/><rect x="${W * 0.82}" width="${W * 0.18}" height="${H}" fill="url(#fx-hatch2)" opacity=".07"/>`;
  },

  // Старая тетрадь: потемневшие края, пятна, скотч, каракули на полях, пометки красным и синим
  aged(s, { W, H, heroX, feet, scale }, r) {
    const ink = s.palette.ink;
    const far = heroX > W / 2 ? W * 0.06 : W * 0.68;
    let out = `<rect width="${W}" height="${H}" fill="url(#fx-aged)"/>`;
    for (let i = 0; i < 4; i++) {
      const x = r() * W;
      const y = r() * H;
      const rr = 50 + r() * 70;
      out += `<circle cx="${x}" cy="${y}" r="${rr}" fill="#8a5a24" opacity=".06"/><circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="#8a5a24" stroke-width="5" opacity=".16"/>`;
    }
    // Скотч по углам
    out += `<rect x="${W * 0.02}" y="18" width="200" height="54" fill="#f6eecb" opacity=".72" transform="rotate(-14 ${W * 0.02 + 100} 45)"/><rect x="${W - 230}" y="${H - 90}" width="200" height="54" fill="#f6eecb" opacity=".72" transform="rotate(10 ${W - 130} ${H - 63})"/>`;
    // Каракули-«почерк» на полях (нечитаемые)
    let scribble = "";
    for (let l = 0; l < 7; l++) {
      let d = `M${far} ${H * 0.1 + l * 34}`;
      const len = W * (0.12 + r() * 0.12);
      for (let x = 0; x < len; x += 14) d += ` q7 ${-10 - r() * 6} 14 0`;
      scribble += `<path d="${d}"/>`;
    }
    out += `<g fill="none" stroke="${ink}" stroke-width="2" opacity=".55">${scribble}</g>`;
    // Зарисовка «образца»: лист с прожилками и странный жучок
    const bx = far + 40;
    const by = H * 0.52;
    out += `<g fill="none" stroke="${ink}" stroke-width="2.4" opacity=".8"><path d="M${bx} ${by + 120} Q${bx + 40} ${by} ${bx + 120} ${by - 20} Q${bx + 110} ${by + 90} ${bx} ${by + 120}Z M${bx} ${by + 120} L${bx + 100} ${by}"/>`;
    for (let k = 1; k < 5; k++) out += `<path d="M${bx + k * 22} ${by + 120 - k * 26} l${18} ${-4} M${bx + k * 22} ${by + 120 - k * 26} l${-2} ${-20}"/>`;
    out += `<ellipse cx="${bx + 220}" cy="${by + 70}" rx="44" ry="30"/><circle cx="${bx + 208}" cy="${by + 64}" r="8"/><circle cx="${bx + 234}" cy="${by + 64}" r="8"/><path d="M${bx + 190} ${by + 96} l-16 22 M${bx + 220} ${by + 100} v26 M${bx + 250} ${by + 96} l16 22 M${bx + 200} ${by + 42} l-12 -26 M${bx + 240} ${by + 42} l12 -26"/></g>`;
    // Красный кружок вокруг героя и синяя стрелка
    out += `<ellipse cx="${heroX}" cy="${feet - 200 * scale}" rx="${190 * scale}" ry="${240 * scale}" fill="none" stroke="#b5352a" stroke-width="4" stroke-dasharray="40 10 6 10" opacity=".55" transform="rotate(-6 ${heroX} ${feet - 200 * scale})"/>`;
    const ax = heroX > W / 2 ? heroX - 290 * scale : heroX + 290 * scale;
    out += `<path d="M${ax} ${H * 0.14} Q${(ax + heroX) / 2} ${H * 0.08} ${heroX + (ax > heroX ? 120 : -120) * scale} ${feet - 410 * scale}" fill="none" stroke="#2f4f9a" stroke-width="4" opacity=".65"/>`;
    return out;
  },

  // Раскадровка: рамка кадра и два маленьких кадра-эскиза со стороны, свободной от героя
  panels(s, { W, H, heroX }) {
    const ink = s.palette.ink;
    const m = 22;
    let out = `<path d="M0 0H${W}V${H}H0Z M${m} ${m}V${H - m}H${W - m}V${m}Z" fill="${s.palette.paper}" fill-rule="evenodd"/><rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" rx="10" fill="none" stroke="${ink}" stroke-width="7"/>`;
    const pw = Math.min(330, W * 0.28);
    const ph = pw * 0.68;
    const x0 = heroX > W / 2 ? m + 26 : W - m - 26 - pw;
    for (let i = 0; i < 2; i++) {
      const y = m + 26 + i * (ph + 22);
      out += `<g transform="translate(${x0} ${y})"><rect width="${pw}" height="${ph}" rx="8" fill="#fff" stroke="${ink}" stroke-width="5"/>`;
      if (i === 0)
        out += `<path d="M${pw * 0.06} ${ph * 0.82} H${pw * 0.94}" stroke="${acc(s, 2)}" stroke-width="10"/><path d="M${pw * 0.42} ${ph * 0.82} v${-ph * 0.3} h${pw * 0.12} v${ph * 0.3}z" fill="#fff6e0" stroke="${ink}" stroke-width="3"/><path d="M${pw * 0.3} ${ph * 0.54} Q${pw * 0.48} ${ph * 0.12} ${pw * 0.66} ${ph * 0.54}z" fill="${acc(s, 1)}" stroke="${ink}" stroke-width="3"/><circle cx="${pw * 0.44}" cy="${ph * 0.42}" r="6" fill="#fff"/><circle cx="${pw * 0.55}" cy="${ph * 0.34}" r="5" fill="#fff"/>`;
      else
        out += `<circle cx="${pw * 0.78}" cy="${ph * 0.3}" r="${ph * 0.16}" fill="${acc(s, 0)}" stroke="${ink}" stroke-width="3"/><path d="M${pw * 0.06} ${ph * 0.84} H${pw * 0.94}" stroke="${acc(s, 2)}" stroke-width="10"/><path d="M${pw * 0.2} ${ph * 0.84} l6 -40 l6 40 M${pw * 0.32} ${ph * 0.84} l-4 -30 l10 30 M${pw * 0.62} ${ph * 0.84} l5 -36 l5 36" fill="none" stroke="${ink}" stroke-width="3"/><path d="M${pw * 0.12} ${ph * 0.3} q30 -24 60 0" fill="none" stroke="${acc(s, 3)}" stroke-width="5"/>`;
      out += `</g>`;
    }
    return out;
  },

  // Пустыня: ночная синева сверху, звёзды-крестики, песчаные дюны карандашом
  crosses(s, { W, H }, r) {
    const ink = s.palette.ink;
    const sand = acc(s, 0);
    const night = acc(s, 1);
    // Пустыня почти заменяет фон темы: от него остаётся лёгкий «мираж»; ночная синева тает к горизонту
    let out = `<defs><linearGradient id="fx-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night}" stop-opacity=".95"/><stop offset=".72" stop-color="${night}" stop-opacity=".25"/><stop offset="1" stop-color="${acc(s, 2)}" stop-opacity=".35"/></linearGradient></defs>`;
    out += `<rect width="${W}" height="${H}" fill="${s.palette.paper}" opacity=".8"/><rect width="${W}" height="${H * 0.74}" fill="url(#fx-night)"/><g filter="url(#fx-blob)">`;
    out += `<path d="M-40 ${H * 0.74} Q${W * 0.25} ${H * 0.64} ${W * 0.5} ${H * 0.72} T${W + 40} ${H * 0.69} V${H + 40} H-40Z" fill="${sand}" opacity=".9"/>`;
    out += `<path d="M-40 ${H * 0.86} Q${W * 0.35} ${H * 0.79} ${W * 0.7} ${H * 0.86} T${W + 40} ${H * 0.84} V${H + 40} H-40Z" fill="${acc(s, 3)}" opacity=".6"/></g>`;
    out += `<g fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" opacity=".8"><path d="M0 ${H * 0.735} Q${W * 0.25} ${H * 0.64} ${W * 0.5} ${H * 0.72} T${W} ${H * 0.69}"/><path d="M0 ${H * 0.862} Q${W * 0.35} ${H * 0.79} ${W * 0.7} ${H * 0.86} T${W} ${H * 0.84}" stroke-dasharray="60 14"/>`;
    for (let i = 0; i < 46; i++) {
      const x = r() * W;
      const y = r() * H * 0.5;
      const k = 6 + r() * 8;
      out += r() < 0.55 ? `<path d="M${x - k} ${y} h${2 * k} M${x} ${y - k} v${2 * k}"/>` : `<circle cx="${x}" cy="${y}" r="2" fill="${ink}"/>`;
    }
    return out + `</g>`;
  },

  // Туман, лучи солнца и выдуманные знаки по краям
  fog(s, { W, H }, r) {
    let out = `<rect width="${W}" height="${H}" fill="#1f4a55" opacity=".1"/>`;
    out += `<g fill="#fffbe6" opacity=".16"><path d="M${W * 0.78} -10 L${W * 0.55} ${H} L${W * 0.66} ${H} L${W * 0.86} -10Z"/><path d="M${W * 0.95} -10 L${W * 0.78} ${H} L${W * 0.84} ${H} L${W * 1.0} -10Z"/></g>`;
    out += `<g filter="url(#fx-fog)" fill="#eef6f4">`;
    for (let i = 0; i < 4; i++) out += `<ellipse cx="${r() * W}" cy="${H * (0.56 + r() * 0.24)}" rx="${W * (0.18 + r() * 0.16)}" ry="${34 + r() * 30}" opacity=".5"/>`;
    out += `</g><g fill="none" stroke="${s.palette.ink}" stroke-width="4" opacity=".4" stroke-linecap="round">`;
    const glyphs = [
      (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="16"/><path d="M${x} ${y - 26} v52"/>`,
      (x: number, y: number) => `<path d="M${x - 18} ${y + 14} l12 -28 l12 28 l12 -28"/>`,
      (x: number, y: number) => `<path d="M${x - 16} ${y - 16} h32 v32 M${x} ${y - 6} v22"/>`,
      (x: number, y: number) => `<path d="M${x - 16} ${y} a16 16 0 1 1 32 0 M${x} ${y} v20"/>`,
    ];
    for (let i = 0; i < 6; i++) {
      const x = i < 3 ? W * 0.04 + r() * W * 0.12 : W * 0.84 + r() * W * 0.12;
      out += glyphs[i % glyphs.length](x, H * (0.12 + r() * 0.4));
    }
    return out + `</g>`;
  },

  // Мягкие золотые лучи сверху и искорки — сказочный свет
  rays(_s, { W, H }, r) {
    let out = `<g fill="url(#fx-ray)">`;
    for (let i = 0; i < 4; i++) {
      const x = W * (0.05 + i * 0.13 + r() * 0.05);
      out += `<path d="M${x} -10 L${x + W * 0.05} -10 L${x + W * 0.42} ${H * 0.95} L${x + W * 0.3} ${H * 0.95}Z" opacity="${(0.35 + r() * 0.3).toFixed(2)}"/>`;
    }
    out += `</g><g fill="#fffbe8">`;
    for (let i = 0; i < 22; i++) {
      const x = r() * W;
      const y = r() * H * 0.7;
      const k = 3 + r() * 6;
      out += `<path d="M${x} ${y - k * 2} Q${x} ${y} ${x + k * 2} ${y} Q${x} ${y} ${x} ${y + k * 2} Q${x} ${y} ${x - k * 2} ${y} Q${x} ${y} ${x} ${y - k * 2}Z" opacity=".85"/>`;
    }
    return out + `</g>`;
  },

  // Тёмные тёплые края кадра — «кинематографичная» живопись
  shade(_s, { W, H }) {
    return `<rect width="${W}" height="${H}" fill="url(#fx-dark)"/>`;
  },

  // Рисунок-виньетка: края тают в бумаге
  vignette(_s, { W, H }) {
    return `<rect width="${W}" height="${H}" fill="url(#fx-vig)"/>`;
  },
};
