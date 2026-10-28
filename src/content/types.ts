// Контракты контент-движка БУКИМИ (владелец — агент 1, архитектор).
// Все контент-модули (сюжеты, стили текста и картинок, настроения, темы демо) обязаны
// соответствовать этим типам. Менять файл может только архитектор / интегратор (агент 11).
// Спецификация меток, правила и таблица владельцев — docs/content/ARCHITECTURE.md.
//
// Чистые типы и константы без импортов из lib/ — модуль безопасен для клиента и демо-бандла.

import type { AudienceKey } from "./profiles";

export type { AudienceKey };

// ---------------------------------------------------------------------------
// Герой
// ---------------------------------------------------------------------------

/** Кого рисуем главным героем. Определяет поля анкеты, промпт Qwen и демо-рисовальщик. */
export type HeroKind = "child" | "teen" | "adult" | "pet";

export const HERO_KIND_BY_AUDIENCE: Record<AudienceKey, HeroKind> = {
  CHILD: "child",
  TEEN: "teen",
  ADULT: "adult",
  PET: "pet",
};

/**
 * Роли доп. героев (ДОП1..ДОП3). Старые роли анкеты (sibling, mom, dad, grandma, grandpa, pet)
 * сохранены. custom — «свой вариант»: любое существо или предмет (дерево, робот, машина).
 */
export const EXTRA_ROLES = [
  "sibling",
  "mom",
  "dad",
  "grandma",
  "grandpa",
  "pet",
  "partner",
  "friend",
  "toy",
  "child",
  "grandchild",
  "owner",
  "colleague",
  "custom",
] as const;
export type ExtraRole = (typeof EXTRA_ROLES)[number];

/** Как рисовать доп. героя в демо: человек (по возрасту), питомец или предмет/существо. */
export type ExtraDrawKind = HeroKind | "toy" | "custom";

// ---------------------------------------------------------------------------
// Сюжет
// ---------------------------------------------------------------------------

export interface PlotSpread {
  /**
   * Текст разворота по-русски с метками ({ГЕРОЙ.им}, {Р:|а}…). Это и текст демо-книги,
   * и план для YandexGPT. В стихах строки разделяются "\n"; метка имени не стоит в конце строки.
   */
  text: string;
  /** Сцена для иллюстрации, EN, без имён: «the child…», «the dog…», «the couple…». */
  scene: string;
}

/** Как вплести повод в разворот 1 (opening) и 12 (closing). Тексты — с метками, в голосе сюжета. */
export interface OccasionHook {
  /** Добавляется в начало текста разворота 1 (отдельной фразой/строфой). */
  opening: string;
  /** Добавляется в конец текста разворота 12. */
  closing: string;
  /** EN-добавка к сцене разворота 1 (реквизит повода: «a decorated New Year tree»). */
  openingScene?: string;
  /** EN-добавка к сцене разворота 12. */
  closingScene?: string;
}

/**
 * Ключ — ключ повода из OCCASIONS (profiles.ts) или "default".
 * "default" — шаблон в голосе сюжета для любых поводов без своего крючка; обязан содержать {ПОВОД}.
 * Порядок выбора: hooks[повод] → hooks.default → общий крючок из occasions.ts. Для "bez" — только hooks.bez.
 */
export type OccasionHooks = Partial<Record<string, OccasionHook>>;

export interface PlotExtras {
  /** Какие роли доп. героев подходят сюжету (первые — лучшие). */
  roles: ExtraRole[];
  /** Минимум доп. героев. Если текст разворотов использует {ДОПn…}, min должен быть ≥ n. */
  min: number;
  /** Максимум (≤ 3). */
  max: number;
  /** Подсказка для анкеты: «Вторая половинка — обязательно», «Хозяева питомца». */
  note?: string;
}

export interface Plot {
  /** Латиница, kebab-case, уникален во всём каталоге. */
  slug: string;
  audience: AudienceKey;
  /** id сегментов из SEGMENTS той же аудитории. */
  segments: string[];
  /** Название; может содержать [Имя] — заменяется на {ГЕРОЙ.им}. */
  title: string;
  tagline: string;
  description: string;
  /** Возраст героя — для детей и подростков (обязателен для CHILD и TEEN). */
  ageMin?: number;
  ageMax?: number;
  /** Ключи поводов из OCCASIONS, для которых сюжет особенно хорош (первый — главный). */
  occasions: string[];
  /** Голос книги — один id из TEXT_STYLE_IDS. */
  textStyle: string;
  /** Рекомендуемые стили картинок, id из ART_STYLE_IDS, лучший первый. */
  artStyles: string[];
  /** Ключ демо-темы из DEMO_THEME_KEYS. */
  theme: string;
  heroKind: HeroKind;
  extras: PlotExtras;
  /** Обложка: EN, без имён. */
  coverScene: string;
  /** Ровно 12 разворотов. */
  spreads: PlotSpread[];
  occasionHooks?: OccasionHooks;
  /** Увлечения из анкеты, которые сюжет особенно подхватывает (для подбора). */
  interests?: string[];
  /** null/undefined — для любого пола. */
  gender?: "boy" | "girl" | null;
}

export interface PlotFilter {
  audience?: AudienceKey;
  segment?: string;
  occasion?: string;
  heroKind?: HeroKind;
  /** Возраст героя — оставляет сюжеты, где ageMin ≤ age ≤ ageMax (если они заданы). */
  age?: number;
  textStyle?: string;
}

// ---------------------------------------------------------------------------
// Стиль текста (голос книги для YandexGPT)
// ---------------------------------------------------------------------------

export interface TextStyle {
  id: string;
  title: string;
  oneLine: string;
  audiences: AudienceKey[];
  /** Полный системный промпт YandexGPT для этого голоса (включая общие жёсткие правила). */
  systemPrompt: string;
  /** Короткие правила голоса — для админки и проверки. */
  rules: string[];
  /** 4–8 строк оригинального текста в этом голосе, с метками. */
  example: string;
  verse: boolean;
}

// ---------------------------------------------------------------------------
// Стиль картинок
// ---------------------------------------------------------------------------

export type DemoLine = "thin" | "bold" | "sketch" | "none";
export type DemoTexture = "paper" | "grain" | "halftone" | "none";

export interface ArtStyleDemo {
  palette: { paper: string; ink: string; accents: string[] };
  line: DemoLine;
  texture: DemoTexture;
  /** id SVG-фильтра из render.ts (wobble, grain, posterize, soft) или подсказка. */
  filter?: string;
}

export interface ArtStyle {
  id: string;
  title: string;
  /** Для покупателя, по-русски. */
  description: string;
  audiences: AudienceKey[];
  /** EN, позитивный промпт стиля для Qwen. Только техника — без имён художников и брендов. */
  prompt: string;
  /** EN, негатив для Qwen. */
  negative: string;
  demo: ArtStyleDemo;
}

// ---------------------------------------------------------------------------
// Настроение картинок
// ---------------------------------------------------------------------------

export interface Mood {
  id: string;
  title: string;
  oneLine: string;
  /** EN, добавка к промпту Qwen. */
  promptAdd: string;
  /** EN, добавка к негативу. */
  negativeAdd: string;
  demo: {
    /** Цвет тонировки (#rrggbb) поверх иллюстрации, мягко. */
    tint: string;
    /** Множитель насыщенности: 1 — без изменений. */
    saturation: number;
    /** Множитель яркости: 1 — без изменений. */
    brightness: number;
    /** Доп. декор поверх: искры, сердечки, конфетти… (рисует applyMood). */
    extraDeco?: DemoDeco;
  };
}

// ---------------------------------------------------------------------------
// Демо-иллюстрации (SVG без GPU)
// ---------------------------------------------------------------------------

/** Виды декора, которые умеет рисовать общий рендер (render.ts). */
export type DemoDeco =
  | "snow"
  | "flags"
  | "stars"
  | "bubbles"
  | "moon"
  | "leaves"
  | "hearts"
  | "confetti"
  | "sparkles"
  | "paws"
  | "grid"
  | "clouds"
  | "none";

export interface DemoSceneCtx {
  W: number;
  H: number;
  /** 0 — обложка, 1..12 — развороты. */
  index: number;
  theme: DemoTheme;
  style: ArtStyleDemo;
  /** Детерминированный генератор 0..1. */
  rnd: () => number;
}

/** Рисует фон разворота (под героями). Возвращает фрагмент SVG. */
export type DemoScene = (ctx: DemoSceneCtx) => string;

export interface DemoTheme {
  /** Ключ из DEMO_THEME_KEYS. */
  key: string;
  sky: [string, string];
  ground: string;
  accent: string;
  deco: DemoDeco;
  /** Свой фон вместо стандартного (небо + холм + декор). */
  scene?: DemoScene;
}

/** Внешность для демо-рисовальщиков. Все поля необязательны. */
export interface DemoLook {
  gender?: string; // boy | girl (для питомца — он/она)
  age?: number;
  hair?: string; // как в анкете: «светлые», «рыжие», «седые»…
  hairstyle?: string;
  longHair?: boolean;
  skin?: string; // «светлый», «смуглый», «тёмный»
  glasses?: boolean;
  freckles?: boolean;
  beard?: boolean;
  outfit?: string; // цвет одежды #rrggbb
  species?: "dog" | "cat" | string;
  breed?: string;
  furColor?: string; // как в анкете: «рыжий», «чёрный с белым»
  /** Для custom/toy: что это (tree, robot, car, bear…). */
  thing?: string;
}

export interface DemoHeroOpts {
  kind: HeroKind;
  look: DemoLook;
  /** Точка опоры — середина ступней / лап. */
  x: number;
  y: number;
  scale: number;
  style: ArtStyleDemo;
  /** Номер разворота — для разнообразия поз и цветов. */
  index?: number;
  /** Смотрит влево. */
  flip?: boolean;
}

export type DemoHeroDrawer = (opts: DemoHeroOpts) => string;

export interface DemoExtra {
  /** Как рисовать; если не задано — по роли (extraDrawKind в art/index.ts). */
  kind?: ExtraDrawKind;
  role: ExtraRole | string;
  look: DemoLook;
}

// ---------------------------------------------------------------------------
// Каталог ключей демо-тем. Сюжеты ссылаются только на эти ключи; художники аудитории
// обязаны реализовать все ключи со своим owner. Новые ключи — через «requests» интегратору.
// ---------------------------------------------------------------------------

export const DEMO_THEME_KEYS = [
  // агент 3 (art/kids.ts)
  { key: "winter", owner: "kids", hint: "зимний лес, снег, ночь под Новый год" },
  { key: "kingdom", owner: "kids", hint: "сказочное королевство, замок, флажки, праздник" },
  { key: "dragon", owner: "kids", hint: "ночной сад, звёзды, волшебство" },
  { key: "ocean", owner: "kids", hint: "подводный мир, пузырьки, кораллы" },
  { key: "sleep", owner: "kids", hint: "вечер, луна, сон" },
  { key: "forest", owner: "kids", hint: "дневной лес, тропинки, зверята" },
  { key: "space", owner: "kids", hint: "космос, планеты, ракета" },
  { key: "school", owner: "kids", hint: "школа, класс, книги, первый звонок" },
  { key: "meadow", owner: "kids", hint: "летний луг, цветы, солнце" },
  { key: "dino", owner: "kids", hint: "доисторическая долина, папоротники, вулкан вдали" },
  // агент 5 (art/teens.ts)
  { key: "game-world", owner: "teens", hint: "мир-игра, пиксели, платформы, уровни" },
  { key: "city-night", owner: "teens", hint: "ночной город, огни, крыши" },
  { key: "orbit", owner: "teens", hint: "орбитальная станция, Земля в иллюминаторе" },
  { key: "mountains", owner: "teens", hint: "горы, тропа, карта сокровищ" },
  { key: "museum", owner: "teens", hint: "музей ночью, витрины, тайна" },
  { key: "stage", owner: "teens", hint: "сцена, прожекторы, концерт" },
  // агент 7 (art/adults.ts)
  { key: "romance-city", owner: "adults", hint: "вечерний город для двоих, фонари, мосты" },
  { key: "travel-map", owner: "adults", hint: "карта путешествия, пунктир маршрута, чемоданы" },
  { key: "office", owner: "adults", hint: "офис, бумаги, кофе, окна в город" },
  { key: "dacha", owner: "adults", hint: "дача, грядки, яблони, самовар" },
  { key: "home", owner: "adults", hint: "уютный дом, кухня, семейный стол" },
  { key: "celebration", owner: "adults", hint: "праздничный зал, гирлянды, торт, бокалы с соком" },
  { key: "starry-sky", owner: "adults", hint: "звёздное небо, маленькая планета, мечта" },
  // агент 9 (art/pets.ts)
  { key: "pet-home", owner: "pets", hint: "квартира глазами питомца: диван, миска, плед" },
  { key: "park", owner: "pets", hint: "парк, дорожки, листья, мячик" },
  { key: "yard", owner: "pets", hint: "двор, скамейки, клумбы" },
  { key: "pet-night", owner: "pets", hint: "ночь в доме, подоконник, луна" },
  { key: "seaside", owner: "pets", hint: "море, пляж, ракушки" },
] as const;

export type DemoThemeKey = (typeof DEMO_THEME_KEYS)[number]["key"];

/** Тема, на которую откатывается рендер, если ключ ещё не реализован. */
export const FALLBACK_THEME_KEY: DemoThemeKey = "meadow";

// ---------------------------------------------------------------------------
// Владельцы стилей картинок (кто описывает ArtStyle с этим id).
// ---------------------------------------------------------------------------

export const ART_STYLE_OWNERS: Record<string, "kids" | "teens" | "adults" | "pets"> = {
  "watercolor-air": "kids",
  "kind-classic": "kids",
  "folk-lubok": "kids",
  "ink-humor": "kids",
  "cozy-detail": "kids",
  "naive-watercolor": "kids",
  "pen-ink-1920s": "kids",
  "graphic-novel": "teens",
  "painterly-fantasy": "teens",
  "risograph-zine": "teens",
  linocut: "adults",
  "retro-poster": "adults",
  "soft-gouache": "pets",
  "pet-cartoon": "pets",
  "vintage-postcard": "pets",
};
