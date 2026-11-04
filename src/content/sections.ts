// Повод → разделы каталога (core / «Своя история» / fits / остальные). Чистая логика без промптов и планов:
// её зовут и сервер (registry.plotSections), и анкета в браузере (QuizWizard, шаг «Книга»), и демо-стенд —
// поэтому сайт, страница повода и анкета показывают книги в одном порядке.

/** Что нужно знать о сюжете для разделов повода (проекция Plot, безопасна для клиента). */
export interface SectionPlot {
  slug: string;
  occasions: string[];
  /** Поводы, для которых сюжет написан: plot.coreOccasions ∪ ключи пустых крючков. */
  core: string[];
  /** Ключи своих крючков сюжета (plot.occasionHooks). */
  hooks: string[];
}

export type Relevance = "core" | "fits" | "generic";

/**
 * «Своя история» (книга по своей идее) — rev 20: решение владелицы 03.11.2026 — убрана из пути покупателя везде
 * (шаг «Книга», каталог, главная, страницы поводов, SEO, демо); сервер не создаёт такие книги. Код оставлен спящим:
 * включить — true (и проверить тексты поводов и тесты). Модуль безопасен для клиента.
 */
export const CUSTOM_STORY_ENABLED = false as boolean;

/**
 * Поводы с сильной темой: в каталоге — только core, «Своя история» и fits («Тоже подойдут»);
 * чужие сюжеты скрыты (никакой подводной лодки на выпускной в детском саду).
 */
export const STRONG_OCCASIONS = [
  "vypusknoj-v-sadu",
  "pervyj-klass",
  "okonchanie-nachalnoj-shkoly",
  "vypusknoj-v-shkole",
  "rozhdenie-brata-ili-sestry",
  "svadba",
  "godovshchina",
  "pensiya",
  "poyavlenie-pitomca",
  "novyj-god",
  "den-rozhdeniya",
] as const;

/** Без повода и свой повод: «Своя история» первой, затем все сюжеты. */
export const OPEN_OCCASIONS = ["bez", "svoj", ""] as const;

/** Родственные поводы: книги про Новый год «тоже подходят» к Рождеству и Старому Новому году. */
export const RELATED_OCCASIONS: Record<string, string> = { rozhdestvo: "novyj-god", "staryj-novyj-god": "novyj-god" };

export const FITS_TITLE = "Тоже подойдут — впишем ваш повод";

export function relevanceOf(p: SectionPlot, occasionKey: string): Relevance {
  if (p.core.includes(occasionKey)) return "core";
  if (p.occasions.includes(occasionKey) || p.hooks.includes(occasionKey)) return "fits";
  const rel = RELATED_OCCASIONS[occasionKey];
  if (rel && relevanceOf(p, rel) !== "generic") return "fits";
  return "generic";
}

export interface Sections<T> {
  occasion: string;
  /** Сильная тема: generic-сюжеты скрыты (если для повода нет ни core, ни fits — не скрываем, strong = false). */
  strong: boolean;
  /** Показывать «Своя история» до core (без повода, свой повод, нет core-сюжетов). */
  customFirst: boolean;
  core: T[];
  /** Карточка «Своя история» (rev 20: выключена — CUSTOM_STORY_ENABLED). */
  custom: boolean;
  fits: T[];
  fitsTitle: string;
  /** Остальные (для поводов без сильной темы и для «без повода»/«своего»). */
  others: T[];
  /** Сколько сюжетов скрыто (сильная тема). */
  hiddenCount: number;
  /** Скрытые сюжеты — для кнопки «Показать все книги (N)». */
  hidden: T[];
}

/** Разделы повода по уже отфильтрованному пулу (аудитория, сегмент, возраст). */
export function sectionsOf<T extends SectionPlot>(pool: T[], occasionKey: string): Sections<T> {
  const key = occasionKey ?? "";
  const base = { occasion: key, custom: CUSTOM_STORY_ENABLED, fitsTitle: FITS_TITLE };
  if ((OPEN_OCCASIONS as readonly string[]).includes(key)) {
    // «Без повода»: сюжеты с bez в occasions — первыми
    const others = key === "bez" ? [...pool.filter((p) => p.occasions.includes("bez")), ...pool.filter((p) => !p.occasions.includes("bez"))] : pool;
    return { ...base, strong: false, customFirst: true, core: [], fits: [], others, hiddenCount: 0, hidden: [] };
  }
  const rank = (p: T) => {
    const i = p.occasions.indexOf(key);
    return i < 0 ? 100 : i;
  };
  const by = (r: Relevance) =>
    pool
      .map((p, i) => ({ p, i }))
      .filter((x) => relevanceOf(x.p, key) === r)
      .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
      .map((x) => x.p);
  const core = by("core");
  const fits = by("fits");
  const generic = by("generic");
  // Сильная тема прячет чужие сюжеты — но не оставляет пустой каталог (тогда это пробел контента, см. OCCASIONS-MATRIX.md)
  const strong = (STRONG_OCCASIONS as readonly string[]).includes(key) && core.length + fits.length > 0;
  return { ...base, strong, customFirst: core.length === 0, core, fits, others: strong ? [] : generic, hiddenCount: strong ? generic.length : 0, hidden: strong ? generic : [] };
}

/** Порядок показа разделов: customFirst ? [custom, core, fits, others] : [core, custom, fits, others]. */
export function sectionOrder(s: Pick<Sections<unknown>, "customFirst"> & { custom?: boolean }): ("custom" | "core" | "fits" | "others")[] {
  const order: ("custom" | "core" | "fits" | "others")[] = s.customFirst ? ["custom", "core", "fits", "others"] : ["core", "custom", "fits", "others"];
  return s.custom === false || !CUSTOM_STORY_ENABLED ? order.filter((x) => x !== "custom") : order;
}
