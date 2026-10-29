import { BookCard } from "@/components/BookCard";
import type { CatalogQuery } from "@/components/CatalogNav";
import { getStoriesForOccasion, type PublicStory } from "@/lib/catalog";
import { OCCASIONS as OCCASION_KEYS, SEGMENTS } from "@/content/profiles";
import { audienceFromParam, catalogStories } from "@/lib/storefront";

export type SP = Record<string, string | undefined>;

export function parseCatalogQuery(sp: SP): CatalogQuery {
  const audience = audienceFromParam(sp.dlya);
  const segments = (sp.segment ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((id) => SEGMENTS.some((s) => s.id === id && (!audience || s.audience === audience)));
  const povod = OCCASION_KEYS.some((o) => o.key === sp.povod && o.key !== "svoj" && o.key !== "bez") ? sp.povod : undefined;
  return { audience, segments, povod };
}

/** Книги по фильтру: сначала подходящие к поводу (с отметкой), затем остальные — повод впишем в историю. */
export async function filteredStories(q: CatalogQuery) {
  const all = catalogStories(await getStoriesForOccasion(q.povod ?? "", q.audience));
  const list = all.filter((s) => !q.segments.length || s.segments.some((x) => q.segments.includes(x)));
  const matching = q.povod ? list.filter((s) => s.occasions.includes(q.povod!)) : list;
  const others = q.povod ? list.filter((s) => !s.occasions.includes(q.povod!)) : [];
  return { matching, others };
}

export function StoryGroups({ matching, others, povod, minPrice }: { matching: PublicStory[]; others: PublicStory[]; povod?: string; minPrice: number }) {
  if (povod && !matching.length)
    return (
      <>
        <p className="muted small">Повод впишем в любую книгу: первая и последняя страницы расскажут о празднике, а посвящение вы напишете сами.</p>
        <div className="grid">
          {others.map((s) => (
            <BookCard key={s.slug} story={s} minPrice={minPrice} badge="впишем ваш повод" povod={povod} />
          ))}
        </div>
      </>
    );
  return (
    <>
      <div className="grid">
        {matching.map((s) => (
          <BookCard key={s.slug} story={s} minPrice={minPrice} badge={povod ? "к вашему поводу" : undefined} povod={povod} />
        ))}
      </div>
      {others.length > 0 && (
        <>
          <h2 className="grid-sub">Другие книги — повод впишем в историю</h2>
          <p className="muted small">Первая и последняя страницы расскажут о празднике, а посвящение вы напишете сами.</p>
          <div className="grid">
            {others.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} badge="впишем ваш повод" povod={povod} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

