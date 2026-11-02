import { og } from "@/lib/og";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { HolidayCards } from "@/components/Holidays";
import { getHolidayCards } from "@/lib/holidays";

// Даты считаются по Москве на каждый запрос раз в час: «осталось N дней» не устаревает
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ближайшие праздники: книга в подарок к Новому году, Рождеству и дню рождения",
  description:
    "Ближайшие праздники и до какого дня заказать печатную именную книгу, чтобы она успела: Новый год, Рождество, Старый Новый год, дни рождения детей, подростков, взрослых и питомцев. PDF — в тот же день.",
  alternates: { canonical: "/prazdniki" },
  ...og({ title: "Ближайшие праздники: книга в подарок к Новому году, Рождеству и дню рождения", description: "До какого дня заказать печатную именную книгу, чтобы она успела к празднику.", path: "/prazdniki" }),
};

export default async function Page() {
  const cards = await getHolidayCards();
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Ближайшие праздники" }]} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Ближайшие праздники",
          itemListElement: cards.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: `${base}${c.occasionHref ?? c.catalogHref}` })),
        }}
      />
      <section className="section section--tight">
        <div className="wrap">
          <p className="eyebrow">Календарь подарков</p>
          <h1>Ближайшие праздники</h1>
          <p className="lead">
            Печатной книге нужно время: изготовление и доставка. Здесь видно, сколько осталось до праздника и до какого дня
            заказать, чтобы книга успела. PDF приходит сразу после оплаты — даже в последний день.
          </p>
          <HolidayCards cards={cards} />
          <p className="hol-later">
            Другие поводы — 8 Марта, выпускные, годовщины, юбилеи — на странице <Link href="/povody">«Все поводы»</Link>. А свой
            повод можно вписать в анкете.
          </p>
        </div>
      </section>
      <StickyCta href="/sozdat" label="Создать книгу к празднику" />
    </>
  );
}
