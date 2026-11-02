import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cover } from "@/components/Cover";
import { Breadcrumbs, JsonLd, StickyCta } from "@/components/Layout";
import { NamePreview } from "@/components/NamePreview";
import { Faq } from "@/components/Sections";
import { ageLabel, displayTitle, getAddonsFor, getPriceTable, getStories, getStory, HERO_WORD, rub } from "@/lib/catalog";
import { faqItems, fillFacts, siteFacts } from "@/lib/seo";
import { sampleUrl } from "@/lib/obrazec";
import { og } from "@/lib/og";
import { getSeason, getSoon, segmentTitle, SVOYA_IDEYA } from "@/lib/storefront";
import { SOON_SHORT } from "@/lib/shelf";
import { cfg } from "@/lib/settings";
import { SoonBanner } from "@/components/Soon";
import { EXTRA_ROLE_LABELS } from "@/lib/quiz";
import { ART_STYLE_IDS, OCCASIONS as OCCASION_KEYS, TEXT_STYLE_IDS } from "@/content/profiles";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getStories()).filter((s) => s.slug !== SVOYA_IDEYA).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStory(slug);
  if (!s) return {};
  const title = s.seoTitle ?? `${displayTitle(s.title, s.audience)} — персональная книга`;
  const description = s.seoDescription ?? `${s.tagline} ${ageLabel(s.ageMin, s.ageMax, s.audience)}. Бесплатное превью, PDF 990 ₽, печатная книга от 2 490 ₽.`;
  return { title, description, alternates: { canonical: `/skazki/${s.slug}` }, ...og({ title, description, slug: s.slug, path: `/skazki/${s.slug}`, alt: `Обложка-пример: ${displayTitle(s.title, s.audience)}` }) };
}

const NAME_LABEL = { CHILD: "Как зовут ребёнка?", TEEN: "Как зовут героя?", ADULT: "Как зовут героя книги?", PET: "Как зовут питомца?" } as const;
const NAME_PH = { CHILD: "Например, Варя", TEEN: "Например, Миша", ADULT: "Например, Анна", PET: "Например, Пушок" } as const;
/** Развороты-примеры: начало, середина, финал. */
const SAMPLE_SPREADS = [1, 6, 12];
/** «Постер А3 в стиле книги» → «постер А3 в стиле книги»; «Мультфильм по книге: 2 минуты…» → «мультфильм по книге». */
const shortAddon = (t: string) => {
  const s = t.split(":")[0].replace(/\s*\(.*\)$/, "");
  return /^[А-ЯЁ][а-яё]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
};

// Страница книги как у Wonderbly: живая обложка (имя появляется, пока вы печатаете), 3 разворота-примера,
// голос и стили, для кого, цены из каталога, сроки печати к сезону, «Создать» → анкета с выбранной книгой.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [story, prices, season, soon] = await Promise.all([getStory(slug), getPriceTable(), getSeason(), getSoon()]);
  if (!story || story.slug === SVOYA_IDEYA) notFound();
  // Аудитория «скоро» (storefront.soon): книгу можно посмотреть, «Создать» выключена
  const isSoon = soon.audiences.includes(story.audience);
  // Допы — свои для аудитории книги; в блоке цены — четыре первых (без «второго экземпляра» и срочности)
  const extras = (await getAddonsFor(story.audience)).filter((a) => a.kind !== "MODIFIER" && a.priceRub && !a.key.startsWith("cartoon")).slice(0, 4);
  // «Оживление книги» пока «скоро» (cartoon.enabled = false): упоминаем без цены
  const cartoonSoon = !(await cfg("cartoon").catch(() => ({ enabled: false }))).enabled;
  const title = displayTitle(story.title, story.audience);
  const pdf = prices.find((r) => r.kind === "PDF");
  const print = prices.filter((r) => r.kind === "PRINT").sort((a, b) => a.priceRub - b.priceRub);
  const minPrice = Math.min(...prices.map((p) => p.priceRub));
  const maxPrice = Math.max(...prices.map((p) => p.priceRub));
  const voice = TEXT_STYLE_IDS.find((t) => t.id === story.textStyle);
  const styles = story.artStyles.map((id) => ART_STYLE_IDS.find((s) => s.id === id)).filter(Boolean).slice(0, 3) as { id: string; title: string; oneLine: string }[];
  const occasionLabels = story.occasions.filter((o) => o !== "bez").map((o) => OCCASION_KEYS.find((x) => x.key === o)?.label).filter(Boolean).slice(0, 4);
  const seasonFits = season && story.occasions.includes(season.occasion);
  const extrasLine =
    story.extras.note ??
    (story.extras.max > 0 ? `Можно добавить до ${story.extras.max} героев: ${story.extras.roles.slice(0, 4).map((r) => (EXTRA_ROLE_LABELS[r] ?? r).toLowerCase()).join(", ")} или свой вариант` : null);
  const create = `/sozdat?skazka=${story.slug}${seasonFits ? `&povod=${season!.occasion}` : ""}`;
  const domain = process.env.DOMAIN ?? "bookimi.ru";

  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/skazki", label: "Книги" }, { label: title }]} />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: title,
            description: story.description,
            // Картинка — обложка книги (или её OG-карточка); «скоро» — предзаказ, не «в наличии»
            image: [story.coverUrl ? (story.coverUrl.startsWith("http") ? story.coverUrl : `https://${domain}${story.coverUrl}`) : `https://${domain}/og?s=${encodeURIComponent(story.slug)}`],
            brand: { "@type": "Brand", name: "БУКИМИ" },
            offers: { "@type": "AggregateOffer", priceCurrency: "RUB", lowPrice: minPrice, highPrice: maxPrice, availability: isSoon ? "https://schema.org/PreOrder" : "https://schema.org/InStock", url: `https://${domain}/skazki/${story.slug}` },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: `https://${domain}/` },
              { "@type": "ListItem", position: 2, name: "Книги", item: `https://${domain}/skazki` },
              { "@type": "ListItem", position: 3, name: title, item: `https://${domain}/skazki/${story.slug}` },
            ],
          },
        ]}
      />
      <div className="wrap product">
        <div className="product__media">
          <Cover theme={story.coverTheme} title={title} coverUrl={story.coverUrl} colors={story.coverColors} sample={sampleUrl({ slug: story.slug })} rawTitle={story.title} heroWord={HERO_WORD[story.audience]} eager />
          <p className="product__tag small muted">Обложка-пример. В вашей книге герой будет похож на себя — по фото или описанию.</p>
        </div>
        <div className="product__info">
          <p className="eyebrow">{ageLabel(story.ageMin, story.ageMax, story.audience)}</p>
          <h1>{title}</h1>
          <p className="lead">{story.tagline}</p>
          <NamePreview label={NAME_LABEL[story.audience]} placeholder={NAME_PH[story.audience]} hint="Имя сразу появится на обложке" />
          <div className="product__price">
            <div>
              <b>{pdf ? rub(pdf.priceRub) : rub(minPrice)}</b>
              <span>PDF сразу после оплаты</span>
            </div>
            {print[0] && (
              <div>
                <b>от {rub(print[0].priceRub)}</b>
                <span>печатная книга, PDF в подарок</span>
              </div>
            )}
          </div>
          {extras.length > 0 && (
            <p className="small product__addons" data-addons={story.audience}>
              К книге можно добавить: {extras.map((a, i) => <span key={a.key}>{i > 0 && ", "}{shortAddon(a.title)} — {rub(a.priceRub!)}</span>)}.
              {cartoonSoon && <> <span className="soon-inline" data-cartoon-soon>Оживление книги <span className="badge badge--gold">скоро</span></span></>}
            </p>
          )}
          {season?.printLine && seasonFits && <p className="deadline">{season.printLine}</p>}
          {isSoon ? (
            <>
              <button type="button" className="btn btn--primary btn--lg btn--block product__cta" disabled aria-describedby="product-soon">
                Создать книгу
              </button>
              <p className="small muted" id="product-soon" style={{ textAlign: "center" }}>{SOON_SHORT}</p>
              <SoonBanner audience={story.audience} />
            </>
          ) : (
            <>
              <Link href={create} className="btn btn--primary btn--lg btn--block product__cta">
                Создать книгу
              </Link>
              <p className="small muted" style={{ textAlign: "center" }}>Превью бесплатно — платите, только если понравится</p>
            </>
          )}

          <dl className="specs">
            <div>
              <dt>Для кого</dt>
              <dd>{story.segments.map(segmentTitle).join(" · ")}</dd>
            </div>
            {voice && (
              <div>
                <dt>Голос книги</dt>
                <dd>
                  <b>{voice.title}.</b> {voice.oneLine}
                </dd>
              </div>
            )}
            {styles.length > 0 && (
              <div>
                <dt>Иллюстрации</dt>
                <dd>
                  Лучше всего: {styles.map((s) => `«${s.title}»`).join(", ")}. Стиль и настроение выберете в анкете.
                </dd>
              </div>
            )}
            {extrasLine && (
              <div>
                <dt>Кто ещё в книге</dt>
                <dd>{extrasLine}</dd>
              </div>
            )}
            {occasionLabels.length > 0 && (
              <div>
                <dt>Подходит к поводам</dt>
                <dd>{occasionLabels.join(", ")} — или к любому вашему</dd>
              </div>
            )}
            <div>
              <dt>Книга</dt>
              <dd>24 страницы, 12 иллюстрированных разворотов, посвящение от вас на первой странице</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="section section--sage" aria-labelledby="pages-h">
        <div className="wrap">
          <h2 id="pages-h">Как выглядят страницы</h2>
          <p className="muted">Демо-развороты в стиле «{styles[0]?.title ?? "по умолчанию"}» — пример. В вашей книге будут ваш герой, его имя и ваши детали.</p>
          <div className="spreads">
            {SAMPLE_SPREADS.map((i) => (
              <figure key={i} className="spreads__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sampleUrl({ slug: story.slug, index: i })} alt={`Пример разворота ${i}`} loading="lazy" decoding="async" width={800} height={400} />
                <figcaption>
                  <span className="badge">пример</span> Разворот {i} из 12
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="about-book">
            <h2>О книге</h2>
            <p>{story.description}</p>
          </div>
        </div>
      </section>
      <Faq items={faqItems(await siteFacts()).slice(0, 4)} />
      <StickyCta href={create} label="Создать книгу" soon={isSoon} />
    </>
  );
}
