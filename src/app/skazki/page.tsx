import type { Metadata } from "next";
import { CatalogNav } from "@/components/CatalogNav";
import { filteredStories, OccasionSectionsView, parseCatalogQuery, sectionedStories, StoryGroups, type SP } from "@/components/StoryGroups";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { PriceSection } from "@/components/Sections";
import { getMinPrice } from "@/lib/catalog";
import { OCCASIONS as OCCASION_KEYS, SEGMENTS } from "@/content/profiles";
import { audiencePage, getSoon } from "@/lib/storefront";
import { SoonBanner } from "@/components/Soon";
import { og } from "@/lib/og";

export const metadata: Metadata = {
  title: "Все книги: детям, подросткам, взрослым и о питомцах",
  description: "Персональные книги для детей, подростков, взрослых и о питомцах: сказки, приключения, истории любви и семейные былины. Превью бесплатно, PDF 990 ₽.",
  alternates: { canonical: "/skazki" },
  ...og({ title: "Все книги БУКИМИ: детям, подросткам, взрослым и о питомцах", description: "Персональные книги: сказки, приключения, истории любви и семейные былины. Превью бесплатно.", path: "/skazki" }),
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const q = parseCatalogQuery(await searchParams);
  const [{ matching, others }, minPrice, soon] = await Promise.all([filteredStories(q), getMinPrice(), getSoon()]);
  const isSoon = Boolean(q.audience && soon.audiences.includes(q.audience));
  // С поводом — разделы как в анкете и на странице повода (plotSections)
  const sections = q.povod ? await sectionedStories(q.povod, q.audience, q.segments) : null;
  const page = q.audience ? audiencePage(q.audience) : null;
  const seg = q.segments.length === 1 ? SEGMENTS.find((s) => s.id === q.segments[0]) : null;
  const occ = q.povod ? OCCASION_KEYS.find((o) => o.key === q.povod) : null;
  const h1 = seg ? seg.title : page ? `Книги: ${page.nav.toLowerCase()}` : "Все книги";
  const total = sections ? sections.core.length + sections.fits.length + sections.others.length : matching.length + others.length;

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, ...(page ? [{ href: "/skazki", label: "Книги" }, { label: page.nav }] : [{ label: "Книги" }])]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: `https://${process.env.DOMAIN ?? "bookimi.ru"}/` },
        { "@type": "ListItem", position: 2, name: "Книги", item: `https://${process.env.DOMAIN ?? "bookimi.ru"}/skazki` },
      ] }} />
      <section className="section section--tight">
        <div className="wrap">
          {isSoon && <SoonBanner audience={q.audience!} />}
          <h1>{h1}</h1>
          <p className="lead">
            {occ
              ? `Повод — «${occ.label}». Сначала книги, написанные к нему; в любую другую мы впишем ваш повод.`
              : "Выберите историю — имя, внешность и увлечения героя мы вплетём в каждую страницу."}
          </p>
          <CatalogNav q={q} />
          <p className="small muted" aria-live="polite">
            {total} {total % 10 === 1 && total % 100 !== 11 ? "книга" : [2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100) ? "книги" : "книг"}
          </p>
          {sections ? <OccasionSectionsView sections={sections} minPrice={minPrice} soon={soon.audiences} /> : <StoryGroups matching={matching} others={others} povod={q.povod} minPrice={minPrice} soon={soon.audiences} />}
        </div>
      </section>
      <PriceSection />
      <StickyCta href={q.audience ? `/sozdat?dlya=${q.audience}${q.povod ? `&povod=${q.povod}` : ""}` : "/sozdat"} soon={isSoon} />
    </>
  );
}

