// ВЛАДЕЛЕЦ: агент 9 (художник книг о питомцах). Никто другой этот файл не меняет.
//
// Должно быть:
//  • PET_ART_STYLES — стили с owner "pets" в ART_STYLE_OWNERS (src/content/types.ts):
//    soft-gouache, pet-cartoon, vintage-postcard. title/description (ru), prompt/negative (EN, только
//    техника; негатив: cages, leashes on chains, injured animal, vet), demo (палитра, линия, фактура).
//  • PET_THEMES — демо-темы для ключей с owner "pets" в DEMO_THEME_KEYS:
//    pet-home, park, yard, pet-night, seaside.
//  • drawPet: DemoHeroDrawer — собака или кошка (look.species), окрас (look.furColor),
//    приметы, порода (look.breed: уши, хвост, размер). Сейчас — запасной рисунок из shared.ts.
//
// requests (просьбы к интегратору, агенту 11): —

import type { ArtStyle, DemoHeroDrawer, DemoTheme } from "../types";
import { drawSimplePet } from "./shared";

export const PET_ART_STYLES: ArtStyle[] = [];

export const PET_THEMES: DemoTheme[] = [];

export const drawPet: DemoHeroDrawer = (o) => drawSimplePet(o);
