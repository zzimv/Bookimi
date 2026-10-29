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
import { KIDS_GROUP_PLOTS, TEEN_GROUP_PLOTS } from "./plots/groups";
import { MOODS } from "./moods";
import { KIDS_ART_STYLES, KIDS_THEMES } from "./art/kids";
import { TEEN_ART_STYLES, TEEN_THEMES } from "./art/teens";
import { ADULT_ART_STYLES, ADULT_THEMES } from "./art/adults";
import { PET_ART_STYLES, PET_THEMES } from "./art/pets";
import { TRIAL_ART_STYLES } from "./art/trial";
import { ART_STYLES, artStyle, heroDrawer, themeFor, themesByKey } from "./art/index";
import { GENERIC_HOOKS, occasionText } from "./occasions";
import { titleTemplate } from "./title";
import { relevanceOf, sectionsOf, type Relevance, type SectionPlot, type Sections } from "./sections";
import {
  ADULT_TAG_RE,
  blocksOf,
  blockVariant,
  checkTags,
  countNameTags,
  GROUP_TAG_RE,
  maxExtraRef,
  nameInMetricLine,
  slotsIn,
  unevenGenderForms,
} from "./tags";
import { distributeMembers, resolveGroupBlocks } from "../lib/declension";
import {
  ART_STYLE_OWNERS,
  DEMO_THEME_KEYS,
  EXTRA_ROLES,
  GROUP_ADULT_ROLES,
  GROUP_LABELS,
  GROUP_MAX_LIMIT,
  GROUP_SLOT_LIMIT,
  HERO_KIND_BY_AUDIENCE,
  type Mood,
  type OccasionHook,
  type Plot,
  type PlotFilter,
  type PlotSpread,
  type TextStyle,
} from "./types";

export { TEXT_STYLES, ART_STYLES, MOODS, themesByKey, themeFor, heroDrawer, artStyle, occasionText };

export const PLOTS: Plot[] = [...KIDS_PLOTS, ...KIDS_GROUP_PLOTS, ...TEEN_PLOTS, ...TEEN_GROUP_PLOTS, ...ADULT_PLOTS, ...PET_PLOTS];

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

// ---------------------------------------------------------------------------
// Повод → какие книги показывать (модель релевантности)
// ---------------------------------------------------------------------------

export type { Relevance } from "./sections";
export { STRONG_OCCASIONS, OPEN_OCCASIONS, RELATED_OCCASIONS, FITS_TITLE } from "./sections";

const isEmptyHook = (h?: OccasionHook) => !!h && !h.opening && !h.closing;

/** Проекция сюжета для разделов повода (src/content/sections.ts) — безопасна для клиента. */
export function sectionPlot(plot: Plot): SectionPlot {
  const hooks = plot.occasionHooks ?? {};
  const empty = Object.entries(hooks).filter(([, h]) => isEmptyHook(h)).map(([k]) => k);
  return { slug: plot.slug, occasions: plot.occasions, core: [...new Set([...(plot.coreOccasions ?? []), ...empty])], hooks: Object.keys(hooks) };
}

/** core — сюжет написан для этого повода; fits — повод вплетается естественно (крючок, occasions); generic — общий крючок. */
export function relevance(plot: Plot, occasionKey: string): Relevance {
  return relevanceOf(sectionPlot(plot), occasionKey);
}

export type OccasionSections = Omit<Sections<Plot>, "hidden">;

/**
 * Каталог повода по разделам. Порядок показа: customFirst ? [custom, core, fits, others] : [core, custom, fits, others]
 * (sectionOrder). opts.segment / opts.age сужают выбор (сегмент — p.segments, возраст — ageMin..ageMax).
 * Логика — sectionsOf (sections.ts): ею же пользуются анкета в браузере и демо-стенд.
 */
export function plotSections(occasionKey: string, audience?: AudienceKey, opts: { segment?: string; age?: number } = {}): OccasionSections {
  const pool = getPlots({ audience, segment: opts.segment, age: opts.age });
  const byslug = new Map(pool.map((p) => [p.slug, p]));
  const s = sectionsOf(pool.map(sectionPlot), occasionKey ?? "");
  const back = (xs: SectionPlot[]) => xs.map((x) => byslug.get(x.slug)!);
  return { occasion: s.occasion, strong: s.strong, customFirst: s.customFirst, custom: true, fitsTitle: s.fitsTitle, core: back(s.core), fits: back(s.fits), others: back(s.others), hiddenCount: s.hiddenCount };
}

/**
 * Старый вид (совместимость): все сюжеты аудитории — core, затем fits, затем остальные.
 * Никогда не пустой: если у аудитории ещё нет сюжетов — возвращает весь каталог. Новый код — plotSections.
 */
export function plotsForOccasion(occasionKey: string, audience?: AudienceKey): Plot[] {
  let pool = audience ? PLOTS.filter((p) => p.audience === audience) : PLOTS;
  if (!pool.length) pool = PLOTS;
  const order: Record<Relevance, number> = { core: 0, fits: 1, generic: 2 };
  const rank = (p: Plot) => {
    const i = p.occasions.indexOf(occasionKey);
    return order[relevance(p, occasionKey)] * 1000 + (i < 0 ? 100 : i);
  };
  return pool
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map((x) => x.p);
}

// ---------------------------------------------------------------------------
// Группа: слоты, сцены
// ---------------------------------------------------------------------------

/** Сколько слотов {ДРУГn} в книге (для TagGroup.slots и распределения детей). */
export function groupSlotCount(plot: Pick<Plot, "spreads">): number {
  return Math.max(0, ...plot.spreads.flatMap((s) => slotsIn(s.text)));
}

/** Сколько детей в анкете можно указать для сюжета (без героя). */
export const groupMembersMax = (plot: Pick<Plot, "group">) => Math.max(0, (plot.group?.max ?? 1) - 1);

/**
 * Кто из детей по имени звучит в каждом развороте через слоты (без ведомости {ПЕРЕКЛИЧКА} и списков {ГРУППА}).
 * members — число детей без героя. Для проверки «каждый назван, никто дважды, пока не прозвучали все».
 */
export function slotMentions(plot: Plot, members: number, adults = 0): number[][] {
  const S = groupSlotCount(plot);
  const dist = distributeMembers(members, S);
  return applyOccasion(plot, "bez").map((sp) => {
    const t = resolveGroupBlocks(sp.text, { members, adults, slots: S });
    const out = new Set<number>();
    for (const n of slotsIn(t)) for (const i of dist[n - 1]?.length ? dist[n - 1] : members ? [(n - 1) % members] : []) out.add(i);
    return [...out];
  });
}

const GROUP_NOUN: Record<string, [string, string]> = {
  "kids-2-4": ["toddlers", "kindergarten teacher"],
  "kids-5-7": ["kindergarten children", "kindergarten teacher"],
  "kids-8-10": ["schoolchildren", "teacher"],
  "teens-11-13": ["teenage classmates", "teacher"],
  "teens-14-17": ["teenage classmates", "teacher"],
};

/**
 * Сцены группы: {GROUP} → «a group of 12 kindergarten children» (без имён), {GROUP_ADULTS} → «a kind kindergarten teacher».
 * members — дети без героя; adults — взрослые группы. Сюжеты без group не меняются.
 */
export function applyGroupScenes<T extends { scene: string }>(plot: Plot, spreads: T[], members: number, adults = 0): T[] {
  if (!plot.group) return spreads;
  const [kids, teacher] = GROUP_NOUN[plot.segments[0]] ?? ["children", "teacher"];
  const pupils = plot.group.label === "класс" && plot.audience === "CHILD" && (plot.ageMax ?? 7) <= 8 ? "first-graders" : kids;
  const group = members <= 0 ? "a couple of friendly " + pupils : members === 1 ? `one friend, another of the ${pupils}` : `a group of ${members} ${pupils}`;
  const grown = adults <= 0 ? `a kind ${teacher} in the background` : adults === 1 ? `a kind ${teacher}` : `${adults} kind grown-ups (${teacher}s)`;
  return spreads.map((s) => ({ ...s, scene: s.scene.replace(/\{GROUP\}/g, group).replace(/\{GROUP_ADULTS\}/g, grown) }));
}

/** Развороты группы (сцена с {GROUP}) — в них демо-рендер рисует толпу (renderDemoSpread({ crowd })). */
export function groupSpreadIndexes(plot: Plot): number[] {
  return plot.spreads.flatMap((s, i) => (/\{GROUP\}/.test(s.scene) ? [i + 1] : []));
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
// Проверка группы
// ---------------------------------------------------------------------------

/** Условия, при которых в блоке гарантированно есть хотя бы один ребёнок. */
const MEMBER_COND = /^(ДРУГ\d+|ГРУППА(>\d+)?)$/;

function groupChecks(p: Plot, texts: [string, string][], errors: string[]) {
  const at = `plot ${p.slug}`;
  const g = p.group;
  const all = texts.map(([, t]) => t).join("\n");
  if (!g) {
    if (GROUP_TAG_RE.test(all) || ADULT_TAG_RE.test(all) || /\[\[\?/.test(all)) errors.push(`${at}: метки группы и блоки [[?…]] — только у сюжетов с group`);
    return;
  }
  if (!(g.min >= 1 && g.max <= GROUP_MAX_LIMIT && g.min <= g.max)) errors.push(`${at}: group — 1 ≤ min ≤ max ≤ ${GROUP_MAX_LIMIT} (размер вместе с героем)`);
  if (!(GROUP_LABELS as readonly string[]).includes(g.label)) errors.push(`${at}: group.label — ${GROUP_LABELS.join(" | ")}`);
  if (g.includeAdults) {
    if (!(g.includeAdults.max >= 0 && g.includeAdults.max <= 3)) errors.push(`${at}: group.includeAdults.max — 0..3`);
    for (const r of g.includeAdults.roles) if (!(GROUP_ADULT_ROLES as readonly string[]).includes(r)) errors.push(`${at}: неизвестная роль взрослого ${r}`);
  } else if (ADULT_TAG_RE.test(all)) errors.push(`${at}: метки взрослых группы без group.includeAdults`);

  const spreads = p.spreads.map((s) => s.text ?? "");
  // Слоты: 1..S подряд, S ≤ 14; каждый слот — в одном развороте; первые появления — по возрастанию номеров
  const S = groupSlotCount(p);
  const need = Math.min(GROUP_SLOT_LIMIT, g.max - 1);
  if (S > GROUP_SLOT_LIMIT) errors.push(`${at}: слотов {ДРУГn} ${S}, максимум ${GROUP_SLOT_LIMIT}`);
  if (S < need) errors.push(`${at}: слотов {ДРУГn} ${S}, нужно ${need} — иначе не у каждого ребёнка будет свой момент`);
  const home = new Map<number, number>();
  spreads.forEach((t, i) => {
    for (const n of slotsIn(t)) {
      if (home.has(n) && home.get(n) !== i) errors.push(`${at}: слот ДРУГ${n} в разворотах ${home.get(n)! + 1} и ${i + 1} — слот живёт в одном развороте`);
      if (!home.has(n)) home.set(n, i);
    }
  });
  for (let n = 1; n <= S; n++) if (!home.has(n)) errors.push(`${at}: пропущен слот ДРУГ${n} (слоты — подряд с 1)`);
  for (let n = 2; n <= S; n++) if ((home.get(n) ?? 0) < (home.get(n - 1) ?? 0)) errors.push(`${at}: слот ДРУГ${n} появляется раньше ДРУГ${n - 1}`);
  // Свой блок [[?ДРУГn: …]] — у каждого слота; метки детей — только внутри блоков с ребёнком (или если min ≥ 2)
  for (let n = 1; n <= S; n++) if (!spreads.some((t) => blocksOf(t).some((b) => b.cond === `ДРУГ${n}`))) errors.push(`${at}: у слота ДРУГ${n} нет блока [[?ДРУГ${n}: …]] (без ребёнка фраза должна выпадать)`);
  for (const [where, t] of texts) {
    const outside = t.replace(/\[\[\?([^:\]\n]+):\s?([\s\S]*?)\]\]/g, (m, cond: string) => (MEMBER_COND.test(cond.trim()) ? "" : m));
    if (g.min < 2 && /\{(ГРУППА|ДРУГ\d+|РД\d+|МН_ГРУППЫ)[.:}]/.test(outside.replace(/\{ПЕРЕКЛИЧКА\}/g, "")))
      errors.push(`${at}: ${where} — метки детей группы вне блока [[?ДРУГn: …]] / [[?ГРУППА: …]] (группа может быть пустой)`);
    const outsideAdults = t.replace(/\[\[\?(ВОСПИТАТЕЛ[^:\]\n]*):\s?([\s\S]*?)\]\]/g, (m, _c: string, body: string) => body.split("||").slice(1).join(""));
    if (ADULT_TAG_RE.test(outsideAdults)) errors.push(`${at}: ${where} — метки взрослых вне блока [[?ВОСПИТАТЕЛЬn: … || без взрослых]]`);
    // Слот больше одного ребёнка (детей больше, чем слотов): формы {РДn:…} — с третьей формой для многих
    if (g.max - 1 > S) for (const m of t.matchAll(/\{РД\d+:([^{}]*)\}/g)) if (m[1].split("|").length < 3) errors.push(`${at}: ${where} — ${m[0]}: нужна форма для нескольких детей ({РДn:м|ж|мн}), детей бывает больше, чем слотов`);
  }
  if (g.max > 9 && !spreads.some((t) => t.includes("{ПЕРЕКЛИЧКА}"))) errors.push(`${at}: группа больше 9 — нужен разворот-ведомость с {ПЕРЕКЛИЧКА} («Наш класс»)`);
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
/** Имена художников, студий и франшиз, которых не должно быть в стилях картинок (юридическое правило). */
const BANNED_ART_NAMES =
  /nordqvist|нурдквист|bidstrup|бидструп|berner|бернер|shepard|шепард|suteev|сутеев|saint-?exup|экзюпери|pogodi|погоди|kanivets|канивец|semenov|семёнов|семенов|gravity falls|гравити|disney|дисней|pooh|винни|soyuzmult|союзмульт|wimmel|hirsch|ghibli|pixar|миядзаки|miyazaki/i;

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
    ["trial", TRIAL_ART_STYLES],
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
      if (BANNED_ART_NAMES.test([a.title, a.description, a.prompt, a.negative].join(" "))) errors.push(`${where} — имя художника, студии или франшизы в стиле: только техника`);
      // Пробный стиль: только в art/trial.ts и со status "trial" и в ArtStyle, и в ART_STYLE_IDS
      const idStatus = ART_STYLE_IDS.find((x) => x.id === a.id)?.status ?? "live";
      if ((a.status ?? "live") !== idStatus) errors.push(`${where} — status ${a.status ?? "live"}, а в ART_STYLE_IDS — ${idStatus}`);
      if ((owner === "trial") !== (idStatus === "trial")) errors.push(`${where} — пробные стили (status "trial") живут только в art/trial.ts`);
      const p = a.demo.palette;
      if (![p.paper, p.ink, ...p.accents].every((c) => HEX.test(c)) || !p.accents.length) errors.push(`${where} — палитра demo: цвета #rrggbb, accents не пуст`);
    }
  }
  for (const a of ART_STYLE_IDS) if (BANNED_ART_NAMES.test(`${a.title} ${a.oneLine}`)) errors.push(`profiles: стиль ${a.id} — имя художника, студии или франшизы в описании`);
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
      else if (ART_STYLE_IDS.find((x) => x.id === a)?.status === "trial") errors.push(`${at}: пробный стиль ${a} нельзя рекомендовать в сюжете (на сайте он скрыт)`);
      else if (!definedArt.has(a)) soft(`${at}: стиль картинок ${a} ещё не описан`);
    }
    if (!themeKeys.has(p.theme)) errors.push(`${at}: тема ${p.theme} не из DEMO_THEME_KEYS`);
    else if (!themesByKey[p.theme]) soft(`${at}: тема ${p.theme} ещё не нарисована`);
    if (p.gender !== undefined && p.gender !== null && p.gender !== "boy" && p.gender !== "girl") errors.push(`${at}: gender — boy | girl | null`);

    const ex = p.extras;
    if (!ex || ex.min < 0 || ex.max > 3 || ex.min > ex.max) errors.push(`${at}: extras — 0 ≤ min ≤ max ≤ 3`);
    for (const r of ex?.roles ?? []) if (!(EXTRA_ROLES as readonly string[]).includes(r)) errors.push(`${at}: неизвестная роль доп. героя ${r}`);

    if (!p.coverScene || CYR.test(p.coverScene) || /[{}]/.test(p.coverScene)) errors.push(`${at}: coverScene — на английском, без меток`);
    for (const k of p.coreOccasions ?? []) if (!p.occasions.includes(k)) errors.push(`${at}: coreOccasions ${k} нет в occasions`);
    if (p.spreads.length !== 12) errors.push(`${at}: ${p.spreads.length} разворотов, нужно ровно 12`);
    const verse = !!textStyle(p.textStyle)?.verse;
    const texts: [string, string][] = [["title", titleTemplate(p.title)]];
    p.spreads.forEach((s, i) => {
      if (!s.text?.trim()) errors.push(`${at}: разворот ${i + 1} без текста`);
      if (!s.scene?.trim() || CYR.test(s.scene)) errors.push(`${at}: разворот ${i + 1} — scene на английском и без имён`);
      if (!p.group && /\{GROUP(_ADULTS)?\}/.test(s.scene)) errors.push(`${at}: разворот ${i + 1} — {GROUP} в сцене только у сюжетов с group`);
      if (/\{(?!GROUP\}|GROUP_ADULTS\})[^}]*\}/.test(s.scene)) errors.push(`${at}: разворот ${i + 1} — в сцене допустимы только {GROUP} и {GROUP_ADULTS}`);
      texts.push([`разворот ${i + 1}`, s.text ?? ""]);
    });
    if (verse) {
      // Стихи (обе ветки блоков [[?…]]): имя и повод — только в отдельных строках-обращениях; имён — не больше 4 на книгу; формы рода — равной длины
      const verseTexts: [string, string][] = [
        ...p.spreads.map((s, i): [string, string] => [`разворот ${i + 1}`, s.text ?? ""]),
        ...Object.entries(p.occasionHooks ?? {}).flatMap(([k, h]): [string, string][] => (h ? [[`крючок ${k}`, h.opening], [`крючок ${k}`, h.closing]] : [])),
      ];
      for (const [where, t0] of verseTexts) {
        const t = `${blockVariant(t0, "then")}\n${blockVariant(t0, "else")}`;
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
    groupChecks(p, texts, errors);
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
