import type { Metadata } from "next";
import { og } from "@/lib/og";
import { getSeller } from "@/lib/settings";
import { JsonLd, StickyCta } from "@/components/Layout";
import { ContinueBanner } from "@/components/ContinueBanner";
import { AboutUs, FiveMinutes, Favorites, HomeHero, Newsletter, PhotoShowcase } from "@/components/Home";
import { Faq, Reviews } from "@/components/Sections";
import { getMinPrice, getStories } from "@/lib/catalog";
import { faqItems, fillFacts, siteFacts } from "@/lib/seo";
import { getNewsletter, getRating, getSeason, getSoon, pickFavorites } from "@/lib/storefront";
import { shelfLinks } from "@/lib/shelf";

export const revalidate = 300;

// Главная: canonical и свои OG (на остальных страницах — их собственные)
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  ...og({ title: "БУКИМИ — книга, где главный герой тот, кого вы любите", description: "Персональная сказка по фото, где ваш ребёнок от 0 до 9 лет — главный герой. Бесплатное превью за 5 минут.", path: "/" }),
};

// Главная: промо-полоса и меню (layout) → первый экран с полкой книг (макет владелицы, rev 06; полка заменила
// «Для кого книга?») → «Самые любимые» → «Фото → иллюстрация» → «Подарок за 5 минут» → отзывы (только настоящие) →
// «Кто мы» и вопросы → подписка (только если настроен промокод) → подвал.
export default async function Home() {
  const [stories, minPrice, season, rating, newsletter, soon] = await Promise.all([getStories(), getMinPrice(), getSeason(), getRating(), getNewsletter(), getSoon()]);
  // «Самые любимые» — только то, что продаётся: книги аудиторий «скоро» getStories не отдаёт
  const favorites = pickFavorites(stories, season?.occasion);
  const domain = process.env.DOMAIN ?? "bookimi.ru";
  const seller = await getSeller().catch(() => ({ email: "", phone: "" }));
  // AggregateRating — только по реальным опубликованным отзывам
  const aggregate = rating ? { "@type": "AggregateRating", ratingValue: rating.avg.toFixed(1), reviewCount: rating.count } : undefined;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "БУКИМИ",
            alternateName: "Bookimi",
            url: `https://${domain}`,
            logo: `https://${domain}/apple-icon.png`,
            description: "Российский сервис персональных иллюстрированных книг по фото: герой — ваш ребёнок, близкий человек или питомец.",
            areaServed: "RU",
            ...(seller.email || seller.phone ? { contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", availableLanguage: "ru", ...(seller.email ? { email: seller.email } : {}), ...(seller.phone ? { telephone: seller.phone } : {}) }] } : {}),
            ...(aggregate ? { aggregateRating: aggregate } : {}),
          },
          { "@context": "https://schema.org", "@type": "WebSite", name: "БУКИМИ", url: `https://${domain}`, inLanguage: "ru" },
        ]}
      />
      <ContinueBanner />
      <HomeHero shelf={shelfLinks(soon.soon)} rating={rating} />
      <Favorites stories={favorites} minPrice={minPrice} />
      <PhotoShowcase />
      <FiveMinutes count={stories.filter((s) => s.slug !== "svoya-ideya").length} soon={soon.audiences} />
      <Reviews />
      <AboutUs />
      <Faq items={faqItems(await siteFacts())} jsonLd />
      {newsletter && <Newsletter text={newsletter.text} />}
      <StickyCta href={season?.href ?? "/sozdat"} label={season ? season.cta : "Создать книгу"} />
    </>
  );
}
