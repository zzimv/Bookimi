"use client";
// Допы в оформлении и в кабинете: крупные карточки с картинкой «что вы получите» (постер на стене, страница календаря,
// набор открыток, обои на телефоне…) из обложки и разворотов этой книги, цена и одна строка описания. Нажатие на
// картинку — увеличенный просмотр в окне на странице (фокус внутри окна, Esc закрывает). Сетка: 1 колонка на 360,
// 2 — от 600 px, 3 — от 1000 px (globals.css, .addon-grid). Всё рисуется SVG — без файлов и одинаково в демо.
import { useEffect, useRef, useState } from "react";
import { rub } from "@/lib/client";

export interface AddonCardItem {
  key: string;
  title: string;
  description: string;
  priceRub: number | null;
  percentOff?: number | null;
  /** «Скоро»: видно, но купить нельзя (например, «Оживление книги», пока cartoon.enabled = false). */
  soon?: boolean;
}

type Art = { images: string[]; name: string; title: string };

/** Январь 2027: 1-е — пятница (столбец 4 от понедельника); 1–8 — праздники. */
const CALENDAR_DAYS_2027_JAN = Array.from({ length: 31 }, (_, i) => i + 1);

const INK = "#1e4d3b";
const PAPER = "#fffaf0";
const LINE = "#d9cfb8";

/** Короткое название для заголовка карточки: «Постер с обложкой А3» → как есть; длинное — до двоеточия. */
const shortTitle = (t: string) => t.split(":")[0];

/** Картинка в прямоугольнике с обрезкой по рамке (cover → spreads по кругу). */
function Pic({ id, art, n, x, y, w, h, r = 2, filter }: { id: string; art: Art; n: number; x: number; y: number; w: number; h: number; r?: number; filter?: string }) {
  const src = art.images.length ? art.images[n % art.images.length] : null;
  const cid = `${id}-c${n}-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g>
      <clipPath id={cid}>
        <rect x={x} y={y} width={w} height={h} rx={r} />
      </clipPath>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="#9cc3a8" />
      {src && <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} style={filter ? { filter } : undefined} />}
    </g>
  );
}

const T = ({ x, y, s = 10, w = 800, fill = INK, anchor = "middle", children }: { x: number; y: number; s?: number; w?: number; fill?: string; anchor?: "start" | "middle" | "end"; children: string }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} fill={fill} textAnchor={anchor} fontFamily="Nunito, Manrope, sans-serif">
    {children}
  </text>
);

/** Крупная картинка допа: 320×220, изделие «в жизни» — на стене, в руке, на телефоне. */
export function AddonArt({ addonKey, art, id }: { addonKey: string; art: Art; id: string }) {
  const name = art.name || "Герой";
  const short = (art.title || "Ваша сказка").slice(0, 34);
  let body: React.ReactNode;
  const wall = <rect x="0" y="0" width="320" height="220" fill="#efe6d4" />;
  const shadow = (x: number, y: number, w: number, h: number) => <rect x={x + 4} y={y + 6} width={w} height={h} rx="3" fill="rgba(0,0,0,.14)" />;
  switch (addonKey) {
    case "poster":
    case "teen-poster":
    case "pet-poster":
      body = (
        <>
          {wall}
          {shadow(105, 14, 110, 156)}
          <rect x="105" y="14" width="110" height="156" fill="#fff" />
          <Pic id={id} art={art} n={addonKey === "teen-poster" ? 1 : 0} x={109} y={18} w={102} h={122} r={0} />
          <T x={160} y={155} s={11}>{name}</T>
          <T x={160} y={165} s={6.5} w={600} fill="#555">{short}</T>
          <rect x="60" y="182" width="200" height="22" rx="4" fill="#d8c7a6" />
          <T x={160} y={197} s={9} w={700} fill="#5b4a2e">А3 · 29,7 × 42 см</T>
        </>
      );
      break;
    case "adult-print":
    case "framed-print":
      body = (
        <>
          {wall}
          {shadow(96, 12, 128, 170)}
          <rect x="96" y="12" width="128" height="170" fill={addonKey === "framed-print" ? "#8a5a33" : "#fff"} />
          <rect x="104" y="20" width="112" height="154" fill={PAPER} />
          <Pic id={id} art={art} n={2} x={116} y={32} w={88} h={110} r={0} />
          <T x={160} y={158} s={8} w={700} fill="#444">{short}</T>
          <T x={160} y={204} s={9} w={700} fill="#5b4a2e">Принт А3 с паспарту</T>
        </>
      );
      break;
    case "stickers":
    case "teen-stickers":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          <rect x="70" y="10" width="180" height="200" rx="8" fill="#fff" stroke={LINE} />
          {[
            [115, 55, 34, 0],
            [200, 60, 28, 1],
            [120, 140, 26, 2],
            [205, 150, 36, 3],
          ].map(([cx, cy, r, n]) => (
            <g key={n}>
              <circle cx={cx} cy={cy} r={r + 4} fill="#fff" stroke="#bbb" strokeDasharray="3 2" />
              <Pic id={id} art={art} n={n} x={cx - r} y={cy - r} w={r * 2} h={r * 2} r={r} />
            </g>
          ))}
          <rect x="140" y="92" width="76" height="22" rx="11" fill="#f5a524" />
          <T x={178} y={107} s={10} fill="#fff">{name}</T>
          <rect x="84" y="178" width="46" height="18" rx="9" fill="#7c5cff" />
          <T x={107} y={191} s={8} fill="#fff">ура!</T>
        </>
      );
      break;
    case "postcards":
    case "pet-postcards":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {[
            [-12, 40, 40, 1],
            [-2, 95, 50, 2],
            [9, 150, 46, 3],
          ].map(([rot, x, y, n]) => (
            <g key={n} transform={`rotate(${rot} ${x + 60} ${y + 42})`}>
              {shadow(x, y, 120, 84)}
              <rect x={x} y={y} width="120" height="84" rx="2" fill="#fff" />
              <Pic id={id} art={art} n={n} x={x + 4} y={y + 4} w={112} h={76} r={1} />
            </g>
          ))}
          <T x={160} y={208} s={9} w={700} fill="#5b4a2e">{addonKey === "pet-postcards" ? "4 открытки 10×15 + наклейки" : "6 открыток 10×15 см"}</T>
        </>
      );
      break;
    case "adult-calendar":
    case "pet-calendar":
      body = (
        <>
          {wall}
          {shadow(92, 10, 136, 200)}
          <rect x="92" y="10" width="136" height="200" fill="#fff" />
          {[120, 160, 200].map((x) => <rect key={x} x={x - 2} y="5" width="4" height="12" rx="2" fill="#555" />)}
          <Pic id={id} art={art} n={1} x={98} y={18} w={124} h={96} r={0} />
          <T x={160} y={128} s={10}>Январь 2027</T>
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d, c) => (
            <T key={d} x={106 + c * 18} y={140} s={6} w={700} fill={c >= 5 ? "#c0392b" : "#777"}>{d}</T>
          ))}
          {CALENDAR_DAYS_2027_JAN.map((day, i) => {
            const c = (i + 4) % 7;
            const r = Math.floor((i + 4) / 7);
            const red = c >= 5 || day <= 8;
            return <T key={day} x={106 + c * 18} y={152 + r * 11} s={7} w={red ? 800 : 600} fill={red ? "#c0392b" : "#333"}>{String(day)}</T>;
          })}
        </>
      );
      break;
    case "teen-bookmarks":
    case "bookmark": {
      const n = addonKey === "bookmark" ? 1 : 4;
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {Array.from({ length: n }, (_, i) => {
            const x = n === 1 ? 140 : 70 + i * 50;
            return (
              <g key={i} transform={`rotate(${n === 1 ? 4 : (i - 1.5) * 5} ${x + 20} 110)`}>
                {shadow(x, 20, 40, 170)}
                <rect x={x} y={20} width="40" height="170" rx="3" fill="#fff" />
                <Pic id={id} art={art} n={i} x={x + 3} y={23} w={34} h={140} r={2} />
                <T x={x + 20} y={180} s={7}>{name}</T>
                <circle cx={x + 20} cy={30} r="3" fill="#fff" stroke="#999" />
                <path d={`M${x + 20} 30 q-8 -18 -2 -28`} stroke="#c0392b" strokeWidth="2" fill="none" />
              </g>
            );
          })}
        </>
      );
      break;
    }
    case "notebook":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {shadow(100, 14, 130, 190)}
          <rect x="100" y="14" width="130" height="190" rx="4" fill={INK} />
          <Pic id={id} art={art} n={2} x={108} y={22} w={114} h={150} r={3} />
          <T x={165} y={190} s={11} fill="#fff">{name}</T>
          {Array.from({ length: 14 }, (_, i) => <circle key={i} cx="100" cy={24 + i * 13} r="4" fill="none" stroke="#666" strokeWidth="2" />)}
        </>
      );
      break;
    case "wallpapers":
      body = (
        <>
          <rect width="320" height="220" fill="#e9eef0" />
          <rect x="18" y="36" width="190" height="120" rx="6" fill="#222" />
          <Pic id={id} art={art} n={1} x={24} y={42} w={178} h={108} r={2} />
          <rect x="98" y="156" width="30" height="16" fill="#444" />
          <rect x="76" y="172" width="74" height="6" rx="3" fill="#444" />
          <rect x="222" y="22" width="84" height="176" rx="14" fill="#111" />
          <Pic id={id} art={art} n={0} x={228} y={30} w={72} h={160} r={10} />
          <T x={264} y={64} s={18} fill="#fff">9:41</T>
          <rect x="250" y="26" width="28" height="6" rx="3" fill="#111" />
        </>
      );
      break;
    case "pet-passport":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {shadow(40, 40, 240, 150)}
          <rect x="40" y="40" width="240" height="150" rx="6" fill="#fff" stroke={LINE} />
          <rect x="40" y="40" width="240" height="26" rx="6" fill={INK} />
          <T x={160} y={58} s={11} fill="#fff">ПАСПОРТ ПИТОМЦА</T>
          <Pic id={id} art={art} n={0} x={52} y={76} w={80} h={100} r={4} />
          <T x={144} y={92} s={8} w={600} fill="#777" anchor="start">Кличка</T>
          <T x={144} y={106} s={12} anchor="start">{name}</T>
          {[124, 144, 164].map((y, i) => (
            <g key={y}>
              <T x={144} y={y} s={7} w={600} fill="#777" anchor="start">{["Порода", "Окрас", "Любимое лакомство"][i]}</T>
              <rect x="144" y={y + 4} width="122" height="1" fill="#bbb" />
            </g>
          ))}
        </>
      );
      break;
    case "premium-box":
    case "gift-box": {
      const dark = addonKey === "premium-box";
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          <rect x="50" y="80" width="220" height="120" rx="4" fill={dark ? "#1b1b1b" : "#c9a36b"} />
          <rect x="42" y="60" width="236" height="30" rx="4" fill={dark ? "#2a2a2a" : "#d8b47d"} />
          <rect x="150" y="60" width="20" height="140" fill={dark ? "#c8a24a" : "#c0392b"} />
          <path d="M160 60 q-30 -36 -44 -14 q10 16 44 14 q30 -36 44 -14 q-10 16 -44 14" fill={dark ? "#c8a24a" : "#c0392b"} />
          <rect x="190" y="110" width="66" height="80" rx="3" fill="#fff" />
          <Pic id={id} art={art} n={0} x={194} y={114} w={58} h={58} r={2} />
          <T x={223} y={184} s={7}>{name}</T>
          <rect x="66" y="110" width="70" height="50" rx="3" fill="#fff" transform="rotate(-6 100 135)" />
          <T x={100} y={140} s={7} w={600} fill="#555">{dark ? "Открытка" : "Карта и открытка"}</T>
        </>
      );
      break;
    }
    case "height-chart":
      body = (
        <>
          {wall}
          {shadow(120, 6, 80, 208)}
          <rect x="120" y="6" width="80" height="208" fill="#fff" />
          <Pic id={id} art={art} n={0} x={124} y={10} w={72} h={72} r={3} />
          <T x={160} y={96} s={10}>{name}</T>
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x="120" y={104 + i * 5} width={i % 2 ? 10 : 18} height="1.4" fill={INK} />
          ))}
          {[150, 130, 110, 90, 70].map((cm, i) => <T key={cm} x={146} y={108 + i * 22} s={7} w={700} anchor="start">{`${cm}`}</T>)}
        </>
      );
      break;
    case "audiobook":
    case "audio-self":
    case "cartoon-own-voice":
      body = (
        <>
          <rect width="320" height="220" fill="#eef3ef" />
          <Pic id={id} art={art} n={0} x={36} y={40} w={120} h={120} r={8} />
          {addonKey === "audiobook" ? (
            <path d="M190 120 v-20 a40 40 0 0 1 80 0 v20" stroke={INK} strokeWidth="10" fill="none" strokeLinecap="round" />
          ) : (
            <>
              <rect x="214" y="56" width="32" height="64" rx="16" fill={INK} />
              <path d="M200 100 a30 30 0 0 0 60 0 M230 130 v20 M214 150 h32" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
            </>
          )}
          {addonKey === "audiobook" && <><rect x="180" y="112" width="20" height="36" rx="8" fill={INK} /><rect x="260" y="112" width="20" height="36" rx="8" fill={INK} /></>}
          {Array.from({ length: 16 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 1.7)) * 22;
            return <rect key={i} x={36 + i * 8} y={186 - h / 2} width="4" height={h} rx="2" fill="#7aa58a" />;
          })}
          <T x={236} y={186} s={9} w={700} fill="#444">{addonKey === "audiobook" ? "MP3 · голос диктора" : "ваш голос"}</T>
        </>
      );
      break;
    case "coloring":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {shadow(80, 12, 150, 196)}
          <rect x="80" y="12" width="150" height="196" fill="#fff" />
          <Pic id={id} art={art} n={1} x={90} y={24} w={130} h={130} r={0} filter="grayscale(1) contrast(1.5) brightness(1.1)" />
          <T x={155} y={178} s={9} w={700} fill="#777">раскраска · А4</T>
          {["#f5a524", "#c0392b", "#2e86de"].map((c, i) => (
            <g key={c} transform={`rotate(${20 + i * 8} 260 150)`}>
              <rect x={244 + i * 12} y="80" width="9" height="110" rx="2" fill={c} />
              <path d={`M${244 + i * 12} 190 l4.5 12 l4.5 -12`} fill="#e7c99a" />
            </g>
          ))}
        </>
      );
      break;
    case "cartoon":
      body = (
        <>
          <rect width="320" height="220" fill="#16241d" />
          <rect x="40" y="24" width="240" height="150" rx="8" fill="#000" />
          <Pic id={id} art={art} n={1} x={46} y={30} w={228} h={138} r={4} />
          <circle cx="160" cy="99" r="26" fill="rgba(0,0,0,.55)" />
          <path d="M152 86 L174 99 L152 112 Z" fill="#fff" />
          <rect x="120" y="186" width="80" height="22" rx="11" fill="#c8a24a" />
          <T x={160} y={201} s={10} fill="#1b1b1b">скоро</T>
        </>
      );
      break;
    case "second-copy":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {shadow(70, 40, 110, 110)}
          <Pic id={id} art={art} n={0} x={70} y={40} w={110} h={110} r={3} />
          {shadow(140, 60, 110, 110)}
          <Pic id={id} art={art} n={0} x={140} y={60} w={110} h={110} r={3} />
          <T x={44} y={200} s={22}>×2</T>
        </>
      );
      break;
    case "urgent":
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          {shadow(70, 40, 120, 120)}
          <Pic id={id} art={art} n={0} x={70} y={40} w={120} h={120} r={3} />
          <path d="M240 30 L214 104 H240 L226 186 L276 86 H248 L268 30 Z" fill="#f5a524" stroke={INK} strokeWidth="2" />
          <T x={130} y={196} s={10} w={700} fill="#444">на 2 рабочих дня быстрее</T>
        </>
      );
      break;
    default:
      body = (
        <>
          <rect width="320" height="220" fill="#f3efe7" />
          <Pic id={id} art={art} n={0} x={100} y={30} w={120} h={150} r={4} />
        </>
      );
  }
  return (
    <svg className="addon-art" viewBox="0 0 320 220" role="img" aria-label={`Как выглядит: ${addonKey}`} preserveAspectRatio="xMidYMid meet">
      {body}
    </svg>
  );
}

const priceLine = (a: AddonCardItem) => (a.soon ? "Скоро" : a.percentOff ? `−${a.percentOff}% от цены книги` : a.priceRub ? `+${rub(a.priceRub)}` : "");

/**
 * Сетка карточек допов. mode="toggle" — выбрать в заказ (оформление); mode="buy" — купить сразу (кабинет).
 * Нажатие на картинку открывает увеличенный просмотр.
 */
export function AddonCards({
  items,
  selected = [],
  onToggle,
  art,
  mode = "toggle",
  busyKey = "",
  idPrefix = "ad",
}: {
  items: AddonCardItem[];
  selected?: string[];
  onToggle: (key: string) => void;
  art: Art;
  mode?: "toggle" | "buy";
  busyKey?: string;
  idPrefix?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const item = items.find((a) => a.key === open) ?? null;
  const action = (a: AddonCardItem, on: boolean) =>
    a.soon ? "Скоро" : mode === "buy" ? (busyKey === a.key ? "Оформляем…" : `Добавить — ${rub(a.priceRub ?? 0)}`) : on ? "Добавлено ✓" : "Добавить";
  return (
    <>
      <ul className="addon-grid" data-addon-grid>
        {items.map((a) => {
          const on = selected.includes(a.key);
          return (
            <li key={a.key} className={`addon-card ${on ? "addon-card--on" : ""} ${a.soon ? "addon-card--soon" : ""}`} data-addon={a.key}>
              <button type="button" className="addon-card__pic" aria-label={`Посмотреть крупно: ${shortTitle(a.title)}`} data-addon-zoom={a.key} onClick={() => setOpen(a.key)}>
                <AddonArt addonKey={a.key} art={art} id={`${idPrefix}-${a.key}`} />
                {a.soon && <span className="badge badge--gold addon-card__soon">скоро</span>}
                <span className="addon-card__zoom" aria-hidden="true">⤢</span>
              </button>
              <div className="addon-card__body">
                <strong className="addon-card__title">{shortTitle(a.title)}</strong>
                {a.description && <span className="addon-card__desc">{a.description}</span>}
                <div className="addon-card__foot">
                  <b className="addon-card__price">{priceLine(a)}</b>
                  <button
                    type="button"
                    className={`btn btn--sm ${on ? "btn--primary" : "btn--ghost"}`}
                    aria-pressed={mode === "toggle" ? on : undefined}
                    data-addon-toggle={a.key}
                    disabled={a.soon || Boolean(busyKey)}
                    onClick={() => onToggle(a.key)}
                  >
                    {action(a, on)}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {item && (
        <AddonModal onClose={() => setOpen(null)} title={shortTitle(item.title)}>
          <AddonArt addonKey={item.key} art={art} id={`${idPrefix}-zoom-${item.key}`} />
          <p className="addon-modal__desc">{item.description}</p>
          <div className="addon-card__foot">
            <b className="addon-card__price">{priceLine(item)}</b>
            <button
              type="button"
              className={`btn ${selected.includes(item.key) ? "btn--ghost" : "btn--primary"}`}
              disabled={item.soon || Boolean(busyKey)}
              data-addon-modal-toggle={item.key}
              onClick={() => {
                onToggle(item.key);
                if (mode === "buy") setOpen(null);
              }}
            >
              {item.soon ? "Скоро" : mode === "buy" ? action(item, false) : selected.includes(item.key) ? "Убрать из заказа" : "Добавить в заказ"}
            </button>
          </div>
          <p className="small muted" style={{ margin: "8px 0 0" }}>Картинка — пример: в изделии будут иллюстрации и имя из вашей книги.</p>
        </AddonModal>
      )}
    </>
  );
}

/** Окно на странице: фокус внутри (Tab по кругу), Esc и щелчок по фону закрывают, фокус возвращается назад. */
export function AddonModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => box.current?.querySelector<HTMLElement>("[data-modal-close]")?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!box.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("modal-open");
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("modal-open");
      before?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="modal" data-modal onClick={(e) => (e.target as HTMLElement).dataset.modal !== undefined && onClose()}>
      <div className="modal__box" ref={box} role="dialog" aria-modal="true" aria-labelledby="modal-h">
        <div className="modal__head">
          <h2 id="modal-h">{title}</h2>
          <button type="button" className="modal__close" data-modal-close aria-label="Закрыть" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
