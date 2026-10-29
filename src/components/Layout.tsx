import Link from "next/link";
import { getPromoBar, getSeller, sellerIsComplete } from "@/lib/settings";
import { AUDIENCE_PAGES, getSeason } from "@/lib/storefront";
import { ThemeToggle } from "./ThemeToggle";

export async function PromoBar() {
  const p = await getPromoBar();
  if (!p.enabled || !p.text) return null;
  return <div className="promo">{p.text}</div>;
}

export async function Header() {
  const season = await getSeason();
  const links = [
    { href: "/skazki", label: "Книги" },
    ...AUDIENCE_PAGES.map((a) => ({ href: `/dlya/${a.slug}`, label: a.nav })),
    { href: "/povody", label: "Поводы" },
  ];
  return (
    <header className="header">
      <div className="wrap header__in">
        <Link href="/" className="logo" aria-label="букими — на главную">
          букими<span>.</span>
        </Link>
        <nav className="nav" aria-label="Основное меню">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
          {season && (
            <Link href={season.href} className="nav__season">{season.nav}</Link>
          )}
        </nav>
        <div className="header__right">
          <Link href="/kabinet" className="header__cab" aria-label="Личный кабинет">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <span>Кабинет</span>
          </Link>
          <Link href="/sozdat" className="btn btn--primary header__cta">
            Создать книгу
          </Link>
          {/* Меню на телефоне — без JavaScript */}
          <details className="burger">
            <summary aria-label="Меню">
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </summary>
            <nav className="burger__menu" aria-label="Меню">
              {season && <Link href={season.href} className="nav__season">{season.nav}</Link>}
              {links.map((l) => (
                <Link key={l.href} href={l.href}>{l.label}</Link>
              ))}
              <Link href="/kabinet">Личный кабинет</Link>
              <Link href="/sozdat" className="btn btn--primary btn--block">Создать книгу</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export async function Footer() {
  const seller = await getSeller();
  const ok = sellerIsComplete(seller);
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div>
          <Link href="/" className="logo">
            букими
          </Link>
          <span className="footer__age" aria-label="Возрастная маркировка 0+">0+</span>
          <p style={{ marginTop: 14 }}>Персональные книги, где главный герой — тот, кого вы любите: ребёнок, подросток, близкий взрослый или питомец.</p>
          <p>
            {ok ? (
              <>
                {seller.fullName}, ИНН {seller.inn}
                <br />
                {seller.status}
              </>
            ) : (
              <>Реквизиты продавца появятся после заполнения в кабинете администратора.</>
            )}
          </p>
          <p>© {year} БУКИМИ. Копирование материалов сайта запрещено.</p>
          <ThemeToggle />
        </div>
        <div>
          <ul>
            <li><Link href="/skazki">Все книги</Link></li>
            {AUDIENCE_PAGES.map((a) => (
              <li key={a.slug}><Link href={`/dlya/${a.slug}`}>{a.nav}</Link></li>
            ))}
            <li><Link href="/povody">Все поводы</Link></li>
            <li><Link href="/povod/novyj-god">На Новый год</Link></li>
            <li><Link href="/vozrast/2-4-goda">Для детей 2–4 лет</Link></li>
            <li><Link href="/blog">Блог</Link></li>
            <li><Link href="/kabinet">Личный кабинет</Link></li>
            <li><Link href="/kontakty">Контакты</Link></li>
          </ul>
        </div>
        <div>
          <ul>
            <li><Link href="/oferta">Публичная оферта</Link></li>
            <li><Link href="/politika">Политика обработки персональных данных</Link></li>
            <li><Link href="/soglasie/pd">Согласие на обработку ПДн</Link></li>
            <li><Link href="/soglasie/foto">Согласие на обработку фото</Link></li>
            <li><Link href="/soglasie/rassylka">Согласие на рассылку</Link></li>
            <li><Link href="/vozvrat">Возврат и брак</Link></li>
            <li><Link href="/cookies">Файлы cookie</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

export function StickyCta({ href = "/sozdat", label = "Создать книгу" }: { href?: string; label?: string }) {
  return (
    <div className="sticky-cta">
      <Link href={href} className="btn btn--primary btn--block">
        {label}
      </Link>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="crumbs wrap" aria-label="Хлебные крошки">
      <ol>
        {items.map((it, i) => (
          <li key={i}>{it.href ? <Link href={it.href}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
