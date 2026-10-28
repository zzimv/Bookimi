// ВЛАДЕЛЕЦ: агент 6 (сюжеты для взрослых). Никто другой этот файл не меняет.
//
// Должно быть: ADULT_PLOTS — не меньше 5 сюжетов для ADULT, все четыре сегмента (adult-couple,
// adult-parent, adult-grandparent, adult-friend) — хотя бы по одному. Контракт Plot (src/content/types.ts):
// heroKind "adult", ровно 12 разворотов, метки — по docs/content/ARCHITECTURE.md.
// Пары: второй главный герой — {ДОП1.*} с ролью partner (extras.min = 1, roles: ["partner"]), его род —
// {Р1:м|ж}. Книги «от детей/внуков/коллег»: дарители — доп. герои (roles child/grandchild/friend/colleague),
// все вместе — {ДОПЫ.им}, согласование числа — {МН:один|много}; текст должен читаться и без них
// (extras.min = 0), если сюжет их не требует. textStyle из TEXT_STYLE_IDS (our-story-memoir,
// lyrical-verse, mock-epic, pushkin-verse, folk-tale-prose, comic-captions), artStyles из ART_STYLE_IDS,
// theme из DEMO_THEME_KEYS, occasions из OCCASIONS, occasionHooks для главных поводов + "default" с {ПОВОД}.
// Анкетные детали (howMet, memories, profession) — плейсхолдеры не нужны: YandexGPT вплетает их по брифу;
// демо-текст пишите так, чтобы он был хорош и без них. Проверка: validateContent().
//
// requests (просьбы к интегратору, агенту 11): —

import type { Plot } from "../types";

export const ADULT_PLOTS: Plot[] = [];
