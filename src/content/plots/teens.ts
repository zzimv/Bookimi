// ВЛАДЕЛЕЦ: агент 4 (подростковые сюжеты). Никто другой этот файл не меняет.
//
// Должно быть: TEEN_PLOTS — не меньше 5 сюжетов для TEEN, оба сегмента (teens-11-13, teens-14-17).
// Контракт Plot (src/content/types.ts): heroKind "teen", ageMin/ageMax обязательны, ровно 12 разворотов,
// метки — по docs/content/ARCHITECTURE.md, textStyle из TEXT_STYLE_IDS (голоса подростков:
// quest-fantasy-humor, detective, sci-fi, comic-captions, mock-epic, pushkin-verse), artStyles из
// ART_STYLE_IDS, theme из DEMO_THEME_KEYS, occasions из OCCASIONS, occasionHooks для главных поводов
// сегмента (ДР, Новый год, выпускной в школе, 23 Февраля, 8 Марта) + "default" с {ПОВОД}.
// Запреты сегментов: для 11–13 — никакой романтики; для всех — без насилия, алкоголя, брендов, игр.
// Обложка и сцены — «взрослая» подача (the teen, not the child). Проверка: validateContent().
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

export const TEEN_PLOTS: Plot[] = [];
