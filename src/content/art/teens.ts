// ВЛАДЕЛЕЦ: агент 5 (художник подростковых книг). Никто другой этот файл не меняет.
//
// Должно быть:
//  • TEEN_ART_STYLES — стили с owner "teens" в ART_STYLE_OWNERS (src/content/types.ts):
//    graphic-novel, painterly-fantasy, risograph-zine. title/description (ru), prompt/negative (EN,
//    только техника, без имён художников, брендов, франшиз), demo (палитра, линия, фактура).
//    Взрослая подача: подросток стесняется «детского» вида.
//  • TEEN_THEMES — демо-темы для ключей с owner "teens" в DEMO_THEME_KEYS:
//    game-world, city-night, orbit, mountains, museum, stage (можно со своим scene: DemoScene).
//  • drawTeen: DemoHeroDrawer — подросток 11–17: пропорции выше и стройнее ребёнка, причёски,
//    очки, веснушки, худи/куртка. Сейчас — запасная фигура из shared.ts.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, DemoHeroDrawer, DemoTheme } from "../types";
import { drawFigure } from "./shared";

export const TEEN_ART_STYLES: ArtStyle[] = [];

export const TEEN_THEMES: DemoTheme[] = [];

export const drawTeen: DemoHeroDrawer = (o) => drawFigure({ ...o, kind: "teen" });
