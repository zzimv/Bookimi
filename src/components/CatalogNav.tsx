// Фильтры каталога — обычные ссылки (без JavaScript): аудитория → сегмент → повод.
import Link from "next/link";
import { OCCASIONS as OCCASION_KEYS, type AudienceKey } from "@/content/profiles";
import { AUDIENCE_PAGES, segmentChips } from "@/lib/storefront";
import { occasionIsLive } from "@/lib/shelf";
import { SoonBadge } from "./Soon";

export interface CatalogQuery {
  audience?: AudienceKey;
  segments: string[];
  povod?: string;
}

export function catalogHref(q: CatalogQuery, base = "/skazki") {
  const p = new URLSearchParams();
  if (q.audience) p.set("dlya", AUDIENCE_PAGES.find((a) => a.key === q.audience)!.slug);
  if (q.segments.length) p.set("segment", q.segments.join(","));
  if (q.povod) p.set("povod", q.povod);
  const s = p.toString().replace(/%2C/g, ",");
  return s ? `${base}?${s}` : base;
}

/** soon — аудитории «скоро»: вкладка со значком ведёт на страницу аудитории, их поводы и сегменты не предлагаем. */
export function CatalogNav({ q, showAudience = true, soon = [] }: { q: CatalogQuery; showAudience?: boolean; soon?: AudienceKey[] }) {
  const audSoon = Boolean(q.audience && soon.includes(q.audience));
  // Продаётся одна аудитория (сейчас — дети): чипсы возраста видны сразу, и без выбора вкладки
  const live = AUDIENCE_PAGES.map((a) => a.key).filter((k) => !soon.includes(k));
  const chipAud = q.audience ?? (live.length === 1 ? live[0] : undefined);
  const occasions = audSoon
    ? []
    : OCCASION_KEYS.filter((o) => o.key !== "svoj" && o.key !== "bez" && (q.audience ? o.audiences.includes(q.audience) : occasionIsLive(o.key, soon)));
  return (
    <div className="cnav">
      {showAudience && (
        <nav className="tabs" aria-label="Для кого">
          <Link href={catalogHref({ segments: [], povod: q.povod })} aria-current={!q.audience ? "page" : undefined}>Все</Link>
          {AUDIENCE_PAGES.map((a) => (
            <Link key={a.key} href={soon.includes(a.key) ? `/dlya/${a.slug}` : catalogHref({ audience: a.key, segments: [], povod: q.povod })} aria-current={q.audience === a.key ? "page" : undefined} data-soon={soon.includes(a.key) || undefined}>
              {a.nav}
              {soon.includes(a.key) && <SoonBadge />}
            </Link>
          ))}
        </nav>
      )}
      {chipAud && !audSoon && (
        <div className="filters" role="group" aria-label={chipAud === "CHILD" ? "Возраст" : "Кому именно"}>
          <Link className="chip" href={catalogHref({ ...q, segments: [] })} aria-current={!q.segments.length ? "true" : undefined}>Все</Link>
          {segmentChips(chipAud).map((s) => {
            const on = q.segments.includes(s.id);
            return (
              <Link key={s.id} className="chip" title={s.title} data-segment={s.id} href={catalogHref({ ...q, audience: chipAud, segments: on ? [] : [s.id] })} aria-current={on ? "true" : undefined}>
                {s.label}
              </Link>
            );
          })}
        </div>
      )}
      {occasions.length > 0 && <div className="filters filters--scroll" role="group" aria-label="Повод">
        <span className="filters__label">Повод:</span>
        <Link className="chip" href={catalogHref({ ...q, povod: undefined })} aria-current={!q.povod ? "true" : undefined}>Любой</Link>
        {occasions.map((o) => (
          <Link key={o.key} className="chip" href={catalogHref({ ...q, povod: q.povod === o.key ? undefined : o.key })} aria-current={q.povod === o.key ? "true" : undefined}>
            {o.label}
          </Link>
        ))}
      </div>}
    </div>
  );
}
