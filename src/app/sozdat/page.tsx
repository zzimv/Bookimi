import type { Metadata } from "next";
import { QuizWizard } from "@/components/quiz/QuizWizard";
import { getStories } from "@/lib/catalog";
import { db, hasDatabase } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ART_STYLE_IDS, OCCASIONS } from "@/content/profiles";
import { audienceFromParam, SVOYA_IDEYA } from "@/lib/storefront";
import { moodSwatch } from "@/lib/mood-swatch";
import { MOODS } from "@/content/moods";

export const metadata: Metadata = { title: "Создать книгу", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Стили для анкеты: из админки (включён/выключен, название), аудитории — из профилей. */
async function quizStyles() {
  const base = ART_STYLE_IDS.map((s) => ({ key: s.id, title: s.title, description: s.oneLine, audiences: s.audiences }));
  if (!hasDatabase) return base;
  try {
    const rows = await db.illustrationStyle.findMany({ orderBy: { sortOrder: "asc" }, select: { key: true, title: true, description: true, isActive: true } });
    if (!rows.length) return base;
    return rows
      .filter((r) => r.isActive)
      .map((r) => ({ key: r.key, title: r.title, description: r.description, audiences: ART_STYLE_IDS.find((s) => s.id === r.key)?.audiences }));
  } catch {
    return base;
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [all, styles] = await Promise.all([getStories(), quizStyles()]);
  const stories = all.filter((s) => s.slug !== SVOYA_IDEYA);
  const initial: Record<string, unknown> = {};
  // ?dlya=ADULT|TEEN|PET|CHILD (или detyam/podrostkam/…) — аудитория; ?skazka=<slug> — книга (аудитория берётся из неё);
  // ?povod=<ключ> — повод. Книга выбрана → анкета не спрашивает ни повод, ни сюжет.
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
  // «Новая книга с этим героем» из кабинета
  if (sp.geroj) {
    const user = await currentUser();
    const h = user ? await db.hero.findFirst({ where: { id: sp.geroj, userId: user.id, role: "main" } }) : null;
    if (h) {
      initial.hero = { name: h.name, nickname: h.nickname ?? "", gender: h.gender ?? undefined, ageGroup: h.ageGroup ?? undefined, birthDate: h.birthDate?.toISOString().slice(0, 10) ?? "" };
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
      }))}
      styles={styles}
      moods={MOODS.map((m) => ({ id: m.id, title: m.title, oneLine: m.oneLine, audiences: m.audiences, minAge: m.minAge, swatch: moodSwatch(m) }))}
      initial={initial}
      locked={Boolean(picked)}
      presetAudience={Boolean(dlya) && !picked}
      presetOccasion={Boolean(povod) && !picked}
      captchaKey={process.env.YANDEX_SMARTCAPTCHA_CLIENT_KEY || undefined}
    />
  );
}
