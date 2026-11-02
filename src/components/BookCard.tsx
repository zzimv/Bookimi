import Link from "next/link";
import { Cover } from "./Cover";
import { ageLabel, displayTitle, HERO_WORD, rub, type PublicStory } from "@/lib/catalog";
import { sampleUrl } from "@/lib/obrazec";
import { SOON_SHORT } from "@/lib/shelf";

/**
 * Карточка книги: обложка с именем, одна строка, «от 990 ₽», «Создать». badge — «к вашему поводу».
 * soon — аудитория пока «скоро» (storefront.soon); такие книги покупателю уже не показываются (visiblePlots), флаг — на всякий случай.
 */
export function BookCard({ story, minPrice, badge, povod, soon }: { story: PublicStory; minPrice: number; badge?: string; povod?: string; soon?: boolean }) {
  const title = displayTitle(story.title, story.audience);
  const create = `/sozdat?skazka=${story.slug}${povod ? `&povod=${povod}` : ""}`;
  // Имя из «Как зовут героя?» — и на обложке, и в названии под ней (тот же слот, CSS-переменная --hero-name)
  const slot = story.title.startsWith("[Имя]");
  return (
    <article className="book" data-audience={story.audience}>
      <Link href={`/skazki/${story.slug}`} className="book__cover" tabIndex={-1} aria-hidden="true">
        <Cover theme={story.coverTheme} title={title} coverUrl={story.coverUrl} colors={story.coverColors} sample={sampleUrl({ slug: story.slug })} rawTitle={story.title} heroWord={HERO_WORD[story.audience]} />
        {badge && <span className="badge badge--gold book__badge">{badge}</span>}
      </Link>
      <h3>
        <Link href={`/skazki/${story.slug}`} data-title={title}>
          {slot ? (
            <>
              <span className="name-slot" data-ph={HERO_WORD[story.audience]} />
              {story.title.slice("[Имя]".length)}
            </>
          ) : (
            title
          )}
        </Link>
      </h3>
      <p>{story.tagline}</p>
      <div className="book__meta">
        <span className="muted">{ageLabel(story.ageMin, story.ageMax, story.audience, story.segments)}</span>
        <span className="book__price">от {rub(minPrice)}</span>
      </div>
      {soon ? (
        <>
          <button type="button" className="btn btn--primary" disabled aria-describedby={`soon-${story.slug}`}>
            Создать
          </button>
          <p className="book__soon" id={`soon-${story.slug}`}>{SOON_SHORT}</p>
        </>
      ) : (
        <Link className="btn btn--primary" href={create} aria-label={`Создать книгу «${title}»`}>
          Создать
        </Link>
      )}
    </article>
  );
}
