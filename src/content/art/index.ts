// Сборка художественной части (владелец — агент 1): стили картинок, демо-темы, рисовальщики героев.
// Безопасно для клиента и демо-бандла: здесь нет системных промптов YandexGPT и планов сюжетов.

import type { ArtStyle, DemoExtra, DemoHeroDrawer, DemoTheme, ExtraDrawKind, ExtraRole, HeroKind } from "../types";
import { FALLBACK_THEME_KEY } from "../types";
import { drawChild, KIDS_ART_STYLES, KIDS_THEMES } from "./kids";
import { drawTeen, TEEN_ART_STYLES, TEEN_THEMES } from "./teens";
import { drawAdult, ADULT_ART_STYLES, ADULT_THEMES } from "./adults";
import { drawPet, PET_ART_STYLES, PET_THEMES } from "./pets";
import { drawThing } from "./shared";

export const ART_STYLES: ArtStyle[] = [...KIDS_ART_STYLES, ...TEEN_ART_STYLES, ...ADULT_ART_STYLES, ...PET_ART_STYLES];
export const DEMO_THEMES: DemoTheme[] = [...KIDS_THEMES, ...TEEN_THEMES, ...ADULT_THEMES, ...PET_THEMES];

export const themesByKey: Record<string, DemoTheme> = Object.fromEntries(DEMO_THEMES.map((t) => [t.key, t]));

const STUB_THEME: DemoTheme = { key: FALLBACK_THEME_KEY, sky: ["#bfe3f2", "#eef7fb"], ground: "#8cc084", accent: "#f2a65a", deco: "clouds" };

/** Тема по ключу; если ещё не нарисована — запасная (луг), затем заглушка. */
export function themeFor(key: string): DemoTheme {
  return themesByKey[key] ?? themesByKey[FALLBACK_THEME_KEY] ?? themesByKey.dragon ?? STUB_THEME;
}

export function artStyle(id: string): ArtStyle | null {
  return ART_STYLES.find((s) => s.id === id) ?? null;
}

const DRAWERS: Record<HeroKind, DemoHeroDrawer> = { child: drawChild, teen: drawTeen, adult: drawAdult, pet: drawPet };

/** Рисовальщик героя по виду; для «своего варианта» и игрушек — drawThing. */
export function heroDrawer(kind: HeroKind | ExtraDrawKind): DemoHeroDrawer {
  if (kind === "toy" || kind === "custom") return drawThing;
  return DRAWERS[kind];
}

/** Как рисовать доп. героя по роли (если вид не задан явно). heroKind — вид главного героя. */
export function extraDrawKind(role: ExtraRole | string, heroKind: HeroKind): ExtraDrawKind {
  switch (role) {
    case "mom":
    case "dad":
    case "grandma":
    case "grandpa":
    case "partner":
    case "owner":
    case "colleague":
      return "adult";
    case "pet":
      return "pet";
    case "toy":
      return "toy";
    case "custom":
      return "custom";
    case "child":
    case "grandchild":
      return "child";
    case "sibling":
    case "friend":
    default:
      return heroKind === "pet" ? "adult" : heroKind;
  }
}

export type { DemoExtra };
