import { BookCard } from "@/components/BookCard";
import type { CatalogQuery } from "@/components/CatalogNav";
import Link from "next/link";
import { getStories, getStoriesForOccasion, type PublicStory } from "@/lib/catalog";
import { plotSections } from "@/content/registry";
import { sectionOrder, FITS_TITLE } from "@/content/sections";
import type { AudienceKey } from "@/content/profiles";
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

/** soon — аудитории «скоро» (storefront.soon): их книги видны, «Создать» выключена. */
export function StoryGroups({ matching, others, povod, minPrice, soon = [] }: { matching: PublicStory[]; others: PublicStory[]; povod?: string; minPrice: number; soon?: AudienceKey[] }) {
  if (povod && !matching.length)
    return (
      <>
        <p className="muted small">Повод впишем в любую книгу: первая и последняя страницы расскажут о празднике, а посвящение вы напишете сами.</p>
        <div className="grid">
          {others.map((s) => (
            <BookCard key={s.slug} story={s} minPrice={minPrice} soon={soon.includes(s.audience)} badge="впишем ваш повод" povod={povod} />
          ))}
        </div>
      </>
    );
  return (
    <>
      <div className="grid">
        {matching.map((s) => (
          <BookCard key={s.slug} story={s} minPrice={minPrice} soon={soon.includes(s.audience)} badge={povod ? "к вашему поводу" : undefined} povod={povod} />
        ))}
      </div>
      {others.length > 0 && (
        <>
          <h2 className="grid-sub">Другие книги — повод впишем в историю</h2>
          <p className="muted small">Первая и последняя страницы расскажут о празднике, а посвящение вы напишете сами.</p>
          <div className="grid">
            {others.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} soon={soon.includes(s.audience)} badge="впишем ваш повод" povod={povod} />
            ))}
          </div>
        </>
      )}
    </>
  );
}


export interface StorySections {
  povod: string;
  customFirst: boolean;
  core: PublicStory[];
  fits: PublicStory[];
  others: PublicStory[];
  hidden: PublicStory[];
}

/**
 * Книги повода по разделам — та же логика, что в анкете (plotSections → sections.ts): core, «Своя история», «Тоже подойдут»,
 * остальные; у сильной темы чужие книги — за «Показать все книги (N)». Книги из админки, которых нет в реестре, — в остальных.
 */
export async function sectionedStories(povod: string, audience?: AudienceKey, segments: string[] = []): Promise<StorySections> {
  const all = catalogStories(await getStories(audience ? { audience } : {})).filter((s) => !segments.length || s.segments.some((x) => segments.includes(x)));
  const sec = plotSections(povod, audience);
  const bySlug = new Map(all.map((s) => [s.slug, s]));
  const take = (xs: { slug: string }[]) => xs.map((p) => bySlug.get(p.slug)).filter(Boolean) as PublicStory[];
  const core = take(sec.core);
  const fits = take(sec.fits);
  const others = take(sec.others);
  const used = new Set([...core, ...fits, ...others].map((s) => s.slug));
  const rest = all.filter((s) => !used.has(s.slug));
  return { povod, customFirst: sec.customFirst, core, fits, others: sec.strong ? others : [...others, ...rest], hidden: sec.strong ? rest : [] };
}

/** dlya — повод одной аудитории (юбилей — взрослым, день питомца — питомцам): «Своя история» сразу с ней. */
export function OccasionSectionsView({ sections, minPrice, soon = [], dlya }: { sections: StorySections; minPrice: number; soon?: AudienceKey[]; dlya?: AudienceKey }) {
  const { povod } = sections;
  const own = (
    <Link key="own" href={`/sozdat?povod=${povod}${dlya ? `&dlya=${dlya}` : ""}`} className="own-card panel" data-own-card>
      <span className="own-icon" aria-hidden="true">✎</span>
      <span>
        <strong>Своя история</strong>
        <span className="small">Опишите идею в 1–2 предложениях — предложим 3 сюжета, а ваш повод станет его частью.</span>
      </span>
    </Link>
  );
  const grid = (list: PublicStory[], badge?: string) => (
    <div className="grid">
      {list.map((s) => (
        <BookCard key={s.slug} story={s} minPrice={minPrice} soon={soon.includes(s.audience)} badge={badge} povod={povod} />
      ))}
    </div>
  );
  return (
    <div data-sections={sectionOrder(sections).join(",")}>
      {sectionOrder(sections).map((part) =>
        part === "custom" ? (
          own
        ) : part === "core" ? (
          sections.core.length ? <div key="core">{grid(sections.core, "к вашему поводу")}</div> : null
        ) : part === "fits" ? (
          sections.fits.length ? (
            <div key="fits">
              <h2 className="grid-sub">{FITS_TITLE}</h2>
              {grid(sections.fits, "впишем ваш повод")}
            </div>
          ) : null
        ) : sections.others.length ? (
          <div key="others">
            {sections.core.length + sections.fits.length > 0 && <h2 className="grid-sub">Другие книги — повод впишем в историю</h2>}
            {grid(sections.others, povod && povod !== "bez" ? "впишем ваш повод" : undefined)}
          </div>
        ) : null,
      )}
      {sections.hidden.length > 0 && (
        <details className="show-all-books">
          <summary className="btn btn--ghost btn--sm">Показать все книги ({sections.hidden.length})</summary>
          <p className="muted small">Повод впишем в любую книгу: первая и последняя страницы расскажут о празднике.</p>
          {grid(sections.hidden, "впишем ваш повод")}
        </details>
      )}
    </div>
  );
}
