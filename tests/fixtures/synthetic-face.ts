// Синтетическое «фото» для тестов и скриншотов: нарисованное SVG-лицо (никаких настоящих детских фото).
// Голова — овал цвета кожи с глазами, бровями, ртом и волосами, плечи в одежде, фон — комната.
export interface SynthFace {
  cx: number;
  cy: number;
  /** Полуширина лица. */
  r: number;
  skin?: string;
  hair?: string;
}

export function faceSvg(o: { w?: number; h?: number; faces?: SynthFace[]; bg?: string; blur?: number; dim?: number } = {}): string {
  const W = o.w ?? 1200;
  const H = o.h ?? 1500;
  const faces = o.faces ?? [{ cx: W / 2, cy: H * 0.42, r: W * 0.17 }];
  const head = (f: SynthFace) => {
    const skin = f.skin ?? "#e8b896";
    const hair = f.hair ?? "#5b3a22";
    const rx = f.r, ry = f.r * 1.28;
    return `<g>
<rect x="${f.cx - rx * 1.9}" y="${f.cy + ry * 1.05}" width="${rx * 3.8}" height="${ry * 2.2}" rx="${rx * 0.9}" fill="#3d6fb0"/>
<rect x="${f.cx - rx * 0.32}" y="${f.cy + ry * 0.75}" width="${rx * 0.64}" height="${ry * 0.5}" fill="${skin}"/>
<ellipse cx="${f.cx}" cy="${f.cy - ry * 0.35}" rx="${rx * 1.12}" ry="${ry * 0.82}" fill="${hair}"/>
<ellipse cx="${f.cx}" cy="${f.cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>
<path d="M${f.cx - rx * 1.02} ${f.cy - ry * 0.25} Q${f.cx} ${f.cy - ry * 1.25} ${f.cx + rx * 1.02} ${f.cy - ry * 0.25} Q${f.cx} ${f.cy - ry * 0.75} ${f.cx - rx * 1.02} ${f.cy - ry * 0.25}Z" fill="${hair}"/>
<rect x="${f.cx - rx * 0.62}" y="${f.cy - ry * 0.3}" width="${rx * 0.42}" height="${ry * 0.07}" rx="${ry * 0.03}" fill="#5a3a1e"/>
<rect x="${f.cx + rx * 0.2}" y="${f.cy - ry * 0.3}" width="${rx * 0.42}" height="${ry * 0.07}" rx="${ry * 0.03}" fill="#5a3a1e"/>
<ellipse cx="${f.cx - rx * 0.4}" cy="${f.cy - ry * 0.1}" rx="${rx * 0.17}" ry="${ry * 0.09}" fill="#fff"/>
<ellipse cx="${f.cx + rx * 0.4}" cy="${f.cy - ry * 0.1}" rx="${rx * 0.17}" ry="${ry * 0.09}" fill="#fff"/>
<circle cx="${f.cx - rx * 0.4}" cy="${f.cy - ry * 0.1}" r="${rx * 0.08}" fill="#2b1d12"/>
<circle cx="${f.cx + rx * 0.4}" cy="${f.cy - ry * 0.1}" r="${rx * 0.08}" fill="#2b1d12"/>
<path d="M${f.cx - rx * 0.06} ${f.cy + ry * 0.05} L${f.cx - rx * 0.13} ${f.cy + ry * 0.3} L${f.cx + rx * 0.1} ${f.cy + ry * 0.3}" stroke="#c48a6a" stroke-width="${rx * 0.04}" fill="none"/>
<path d="M${f.cx - rx * 0.36} ${f.cy + ry * 0.48} Q${f.cx} ${f.cy + ry * 0.7} ${f.cx + rx * 0.36} ${f.cy + ry * 0.48}" stroke="#8c3b3b" stroke-width="${rx * 0.07}" fill="none" stroke-linecap="round"/>
<ellipse cx="${f.cx - rx * 0.62}" cy="${f.cy + ry * 0.28}" rx="${rx * 0.16}" ry="${ry * 0.08}" fill="#e79c8a" opacity=".5"/>
<ellipse cx="${f.cx + rx * 0.62}" cy="${f.cy + ry * 0.28}" rx="${rx * 0.16}" ry="${ry * 0.08}" fill="#e79c8a" opacity=".5"/>
</g>`;
  };
  const filt = o.blur ? `<filter id="b"><feGaussianBlur stdDeviation="${o.blur}"/></filter>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${filt}<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.bg ?? "#cfe0ea"}"/><stop offset="1" stop-color="#9fb6c4"/></linearGradient></defs>
<g${o.blur ? ' filter="url(#b)"' : ""}${o.dim ? ` opacity="${o.dim}"` : ""}><rect width="${W}" height="${H}" fill="url(#wall)"/><rect x="${W * 0.06}" y="${H * 0.08}" width="${W * 0.22}" height="${H * 0.3}" fill="#f5f1e6" stroke="#7b8a94" stroke-width="10"/>
<rect x="0" y="${H * 0.82}" width="${W}" height="${H * 0.18}" fill="#6d7f8a"/>${faces.map(head).join("")}</g>${o.dim ? `<rect width="${W}" height="${H}" fill="#000" opacity="${1 - o.dim}"/>` : ""}</svg>`;
}

/** Синтетическая собака: рыжая голова с ушами и носом на траве (для пути «питомец с фото»). */
export function petSvg(W = 1200, H = 1200): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#bcd9a8"/><rect y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="#7fae5e"/>
<ellipse cx="${W / 2}" cy="${H * 0.78}" rx="${W * 0.3}" ry="${H * 0.2}" fill="#c9782e"/>
<ellipse cx="${W / 2}" cy="${H * 0.45}" rx="${W * 0.22}" ry="${H * 0.2}" fill="#d4873a"/>
<ellipse cx="${W * 0.3}" cy="${H * 0.36}" rx="${W * 0.07}" ry="${H * 0.15}" fill="#8a4c1c" transform="rotate(20 ${W * 0.3} ${H * 0.36})"/>
<ellipse cx="${W * 0.7}" cy="${H * 0.36}" rx="${W * 0.07}" ry="${H * 0.15}" fill="#8a4c1c" transform="rotate(-20 ${W * 0.7} ${H * 0.36})"/>
<ellipse cx="${W / 2}" cy="${H * 0.53}" rx="${W * 0.1}" ry="${H * 0.07}" fill="#f2d9b8"/>
<circle cx="${W * 0.42}" cy="${H * 0.42}" r="${W * 0.025}" fill="#1b1209"/><circle cx="${W * 0.58}" cy="${H * 0.42}" r="${W * 0.025}" fill="#1b1209"/>
<ellipse cx="${W / 2}" cy="${H * 0.5}" rx="${W * 0.04}" ry="${H * 0.028}" fill="#1b1209"/></svg>`;
}
