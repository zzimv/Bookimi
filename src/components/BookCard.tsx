import Link from "next/link";
import { Cover } from "./Cover";
import { ageLabel, displayTitle, rub, type PublicStory } from "@/lib/catalog";

export function BookCard({ story, minPrice }: { story: PublicStory; minPrice: number }) {
  const title = displayTitle(story.title, story.audience);
  return (
    <article className="book" data-age-min={story.ageMin} data-age-max={story.ageMax} data-occasion={story.occasionSlug ?? ""} data-occasions={story.occasions.join(" ")} data-audience={story.audience}>
      <Link href={`/skazki/${story.slug}`} tabIndex={-1} aria-hidden="true">
        <Cover theme={story.coverTheme} title={title} coverUrl={story.coverUrl} colors={story.coverColors} />
      </Link>
      <h3>
        <Link href={`/skazki/${story.slug}`}>{title}</Link>
      </h3>
      <p>{story.tagline}</p>
      <div className="book__meta">
        <span className="muted">{ageLabel(story.ageMin, story.ageMax, story.audience)}</span>
        <span className="book__price">от {rub(minPrice)}</span>
      </div>
      <Link className="btn btn--primary" href={`/sozdat?skazka=${story.slug}`}>
        Создать
      </Link>
    </article>
  );
}
