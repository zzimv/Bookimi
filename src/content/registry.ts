// Реестр контента (владелец — агент 1). Собирает профили, сюжеты, голоса, стили картинок, настроения
// и демо-темы в одно место и проверяет их целостность (validateContent).
// ⚠ Содержит системные промпты YandexGPT и планы сюжетов — импортировать только на сервере
// (и в демо-стенд). Клиентским компонентам — art/index.ts, art/render.ts и проекции из серверных props.

import { AUDIENCES, ART_STYLE_IDS, OCCASIONS, SEGMENTS, TEXT_STYLE_IDS, type AudienceKey } from "./profiles";
import { TEXT_STYLES } from "./text-styles";
import { KIDS_PLOTS } from "./plots/kids";
import { TEEN_PLOTS } from "./plots/teens";
import { ADULT_PLOTS } from "./plots/adults";
import { PET_PLOTS } from "./plots/pets";
import { MOODS } from "./moods";
import { KIDS_ART_STYLES, KIDS_THEMES } from "./art/kids";
import { TEEN_ART_STYLES, TEEN_THEMES } from "./art/teens";
import { ADULT_ART_STYLES, ADULT_THEMES } from "./art/adults";
import { PET_ART_STYLES, PET_THEMES } from "./art/pets";
import { ART_STYLES, artStyle, heroDrawer, themeFor, themesByKey } from "./art/index";
import { GENERIC_HOOKS, occasionText } from "./occasions";
import { titleTemplate } from "./title";
import { checkTags, countNameTags, maxExtraRef, nameInMetricLine, unevenGenderForms } from "./tags";
import {
  ART_STYLE_OWNERS,
  DEMO_THEME_KEYS,
  EXTRA_ROLES,
  HERO_KIND_BY_AUDIENCE,
  type Mood,
  type OccasionHook,
  type Plot,
  type PlotFilter,
  type PlotSpread,
  type TextStyle,
} from "./types";

export { TEXT_STYLES, ART_STYLES, MOODS, themesByKey, themeFor, heroDrawer, artStyle, occasionText };

export const PLOTS: Plot[] = [...KIDS_PLOTS, ...TEEN_PLOTS, ...ADULT_PLOTS, ...PET_PLOTS];

/** Минимум сюжетов по аудиториям (Definition of Done контент-агентов). */
export const PLOT_TARGETS: Record<AudienceKey, number> = { CHILD: 9, TEEN: 5, ADULT: 5, PET: 4 };

export function getPlots(f: PlotFilter = {}): Plot[] {
  return PLOTS.filter(
    (p) =>
      (!f.audience || p.audience === f.audience) &&
      (!f.segment || p.segments.includes(f.segment)) &&
      (!f.occasion || p.occasions.includes(f.occasion)) &&
      (!f.heroKind || p.heroKind === f.heroKind) &&
      (!f.textStyle || p.textStyle === f.textStyle) &&
      (f.age === undefined || ((p.ageMin ?? 0) <= f.age && f.age <= (p.ageMax ?? 200))),
  );
}

export const plotBySlug = (slug: string): Plot | null => PLOTS.find((p) => p.slug === slug) ?? null;
export const textStyle = (id: string): TextStyle | null => TEXT_STYLES.find((s) => s.id === id) ?? null;
export const mood = (id: string): Mood | null => MOODS.find((m) => m.id === id) ?? null;
/** Настроение по умолчанию — первое в списке агента 10 (или без настроения). */
export const defaultMood = (): Mood | null => MOODS[0] ?? null;
export const segmentsFor = (audience: AudienceKey) => SEGMENTS.filter((s) => s.audience === audience);

/**
 * Сюжеты для повода: сначала те, у кого повод в occasions (главный повод — выше), затем остальные.
 * Никогда не пустой: если у аудитории ещё нет сюжетов — возвращает весь каталог.
 */
export function plotsForOccasion(occasionKey: string, audience?: AudienceKey): Plot[] {
  let pool = audience ? PLOTS.filter((p) => p.audience === audience) : PLOTS;
  if (!pool.length) pool = PLOTS;
  const rank = (p: Plot) => {
    const i = p.occasions.indexOf(occasionKey);
    return i < 0 ? 1000 : i;
  };
  return pool
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map((x) => x.p);
}

/**
 * Крючок повода для сюжета: свой крючок сюжета → его "default" → общий из occasions.ts.
 * «Без повода» (и «свой» без текста) — только явный hooks.bez сюжета. Пустой крючок {opening:"",closing:""}
 * означает «сюжет уже про этот повод».
 */
export function hooksFor(plot: Plot, occasionKey: string, custom?: string): OccasionHook | null {
  const own = plot.occasionHooks ?? {};
  if (occasionKey === "bez" || !occasionKey || (occasionKey === "svoj" && !custom?.trim())) return own.bez ?? null;
  return own[occasionKey] ?? own.default ?? GENERIC_HOOKS[occasionKey] ?? null;
}

/** Развороты сюжета с вплетённым поводом (для демо-текста и как план для YandexGPT). Метки не заполняет. */
export function applyOccasion(plot: Plot, occasionKey: string, custom?: string): PlotSpread[] {
  const spreads = plot.spreads.map((s) => ({ ...s }));
  const h = hooksFor(plot, occasionKey, custom);
  if (!h || spreads.length < 12) return spreads;
  const sep = textStyle(plot.textStyle)?.verse ? "\n" : " ";
  if (h.opening) spreads[0].text = `${h.opening}${sep}${spreads[0].text}`;
  if (h.closing) spreads[11].text = `${spreads[11].text}${sep}${h.closing}`;
  if (h.openingScene) spreads[0].scene = `${spreads[0].scene}, ${h.openingScene}`;
  if (h.closingScene) spreads[11].scene = `${spreads[11].scene}, ${h.closingScene}`;
  return spreads;
}

// ---------------------------------------------------------------------------
// Проверка целостности
// ---------------------------------------------------------------------------

export interface ContentReport {
  errors: string[];
  warnings: string[];
}

const CYR = /[а-яё]/i;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Частые ошибки форм рода: «нашёл{Р:|а}» → «нашёла», «вышел{Р:|а}» → «вышела». */
const BAD_GENDER = /(ёл|шел)\{Р\d?:\|а\}/;

/**
 * strict = false (по умолчанию): пустые модули-заглушки — предупреждения, всё остальное — ошибки.
 * strict = true: ещё и полнота — все стили, темы, настроения и минимум сюжетов (включает агент 11
 * после контент-агентов; тест — CONTENT_STRICT=1).
 */
export function validateContent(opts: { strict?: boolean } = {}): ContentReport {
  const strict = !!opts.strict;
  const errors: string[] = [];
  const warnings: string[] = [];
  const soft = (msg: string) => (strict ? errors : warnings).push(msg);

  const occasionKeys = new Set(OCCASIONS.map((o) => o.key));
  const themeKeys = new Set<string>(DEMO_THEME_KEYS.map((t) => t.key));
  const artIds = new Set(ART_STYLE_IDS.map((a) => a.id));
  const definedArt = new Set(ART_STYLES.map((a) => a.id));

  // ── Голоса ──
  const seenStyles = new Set<string>();
  for (const s of TEXT_STYLES) {
    if (seenStyles.has(s.id)) errors.push(`text-styles: стиль ${s.id} описан дважды`);
    seenStyles.add(s.id);
    if (s.systemPrompt.length < 500) errors.push(`text-styles: ${s.id} — слишком короткий systemPrompt`);
    if (s.rules.length < 3) errors.push(`text-styles: ${s.id} — меньше трёх правил`);
    for (const e of checkTags(s.example)) errors.push(`text-styles: ${s.id} пример: ${e}`);
    if (s.verse) for (const l of nameInMetricLine(s.example)) errors.push(`text-styles: ${s.id} пример: имя внутри стихотворной строки «${l}»`);
  }
  for (const t of TEXT_STYLE_IDS) if (!seenStyles.has(t.id)) errors.push(`text-styles: нет описания стиля ${t.id}`);

  // ── Стили картинок ──
  const artModules: [string, typeof ART_STYLES][] = [
    ["kids", KIDS_ART_STYLES],
    ["teens", TEEN_ART_STYLES],
    ["adults", ADULT_ART_STYLES],
    ["pets", PET_ART_STYLES],
  ];
  const seenArt = new Set<string>();
  for (const [owner, list] of artModules) {
    for (const a of list) {
      const where = `art/${owner}: ${a.id}`;
      if (seenArt.has(a.id)) errors.push(`${where} — описан дважды`);
      seenArt.add(a.id);
      if (!artIds.has(a.id)) errors.push(`${where} — id нет в ART_STYLE_IDS`);
      else if (ART_STYLE_OWNERS[a.id] !== owner) errors.push(`${where} — стиль принадлежит art/${ART_STYLE_OWNERS[a.id]}`);
      if (!a.prompt || CYR.test(a.prompt) || CYR.test(a.negative)) errors.push(`${where} — prompt/negative должны быть на английском и непустыми`);
      if (!a.title || !a.description) errors.push(`${where} — нет title/description`);
      const p = a.demo.palette;
      if (![p.paper, p.ink, ...p.accents].every((c) => HEX.test(c)) || !p.accents.length) errors.push(`${where} — палитра demo: цвета #rrggbb, accents не пуст`);
    }
  }
  for (const a of ART_STYLE_IDS) if (!definedArt.has(a.id)) soft(`art: стиль ${a.id} ещё не описан (art/${ART_STYLE_OWNERS[a.id] ?? "?"}.ts)`);

  // ── Темы ──
  const themeModules: [string, typeof KIDS_THEMES][] = [
    ["kids", KIDS_THEMES],
    ["teens", TEEN_THEMES],
    ["adults", ADULT_THEMES],
    ["pets", PET_THEMES],
  ];
  const seenThemes = new Set<string>();
  for (const [owner, list] of themeModules) {
    for (const t of list) {
      const spec = DEMO_THEME_KEYS.find((k) => k.key === t.key);
      if (seenThemes.has(t.key)) errors.push(`art/${owner}: тема ${t.key} описана дважды`);
      seenThemes.add(t.key);
      if (!spec) errors.push(`art/${owner}: тема ${t.key} не из DEMO_THEME_KEYS`);
      else if (spec.owner !== owner) errors.push(`art/${owner}: тема ${t.key} принадлежит art/${spec.owner}`);
      if (![...t.sky, t.ground, t.accent].every((c) => HEX.test(c))) errors.push(`art/${owner}: тема ${t.key} — цвета #rrggbb`);
    }
  }
  for (const k of DEMO_THEME_KEYS) if (!seenThemes.has(k.key)) soft(`art: тема ${k.key} ещё не нарисована (art/${k.owner}.ts)`);

  // ── Настроения ──
  const seenMoods = new Set<string>();
  for (const m of MOODS) {
    if (seenMoods.has(m.id)) errors.push(`moods: ${m.id} описано дважды`);
    seenMoods.add(m.id);
    if (!SLUG.test(m.id)) errors.push(`moods: id ${m.id} — латиница kebab-case`);
    if (artIds.has(m.id)) errors.push(`moods: id ${m.id} совпадает со стилем картинок`);
    if (!m.title || !m.oneLine) errors.push(`moods: ${m.id} — нет title/oneLine`);
    if (CYR.test(m.promptAdd) || CYR.test(m.negativeAdd)) errors.push(`moods: ${m.id} — promptAdd/negativeAdd на английском`);
    const d = m.demo;
    if (!HEX.test(d.tint) || !(d.saturation >= 0 && d.saturation <= 3) || !(d.brightness > 0 && d.brightness <= 2))
      errors.push(`moods: ${m.id} — demo: tint #rrggbb, saturation 0..3, brightness 0..2`);
  }
  if (MOODS.length < 8) soft(`moods: ${MOODS.length} настроений, нужно не меньше 8 (moods.ts)`);

  // ── Сюжеты ──
  const slugs = new Set<string>();
  for (const p of PLOTS) {
    const at = `plot ${p.slug}`;
    if (!SLUG.test(p.slug)) errors.push(`${at}: slug — латиница kebab-case`);
    if (slugs.has(p.slug)) errors.push(`${at}: slug повторяется`);
    slugs.add(p.slug);
    if (!AUDIENCES.some((a) => a.key === p.audience)) errors.push(`${at}: неизвестная аудитория ${p.audience}`);
    if (p.heroKind !== HERO_KIND_BY_AUDIENCE[p.audience]) errors.push(`${at}: heroKind ${p.heroKind} не подходит аудитории ${p.audience}`);
    if (!p.segments.length) errors.push(`${at}: нет сегментов`);
    for (const s of p.segments) {
      const seg = SEGMENTS.find((x) => x.id === s);
      if (!seg) errors.push(`${at}: нет сегмента ${s}`);
      else if (seg.audience !== p.audience) errors.push(`${at}: сегмент ${s} другой аудитории`);
    }
    if (!p.title || !p.tagline || !p.description) errors.push(`${at}: нет title/tagline/description`);
    if (p.audience === "CHILD" || p.audience === "TEEN") {
      if (p.ageMin === undefined || p.ageMax === undefined || p.ageMin > p.ageMax) errors.push(`${at}: нужны ageMin ≤ ageMax`);
    }
    if (!p.occasions.length) errors.push(`${at}: нет поводов`);
    for (const o of p.occasions) {
      const occ = OCCASIONS.find((x) => x.key === o);
      if (!occ) errors.push(`${at}: нет повода ${o}`);
      else if (!occ.audiences.includes(p.audience)) errors.push(`${at}: повод ${o} не для аудитории ${p.audience}`);
    }
    const ts = TEXT_STYLE_IDS.find((t) => t.id === p.textStyle);
    if (!ts) errors.push(`${at}: нет стиля текста ${p.textStyle}`);
    else if (!ts.audiences.includes(p.audience)) errors.push(`${at}: стиль текста ${p.textStyle} не для аудитории ${p.audience}`);
    if (!p.artStyles.length) errors.push(`${at}: нет стилей картинок`);
    for (const a of p.artStyles) {
      if (!artIds.has(a)) errors.push(`${at}: нет стиля картинок ${a} в ART_STYLE_IDS`);
      else if (!definedArt.has(a)) soft(`${at}: стиль картинок ${a} ещё не описан`);
    }
    if (!themeKeys.has(p.theme)) errors.push(`${at}: тема ${p.theme} не из DEMO_THEME_KEYS`);
    else if (!themesByKey[p.theme]) soft(`${at}: тема ${p.theme} ещё не нарисована`);
    if (p.gender !== undefined && p.gender !== null && p.gender !== "boy" && p.gender !== "girl") errors.push(`${at}: gender — boy | girl | null`);

    const ex = p.extras;
    if (!ex || ex.min < 0 || ex.max > 3 || ex.min > ex.max) errors.push(`${at}: extras — 0 ≤ min ≤ max ≤ 3`);
    for (const r of ex?.roles ?? []) if (!(EXTRA_ROLES as readonly string[]).includes(r)) errors.push(`${at}: неизвестная роль доп. героя ${r}`);

    if (!p.coverScene || CYR.test(p.coverScene)) errors.push(`${at}: coverScene — на английском`);
    if (p.spreads.length !== 12) errors.push(`${at}: ${p.spreads.length} разворотов, нужно ровно 12`);
    const verse = !!textStyle(p.textStyle)?.verse;
    const texts: [string, string][] = [["title", titleTemplate(p.title)]];
    p.spreads.forEach((s, i) => {
      if (!s.text?.trim()) errors.push(`${at}: разворот ${i + 1} без текста`);
      if (!s.scene?.trim() || CYR.test(s.scene)) errors.push(`${at}: разворот ${i + 1} — scene на английском и без имён`);
      texts.push([`разворот ${i + 1}`, s.text ?? ""]);
    });
    if (verse) {
      // Стихи: имя и повод — только в отдельных строках-обращениях; имён — не больше 4 на книгу; формы рода — равной длины
      const verseTexts: [string, string][] = [
        ...p.spreads.map((s, i): [string, string] => [`разворот ${i + 1}`, s.text ?? ""]),
        ...Object.entries(p.occasionHooks ?? {}).flatMap(([k, h]): [string, string][] => (h ? [[`крючок ${k}`, h.opening], [`крючок ${k}`, h.closing]] : [])),
      ];
      for (const [where, t] of verseTexts) {
        for (const l of nameInMetricLine(t)) errors.push(`${at}: ${where} — имя или повод внутри стихотворной строки «${l}» (только отдельной строкой-обращением)`);
        for (const f of unevenGenderForms(t)) errors.push(`${at}: ${where} — формы рода разной длины ${f} ломают метр`);
      }
      const names = p.spreads.reduce((n, s) => n + countNameTags(s.text ?? ""), 0);
      if (names > 4) errors.push(`${at}: в стихах ${names} меток имени, нужно не больше 4`);
    }
    for (const [k, h] of Object.entries(p.occasionHooks ?? {})) {
      if (!h) continue;
      if (k !== "default" && !occasionKeys.has(k)) errors.push(`${at}: крючок для неизвестного повода ${k}`);
      if (k === "default" && !/\{ПОВОД\}/.test(h.opening + h.closing)) errors.push(`${at}: крючок default должен содержать {ПОВОД}`);
      if (CYR.test(h.openingScene ?? "") || CYR.test(h.closingScene ?? "")) errors.push(`${at}: крючок ${k} — сцены на английском`);
      texts.push([`крючок ${k}`, h.opening], [`крючок ${k}`, h.closing]);
    }
    for (const [where, t] of texts) {
      for (const e of checkTags(t)) errors.push(`${at}: ${where}: ${e}`);
      if (BAD_GENDER.test(t)) errors.push(`${at}: ${where}: форма вида «нашёл{Р:|а}» даёт «нашёла» — пишите {Р:нашёл|нашла}`);
      const n = maxExtraRef(t);
      if (n > (ex?.min ?? 0)) errors.push(`${at}: ${where} ссылается на ДОП${n}, а extras.min = ${ex?.min ?? 0}`);
    }
  }

  // ── Полнота каталога ──
  for (const a of AUDIENCES) {
    const n = PLOTS.filter((p) => p.audience === a.key).length;
    if (n === 0) soft(`каталог: у аудитории ${a.key} ещё нет сюжетов`);
    else if (n < 3) errors.push(`каталог: у аудитории ${a.key} ${n} сюжет(а), нужно не меньше 3`);
    if (n < PLOT_TARGETS[a.key]) soft(`каталог: у аудитории ${a.key} ${n} из ${PLOT_TARGETS[a.key]} сюжетов`);
  }
  for (const s of SEGMENTS) if (!PLOTS.some((p) => p.segments.includes(s.id))) soft(`каталог: для сегмента ${s.id} нет сюжетов`);

  return { errors, warnings };
}
