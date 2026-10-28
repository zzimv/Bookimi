import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { CatalogFilters } from "@/components/Catalog";
import { Cover } from "@/components/Cover";
import { JsonLd, StickyCta } from "@/components/Layout";
import { NamePreview } from "@/components/NamePreview";
import { ContinueBanner } from "@/components/ContinueBanner";
import { getApprovedReviews } from "@/lib/catalog";
import { Faq, PriceSection, Reviews } from "@/components/Sections";
import { displayTitle, getMinPrice, getOccasions, getStories } from "@/lib/catalog";
import { FAQ } from "@/lib/catalog-defaults";

export const revalidate = 300;

export default async function Home() {
  const [stories, occasions, minPrice] = await Promise.all([getStories(), getOccasions(), getMinPrice()]);
  const [first, second] = stories;
  const reviews = await getApprovedReviews();
  // AggregateRating — только по реальным опубликованным отзывам
  const rating = reviews.length ? { "@type": "AggregateRating", ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } : undefined;
  const domain = process.env.DOMAIN ?? "bookimi.ru";

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "Organization", name: "БУКИМИ", alternateName: "Bookimi", url: `https://${domain}`, ...(rating ? { aggregateRating: rating } : {}) },
          { "@context": "https://schema.org", "@type": "WebSite", name: "БУКИМИ", url: `https://${domain}`, inLanguage: "ru" },
        ]}
      />

      <ContinueBanner />
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <h1>Сказка, в которой ваш ребёнок — главный герой</h1>
            <p className="lead">
              Загрузите фото, ответьте на несколько вопросов — и через пару минут увидите обложку и первые страницы
              книги, где ребёнка узнаёшь с первого взгляда.
            </p>
            <NamePreview />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/sozdat" className="btn btn--primary">
                Создать книгу бесплатно
              </Link>
              <Link href="/skazki" className="btn btn--ghost">
                Выбрать сказку
              </Link>
            </div>
            <p className="small muted" style={{ marginTop: 14 }}>
              Превью без регистрации и оплаты. Фото удаляется через 7 дней.
            </p>
          </div>
          <div className="hero__books" aria-hidden="true">
            {first && <Cover theme={first.coverTheme} title={displayTitle(first.title)} coverUrl={first.coverUrl} />}
            {second && <Cover theme={second.coverTheme} title={displayTitle(second.title)} coverUrl={second.coverUrl} />}
          </div>
        </div>
      </section>

      <section className="section section--sage">
        <div className="wrap">
          <h2>Как появляется книга</h2>
          <ol className="steps">
            <li>
              <strong>Расскажите о ребёнке</strong>
              Имя, возраст, 1–3 фото и что он любит: динозавров, космос, море или что-то своё.
            </li>
            <li>
              <strong>Посмотрите превью</strong>
              Через 2–5 минут — обложка и два разворота. Бесплатно и без регистрации.
            </li>
            <li>
              <strong>Получите книгу</strong>
              PDF за 990 ₽ — сразу после оплаты. Печатная книга — изготовление 3–5 рабочих дней и доставка.
            </li>
          </ol>
        </div>
      </section>

      <section className="section" id="skazki">
        <div className="wrap">
          <h2>Сказки</h2>
          <CatalogFilters occasions={occasions.map((o) => ({ slug: o.slug, title: o.title }))} />
          <div className="grid">
            {stories.map((s) => (
              <BookCard key={s.slug} story={s} minPrice={minPrice} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--sage" id="povody">
        <div className="wrap">
          <h2>Подарок к поводу</h2>
          <div className="occasions">
            {occasions.map((o) => (
              <Link key={o.slug} href={`/povod/${o.slug}`} className="occasion">
                <strong>{o.title}</strong>
                <span>Сказки и идеи посвящений</span>
              </Link>
            ))}
            <Link href="/sozdat?povod=svoj" className="occasion">
              <strong>Свой повод</strong>
              <span>Опишите его в квизе — сказка подстроится</span>
            </Link>
          </div>
        </div>
      </section>

      <PriceSection />
      <Reviews />
      <Faq items={FAQ} />
      <StickyCta />
    </>
  );
}
