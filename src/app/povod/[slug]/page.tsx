import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookCard } from "@/components/BookCard";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { Faq } from "@/components/Sections";
import { getMinPrice, getOccasion, getOccasions, getStoriesForOccasion } from "@/lib/catalog";
import { FAQ } from "@/lib/catalog-defaults";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getOccasions()).map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = await getOccasion(slug);
  if (!o) return {};
  return {
    title: o.seoTitle ?? o.h1,
    description: o.seoDescription ?? o.intro.slice(0, 160),
    alternates: { canonical: `/povod/${o.slug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [occasion, stories, minPrice] = await Promise.all([getOccasion(slug), getStoriesForOccasion(slug), getMinPrice()]);
  if (!occasion) notFound();
  // Сначала сюжеты этого повода (главный повод — выше), затем лучшие остальные: повод вплетается в любой сюжет
  const list = [...stories.filter((s) => s.occasions.includes(occasion.slug)), ...stories.filter((s) => !s.occasions.includes(occasion.slug)).slice(0, 6)];

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/#povody", label: "Поводы" }, { label: occasion.title }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: "/" },
        { "@type": "ListItem", position: 2, name: occasion.title },
      ] }} />
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h1>{occasion.h1}</h1>
          <p className="lead">{occasion.intro}</p>
          <div className="grid" style={{ marginTop: 32 }}>
            {list.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} />
            ))}
          </div>
        </div>
      </section>
      <Faq items={FAQ} />
      <StickyCta href={`/sozdat?povod=${occasion.slug}`} />
    </>
  );
}
