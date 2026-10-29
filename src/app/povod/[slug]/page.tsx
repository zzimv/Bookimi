import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OccasionSectionsView, sectionedStories } from "@/components/StoryGroups";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { Faq } from "@/components/Sections";
import { getMinPrice, getOccasion, getOccasions } from "@/lib/catalog";
import { printDeadlineLine } from "@/lib/storefront";
import { cfg } from "@/lib/settings";
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
  const [occasion, minPrice] = await Promise.all([getOccasion(slug), getMinPrice()]);
  if (!occasion) notFound();
  // Разделы повода — как в анкете (plotSections): написанные к поводу, «Своя история», «Тоже подойдут», остальные
  const sections = await sectionedStories(occasion.slug);
  const deadline = printDeadlineLine(occasion.slug, (await cfg("season")).printDeadline);

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/povody", label: "Поводы" }, { label: occasion.title }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: `https://${process.env.DOMAIN ?? "bookimi.ru"}/` },
        { "@type": "ListItem", position: 2, name: "Поводы", item: `https://${process.env.DOMAIN ?? "bookimi.ru"}/povody` },
        { "@type": "ListItem", position: 3, name: occasion.title, item: `https://${process.env.DOMAIN ?? "bookimi.ru"}/povod/${occasion.slug}` },
      ] }} />
      <section className="section section--tight">
        <div className="wrap">
          <h1>{occasion.h1}</h1>
          <p className="lead">{occasion.intro}</p>
          {deadline && <p className="deadline">{deadline}</p>}
          <OccasionSectionsView sections={sections} minPrice={minPrice} />
        </div>
      </section>
      <Faq items={FAQ} />
      <StickyCta href={`/sozdat?povod=${occasion.slug}`} />
    </>
  );
}
