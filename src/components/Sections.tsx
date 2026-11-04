import { getApprovedReviews, getPriceTable, rub } from "@/lib/catalog";
import { JsonLd } from "./Layout";
import { normalizeSignature } from "@/lib/names";

export async function PriceSection() {
  const rows = await getPriceTable();
  const pdf = rows.find((r) => r.kind === "PDF");
  const print = rows.filter((r) => r.kind === "PRINT");
  return (
    <section className="section" id="ceny">
      <div className="wrap">
        <h2>Сколько стоит</h2>
        <p className="lead">Превью — бесплатно. Платите, только если книга понравилась.</p>
        <div className="prices">
          <div className="price-box">
            <h3>Напечатаю сам</h3>
            <p className="muted small">PDF для экрана, домашней печати на А4 и копицентра (21×21 и 15×15 см).</p>
            <div className="price-big">{pdf ? rub(pdf.priceRub) : "—"}</div>
            <p className="small muted">Если позже решите напечатать у нас — заплатите только разницу.</p>
          </div>
          <div className="price-box">
            <h3>Напечатает БУКИМИ</h3>
            <p className="muted small">Малышам 0–3 — картонная книжка (9 или 12 страниц), детям 4–6 — 30 страниц со страницами для рисунков, 7–9 — 40 страниц с заметками. PDF в подарок. Изготовление 3–5 рабочих дней.</p>
            <table>
              <tbody>
                {print.map((r) => (
                  <tr key={r.key}>
                    <td>{r.title}</td>
                    <td>{rub(r.priceRub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// Только реальные отзывы из БД после модерации. Нет отзывов — секции нет.
export async function Reviews() {
  const reviews = await getApprovedReviews();
  if (reviews.length === 0) return null;
  return (
    <section className="section section--sage">
      <div className="wrap">
        <h2>Что говорят покупатели</h2>
        <div className="reviews">
          {reviews.map((r) => (
            <figure key={r.id} className="review" style={{ margin: 0 }}>
              <div className="review__stars" aria-label={`Оценка ${r.rating} из 5`}>
                {"★".repeat(r.rating)}
              </div>
              <blockquote style={{ margin: "8px 0" }}>{r.text}</blockquote>
              <figcaption className="small muted">{normalizeSignature(r.authorName)}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** jsonLd — разметка FAQPage: только на главной (одна страница с FAQPage на сайт — отчёт SEO 31.10, С-4). */
export function Faq({ items, title = "Частые вопросы", jsonLd = false }: { items: { q: string; a: string }[]; title?: string; jsonLd?: boolean }) {
  return (
    <section className="section" id="voprosy">
      <div className="wrap faq">
        <h2>{title}</h2>
        {items.map((it) => (
          <details key={it.q}>
            <summary>{it.q}</summary>
            <p>{it.a}</p>
          </details>
        ))}
        {jsonLd && <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
          }}
        />}
      </div>
    </section>
  );
}
