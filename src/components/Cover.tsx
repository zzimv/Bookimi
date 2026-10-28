
// Обложки-заглушки: собственные простые иллюстрации до загрузки настоящих
// обложек из админки. Имя героя подставляется CSS-переменной --hero-name
// (без гидратации карточек). Пять старых тем нарисованы вручную; остальные темы контент-движка —
// простая заглушка в цветах темы (colors из каталога).

export type CoverColors = { sky: [string, string]; ground: string; accent: string };

function Generic({ c }: { c: CoverColors }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`cv-${c.sky.join("").replace(/#/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sky[0]} />
          <stop offset="1" stopColor={c.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#cv-${c.sky.join("").replace(/#/g, "")})`} />
      <circle cx="150" cy="46" r="18" fill="#f6e7b8" opacity="0.9" />
      <path d="M0 150 Q60 120 110 142 T200 132 V200 H0Z" fill={c.ground} />
      <circle cx="96" cy="118" r="16" fill={c.accent} />
      <path d="M78 160 q18 -40 36 0z" fill={c.accent} />
    </svg>
  );
}

const OWN = ["winter", "kingdom", "dragon", "ocean", "sleep"];

function Art({ theme, colors }: { theme: string; colors?: CoverColors }) {
  if (!OWN.includes(theme) && colors) return <Generic c={colors} />;
  switch (theme) {
    case "winter":
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect width="200" height="200" fill="#24506a" />
          <circle cx="150" cy="48" r="20" fill="#f6e7b8" />
          <path d="M0 150 Q50 120 100 145 T200 135 V200 H0Z" fill="#eaf2f6" />
          <path d="M20 150 l18 -46 l18 46z M60 152 l14 -36 l14 36z M150 146 l16 -42 l16 42z" fill="#1e4d3b" />
          <path d="M70 128 h52 q8 0 10 -8 l4 -10 h8 l-6 18 q-3 10 -16 10 h-52z" fill="#b8352c" />
          <rect x="84" y="108" width="18" height="16" rx="2" fill="#c8952f" />
          <rect x="104" y="112" width="14" height="12" rx="2" fill="#e3ede6" />
          {[30, 70, 120, 170, 45, 95, 185].map((x, i) => (
            <circle key={i} cx={x} cy={20 + ((i * 37) % 90)} r="2.2" fill="#fff" opacity="0.85" />
          ))}
        </svg>
      );
    case "kingdom":
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect width="200" height="200" fill="#8e4b6e" />
          <circle cx="40" cy="40" r="26" fill="#f3d27a" opacity="0.9" />
          <path d="M60 160 V90 h14 v-14 h10 v14 h32 v-14 h10 v14 h14 v70z" fill="#f6eadb" />
          <path d="M56 90 l18 -26 l18 26z M108 90 l18 -26 l18 26z" fill="#c8952f" />
          <rect x="92" y="122" width="16" height="38" rx="8" fill="#5a2c45" />
          <path d="M0 160 H200 V200 H0z" fill="#3f7a52" />
          <path d="M150 40 v26 M150 40 l14 6 l-14 6" stroke="#fff" strokeWidth="2" fill="#f3d27a" />
        </svg>
      );
    case "dragon":
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect width="200" height="200" fill="#1f2d55" />
          <path d="M152 30 l5 12 l13 1 l-10 8 l4 13 l-12 -7 l-11 7 l3 -13 l-10 -8 l13 -1z" fill="#f3d27a" />
          {[20, 60, 100, 40, 180, 130].map((x, i) => (
            <circle key={i} cx={x} cy={18 + i * 14} r="1.8" fill="#fff" />
          ))}
          <ellipse cx="100" cy="128" rx="36" ry="24" fill="#5bbf9a" />
          <circle cx="132" cy="104" r="16" fill="#5bbf9a" />
          <circle cx="137" cy="100" r="3" fill="#1f2d55" />
          <path d="M84 112 q-20 -30 6 -36 q-2 18 14 26z" fill="#9fe0c6" />
          <path d="M66 132 q-26 4 -30 -16 q14 10 30 6z" fill="#5bbf9a" />
          <path d="M0 165 Q100 140 200 165 V200 H0z" fill="#16402f" />
        </svg>
      );
    case "ocean":
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect width="200" height="200" fill="#0f5c74" />
          <rect width="200" height="60" fill="#1b7a92" />
          <path d="M60 110 q0 -22 40 -22 h20 q30 0 30 22 q0 22 -30 22 h-40 q-20 0 -20 -22z" fill="#f2c443" />
          <rect x="96" y="72" width="16" height="18" rx="3" fill="#f2c443" />
          <circle cx="92" cy="110" r="7" fill="#bfe6f0" stroke="#c8952f" strokeWidth="3" />
          <circle cx="118" cy="110" r="7" fill="#bfe6f0" stroke="#c8952f" strokeWidth="3" />
          <path d="M20 200 q6 -40 -4 -60 M34 200 q-4 -30 8 -50 M170 200 q8 -34 -2 -56" stroke="#e46e6e" strokeWidth="6" fill="none" strokeLinecap="round" />
          {[150, 160, 172].map((y, i) => (
            <circle key={i} cx={156 + i * 6} cy={y - 90} r={3 + i} fill="none" stroke="#bfe6f0" strokeWidth="1.5" />
          ))}
        </svg>
      );
    case "sleep":
    default:
      return (
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <rect width="200" height="200" fill="#3d3a6b" />
          <path d="M140 36 a28 28 0 1 0 22 44 a22 22 0 1 1 -22 -44z" fill="#f6e7b8" />
          <ellipse cx="60" cy="70" rx="30" ry="12" fill="#6e6aa3" />
          <ellipse cx="80" cy="64" rx="20" ry="12" fill="#6e6aa3" />
          <path d="M0 160 Q60 130 120 150 T200 140 V200 H0z" fill="#2b2950" />
          <ellipse cx="96" cy="150" rx="22" ry="12" fill="#c9a77a" />
          <circle cx="114" cy="140" r="10" fill="#c9a77a" />
          <path d="M110 140 h4 M117 140 h4" stroke="#3d3a6b" strokeWidth="1.6" strokeLinecap="round" />
          <text x="150" y="120" fill="#f6e7b8" fontSize="12" fontFamily="sans-serif">z z</text>
        </svg>
      );
  }
}

export function Cover({ theme, title, coverUrl, colors }: { theme: string; title: string; coverUrl?: string | null; colors?: CoverColors }) {
  return (
    <div className="cover">
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" loading="lazy" width={600} height={600} />
      ) : (
        <Art theme={theme} colors={colors} />
      )}
      <div className="cover__name" aria-hidden="true" />
      <div className="cover__title" aria-hidden="true">{title}</div>
    </div>
  );
}
