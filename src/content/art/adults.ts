// ВЛАДЕЛЕЦ: агент 7 (художник книг для взрослых). Никто другой этот файл не меняет.
//
// Должно быть:
//  • ADULT_ART_STYLES — стили с owner "adults" в ART_STYLE_OWNERS (src/content/types.ts):
//    linocut, retro-poster. title/description (ru), prompt/negative (EN, только техника),
//    demo (палитра, линия, фактура). Негатив обязательно запрещает эротику и обнажённость.
//  • ADULT_THEMES — демо-темы для ключей с owner "adults" в DEMO_THEME_KEYS:
//    romance-city, travel-map, office, dacha, home, celebration, starry-sky.
//  • drawAdult: DemoHeroDrawer — взрослый 20–85 лет: пол, седина, борода/усы, очки, причёска;
//    возраст (look.age) влияет на осанку и седину. Пары рисуются двумя вызовами (герой + ДОП1).
//    Сейчас — запасная фигура из shared.ts.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, DemoHeroDrawer, DemoTheme } from "../types";
import { drawFigure } from "./shared";

export const ADULT_ART_STYLES: ArtStyle[] = [];

export const ADULT_THEMES: DemoTheme[] = [];

export const drawAdult: DemoHeroDrawer = (o) => drawFigure({ ...o, kind: "adult" });
