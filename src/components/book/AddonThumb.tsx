// Миниатюра допа в оформлении и кабинете: схематичное изделие (постер, открытки, календарь…) с обложкой книги
// внутри. Чистый SVG без картинок-файлов — ничего не весит и одинаково работает на сайте и в демо-стенде.
type Shape =
  | "poster" | "print" | "frame" | "stickers" | "cards" | "calendar" | "bookmarks" | "bookmark" | "notebook" | "wallpapers"
  | "passport" | "box" | "height" | "audio" | "mic" | "coloring" | "cartoon" | "magnet" | "copy" | "urgent";

const SHAPE: Record<string, Shape> = {
  poster: "poster", "teen-poster": "poster", "pet-poster": "poster", "adult-print": "print", "framed-print": "frame",
  stickers: "stickers", "teen-stickers": "stickers", postcards: "cards", "pet-postcards": "cards",
  "adult-calendar": "calendar", "pet-calendar": "calendar", "teen-bookmarks": "bookmarks", bookmark: "bookmark",
  notebook: "notebook", wallpapers: "wallpapers", "pet-passport": "passport", "premium-box": "box", "gift-box": "box",
  "height-chart": "height", audiobook: "audio", "audio-self": "mic", "cartoon-own-voice": "mic", coloring: "coloring",
  cartoon: "cartoon", "pet-magnet": "magnet", "second-copy": "copy", urgent: "urgent",
};

const INK = "#1e4d3b";
const PAPER = "#fffaf0";

export function AddonThumb({ addonKey, coverUrl, size = 56 }: { addonKey: string; coverUrl: string | null; size?: number }) {
  const shape = SHAPE[addonKey] ?? "box";
  const id = `ath-${addonKey}`;
  // Картинка в прямоугольнике: обложка книги (или цветная заливка, если обложки нет)
  const pic = (x: number, y: number, w: number, h: number, r = 1, extra?: string) => (
    <g>
      <clipPath id={`${id}-${x}-${y}`}><rect x={x} y={y} width={w} height={h} rx={r} /></clipPath>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="#9cc3a8" />
      {coverUrl && <image href={coverUrl} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-${x}-${y})`} style={extra ? { filter: extra } : undefined} />}
    </g>
  );
  let body;
  switch (shape) {
    case "poster":
      body = <>{pic(17, 6, 30, 42, 1)}<rect x="17" y="40" width="30" height="8" fill={INK} opacity=".85" /><rect x="21" y="43" width="22" height="2" rx="1" fill="#fff" /></>;
      break;
    case "print":
      body = <><rect x="15" y="5" width="34" height="46" fill={PAPER} stroke="#d9cfb8" />{pic(20, 10, 24, 30, 0)}<rect x="24" y="44" width="16" height="2" rx="1" fill={INK} /></>;
      break;
    case "frame":
      body = <><rect x="12" y="3" width="40" height="52" fill="#8a5a33" /><rect x="16" y="7" width="32" height="44" fill={PAPER} />{pic(20, 11, 24, 32, 0)}</>;
      break;
    case "stickers":
      body = <><rect x="10" y="6" width="44" height="46" rx="4" fill={PAPER} stroke="#d9cfb8" strokeDasharray="2 2" /><circle cx="24" cy="20" r="9" fill="#fff" />{pic(16, 12, 16, 16, 8)}<circle cx="41" cy="33" r="8" fill="#fff" />{pic(34, 26, 14, 14, 7)}<rect x="15" y="35" width="16" height="9" rx="4" fill="#f5a524" /><rect x="36" y="11" width="12" height="7" rx="3.5" fill="#7c5cff" /></>;
      break;
    case "cards":
      body = <><g transform="rotate(-10 32 30)"><rect x="9" y="14" width="40" height="27" rx="1.5" fill={PAPER} stroke="#d9cfb8" /></g><g transform="rotate(5 32 30)"><rect x="14" y="17" width="40" height="27" rx="1.5" fill="#fff" stroke="#d9cfb8" />{pic(16, 19, 36, 23, 1)}</g></>;
      break;
    case "calendar":
      body = (
        <>
          <rect x="14" y="5" width="36" height="48" rx="1.5" fill="#fff" stroke="#d9cfb8" />
          {pic(16, 9, 32, 20, 0.5)}
          {Array.from({ length: 4 }, (_, r) => Array.from({ length: 7 }, (_, c) => <rect key={`${r}-${c}`} x={17 + c * 4.4} y={33 + r * 4.5} width="3" height="3" fill={c >= 5 || (r === 0 && c === 0) ? "#d64545" : "#b9c7bf"} />))}
          {[22, 32, 42].map((x) => <rect key={x} x={x - 1} y="2.5" width="2" height="5" rx="1" fill="#555" />)}
        </>
      );
      break;
    case "bookmarks":
      body = <>{[10, 22, 34, 46].map((x, i) => <g key={x} transform={`rotate(${(i - 1.5) * 4} ${x + 4} 30)`}>{pic(x, 6 + (i % 2) * 3, 9, 44, 1)}<circle cx={x + 4.5} cy={11 + (i % 2) * 3} r="1.2" fill="#fff" /></g>)}</>;
      break;
    case "bookmark":
      body = <>{pic(26, 4, 12, 50, 1)}<circle cx="32" cy="9" r="1.5" fill="#fff" /><path d="M32 54 v3" stroke="#c0392b" strokeWidth="1.5" /></>;
      break;
    case "notebook":
      body = <><rect x="16" y="5" width="34" height="48" rx="2" fill={INK} />{pic(19, 8, 28, 42, 1)}{Array.from({ length: 9 }, (_, i) => <circle key={i} cx="16" cy={9 + i * 5} r="1.6" fill="none" stroke="#555" strokeWidth="1.2" />)}</>;
      break;
    case "wallpapers":
      body = <><rect x="4" y="14" width="40" height="26" rx="2" fill="#333" />{pic(6, 16, 36, 22, 0.5)}<rect x="20" y="40" width="8" height="5" fill="#555" /><rect x="15" y="45" width="18" height="2" rx="1" fill="#555" /><rect x="44" y="12" width="16" height="34" rx="3" fill="#222" />{pic(45.5, 14, 13, 30, 2)}</>;
      break;
    case "passport":
      body = <><rect x="6" y="14" width="52" height="34" rx="2" fill="#fff" stroke="#d9cfb8" /><rect x="6" y="14" width="52" height="7" rx="2" fill={INK} />{pic(10, 24, 16, 20, 1)}{[26, 31, 36, 41].map((y) => <rect key={y} x="30" y={y} width={y === 26 ? 22 : 18} height="2" rx="1" fill="#b9c7bf" />)}</>;
      break;
    case "box":
      body = <><rect x="9" y="22" width="46" height="30" rx="1.5" fill={addonKey === "premium-box" ? "#1b1b1b" : "#c9a36b"} /><rect x="7" y="16" width="50" height="9" rx="1.5" fill={addonKey === "premium-box" ? "#2a2a2a" : "#d8b47d"} /><rect x="29" y="16" width="6" height="36" fill={addonKey === "premium-box" ? "#c8a24a" : "#c0392b"} />{pic(38, 30, 13, 17, 1)}</>;
      break;
    case "height":
      body = <>{pic(22, 3, 14, 52, 1)}{Array.from({ length: 11 }, (_, i) => <rect key={i} x="37" y={4 + i * 5} width={i % 2 ? 4 : 7} height="1" fill={INK} />)}</>;
      break;
    case "audio":
      body = <>{pic(12, 12, 28, 28, 2)}<path d="M44 20 a9 9 0 0 1 0 12 M48 16 a15 15 0 0 1 0 20" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>;
      break;
    case "mic":
      body = <>{pic(8, 12, 26, 26, 2)}<rect x="41" y="12" width="10" height="20" rx="5" fill={INK} /><path d="M37 26 a9 9 0 0 0 18 0 M46 35 v7 M41 42 h10" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" /></>;
      break;
    case "coloring":
      body = <><rect x="12" y="6" width="34" height="46" fill="#fff" stroke="#d9cfb8" />{pic(15, 9, 28, 28, 0, "grayscale(1) contrast(3) brightness(1.6)")}<rect x="46" y="20" width="5" height="30" rx="1" fill="#f5a524" transform="rotate(20 48 35)" /></>;
      break;
    case "cartoon":
      body = <>{pic(6, 12, 52, 34, 3)}<circle cx="32" cy="29" r="9" fill="rgba(0,0,0,.55)" /><path d="M29 24 L37 29 L29 34 Z" fill="#fff" /></>;
      break;
    case "magnet":
      body = <><rect x="12" y="15" width="40" height="28" rx="5" fill="#444" />{pic(14, 17, 36, 24, 4)}</>;
      break;
    case "copy":
      body = <>{pic(10, 14, 26, 32, 1)}{pic(26, 10, 26, 32, 1)}<text x="46" y="54" fontSize="11" fontWeight="800" fill={INK} textAnchor="middle">×2</text></>;
      break;
    case "urgent":
      body = <>{pic(10, 12, 30, 34, 1)}<path d="M46 8 L38 30 H46 L42 52 L56 24 H48 L54 8 Z" fill="#f5a524" stroke={INK} strokeWidth="1" /></>;
      break;
  }
  return (
    <svg className="addon-thumb" viewBox="0 0 64 58" width={size} height={Math.round((size * 58) / 64)} aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}
