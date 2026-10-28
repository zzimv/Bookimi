// ВЛАДЕЛЕЦ: агент 8 (сюжеты о питомцах). Никто другой этот файл не меняет.
//
// Должно быть: PET_PLOTS — не меньше 4 сюжетов для PET, оба сегмента (pet-dog, pet-cat).
// Контракт Plot (src/content/types.ts): heroKind "pet", ровно 12 разворотов, метки — по
// docs/content/ARCHITECTURE.md. Герой — питомец: {ГЕРОЙ.*} — кличка, {Р:он|она} — по полу питомца
// (кот/кошка, пёс/собака). Хозяева — доп. герои с ролью owner: {ДОП1.*}, {ДОП2.*}, все — {ДОПЫ.*};
// если текст на них опирается — extras.min ≥ 1. Сюжет для собаки или кошки — через segments
// (можно оба, если текст подходит обоим: тогда без «гав»/«мяу» в обязательных местах).
// textStyle из TEXT_STYLE_IDS (pet-first-person, cozy-adventure, funny-verse, mock-epic, gentle-bedtime,
// pushkin-verse), artStyles из ART_STYLE_IDS, theme из DEMO_THEME_KEYS, occasions из OCCASIONS,
// occasionHooks для главных поводов + "default" с {ПОВОД}. Запреты PET_TABOO — строго.
// Сцены: «the dog» / «the cat», хозяева — «the owner». Проверка: validateContent().
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

export const PET_PLOTS: Plot[] = [];
