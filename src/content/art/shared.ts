// Общие помощники демо-рисования (владелец — агент 1). Художники аудиторий (агенты 3, 5, 7, 9)
// могут импортировать отсюда, но не менять файл — просьбы пишите в «requests» своего файла.
// Без фреймворков и без Node API: модуль попадает в демо-бандл (esbuild) и используется на сервере.

import type { ArtStyleDemo, DemoDeco, DemoHeroOpts, DemoLook } from "../types";

/** Детерминированный генератор 0..1. */
export function rnd(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export const HAIR_COLORS: Record<string, string> = {
  светлые: "#e8c77a",
  русые: "#b48a5a",
  каштановые: "#7a4a2a",
  тёмные: "#4a3222",
  рыжие: "#c8642c",
  чёрные: "#231a16",
  седые: "#c9c9c9",
  "с проседью": "#8d8a86",
};

export const SKIN_COLORS: Record<string, string> = {
  светлый: "#f4d3b8",
  смуглый: "#d9a77c",
  тёмный: "#8d5a3b",
};

export const FUR_COLORS: Record<string, string> = {
  рыжий: "#d7863a",
  чёрный: "#2a2522",
  белый: "#f4f1ea",
  серый: "#8e8e94",
  коричневый: "#7b5236",
  палевый: "#e2c08d",
  трёхцветный: "#d7863a",
  полосатый: "#9a8f80",
};

/** Цвет по слову из анкеты: ищет ключ словаря внутри строки («рыжий с белым» → рыжий). */
export function colorFrom(map: Record<string, string>, value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const v = value.toLowerCase();
  const key = Object.keys(map).find((k) => v.includes(k) || v.includes(k.slice(0, -2)));
  return key ? map[key] : fallback;
}

/** Обводка по стилю: толщина и цвет. */
export function stroke(style: ArtStyleDemo, base = 3) {
  const w = { thin: base * 0.6, bold: base * 1.6, sketch: base, none: 0 }[style.line];
  const dash = style.line === "sketch" ? ` stroke-dasharray="${base * 4} ${base * 0.8}"` : "";
  return w ? ` stroke="${style.palette.ink}" stroke-width="${w.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"${dash}` : "";
}

export const pick = <T,>(xs: readonly T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length];

// ---------------------------------------------------------------------------
// Запасные рисовальщики. Ими пользуются заглушки до прихода художников аудиторий.
// ---------------------------------------------------------------------------

/** Универсальная человеческая фигура: рост и пропорции по виду героя. */
export function drawFigure(o: DemoHeroOpts) {
  const h: DemoLook = o.look;
  const tall = { child: 1, teen: 1.18, adult: 1.3, pet: 1 }[o.kind];
  const headR = { child: 44, teen: 38, adult: 34, pet: 40 }[o.kind];
  const s = stroke(o.style);
  const hair = colorFrom(HAIR_COLORS, h.hair, "#9a6b45");
  const skin = colorFrom(SKIN_COLORS, h.skin, "#f4d3b8");
  const shirt = h.outfit ?? pick(o.style.palette.accents.length ? o.style.palette.accents : ["#3e8ed0"], o.index ?? 0);
  const long = h.longHair ?? h.gender === "girl";
  const legH = 80 * tall;
  const bodyTop = 36 - (tall - 1) * 60;
  return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.scale : o.scale} ${o.scale})">
    <ellipse cx="0" cy="190" rx="70" ry="12" fill="rgba(0,0,0,.18)"/>
    <rect x="-34" y="${190 - legH}" width="22" height="${legH}" rx="10" fill="#3b4a6b"${s}/>
    <rect x="12" y="${190 - legH}" width="22" height="${legH}" rx="10" fill="#3b4a6b"${s}/>
    <path d="M-52 ${200 - legH} Q-50 ${bodyTop + 4} 0 ${bodyTop} Q50 ${bodyTop + 4} 52 ${200 - legH} Z" fill="${shirt}"${s}/>
    ${long ? `<path d="M-${headR + 2} ${bodyTop - 56} Q-${headR + 12} ${bodyTop + 24} -30 ${bodyTop + 34} L30 ${bodyTop + 34} Q${headR + 12} ${bodyTop + 24} ${headR + 2} ${bodyTop - 56} Z" fill="${hair}"/>` : ""}
    <circle cx="0" cy="${bodyTop - 46}" r="${headR}" fill="${skin}"${s}/>
    <path d="M-${headR + 2} ${bodyTop - 50} Q-${headR - 4} ${bodyTop - 46 - headR - 16} 0 ${bodyTop - 46 - headR - 14} Q${headR - 4} ${bodyTop - 46 - headR - 16} ${headR + 2} ${bodyTop - 50} Q30 ${bodyTop - 74} 0 ${bodyTop - 72} Q-26 ${bodyTop - 76} -${headR + 2} ${bodyTop - 50}Z" fill="${hair}"/>
    <circle cx="-13" cy="${bodyTop - 46}" r="4.5" fill="#2b2b2b"/><circle cx="13" cy="${bodyTop - 46}" r="4.5" fill="#2b2b2b"/>
    ${h.glasses ? `<g fill="none" stroke="#2b2b2b" stroke-width="3"><circle cx="-13" cy="${bodyTop - 46}" r="10"/><circle cx="13" cy="${bodyTop - 46}" r="10"/><path d="M-3 ${bodyTop - 46}h6"/></g>` : ""}
    ${h.beard ? `<path d="M-${headR - 6} ${bodyTop - 36} Q0 ${bodyTop - 46 + headR + 18} ${headR - 6} ${bodyTop - 36} Q0 ${bodyTop - 26} -${headR - 6} ${bodyTop - 36}Z" fill="${hair}"/>` : `<path d="M-10 ${bodyTop - 28} Q0 ${bodyTop - 20} 10 ${bodyTop - 28}" stroke="#9b3b33" stroke-width="3.5" fill="none" stroke-linecap="round"/>`}
    ${h.freckles ? `<g fill="#b9764f" opacity=".6"><circle cx="-20" cy="${bodyTop - 34}" r="2"/><circle cx="-14" cy="${bodyTop - 31}" r="2"/><circle cx="20" cy="${bodyTop - 34}" r="2"/><circle cx="14" cy="${bodyTop - 31}" r="2"/></g>` : ""}
  </g>`;
}

/** Простая собака или кошка. */
export function drawSimplePet(o: DemoHeroOpts) {
  const cat = o.look.species === "cat";
  const fur = colorFrom(FUR_COLORS, o.look.furColor, cat ? "#8e8e94" : "#d7863a");
  const s = stroke(o.style);
  const ears = cat
    ? `<path d="M-40 -62 L-30 -100 L-12 -70Z M40 -62 L30 -100 L12 -70Z" fill="${fur}"${s}/>`
    : `<path d="M-38 -70 Q-64 -40 -46 -10 Q-34 -40 -26 -66Z M38 -70 Q64 -40 46 -10 Q34 -40 26 -66Z" fill="${fur}"${s} opacity=".9"/>`;
  return `<g transform="translate(${o.x} ${o.y}) scale(${o.flip ? -o.scale : o.scale} ${o.scale})">
    <ellipse cx="0" cy="190" rx="90" ry="12" fill="rgba(0,0,0,.18)"/>
    <ellipse cx="10" cy="120" rx="80" ry="50" fill="${fur}"${s}/>
    <rect x="-50" y="140" width="20" height="50" rx="9" fill="${fur}"${s}/><rect x="50" y="140" width="20" height="50" rx="9" fill="${fur}"${s}/>
    <path d="M86 110 Q130 ${cat ? 40 : 80} 120 ${cat ? 20 : 60}" stroke="${fur}" stroke-width="${cat ? 12 : 16}" fill="none" stroke-linecap="round"/>
    <g transform="translate(-50 60)">
      ${ears}
      <circle cx="0" cy="-30" r="46" fill="${fur}"${s}/>
      <circle cx="-16" cy="-36" r="5" fill="#2b2b2b"/><circle cx="16" cy="-36" r="5" fill="#2b2b2b"/>
      <ellipse cx="0" cy="-18" rx="${cat ? 5 : 9}" ry="${cat ? 4 : 6}" fill="#3a2a2a"/>
      ${cat ? `<path d="M-10 -16 h-30 M-10 -12 l-28 6 M10 -16 h30 M10 -12 l28 6" stroke="#3a2a2a" stroke-width="1.5"/>` : `<path d="M-8 -8 Q0 4 8 -8" stroke="#3a2a2a" stroke-width="3" fill="none"/>`}
    </g>
  </g>`;
}

/** Доп. герой «свой вариант» или игрушка: дерево, робот, машина, мишка; иначе — сияющий шар. */
export function drawThing(o: DemoHeroOpts) {
  const t = (o.look.thing ?? "").toLowerCase();
  const a = pick(o.style.palette.accents.length ? o.style.palette.accents : ["#f0ad4e"], (o.index ?? 0) + 1);
  const s = stroke(o.style);
  let body: string;
  if (/дерев|дуб|ёлк|ель|берёз|tree/.test(t))
    body = `<rect x="-14" y="80" width="28" height="110" fill="#7a4a2a"${s}/><circle cx="0" cy="40" r="80" fill="#5b9a63"${s}/>`;
  else if (/робот|robot/.test(t))
    body = `<rect x="-50" y="60" width="100" height="110" rx="12" fill="#9fb3c8"${s}/><rect x="-40" y="-10" width="80" height="64" rx="10" fill="#c7d6e5"${s}/><circle cx="-16" cy="22" r="8" fill="${a}"/><circle cx="16" cy="22" r="8" fill="${a}"/><path d="M0 -10 v-24" stroke="#555" stroke-width="4"/><circle cx="0" cy="-38" r="7" fill="${a}"/>`;
  else if (/машин|авто|car|грузов|трактор/.test(t))
    body = `<rect x="-90" y="110" width="180" height="56" rx="18" fill="${a}"${s}/><path d="M-50 110 L-30 70 H40 L60 110Z" fill="${a}"${s}/><circle cx="-50" cy="170" r="20" fill="#333"/><circle cx="50" cy="170" r="20" fill="#333"/>`;
  else if (/мишк|медвед|bear|игрушк|toy/.test(t))
    body = `<circle cx="0" cy="130" r="56" fill="#b07b4f"${s}/><circle cx="0" cy="40" r="44" fill="#b07b4f"${s}/><circle cx="-34" cy="6" r="15" fill="#b07b4f"${s}/><circle cx="34" cy="6" r="15" fill="#b07b4f"${s}/><circle cx="-14" cy="36" r="5" fill="#2b2b2b"/><circle cx="14" cy="36" r="5" fill="#2b2b2b"/><ellipse cx="0" cy="54" rx="10" ry="7" fill="#e9c9a8"/>`;
  else body = `<circle cx="0" cy="100" r="70" fill="${a}" opacity=".85"${s}/><circle cx="-20" cy="86" r="6" fill="#2b2b2b"/><circle cx="20" cy="86" r="6" fill="#2b2b2b"/><path d="M-14 112 Q0 124 14 112" stroke="#2b2b2b" stroke-width="4" fill="none"/>`;
  return `<g transform="translate(${o.x} ${o.y}) scale(${o.scale})"><ellipse cx="0" cy="190" rx="70" ry="12" fill="rgba(0,0,0,.15)"/>${body}</g>`;
}

/** Декор поверх неба: count элементов в верхних 60% кадра. Используют render.ts и mood.ts. */
export function drawDeco(kind: DemoDeco, W: number, H: number, r: () => number, accent: string, count = 26) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round(r() * W);
    const y = Math.round(r() * H * 0.6);
    const k = 0.7 + r() * 0.8;
    switch (kind) {
      case "snow": out += `<circle cx="${x}" cy="${y}" r="${(3 + r() * 5).toFixed(1)}" fill="#fff" opacity=".85"/>`; break;
      case "stars": out += `<path d="M${x} ${y - 7}l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="#f6e7b8"/>`; break;
      case "bubbles": out += `<circle cx="${x}" cy="${y}" r="${(4 + r() * 10).toFixed(1)}" fill="none" stroke="#cfeff6" stroke-width="2" opacity=".7"/>`; break;
      case "moon": if (i < 18) out += `<circle cx="${x}" cy="${y}" r="2.5" fill="#fff8d9"/>`; break;
      case "flags": if (i < 6) out += `<path d="M${x} ${y + 150}v-60l40 15-40 15" fill="${accent}" stroke="#5a2c45" stroke-width="3"/>`; break;
      case "leaves": out += `<path d="M${x} ${y}q${12 * k} ${-10 * k} ${24 * k} 0q${-12 * k} ${10 * k} ${-24 * k} 0z" fill="${accent}" opacity=".75" transform="rotate(${Math.round(r() * 360)} ${x} ${y})"/>`; break;
      case "hearts": if (i < 14) out += `<path d="M${x} ${y + 8 * k}c${-14 * k} ${-10 * k} ${-10 * k} ${-22 * k} 0 ${-14 * k}c${10 * k} ${-8 * k} ${14 * k} ${4 * k} 0 ${14 * k}z" fill="${accent}" opacity=".8"/>`; break;
      case "confetti": out += `<rect x="${x}" y="${y}" width="${(6 * k).toFixed(1)}" height="${(12 * k).toFixed(1)}" fill="${["#f25f5c", "#ffe066", "#247ba0", "#70c1b3", accent][i % 5]}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})"/>`; break;
      case "sparkles": out += `<path d="M${x} ${y - 10 * k}L${x + 2.5 * k} ${y - 2.5 * k} ${x + 10 * k} ${y} ${x + 2.5 * k} ${y + 2.5 * k} ${x} ${y + 10 * k} ${x - 2.5 * k} ${y + 2.5 * k} ${x - 10 * k} ${y} ${x - 2.5 * k} ${y - 2.5 * k}Z" fill="#fff6c9" opacity=".9"/>`; break;
      case "paws": if (i < 12) out += `<g fill="${accent}" opacity=".5" transform="translate(${x} ${y}) scale(${k.toFixed(2)})"><ellipse cx="0" cy="6" rx="8" ry="7"/><circle cx="-8" cy="-5" r="3.5"/><circle cx="0" cy="-8" r="3.5"/><circle cx="8" cy="-5" r="3.5"/></g>`; break;
      case "clouds": if (i < 6) out += `<g fill="#fff" opacity=".75"><ellipse cx="${x}" cy="${y}" rx="${60 * k}" ry="${22 * k}"/><ellipse cx="${x + 30 * k}" cy="${y - 14 * k}" rx="${36 * k}" ry="${22 * k}"/></g>`; break;
      case "grid": if (i === 0) for (let gx = 0; gx < W; gx += 64) out += `<path d="M${gx} 0V${H * 0.62}" stroke="${accent}" stroke-width="1" opacity=".25"/>`; break;
      case "none": break;
    }
  }
  return out;
}
