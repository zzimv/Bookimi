// «Скоро» (настройка storefront.soon): плашка на странице аудитории / в каталоге и значок в меню и на полке.
import Link from "next/link";
import type { AudienceKey } from "@/content/profiles";
import { soonNote } from "@/lib/shelf";

export function SoonBadge() {
  return <span className="soon-badge">скоро</span>;
}

export function SoonBanner({ audience }: { audience: AudienceKey }) {
  return (
    <p className="soon-banner" role="note" data-soon={audience}>
      <span className="soon-badge" aria-hidden="true">скоро</span>
      <span>{soonNote(audience)}.</span>
    </p>
  );
}

const WHO: Record<AudienceKey, string> = { CHILD: "для детей", TEEN: "для подростков", ADULT: "для взрослых", PET: "о питомцах" };

/** Анкета для аудитории «скоро» (/sozdat?dlya=TEEN и т. п.): создать нельзя — вежливое «скоро» и путь к детским сказкам. */
export function SoonCreate({ audience }: { audience: AudienceKey }) {
  return (
    <section className="section section--tight" data-soon-create={audience}>
      <div className="wrap" style={{ maxWidth: 720 }}>
        <SoonBanner audience={audience} />
        <h1>Книги {WHO[audience]} — скоро</h1>
        <p className="lead">Мы готовим их к запуску. А пока можно создать сказку, где главный герой — ваш ребёнок от 0 до 9 лет.</p>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/sozdat?dlya=CHILD" className="btn btn--primary">Создать сказку для ребёнка</Link>
          <Link href="/skazki" className="btn btn--ghost">Все сказки</Link>
        </p>
      </div>
    </section>
  );
}
