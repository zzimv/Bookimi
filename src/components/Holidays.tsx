// Карточки «Ближайшие праздники» (/prazdniki): дата, сколько осталось, срок печати, 3–4 книги и ссылка в каталог.
// Серверный компонент без данных — получает готовые карточки (src/lib/holidays.ts), работает и в демо-стенде.
import Link from "next/link";
import { Cover } from "./Cover";
import { displayTitle, HERO_WORD } from "@/lib/catalog";
import { sampleUrl } from "@/lib/obrazec";
import type { HolidayCard } from "@/lib/holidays";

export function HolidayCards({ cards }: { cards: HolidayCard[] }) {
  return (
    <div className="hol-list">
      {cards.map((c) => (
        <article key={c.id} className={`hol${c.always ? " hol--always" : ""}`} aria-labelledby={`hol-${c.id}`} data-holiday={c.id}>
          <div className="hol__head">
            <div className="hol__date" aria-hidden={c.always ? "true" : undefined}>
              {c.always ? (
                <span className="hol__date-all">365</span>
              ) : (
                <>
                  <span className="hol__date-d">{c.iso ? Number(c.iso.slice(8, 10)) : ""}</span>
                  <span className="hol__date-m">{c.dateLabel?.split(" ")[1]?.replace(",", "")}</span>
                </>
              )}
            </div>
            <div className="hol__title">
              <h2 id={`hol-${c.id}`}>{c.title}</h2>
              <p className="hol__when">
                {c.always ? (
                  "Для детей, подростков, взрослых и питомцев — в любой день года"
                ) : (
                  <>
                    <time dateTime={c.iso ?? undefined}>{c.dateLabel}</time> · <b>{c.daysLeftLabel}</b>
                  </>
                )}
              </p>
            </div>
          </div>
          {c.description && <p className="hol__desc">{c.description}</p>}
          <p className={`hol__deadline${c.printOk ? "" : " hol__deadline--late"}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
            <span>{c.deadlineLine}</span>
          </p>
          {c.books.length > 0 && (
            <ul className="hol__books" aria-label={`Книги: ${c.title}`}>
              {c.books.map((s) => {
                const title = displayTitle(s.title, s.audience);
                return (
                  <li key={s.slug}>
                    <Link href={`/skazki/${s.slug}`} className="hol__book">
                      <Cover theme={s.coverTheme} title={title} coverUrl={s.coverUrl} colors={s.coverColors} sample={sampleUrl({ slug: s.slug })} rawTitle={s.title} heroWord={HERO_WORD[s.audience]} />
                      <span>{title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {c.audiences.length > 0 && (
            <p className="hol__aud">
              {c.audiences.map((a) => (
                <Link key={a.href} href={a.href} className="chip">{a.label}</Link>
              ))}
            </p>
          )}
          <div className="hol__cta">
            <Link className="btn btn--primary" href={c.catalogHref}>{c.always ? "Все книги ко дню рождения" : `Книги: ${c.title}`}</Link>
            <Link className="btn btn--ghost" href={`/sozdat?povod=${c.occasionKey}`}>Создать книгу</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
