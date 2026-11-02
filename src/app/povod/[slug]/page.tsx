import { OCCASIONS as OCCASION_KEYS, type AudienceKey } from "@/content/profiles";
import { og } from "@/lib/og";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OccasionSectionsView, sectionedStories } from "@/components/StoryGroups";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { Faq } from "@/components/Sections";
import { getMinPrice, getOccasion, getOccasions } from "@/lib/catalog";
import { getSoon, printDeadlineLine } from "@/lib/storefront";
import { cfg } from "@/lib/settings";
import { faqItems, fillFacts, siteFacts } from "@/lib/seo";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getOccasions()).map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = await getOccasion(slug);
  if (!o) return {};
  const description = o.seoDescription ?? fillFacts(o.intro, await siteFacts()).slice(0, 160);
  return {
    title: o.seoTitle ?? o.h1,
    description,
    alternates: { canonical: `/povod/${o.slug}` },
    ...og({ title: o.seoTitle ?? o.h1, description, path: `/povod/${o.slug}` }),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [occasion, minPrice] = await Promise.all([getOccasion(slug), getMinPrice()]);
  if (!occasion) notFound();
  // Разделы повода — как в анкете (plotSections): написанные к поводу, «Своя история», «Тоже подойдут», остальные
  const [sections, soon] = await Promise.all([sectionedStories(occasion.slug), getSoon()]);
  // Повод одной аудитории («Юбилей» — взрослые, «День питомца» — питомцы): анкета открывается сразу для неё
  const auds = OCCASION_KEYS.find((o) => o.key === occasion.slug)?.audiences ?? [];
  const dlya = auds.length === 1 ? (auds[0] as AudienceKey) : undefined;
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
          <p className="lead">{fillFacts(occasion.intro, await siteFacts())}</p>
          {deadline && <p className="deadline">{deadline}</p>}
          <OccasionSectionsView sections={sections} minPrice={minPrice} soon={soon.audiences} dlya={dlya} />
        </div>
      </section>
      <Faq items={faqItems(await siteFacts())} />
      <StickyCta href={`/sozdat?povod=${occasion.slug}${dlya ? `&dlya=${dlya}` : ""}`} />
    </>
  );
}
