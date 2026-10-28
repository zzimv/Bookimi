import type { Metadata } from "next";
import { QuizWizard } from "@/components/quiz/QuizWizard";
import { getStories } from "@/lib/catalog";
import { db, hasDatabase } from "@/lib/db";
import { STYLES } from "@/lib/catalog-defaults";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Создать книгу", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const stories = await getStories();
  const styles = hasDatabase
    ? await db.illustrationStyle.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { key: true, title: true, description: true } })
    : STYLES.filter((s) => s.active);
  const initial: Record<string, unknown> = {};
  if (sp.skazka && stories.some((s) => s.slug === sp.skazka)) initial.story = { slug: sp.skazka, idea: "" };
  if (sp.povod) initial.occasion = { key: sp.povod, custom: "" };
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
      stories={stories.map((s) => ({ slug: s.slug, title: s.title, tagline: s.tagline, coverTheme: s.coverTheme, ageMin: s.ageMin, ageMax: s.ageMax }))}
      styles={styles}
      initial={initial}
      captchaKey={process.env.YANDEX_SMARTCAPTCHA_CLIENT_KEY || undefined}
    />
  );
}
