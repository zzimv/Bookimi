// Секции главной (порядок как у Wonderbly): первый экран → «Для кого книга?» → «Самые любимые» →
// «Фото → иллюстрация» → «Подарок за 5 минут» → отзывы → «Кто мы» + вопросы → подписка.
// Всё — серверные компоненты; клиентский JS только у формы подписки.
import Link from "next/link";
import { BookCard } from "./BookCard";
import { Cover } from "./Cover";
import { NewsletterForm } from "./NewsletterForm";
import { ART_STYLE_IDS } from "@/content/profiles";
import { sampleUrl } from "@/lib/obrazec";
import type { PublicStory } from "@/lib/catalog";
import { FOR_WHOM, getShowcase, type Season } from "@/lib/storefront";

const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10;
  const b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};

export function HomeHero({ season, rating }: { season: Season | null; rating: { avg: number; count: number } | null }) {
  const cta = season ? { href: season.href, label: season.cta } : { href: "/sozdat", label: "Создать книгу" };
  return (
    <section className="hhero">
      <div className="wrap hhero__grid">
        <div className="hhero__text">
          {season && <p className="eyebrow">{season.label}: книги к празднику</p>}
          <h1>Сказка, где главный герой — тот, кого вы любите</h1>
          <p className="lead">
            Ребёнок, подросток, мама, любимый человек или даже кот. Имя, внешность и ваши истории — на каждой странице, а
            иллюстрации по фото рисует нейросеть в выбранном стиле.
          </p>
          <Link href={cta.href} className="btn btn--primary btn--lg">
            {cta.label}
          </Link>
          <p className="hhero__note small">Превью бесплатно, вход по коду на почту · PDF от 990 ₽ · печатная книга от 2 490 ₽</p>
          {rating && (
            <p className="hhero__rating" aria-label={`Оценка ${rating.avg} из 5 по ${rating.count} отзывам`}>
              <span aria-hidden="true">★★★★★</span> {rating.avg.toFixed(1).replace(".", ",")} — {rating.count} {plural(rating.count, "отзыв", "отзыва", "отзывов")} покупателей
            </p>
          )}
        </div>
        <div className="hhero__art" aria-hidden="true">
          <div className="hhero__book hhero__book--2">
            <Cover theme="" title="Носочный клад" name="Бублик" sample={sampleUrl({ slug: "nosochnyj-klad", species: "dog", fur: "палевый", extras: [] })} />
          </div>
          <div className="hhero__book hhero__book--3">
            <Cover theme="" title="Две планеты" name="Аня и Илья" sample={sampleUrl({ slug: "dve-planety" })} />
          </div>
          <div className="hhero__book hhero__book--1">
            <Cover theme="" title="Новогоднее путешествие с Дедом Морозом" name="Варя" eager sample={sampleUrl({ slug: "novogodnee-puteshestvie-s-dedom-morozom", gender: "girl", hairstyle: "косички", hair: "рыжие", freckles: true })} />
          </div>
          <span className="hhero__tag">пример</span>
        </div>
      </div>
    </section>
  );
}

export function ForWhom() {
  return (
    <section className="section" aria-labelledby="dlya-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="dlya-h">Для кого книга?</h2>
          <Link href="/skazki" className="sec-head__more">Все книги →</Link>
        </div>
      <div className="rail" role="list">
        {FOR_WHOM.map((c) => (
          <Link key={c.title} href={c.href} className="whom" role="listitem">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt="" loading="lazy" decoding="async" width={220} height={220} />
            <strong>{c.title}</strong>
            <span>{c.sub}</span>
          </Link>
        ))}
      </div>
      </div>
    </section>
  );
}

export function Favorites({ stories, minPrice }: { stories: PublicStory[]; minPrice: number }) {
  return (
    <section className="section section--sage" aria-labelledby="fav-h">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="fav-h">Самые любимые</h2>
          <Link href="/skazki" className="sec-head__more">Смотреть все →</Link>
        </div>
        <div className="grid grid--4">
          {stories.map((s) => (
            <BookCard key={s.slug} story={s} minPrice={minPrice} />
          ))}
        </div>
      </div>
    </section>
  );
}

const SHOW_STYLES = ["watercolor-air", "folk-lubok", "kind-classic"];
const SHOW_LOOK = { slug: "imya-i-zvyozdnyj-drakonchik", gender: "girl", age: 5, hair: "русые", hairstyle: "хвостик", extras: [] as string[] };

export function PhotoShowcase() {
  const real = getShowcase();
  const styles = real
    ? real.styles
    : SHOW_STYLES.map((id) => ({ src: sampleUrl({ ...SHOW_LOOK, style: id }), title: ART_STYLE_IDS.find((s) => s.id === id)?.title ?? id }));
  return (
    <section className="section" aria-labelledby="show-h">
      <div className="wrap">
        <h2 id="show-h">Фото → иллюстрация</h2>
        <p className="lead">
          Загрузите 1–3 фото — нейросеть нарисует героя в выбранном стиле, похожим на себя. Мы проверяем каждую картинку, а
          если что-то не так — перерисуем бесплатно.
        </p>
        <div className="show">
          <figure className="show__photo">
            {real ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={real.photo} alt={real.alt} loading="lazy" />
            ) : (
              <div className="show__slot" aria-label="Место для фото">
                <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
                  <rect x="6" y="14" width="52" height="38" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
                  <circle cx="32" cy="33" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path d="M22 14l4-6h12l4 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                </svg>
                <span>Ваше фото</span>
                <small>Лицо крупно, хороший свет</small>
              </div>
            )}
            <figcaption>Фото</figcaption>
          </figure>
          <div className="show__arrow" aria-hidden="true">→</div>
          <div className="show__styles">
            {styles.map((s) => (
              <figure key={s.src} className="show__style">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.src} alt={`Герой в стиле «${s.title}»`} loading="lazy" decoding="async" width={300} height={300} />
                <figcaption>{s.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
        <p className="small muted show__note">
          {real
            ? "Фото и иллюстрации публикуются с письменного согласия семьи."
            : "Пример: демо-отрисовка одного героя в трёх стилях. Всего стилей — 15, у каждой книги — свои лучшие."}
        </p>
      </div>
    </section>
  );
}

export function FiveMinutes() {
  return (
    <section className="section section--sage" aria-labelledby="five-h">
      <div className="wrap">
        <h2 id="five-h">Подарок за 5 минут</h2>
        <ol className="steps steps--4">
          <li>
            <strong>Выберите книгу</strong>
            30 историй для детей, подростков, взрослых и питомцев — к любому поводу.
          </li>
          <li>
            <strong>Расскажите о герое</strong>
            Имя, внешность, что любит, кто ещё будет в сказке. Фото — по желанию.
          </li>
          <li>
            <strong>Посмотрите превью</strong>
            Текст целиком, обложка и два разворота — бесплатно. Любую страницу можно поправить.
          </li>
          <li>
            <strong>Получите книгу</strong>
            PDF — сразу после оплаты. Печатная — 3–5 рабочих дней и доставка по России.
          </li>
        </ol>
        <p style={{ marginTop: 28 }}>
          <Link href="/sozdat" className="btn btn--primary">Создать книгу</Link>
        </p>
      </div>
    </section>
  );
}

export function AboutUs() {
  return (
    <section className="section" aria-labelledby="about-h">
      <div className="wrap about">
        <div>
          <h2 id="about-h">Кто мы</h2>
          <p>
            БУКИМИ — небольшая команда из России: мы придумываем сюжеты, вычитываем тексты и следим, чтобы каждая книга была
            доброй и бережной. Сочинять и рисовать помогает нейросеть — так книга получается за минуты, а не за недели.
          </p>
          <ul className="facts">
            <li>Сюжеты, голоса книг и правила для нейросети пишем сами; запреты — по возрасту героя.</li>
            <li>Имя героя не уходит в нейросеть: мы подставляем его сами, с правильными падежами.</li>
            <li>Фото хранится в России и удаляется через 7 дней.</li>
            <li>Текст правится бесплатно, иллюстрации — 3 перерисовки после покупки.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Newsletter({ text }: { text: string }) {
  return (
    <section className="section section--sage" aria-labelledby="nl-h">
      <div className="wrap nl">
        <div>
          <h2 id="nl-h">{text}</h2>
          <p className="muted">Подпишитесь на письма: новые книги, идеи к праздникам и промокод на первый заказ. Не чаще раза в неделю.</p>
        </div>
        <NewsletterForm />
      </div>
    </section>
  );
}
