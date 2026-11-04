// Палитра книги под настроение названия (rev 20): цвет названия на обложке, чернила и акценты «сказочных» страниц
// (приветствие, посвящение, финал, задняя обложка) и акценты текста на картинке (буквица, ключевые слова).
// У сюжета — необязательное поле palette (имя готовой палитры или свои цвета поверх неё); нет — по теме сюжета.
// Чистые данные без импортов из lib/: модуль безопасен для клиента и демо-бандла.

export interface BookPalette {
  /** Имя палитры (для админки и data-атрибута). */
  name: string;
  /** Подпись для владелицы: «Снежно-голубая с золотом». */
  title: string;
  /** Основной цвет текста на бумажных страницах. */
  ink: string;
  /** Ключевые слова, буквица. */
  accent: string;
  /** Орнамент, звёздочки, рамки. */
  orn: string;
  /** Фон бумажных страниц (приветствие, посвящение, финал). */
  paper: string;
  /** Название на светлой обложке («Классика», «Светлая рамка»). */
  cover: string;
  /** Название на тёмной обложке («Звёздная ночь»). */
  coverNight: string;
  /** Фон задней обложки. */
  back: string;
}

export const PALETTES: Record<string, BookPalette> = {
  classic: { name: "classic", title: "Классическая: синий и бордо", ink: "#1f3566", accent: "#8f2a3e", orn: "#c39a4a", paper: "#fdfaf2", cover: "#143628", coverNight: "#f3d27a", back: "#1f3566" },
  newyear: { name: "newyear", title: "Новогодняя: снежно-голубая с золотом", ink: "#1b3d6b", accent: "#b07d1f", orn: "#c9a14a", paper: "#f2f7fc", cover: "#1b3d6b", coverNight: "#f4d27c", back: "#1b3d6b" },
  birthday: { name: "birthday", title: "День рождения: тёплый коралл с золотом", ink: "#6e2b24", accent: "#d8553f", orn: "#d4a23a", paper: "#fff5ef", cover: "#b8402f", coverNight: "#ffc98a", back: "#8a3226" },
  dragon: { name: "dragon", title: "Дракон: ночная синь и звёздное золото", ink: "#1b2552", accent: "#b9862a", orn: "#e0b34a", paper: "#f5f4fb", cover: "#1b2552", coverNight: "#f3d27a", back: "#1b2552" },
  detective: { name: "detective", title: "Детектив: чернила и янтарь", ink: "#1f2430", accent: "#b86e0e", orn: "#d39a2c", paper: "#f8f3e7", cover: "#1f2430", coverNight: "#f0b54a", back: "#1f2430" },
  sea: { name: "sea", title: "Море: бирюза и песок", ink: "#0f4a53", accent: "#13808a", orn: "#d9a443", paper: "#eff8f7", cover: "#0d5560", coverNight: "#9fe3dc", back: "#0f4a53" },
  meadow: { name: "meadow", title: "Луг: зелень и маки", ink: "#2b4a25", accent: "#c0573a", orn: "#b89a3a", paper: "#f7f8ee", cover: "#2b4a25", coverNight: "#f3d27a", back: "#2b4a25" },
  sleepy: { name: "sleepy", title: "Сонная: лаванда и лунное золото", ink: "#2e2a5a", accent: "#7d55b0", orn: "#c7a453", paper: "#f6f4fb", cover: "#2e2a5a", coverNight: "#efd9a0", back: "#2e2a5a" },
  space: { name: "space", title: "Космос: глубокий синий и оранжевый", ink: "#1a2350", accent: "#cc5a26", orn: "#c9a14a", paper: "#f2f4fa", cover: "#1a2350", coverNight: "#ffb36b", back: "#1a2350" },
  forest: { name: "forest", title: "Лес: хвоя и брусника", ink: "#23402f", accent: "#9a3b2c", orn: "#b7913e", paper: "#f4f6ee", cover: "#23402f", coverNight: "#f3d27a", back: "#23402f" },
  ice: { name: "ice", title: "Лёд: морозно-голубая с серебром", ink: "#1d4466", accent: "#3a7fb5", orn: "#9fb6c9", paper: "#f1f7fb", cover: "#1d4466", coverNight: "#dff1ff", back: "#1d4466" },
  sunny: { name: "sunny", title: "Солнечная: синий двор и оранжевый", ink: "#2b3f63", accent: "#d9692a", orn: "#c79b3a", paper: "#f8f5ec", cover: "#2b3f63", coverNight: "#ffc078", back: "#2b3f63" },
  dino: { name: "dino", title: "Динозавры: охра и терракота", ink: "#3a3a1f", accent: "#b0522a", orn: "#c79b3a", paper: "#f7f3e6", cover: "#3a3a1f", coverNight: "#f3c77a", back: "#3a3a1f" },
  school: { name: "school", title: "Школа: синий и вишня", ink: "#23365e", accent: "#a33a3a", orn: "#c39a4a", paper: "#f8f6f0", cover: "#23365e", coverNight: "#f3d27a", back: "#23365e" },
};

/** Палитра по теме сюжета, если у сюжета нет своей. */
export const THEME_PALETTE: Record<string, string> = {
  winter: "newyear",
  kingdom: "birthday",
  dragon: "dragon",
  ocean: "sea",
  meadow: "meadow",
  sleep: "sleepy",
  "starry-sky": "sleepy",
  space: "space",
  orbit: "space",
  forest: "forest",
  yard: "sunny",
  park: "sunny",
  dino: "dino",
  school: "school",
  museum: "detective",
  "city-night": "dragon",
};

export type PlotPalette = string | (Partial<BookPalette> & { base?: string });

/** Палитра книги: своя у сюжета (имя или цвета поверх base) → по теме → классическая. */
export function paletteFor(plot?: { palette?: PlotPalette; theme?: string } | null): BookPalette {
  const p = plot?.palette;
  if (typeof p === "string" && PALETTES[p]) return PALETTES[p];
  const base = PALETTES[(typeof p === "object" && p?.base) || THEME_PALETTE[plot?.theme ?? ""] || "classic"] ?? PALETTES.classic;
  return typeof p === "object" && p ? { ...base, ...p, name: p.name ?? base.name } : base;
}
