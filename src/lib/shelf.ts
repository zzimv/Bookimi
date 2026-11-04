// Полка на первом экране главной (макет владелицы, rev 06): книги-корешки и две обложки лицом.
// Здесь — только данные и куда ведёт каждая книга; рисунок — src/components/Shelf.tsx. Модуль чистый (без БД):
// его проверяют тесты (tests/shelf.test.ts), а «скоро» приходит из настроек (storefront.soon).
import { OCCASIONS, type AudienceKey } from "../content/profiles";
import type { Settings } from "./settings";

export type SoonSettings = Settings["storefront"]["soon"];

export interface ShelfItem {
  /** Ключ в настройках storefront.soon.shelf. */
  id: string;
  /** Подпись на корешке; у обложки — вторая строка («Дочери», «Новому году»). */
  title: string;
  /** Обложка лицом: первая строка («Книга для», «Книга к»). */
  coverLead?: string;
  /** Полное название для экранного диктора. */
  label: string;
  audience: AudienceKey;
  /** Анкета с готовыми ответами. */
  href: string;
  /** Пока «скоро» — страница аудитории с плашкой «Скоро…» (книги «скоро»-аудиторий покупателю не показываем). */
  soonHref: string;
}

// Слева направо, как на макете
export const SHELF: ShelfItem[] = [
  { id: "syn", title: "Сын", label: "Книга для сына", audience: "CHILD", href: "/sozdat?dlya=CHILD&pol=boy", soonHref: "/dlya/detyam" },
  { id: "pervyj-klass", title: "Первый класс", label: "Книга к первому классу", audience: "CHILD", href: "/sozdat?dlya=CHILD&povod=pervyj-klass", soonHref: "/skazki?dlya=detyam&povod=pervyj-klass" },
  { id: "doch", title: "Дочери", coverLead: "Книга для", label: "Книга для дочери", audience: "CHILD", href: "/sozdat?dlya=CHILD&pol=girl", soonHref: "/dlya/detyam" },
  { id: "babushka", title: "Бабушка", label: "Книга для бабушки", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-grandparent&pol=girl", soonHref: "/dlya/vzroslym" },
  { id: "den-rozhdeniya", title: "День рождения", label: "Книга на день рождения", audience: "CHILD", href: "/sozdat?povod=den-rozhdeniya", soonHref: "/skazki?povod=den-rozhdeniya" },
  { id: "mama", title: "Мама", label: "Книга для мамы", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-parent&pol=girl", soonHref: "/dlya/vzroslym" },
  { id: "brat-sestra", title: "Брат или сестра", label: "Книга к рождению брата или сестры", audience: "CHILD", href: "/sozdat?dlya=CHILD&povod=rozhdenie-brata-ili-sestry", soonHref: "/skazki?dlya=detyam&povod=rozhdenie-brata-ili-sestry" },
  { id: "papa", title: "Папа", label: "Книга для папы", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-parent&pol=boy", soonHref: "/dlya/vzroslym" },
  { id: "pitomec", title: "Питомец", label: "Книга о питомце", audience: "PET", href: "/sozdat?dlya=PET", soonHref: "/dlya/pitomcam" },
  { id: "novyj-god", title: "Новому году", coverLead: "Книга к", label: "Книга к Новому году", audience: "CHILD", href: "/sozdat?povod=novyj-god", soonHref: "/skazki?povod=novyj-god" },
  { id: "vypusknoj", title: "Выпускной в саду", label: "Книга к выпускному в детском саду", audience: "CHILD", href: "/sozdat?dlya=CHILD&povod=vypusknoj-v-sadu", soonHref: "/skazki?dlya=detyam&povod=vypusknoj-v-sadu" },
  { id: "dedushka", title: "Дедушка", label: "Книга для дедушки", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-grandparent&pol=boy", soonHref: "/dlya/vzroslym" },
  { id: "lyubimomu", title: "Любимому", label: "Книга любимому", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-couple&pol=boy", soonHref: "/dlya/vzroslym" },
  { id: "podruge", title: "Подруге", label: "Книга подруге", audience: "ADULT", href: "/sozdat?dlya=ADULT&segment=adult-friend&pol=girl", soonHref: "/dlya/vzroslym" },
];

export interface ShelfLink extends ShelfItem {
  soon: boolean;
  /** Куда ведёт сейчас: анкета или (пока «скоро») примеры. */
  to: string;
}

/** Полка с учётом «скоро»: книга отмечена сама или её аудитория «скоро» → ведёт на страницу «скоро», остальные — в анкету. */
export function shelfLinks(soon: SoonSettings): ShelfLink[] {
  return SHELF.map((it) => {
    const s = Boolean(soon.shelf?.[it.id]) || Boolean(soon[it.audience]);
    return { ...it, soon: s, to: s ? it.soonHref : it.href };
  });
}

export const AUDIENCE_KEYS: AudienceKey[] = ["CHILD", "TEEN", "ADULT", "PET"];

/** Аудитории, которые пока «скоро». */
export const soonAudiences = (soon: SoonSettings): AudienceKey[] => AUDIENCE_KEYS.filter((k) => Boolean(soon[k]));
/** Аудитории, которые продаются. */
export const liveAudiences = (soonList: readonly AudienceKey[]): AudienceKey[] => AUDIENCE_KEYS.filter((k) => !soonList.includes(k));

/**
 * Единственное правило «что видит покупатель» (решение владелицы 02.11.2026): книги аудиторий «скоро» не показываются
 * нигде — каталог, полки, поводы, праздники, поиск, sitemap, главная. Сюжеты остаются в репозитории и в админке.
 */
export function visiblePlots<T extends { audience: AudienceKey | string }>(list: readonly T[], soonList: readonly AudienceKey[]): T[] {
  return list.filter((p) => !soonList.includes(p.audience as AudienceKey));
}

/** Повод живой, если у него есть хотя бы одна продающаяся аудитория (неизвестный ключ — живой: свой праздник из админки). */
export function occasionIsLive(key: string, soonList: readonly AudienceKey[]): boolean {
  const o = OCCASIONS.find((x) => x.key === key);
  return !o || o.audiences.some((a) => !soonList.includes(a));
}

const FOR: Record<AudienceKey, string> = { CHILD: "для детей", TEEN: "для подростков", ADULT: "для взрослых", PET: "о питомцах" };

/** Плашка на странице аудитории и в каталоге. */
export const soonNote = (audience: AudienceKey) => `Скоро — книги ${FOR[audience]} готовим к запуску. Сейчас можно создать сказку для ребёнка от 0 до 9 лет`;
/** Ответ анкеты и /api/books, если аудитория «скоро». */
export const soonCreateError = (audience: AudienceKey) => `Скоро: книги ${FOR[audience]} готовим к запуску. Пока можно создать сказку для ребёнка.`;
/** Подпись под выключенной кнопкой «Создать». */
export const SOON_SHORT = "Скоро — готовим к запуску";
