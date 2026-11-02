import type { MetadataRoute } from "next";
import { getOccasions, getSoonAudiences, getStories } from "@/lib/catalog";
import { occasionIsLive } from "@/lib/shelf";
import { AGE_PAGES } from "@/lib/catalog-defaults";
import { db, hasDatabase } from "@/lib/db";
import { LEGAL } from "@/lib/legal";
import { AUDIENCE_PAGES, SVOYA_IDEYA } from "@/lib/storefront";

export const revalidate = 3600;

/** Дата последнего изменения шаблонов страниц (обновлять при заметной правке текстов без БД). */
export const SITE_UPDATED = new Date("2026-11-02T00:00:00+03:00");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  const [stories, allOccasions, soon] = await Promise.all([getStories(), getOccasions(), getSoonAudiences()]);
  // Поводы только аудиторий «скоро» (их страницы отвечают 404) — не в карте сайта
  const occasions = allOccasions.filter((o) => occasionIsLive(o.slug, soon));
  const posts = hasDatabase ? await db.blogPost.findMany({ where: { publishedAt: { not: null } }, select: { slug: true, updatedAt: true } }).catch(() => []) : [];
  // lastmod — из дат изменения (сюжет, повод, статья, тексты документов), а не «сейчас»: иначе Яндекс перестаёт ему верить
  const [storyDates, occDates, legalSet] = hasDatabase
    ? await Promise.all([
        db.story.findMany({ select: { slug: true, updatedAt: true } }).catch(() => []),
        db.occasion.findMany({ select: { slug: true, updatedAt: true } }).catch(() => []),
        db.setting.findUnique({ where: { key: "legal" }, select: { updatedAt: true } }).catch(() => null),
      ])
    : [[], [], null];
  const sd = new Map(storyDates.map((x) => [x.slug, x.updatedAt]));
  const od = new Map(occDates.map((x) => [x.slug, x.updatedAt]));
  const max = (ds: (Date | undefined | null)[]) => ds.filter(Boolean).reduce<Date>((m, d) => (d! > m ? d! : m), SITE_UPDATED);
  const now = max([...storyDates.map((x) => x.updatedAt), ...occDates.map((x) => x.updatedAt)]);
  const legal = legalSet?.updatedAt ?? SITE_UPDATED;
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/skazki`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...AUDIENCE_PAGES.map((a) => ({ url: `${base}/dlya/${a.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${base}/povody`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/prazdniki`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...occasions.map((o) => ({ url: `${base}/povod/${o.slug}`, lastModified: od.get(o.slug) ?? SITE_UPDATED, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...stories.filter((s) => s.slug !== SVOYA_IDEYA).map((s) => ({ url: `${base}/skazki/${s.slug}`, lastModified: sd.get(s.slug) ?? SITE_UPDATED, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...AGE_PAGES.map((a) => ({ url: `${base}/vozrast/${a.slug}`, lastModified: SITE_UPDATED, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/blog`, lastModified: max(posts.map((p) => p.updatedAt)), changeFrequency: "weekly", priority: 0.6 },
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(LEGAL).map((k) => ({
      url: `${base}/${k.startsWith("soglasie-") ? `soglasie/${k.replace("soglasie-", "").replace("rassylka", "rassylka")}` : k}`,
      lastModified: legal,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
