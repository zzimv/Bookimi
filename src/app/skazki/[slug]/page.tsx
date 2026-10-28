import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Cover";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { Faq } from "@/components/Sections";
import { ageLabel, displayTitle, getMinPrice, getOccasions, getStories, getStory, rub } from "@/lib/catalog";
import { FAQ } from "@/lib/catalog-defaults";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getStories()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStory(slug);
  if (!s) return {};
  const title = s.seoTitle ?? `${displayTitle(s.title)} — персональная сказка с вашим ребёнком`;
  const description = s.seoDescription ?? `${s.tagline} Для детей ${s.ageMin}–${s.ageMax} лет. Бесплатное превью, PDF 990 ₽, печатная книга от 2 490 ₽.`;
  return { title, description, alternates: { canonical: `/skazki/${s.slug}` }, openGraph: { title, description } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [story, minPrice, occasions] = await Promise.all([getStory(slug), getMinPrice(), getOccasions()]);
  if (!story) notFound();
  const title = displayTitle(story.title);
  const occasion = occasions.find((o) => o.slug === story.occasionSlug);
  const domain = process.env.DOMAIN ?? "bookimi.ru";

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/skazki", label: "Сказки" }, { label: title }]} />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: title,
            description: story.description,
            brand: { "@type": "Brand", name: "БУКИМИ" },
            offers: { "@type": "AggregateOffer", priceCurrency: "RUB", lowPrice: minPrice, highPrice: 5490, availability: "https://schema.org/InStock", url: `https://${domain}/skazki/${story.slug}` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: `https://${domain}/` },
              { "@type": "ListItem", position: 2, name: "Сказки", item: `https://${domain}/skazki` },
              { "@type": "ListItem", position: 3, name: title },
            ],
          },
        ]}
      />
      <div className="wrap story">
        <Cover theme={story.coverTheme} title={title} coverUrl={story.coverUrl} />
        <div>
          <h1 style={{ fontSize: "var(--fs-2xl)" }}>{title}</h1>
          <p className="lead">{story.description}</p>
          <ul className="facts">
            <li>{ageLabel(story.ageMin, story.ageMax)} лет</li>
            <li>24 страницы, 12 иллюстрированных разворотов</li>
            <li>Можно добавить до 3 героев: брата или сестру, маму, папу, бабушку, дедушку, питомца</li>
            <li>3 стиля иллюстраций и посвящение от вас на первой странице</li>
            {occasion && <li>Повод: {occasion.title.toLowerCase()}</li>}
          </ul>
          <p>
            <strong>от {rub(minPrice)}</strong> <span className="muted">· превью бесплатно</span>
          </p>
          <Link href={`/sozdat?skazka=${story.slug}`} className="btn btn--primary">
            Создать эту книгу
          </Link>
        </div>
      </div>
      <Faq items={FAQ.slice(0, 4)} />
      <StickyCta href={`/sozdat?skazka=${story.slug}`} label="Создать эту книгу" />
    </>
  );
}
