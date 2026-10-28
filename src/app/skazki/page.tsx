import type { Metadata } from "next";
import { BookCard } from "@/components/BookCard";
import { CatalogFilters } from "@/components/Catalog";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { getMinPrice, getOccasions, getStories } from "@/lib/catalog";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Все сказки с вашим ребёнком в главной роли",
  description: "Персональные книги для детей, подростков, взрослых и о питомцах: сказки, приключения, истории любви и семейные былины. Превью бесплатно, PDF 990 ₽.",
  alternates: { canonical: "/skazki" },
};

export default async function Page() {
  const [stories, occasions, minPrice] = await Promise.all([getStories(), getOccasions(), getMinPrice()]);
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Сказки" }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: "/" },
        { "@type": "ListItem", position: 2, name: "Сказки", item: "/skazki" },
      ] }} />
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h1>Все сказки</h1>
          <p className="lead">Выберите историю — имя, внешность и увлечения ребёнка мы вплетём в каждую страницу.</p>
          <CatalogFilters occasions={occasions.map((o) => ({ slug: o.slug, title: o.title }))} />
          <div className="grid">
            {stories.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} />
            ))}
          </div>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
