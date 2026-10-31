import type { Metadata } from "next";
import { QuizWizard } from "@/components/quiz/QuizWizard";
import { getStories } from "@/lib/catalog";
import { db, hasDatabase } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ART_STYLE_IDS, OCCASIONS, SEGMENTS } from "@/content/profiles";
import { visibleArtStyleIds } from "@/content/art/index";
import { cfg } from "@/lib/settings";
import { audienceFromParam, SVOYA_IDEYA } from "@/lib/storefront";
import { moodSwatch } from "@/lib/mood-swatch";
import { MOODS } from "@/content/moods";
import { plotBySlug, sectionPlot } from "@/content/registry";
import { normalizeName } from "@/lib/declension";

export const metadata: Metadata = { title: "Создать книгу", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Стили для анкеты: из админки (включён/выключен, название), аудитории — из профилей.
 * Пробные стили (status "trial") — только при настройке art.showTrialStyles, всегда в конце и со значком.
 */
async function quizStyles() {
  const showTrial = (await cfg("art")).showTrialStyles;
  const visible = visibleArtStyleIds(showTrial);
  const toQuiz = (s: (typeof ART_STYLE_IDS)[number]) => ({ key: s.id, title: s.title, description: s.oneLine, audiences: s.audiences, trial: s.status === "trial" || undefined });
  const base = visible.map(toQuiz);
  const trial = visible.filter((s) => s.status === "trial").map(toQuiz);
  if (!hasDatabase) return base;
  try {
    const rows = await db.illustrationStyle.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, title: true, description: true, isActive: true } });
    if (!rows.length) return base;
    const isTrial = new Set(trial.map((t) => t.key));
    return [
      ...rows
        .filter((r) => r.isActive && !isTrial.has(r.key) && visible.some((s) => s.id === r.key))
        .map((r) => ({ key: r.key, title: r.title, description: r.description, audiences: ART_STYLE_IDS.find((s) => s.id === r.key)?.audiences })),
      ...trial,
    ];
  } catch {
    return base;
  }
}

/** Для шага «Книга» (разделы повода, как на сайте) и шага «Группа»: проекция сюжета без промптов и планов. */
function groupInfo(slug: string) {
  const plot = plotBySlug(slug);
  if (!plot) return { core: [], hooks: [], group: null };
  const { core, hooks } = sectionPlot(plot);
  const g = plot.group;
  return {
    core,
    hooks,
    group: g ? { min: g.min, max: g.max, label: g.label, adultRoles: [...(g.includeAdults?.roles ?? [])], adultsMax: g.includeAdults?.max ?? 0 } : null,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [all, styles, flags, bulk] = await Promise.all([getStories(), quizStyles(), cfg("flags"), cfg("bulk")]);
  const stories = all.filter((s) => s.slug !== SVOYA_IDEYA);
  const initial: Record<string, unknown> = {};
  // ?dlya=ADULT|TEEN|PET|CHILD (или detyam/podrostkam/…) — аудитория; ?skazka=<slug> — книга (аудитория берётся из неё);
  // ?povod=<ключ> — повод; ?pol=, ?segment= — см. ниже. Книга выбрана → анкета не спрашивает ни повод, ни сюжет.
  const dlya = audienceFromParam(sp.dlya);
  if (dlya) initial.audience = dlya;
  const picked = sp.skazka ? stories.find((s) => s.slug === sp.skazka) : undefined;
  const povod = sp.povod && OCCASIONS.some((o) => o.key === sp.povod) ? sp.povod : undefined;
  if (picked) {
    initial.story = { slug: picked.slug, idea: "" };
    initial.audience = picked.audience;
    // Повод: из ссылки; иначе — если книга написана к одному поводу (новогодняя, ко дню рождения); иначе без повода
    const own = picked.occasions.filter((o) => o !== "bez");
    initial.occasion = { key: povod ?? (own.length === 1 ? own[0] : "bez"), custom: "" };
  } else if (povod) initial.occasion = { key: povod, custom: "" };
  // Полка главной: ?pol=boy|girl — пол героя («Сын», «Дочь», «Мама»…), ?segment=<сегмент аудитории> — кому книга
  // («Папа» → adult-parent). Только вместе с аудиторией из ссылки и без выбранной книги.
  if (dlya && !picked) {
    if (sp.pol === "boy" || sp.pol === "girl") initial.hero = { gender: sp.pol };
    if (sp.segment && SEGMENTS.some((x) => x.id === sp.segment && x.audience === dlya)) initial.segment = sp.segment;
  }
  // «Новая книга с этим героем» из кабинета
  if (sp.geroj) {
    const user = await currentUser();
    const h = user ? await db.hero.findFirst({ where: { id: sp.geroj, userId: user.id, role: "main" } }) : null;
    if (h) {
      initial.hero = { name: normalizeName(h.name), nickname: normalizeName(h.nickname ?? ""), gender: h.gender ?? undefined, ageGroup: h.ageGroup ?? undefined, birthDate: h.birthDate?.toISOString().slice(0, 10) ?? "" };
      initial.appearance = h.appearance;
      initial.interests = h.interests;
    }
  }
  return (
    <QuizWizard
      stories={stories.map((s) => ({
        slug: s.slug,
        title: s.title,
        tagline: s.tagline,
        audience: s.audience,
        coverTheme: s.coverTheme,
        ageMin: s.ageMin,
        ageMax: s.ageMax,
        occasions: s.occasions,
        artStyles: s.artStyles,
        segments: s.segments,
        extras: s.extras,
        ...groupInfo(s.slug),
      }))}
      styles={styles}
      moods={MOODS.map((m) => ({ id: m.id, title: m.title, oneLine: m.oneLine, audiences: m.audiences, minAge: m.minAge, swatch: moodSwatch(m) }))}
      initial={initial}
      locked={Boolean(picked)}
      presetAudience={Boolean(dlya) && !picked}
      presetOccasion={Boolean(povod) && !picked}
      captchaKey={process.env.YANDEX_SMARTCAPTCHA_CLIENT_KEY || undefined}
      photoEnabled={flags.photoUploadEnabled}
      bulkTiers={bulk.enabled ? bulk.tiers : []}
    />
  );
}
