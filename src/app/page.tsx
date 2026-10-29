import { JsonLd, StickyCta } from "@/components/Layout";
import { ContinueBanner } from "@/components/ContinueBanner";
import { AboutUs, FiveMinutes, Favorites, ForWhom, HomeHero, Newsletter, PhotoShowcase } from "@/components/Home";
import { Faq, Reviews } from "@/components/Sections";
import { getMinPrice, getStories } from "@/lib/catalog";
import { FAQ } from "@/lib/catalog-defaults";
import { getNewsletter, getRating, getSeason, pickFavorites } from "@/lib/storefront";

export const revalidate = 300;

// Главная в порядке Wonderbly: промо-полоса и меню (layout) → первый экран с одной кнопкой → «Для кого книга?» →
// «Самые любимые» → «Фото → иллюстрация» → «Подарок за 5 минут» → отзывы (только настоящие) → «Кто мы» и вопросы →
// подписка (только если настроен промокод) → подвал.
export default async function Home() {
  const [stories, minPrice, season, rating, newsletter] = await Promise.all([getStories(), getMinPrice(), getSeason(), getRating(), getNewsletter()]);
  const favorites = pickFavorites(stories, season?.occasion);
  const domain = process.env.DOMAIN ?? "bookimi.ru";
  // AggregateRating — только по реальным опубликованным отзывам
  const aggregate = rating ? { "@type": "AggregateRating", ratingValue: rating.avg.toFixed(1), reviewCount: rating.count } : undefined;

  return (
    <>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "Organization", name: "БУКИМИ", alternateName: "Bookimi", url: `https://${domain}`, ...(aggregate ? { aggregateRating: aggregate } : {}) },
          { "@context": "https://schema.org", "@type": "WebSite", name: "БУКИМИ", url: `https://${domain}`, inLanguage: "ru" },
        ]}
      />
      <ContinueBanner />
      <HomeHero season={season} rating={rating} />
      <ForWhom />
      <Favorites stories={favorites} minPrice={minPrice} />
      <PhotoShowcase />
      <FiveMinutes />
      <Reviews />
      <AboutUs />
      <Faq items={FAQ} />
      {newsletter && <Newsletter text={newsletter.text} />}
      <StickyCta href={season?.href ?? "/sozdat"} label={season ? season.cta : "Создать книгу"} />
    </>
  );
}
