import { db, hasDatabase } from "./db";
import {
  AGE_PAGES,
  OCCASIONS,
  STORIES,
  PDF_PRICE,
  type CoverTheme,
} from "./catalog-defaults";

// Публичный срез каталога: без шаблонов текста и промптов (они остаются на сервере).
export interface PublicStory {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  ageMin: number;
  ageMax: number;
  occasionSlug: string | null;
  coverTheme: CoverTheme;
  coverUrl: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface PublicOccasion {
  slug: string;
  title: string;
  h1: string;
  intro: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

const fallbackStories: PublicStory[] = STORIES.map((s) => ({ ...s, coverUrl: null }));

export async function getStories(): Promise<PublicStory[]> {
  if (!hasDatabase) return fallbackStories;
  try {
    const rows = await db.story.findMany({
      where: { isActive: true, audience: "CHILD" },
      orderBy: { sortOrder: "asc" },
      include: { occasion: { select: { slug: true } } },
    });
    if (rows.length === 0) return fallbackStories;
    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      tagline: r.tagline,
      description: r.description,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      occasionSlug: r.occasion?.slug ?? null,
      coverTheme: r.coverTheme as CoverTheme,
      coverUrl: r.coverUrl,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
    }));
  } catch {
    return fallbackStories;
  }
}

export async function getStory(slug: string) {
  return (await getStories()).find((s) => s.slug === slug) ?? null;
}

export async function getOccasions(): Promise<PublicOccasion[]> {
  if (!hasDatabase) return OCCASIONS;
  try {
    const rows = await db.occasion.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return rows.length ? rows : OCCASIONS;
  } catch {
    return OCCASIONS;
  }
}

export async function getOccasion(slug: string) {
  return (await getOccasions()).find((o) => o.slug === slug) ?? null;
}

export function getAgePage(slug: string) {
  return AGE_PAGES.find((a) => a.slug === slug) ?? null;
}

/** Минимальная цена «от N ₽» для карточки — из БД. */
export async function getMinPrice(): Promise<number> {
  if (!hasDatabase) return PDF_PRICE;
  try {
    const f = await db.productFormat.findFirst({ where: { isActive: true }, orderBy: { priceRub: "asc" } });
    return f?.priceRub ?? PDF_PRICE;
  } catch {
    return PDF_PRICE;
  }
}

export async function getPriceTable() {
  const { FORMATS } = await import("./catalog-defaults");
  if (!hasDatabase) return FORMATS.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price }));
  try {
    const rows = await db.productFormat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    if (rows.length) return rows.map((r) => ({ key: r.key, kind: r.kind, title: r.title, priceRub: r.priceRub }));
  } catch {}
  return FORMATS.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price }));
}

export async function getApprovedReviews() {
  if (!hasDatabase) return [];
  try {
    return await db.review.findMany({
      where: { status: "approved" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, authorName: true, rating: true, text: true, storySlug: true },
    });
  } catch {
    return [];
  }
}

export function ageLabel(min: number, max: number) {
  return `Возраст ${min}–${max}`;
}

export function displayTitle(title: string) {
  return title.replace("[Имя]", "Ваш ребёнок");
}

export const rub = (n: number) => `${n.toLocaleString("ru-RU").replace(/,/g, " ")} ₽`;
