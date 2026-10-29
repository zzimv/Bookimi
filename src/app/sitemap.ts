import type { MetadataRoute } from "next";
import { getOccasions, getStories } from "@/lib/catalog";
import { AGE_PAGES } from "@/lib/catalog-defaults";
import { db, hasDatabase } from "@/lib/db";
import { LEGAL } from "@/lib/legal";
import { AUDIENCE_PAGES, SVOYA_IDEYA } from "@/lib/storefront";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  const [stories, occasions] = await Promise.all([getStories(), getOccasions()]);
  const posts = hasDatabase ? await db.blogPost.findMany({ where: { publishedAt: { not: null } }, select: { slug: true, updatedAt: true } }).catch(() => []) : [];
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/skazki`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...AUDIENCE_PAGES.map((a) => ({ url: `${base}/dlya/${a.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    { url: `${base}/povody`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/prazdniki`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...occasions.map((o) => ({ url: `${base}/povod/${o.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...stories.filter((s) => s.slug !== SVOYA_IDEYA).map((s) => ({ url: `${base}/skazki/${s.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...AGE_PAGES.map((a) => ({ url: `${base}/vozrast/${a.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...Object.keys(LEGAL).map((k) => ({
      url: `${base}/${k.startsWith("soglasie-") ? `soglasie/${k.replace("soglasie-", "").replace("rassylka", "rassylka")}` : k}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
