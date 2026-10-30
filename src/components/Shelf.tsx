// Полка с книгами на первом экране главной (макет владелицы, rev 06). Только разметка и CSS (globals.css → «Полка»),
// без картинок и клиентского JS. Каждая книга — ссылка; «скоро» — значок и ссылка к примерам (src/lib/shelf.ts).
import Link from "next/link";
import type { CSSProperties } from "react";
import type { ShelfLink } from "@/lib/shelf";

/** Вид книги: цвет, цвет надписи, ширина и высота в px (на телефоне всё умножается на --k). */
const LOOK: Record<string, { c: string; ink?: string; w: number; h: number }> = {
  syn: { c: "#2f5b43", w: 50, h: 256 },
  "pervyj-klass": { c: "#e6c76f", ink: "#2b2414", w: 46, h: 272 },
  doch: { c: "#bb5531", w: 142, h: 218 },
  babushka: { c: "#8fae88", ink: "#1d2b1f", w: 44, h: 236 },
  "den-rozhdeniya": { c: "#3c6a8e", w: 58, h: 268 },
  mama: { c: "#e8a998", ink: "#3a1d17", w: 48, h: 218 },
  "brat-sestra": { c: "#6c3d62", w: 52, h: 282 },
  papa: { c: "#5f7b3b", w: 52, h: 228 },
  pitomec: { c: "#d9a13a", ink: "#2b1f0b", w: 46, h: 244 },
  "novyj-god": { c: "#20365a", w: 142, h: 218 },
  vypusknoj: { c: "#f3e7d0", ink: "#24452f", w: 50, h: 282 },
  dedushka: { c: "#6b4530", w: 44, h: 240 },
  lyubimomu: { c: "#b4413a", w: 44, h: 254 },
  podruge: { c: "#c9b6dd", ink: "#2c2140", w: 48, h: 232 },
};

/** Гирлянда: провисающий провод из S дуг и лампочка в нижней точке каждой. */
const SAGS = 14;
const BULBS = ["#d9a948", "#e5a19a", "#7fb08f", "#d9a948", "#9cb6d6", "#e5a19a", "#7fb08f"];
const WIRE = Array.from({ length: SAGS }, (_, i) => {
  const x0 = (i * 1000) / SAGS;
  const x1 = ((i + 1) * 1000) / SAGS;
  return `${i ? "" : `M${x0} 6`}Q${((x0 + x1) / 2).toFixed(1)} 30 ${x1.toFixed(1)} 6`;
}).join("");

// Числа — строкой: React (и мини-рантайм демо) не должны дописывать «px» к пользовательским свойствам
const vars = (o: Record<string, string | number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) as CSSProperties;

function KiteArt() {
  return (
    <svg className="facecover__art" viewBox="0 0 150 110" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <circle cx="36" cy="40" r="9" fill="#f6e3c4" />
      <path d="M78 22 90 38 78 56 66 38Z" fill="none" stroke="#f6e3c4" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M78 22v34M66 38h24" stroke="#f6e3c4" strokeWidth="1.4" />
      <path d="M78 56c-4 8 6 12 0 20s4 12-2 18" fill="none" stroke="#f6e3c4" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M74 66l-4 3 5 1zM79 79l4 2-4 2z" fill="#e9b949" />
      <path d="M0 92c26-14 52-16 80-8s48 6 70-4v30H0z" fill="#f3dcb7" />
      <path d="M0 100c30-8 60-2 86 4s44 2 64-4v14H0z" fill="#3f6b45" />
    </svg>
  );
}

function TreeArt() {
  return (
    <svg className="facecover__art" viewBox="0 0 150 110" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      <circle cx="118" cy="40" r="8" fill="#f3dfae" />
      <circle cx="122" cy="37" r="7" fill="#20365a" />
      <g fill="#f3dfae">
        <circle cx="24" cy="30" r="1.6" />
        <circle cx="122" cy="22" r="1.4" />
        <circle cx="132" cy="58" r="1.2" />
        <circle cx="16" cy="66" r="1.2" />
        <circle cx="44" cy="12" r="1" />
      </g>
      <path d="M75 18l3 6.4 7 .8-5.2 4.8 1.4 6.9L75 33.4 68.8 37l1.4-6.9-5.2-4.8 7-.8z" fill="#e7b64a" />
      <path d="M75 34 92 58h-8l14 20h-9l14 18H46l14-18h-9l14-20h-8z" fill="#5f9466" />
      <g fill="#e7b64a">
        <circle cx="72" cy="56" r="2" />
        <circle cx="84" cy="70" r="2" />
        <circle cx="64" cy="82" r="2" />
        <circle cx="90" cy="88" r="2" />
      </g>
      <rect x="71" y="96" width="8" height="7" fill="#7a4e33" />
      <path d="M0 102c30-6 60-8 90-4s44 2 60-2v14H0z" fill="#f1e7d6" />
    </svg>
  );
}

function Spine({ it }: { it: ShelfLink }) {
  const v = LOOK[it.id];
  return (
    <Link
      href={it.to}
      className={`spine${v.ink ? " spine--light" : ""}`}
      style={vars({ "--c": v.c, "--ink": v.ink ?? "#fff", "--w": v.w, "--h": v.h })}
      aria-label={it.soon ? `${it.label} — скоро. Посмотреть примеры` : `${it.label} — создать`}
      data-shelf={it.id}
    >
      <span className="spine__band" aria-hidden="true" />
      <span className="spine__title" aria-hidden="true">{it.title}</span>
      {it.soon && <span className="spine__soon" aria-hidden="true">скоро</span>}
      <span className="spine__star" aria-hidden="true">★</span>
    </Link>
  );
}

function FaceCover({ it }: { it: ShelfLink }) {
  const v = LOOK[it.id];
  return (
    <Link
      href={it.to}
      className="facecover"
      style={vars({ "--c": v.c, "--w": v.w, "--h": v.h })}
      aria-label={it.soon ? `${it.label} — скоро. Посмотреть примеры` : `${it.label} — создать`}
      data-shelf={it.id}
    >
      <span className="facecover__lead" aria-hidden="true">{it.coverLead}</span>
      <span className="facecover__title" aria-hidden="true">{it.title}</span>
      {it.id === "novyj-god" ? <TreeArt /> : <KiteArt />}
      {it.soon && <span className="spine__soon facecover__soon" aria-hidden="true">скоро</span>}
    </Link>
  );
}

export function Shelf({ items }: { items: ShelfLink[] }) {
  return (
    <div className="bookshelf">
      <div className="bookshelf__scroll" role="group" aria-label="Книги на полке: для кого и к какому поводу">
        <div className="bookshelf__track">
          <svg className="bookshelf__wire" viewBox="0 0 1000 32" preserveAspectRatio="none" aria-hidden="true">
            <path d={WIRE} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          {Array.from({ length: SAGS }, (_, i) => (
            <span key={i} className="bookshelf__bulb" aria-hidden="true" style={vars({ left: `${(((i + 0.5) / SAGS) * 100).toFixed(2)}%`, "--b": BULBS[i % BULBS.length] })} />
          ))}
          <div className="bookshelf__row">
            <span className="bookshelf__stack" aria-hidden="true">
              <i style={vars({ "--c": "#3c6a8e", "--sw": 70 })} />
              <i style={vars({ "--c": "#e6c76f", "--sw": 78 })} />
              <i style={vars({ "--c": "#6c3d62", "--sw": 74 })} />
            </span>
            {items.map((it) => (it.coverLead ? <FaceCover key={it.id} it={it} /> : <Spine key={it.id} it={it} />))}
            <span className="bookshelf__plant" aria-hidden="true">
              <svg viewBox="0 0 56 84">
                <path d="M28 50C26 36 18 26 8 22c8 8 14 18 16 30M28 50c1-16 6-30 14-38-4 12-8 26-9 40M28 50c-4-10-12-16-22-16 8 4 14 10 18 18M30 50c4-10 12-14 22-14-8 4-14 10-17 16" fill="none" stroke="#5f8f5a" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M12 52h32l-4 30H16z" fill="#c9643b" />
                <path d="M10 50h36v6H10z" fill="#b5532e" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
