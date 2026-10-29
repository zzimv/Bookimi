import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCard } from "@/components/BookCard";
import { catalogHref } from "@/components/CatalogNav";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { Faq } from "@/components/Sections";
import { getMinPrice, getStories } from "@/lib/catalog";
import { FAQ } from "@/lib/catalog-defaults";
import { OCCASIONS as OCCASION_KEYS } from "@/content/profiles";
import { AUDIENCE_PAGES, catalogStories, segmentChips } from "@/lib/storefront";

export const revalidate = 300;

export function generateStaticParams() {
  return AUDIENCE_PAGES.map((a) => ({ audience: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }): Promise<Metadata> {
  const { audience } = await params;
  const a = AUDIENCE_PAGES.find((x) => x.slug === audience);
  if (!a) return {};
  return { title: a.title, description: a.description, alternates: { canonical: `/dlya/${a.slug}` } };
}

// Посадочная аудитории (SEO): кому именно → книги → поводы → вопросы.
export default async function Page({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const a = AUDIENCE_PAGES.find((x) => x.slug === audience);
  if (!a) notFound();
  const [stories, minPrice] = await Promise.all([getStories({ audience: a.key }), getMinPrice()]);
  const list = catalogStories(stories);
  const occasions = OCCASION_KEYS.filter((o) => o.audiences.includes(a.key) && o.key !== "svoj" && o.key !== "bez");
  const domain = process.env.DOMAIN ?? "bookimi.ru";

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/skazki", label: "Книги" }, { label: a.nav }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: a.title,
          itemListElement: list.map((s, i) => ({ "@type": "ListItem", position: i + 1, url: `https://${domain}/skazki/${s.slug}` })),
        }}
      />
      <section className="section section--tight">
        <div className="wrap">
          <h1>{a.h1}</h1>
          <p className="lead">{a.lead}</p>
          <div className="filters" role="group" aria-label="Кому именно">
            {segmentChips(a.key).map((s) => (
              <Link key={s.id} className="chip" href={catalogHref({ audience: a.key, segments: [s.id] })} title={s.title}>
                {s.label}
              </Link>
            ))}
          </div>
          <div className="grid">
            {list.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} />
            ))}
          </div>
        </div>
      </section>
      <section className="section section--sage">
        <div className="wrap">
          <h2>Подарок к поводу</h2>
          <div className="occasions">
            {occasions.map((o) => (
              <Link key={o.key} href={`/povod/${o.key}`} className="occasion">
                <strong>{o.label}</strong>
                <span>{o.season ? `Сезон: ${o.season}` : "Книги и идеи посвящений"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <Faq items={FAQ} />
      <StickyCta href={`/sozdat?dlya=${a.key}`} />
    </>
  );
}
