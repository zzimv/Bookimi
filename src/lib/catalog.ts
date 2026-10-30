import { db, hasDatabase } from "./db";
import { AGE_PAGES, OCCASIONS, PDF_PRICE, plotAges } from "./catalog-defaults";

export { plotAges };
import { PLOTS } from "../content/registry";
import { themeFor } from "../content/art/index";
import type { AudienceKey } from "../content/profiles";
import { titleForCatalog } from "../content/title";
import type { HeroKind, Plot, PlotExtras } from "../content/types";

// Публичный срез каталога: без шаблонов текста, системных промптов и планов сцен (они остаются на сервере).
// Источник — таблица Story (правится в админке); если БД пуста или недоступна — сюжеты из реестра контента.
export interface PublicStory {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  audience: AudienceKey;
  segments: string[];
  heroKind: HeroKind;
  /** Голос книги (id из TEXT_STYLE_IDS). */
  textStyle: string | null;
  /** Рекомендуемые стили картинок, лучший первый. */
  artStyles: string[];
  /** Ключи поводов, главный первый. */
  occasions: string[];
  ageMin: number;
  ageMax: number;
  /** Главный повод (первый из occasions) — для фильтров каталога. */
  occasionSlug: string | null;
  /** Ключ демо-темы (DEMO_THEME_KEYS) — обложка-заглушка. */
  coverTheme: string;
  /** Цвета обложки-заглушки для тем без своей картинки. */
  coverColors: { sky: [string, string]; ground: string; accent: string };
  coverUrl: string | null;
  /** Доп. герои сюжета: роли, минимум/максимум, подсказка анкете. */
  extras: PlotExtras;
  interests: string[];
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

function colors(theme: string) {
  const t = themeFor(theme);
  return { sky: t.sky, ground: t.ground, accent: t.accent };
}

function fromPlot(p: Plot): PublicStory {
  const [ageMin, ageMax] = plotAges(p);
  return {
    slug: p.slug,
    title: p.title,
    tagline: p.tagline,
    description: p.description,
    audience: p.audience,
    segments: p.segments,
    heroKind: p.heroKind,
    textStyle: p.textStyle,
    artStyles: p.artStyles,
    occasions: p.occasions,
    ageMin,
    ageMax,
    occasionSlug: p.occasions[0] ?? null,
    coverTheme: p.theme,
    coverColors: colors(p.theme),
    coverUrl: null,
    extras: p.extras,
    interests: p.interests ?? [],
  };
}

const fallbackStories: PublicStory[] = PLOTS.map(fromPlot);

export interface StoryFilter {
  audience?: AudienceKey;
  segment?: string;
}

const applyFilter = (list: PublicStory[], f: StoryFilter) =>
  list.filter((s) => (!f.audience || s.audience === f.audience) && (!f.segment || s.segments.includes(f.segment)));

export async function getStories(f: StoryFilter = {}): Promise<PublicStory[]> {
  if (!hasDatabase) return applyFilter(fallbackStories, f);
  try {
    const rows = await db.story.findMany({
      where: { isActive: true, ...(f.audience ? { audience: f.audience } : {}) },
      orderBy: { sortOrder: "asc" },
      include: { occasion: { select: { slug: true } } },
    });
    if (rows.length === 0) return applyFilter(fallbackStories, f);
    const bySlug = new Map(PLOTS.map((p) => [p.slug, p]));
    return applyFilter(
      rows.map((r) => {
        const plot = bySlug.get(r.slug);
        const occasions = r.occasions.length ? r.occasions : r.occasion ? [r.occasion.slug] : [];
        return {
          slug: r.slug,
          title: r.title,
          tagline: r.tagline,
          description: r.description,
          audience: r.audience as AudienceKey,
          segments: r.segments,
          heroKind: r.heroKind as HeroKind,
          textStyle: r.textStyle,
          artStyles: r.artStyles,
          occasions,
          ageMin: r.ageMin,
          ageMax: r.ageMax,
          occasionSlug: occasions[0] ?? null,
          coverTheme: r.coverTheme,
          coverColors: colors(r.coverTheme),
          coverUrl: r.coverUrl,
          extras: plot?.extras ?? { roles: [], min: 0, max: 3 },
          interests: plot?.interests ?? [],
          seoTitle: r.seoTitle,
          seoDescription: r.seoDescription,
        };
      }),
      f,
    );
  } catch {
    return applyFilter(fallbackStories, f);
  }
}

export async function getStory(slug: string) {
  return (await getStories()).find((s) => s.slug === slug) ?? null;
}

/**
 * Сюжеты для повода: сначала те, у кого повод в occasions (главный — выше), затем остальные
 * той же аудитории (любой сюжет дарится на любой повод — крючки вплетаются при генерации).
 */
export async function getStoriesForOccasion(occasionKey: string, audience?: AudienceKey): Promise<PublicStory[]> {
  const list = await getStories(audience ? { audience } : {});
  const rank = (s: PublicStory) => {
    const i = s.occasions.indexOf(occasionKey);
    return i < 0 ? 1000 : i;
  };
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map((x) => x.s);
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

/** Допы для книг аудитории (витрина: блок цены на странице книги). Без БД — значения по умолчанию. */
export async function getAddonsFor(audience: AudienceKey): Promise<{ key: string; title: string; priceRub: number | null; kind: string; requiresPrint: boolean }[]> {
  const { ADDONS } = await import("./catalog-defaults");
  const { addonsForAudience } = await import("./addons-core");
  const fallback = () => addonsForAudience(ADDONS.filter((a) => a.active).map((a) => ({ key: a.key as string, title: a.title as string, priceRub: a.price as number | null, kind: a.kind as string, requiresPrint: a.print as boolean, audiences: [...a.audiences] as string[] })), audience);
  if (!hasDatabase) return fallback();
  try {
    const rows = await db.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    if (!rows.length) return fallback();
    const { cfg } = await import("./settings");
    const [flags, cartoon, audio] = await Promise.all([cfg("flags"), cfg("cartoon"), cfg("audio")]);
    return addonsForAudience(rows, audience)
      .filter((a) => flags.printEnabled || !a.requiresPrint)
      .filter((a) => cartoon.enabled || !a.key.startsWith("cartoon"))
      .filter((a) => a.key !== "audio-self" || audio.selfReadEnabled)
      .map((a) => ({ key: a.key, title: a.title, kind: a.kind, requiresPrint: a.requiresPrint, priceRub: a.key === "cartoon" ? cartoon.priceRub : a.key === "audiobook" ? audio.ttsPriceRub : a.priceRub }));
  } catch {
    return fallback();
  }
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

export function ageLabel(min: number, max: number, audience: AudienceKey = "CHILD") {
  if (audience === "ADULT") return "Для взрослых";
  if (audience === "PET") return "Собакам и кошкам";
  const n = max % 100;
  const unit = n % 10 >= 2 && n % 10 <= 4 && (n < 12 || n > 14) ? "года" : "лет";
  return `${min}–${max} ${unit}`;
}

export const HERO_WORD: Record<AudienceKey, string> = { CHILD: "Ваш ребёнок", TEEN: "Ваш герой", ADULT: "Ваш герой", PET: "Ваш питомец" };

/** Название для витрины без имени — общий помощник src/content/title.ts (падеж по предлогу). */
export function displayTitle(title: string, audience: AudienceKey = "CHILD") {
  return titleForCatalog(title, audience);
}

export const rub = (n: number) => `${n.toLocaleString("ru-RU").replace(/[,\s]/g, "\u00a0")}\u00a0₽`;
