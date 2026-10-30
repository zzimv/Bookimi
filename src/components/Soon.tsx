// «Скоро» (настройка storefront.soon): плашка на странице аудитории / в каталоге и значок в меню и на полке.
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
