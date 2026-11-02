import { og } from "@/lib/og";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookCard } from "@/components/BookCard";
import { Breadcrumbs, StickyCta } from "@/components/Layout";
import { getAgePage, getMinPrice, getStories } from "@/lib/catalog";
import { catalogStories, getSoon } from "@/lib/storefront";
import { AGE_PAGES } from "@/lib/catalog-defaults";

export const revalidate = 300;

export function generateStaticParams() {
  return AGE_PAGES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getAgePage(slug);
  if (!a) return {};
  return {
    title: `${a.title}: персональные сказки по фото`,
    description: `Именные книги для детей ${a.min}–${a.max} лет (${a.label}), где ребёнок — главный герой. Превью бесплатно, PDF 990 ₽, печать от 2 490 ₽.`,
    alternates: { canonical: `/vozrast/${a.slug}` },
    ...og({ title: `${a.title}: персональные сказки по фото`, description: `Именные книги для детей ${a.min}–${a.max} лет, где ребёнок — главный герой.`, path: `/vozrast/${a.slug}` }),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const age = getAgePage(slug);
  if (!age) notFound();
  const [stories, minPrice, soon] = await Promise.all([getStories({ audience: "CHILD", segment: age.segment }), getMinPrice(), getSoon()]);
  // Ровно книги этой группы: текст каждой детской книги написан для одной группы (2–4, 5–7 или 8–10 лет)
  const list = catalogStories(stories);

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: age.title }]} />
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <h1>{age.title}</h1>
          <p className="lead">
            Сказки, написанные для детей {age.min}–{age.max} лет: длина текста, слова и сюжет — под этот возраст. Ребёнок узнаёт себя на
            иллюстрациях, а его имя звучит на каждой странице.
          </p>
          <div className="grid" style={{ marginTop: 32 }}>
            {list.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} soon={soon.audiences.includes(s.audience)} />
            ))}
          </div>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
