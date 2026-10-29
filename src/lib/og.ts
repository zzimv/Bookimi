// OpenGraph для всех страниц: Next заменяет openGraph страницы целиком (не сливает с layout),
// поэтому type / site_name / locale / картинку собираем здесь и отдаём каждой странице.
import type { Metadata } from "next";

export const SITE_NAME = "БУКИМИ";

/** Картинка 1200×630 (PNG, src/app/og/route.ts): обложка-образец сюжета без данных покупателей. */
export function ogImage(slug?: string, alt = "БУКИМИ — персональная книга") {
  return { url: slug ? `/og?s=${encodeURIComponent(slug)}` : "/og", width: 1200, height: 630, alt, type: "image/png" };
}

export function og(o: { title?: string; description?: string; type?: "website" | "article"; slug?: string; path?: string; alt?: string } = {}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = ogImage(o.slug, o.alt ?? o.title);
  return {
    openGraph: {
      type: o.type ?? "website",
      locale: "ru_RU",
      siteName: SITE_NAME,
      ...(o.title ? { title: o.title } : {}),
      ...(o.description ? { description: o.description } : {}),
      ...(o.path ? { url: o.path } : {}),
      images: [image],
    },
    twitter: { card: "summary_large_image", ...(o.title ? { title: o.title } : {}), ...(o.description ? { description: o.description } : {}), images: [image.url] },
  };
}
