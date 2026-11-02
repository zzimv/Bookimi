import { og } from "@/lib/og";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, StickyCta } from "@/components/Layout";
import { OCCASIONS as OCCASION_KEYS } from "@/content/profiles";
import { getOccasions } from "@/lib/catalog";
import { AUDIENCE_PAGES, getSoon } from "@/lib/storefront";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Сказка в подарок к поводу: день рождения, Новый год, выпускной и другие",
  description: "Персональная сказка для ребёнка к любому поводу: день рождения, Новый год, выпускной в саду, первый класс, рождение брата или сестры. Или впишем ваш собственный повод.",
  alternates: { canonical: "/povody" },
  ...og({ title: "Сказка в подарок к поводу", description: "Персональная сказка для ребёнка к любому поводу: день рождения, Новый год, выпускной в саду, первый класс.", path: "/povody" }),
};

export default async function Page() {
  const [pages, soon] = await Promise.all([getOccasions(), getSoon()]);
  // Аудитории «скоро» — без своих поводов (их книги пока не продаются)
  const groups = AUDIENCE_PAGES.filter((a) => !soon.audiences.includes(a.key)).map((a) => ({
    a,
    list: OCCASION_KEYS.filter((o) => o.audiences.includes(a.key) && pages.some((p) => p.slug === o.key)),
  }));
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Поводы" }]} />
      <section className="section section--tight">
        <div className="wrap">
          <h1>Книга к поводу</h1>
          <p className="lead">Любую книгу можно подарить к любому поводу: праздник появится на первой и последней страницах. А если вашего повода нет в списке — впишем свой.</p>
          {groups.map(({ a, list }) => (
            <div key={a.key} style={{ marginBottom: 32 }}>
              {groups.length > 1 && <h2 className="grid-sub">{a.nav}</h2>}
              <div className="occasions">
                {list.map((o) => (
                  <Link key={o.key} href={`/povod/${o.key}`} className="occasion">
                    <strong>{o.label}</strong>
                    <span>{o.season ? `Сезон: ${o.season}` : "Книги и идеи посвящений"}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href="/sozdat?povod=svoj" className="occasion" style={{ maxWidth: 360 }}>
            <strong>Свой повод</strong>
            <span>Первый поход в бассейн, новый зуб, переезд — опишите, и книга подстроится</span>
          </Link>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
