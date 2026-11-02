// rev 12 (решения владелицы 02.11.2026):
//  1) детские книги — строго одна возрастная группа 2–4 / 5–7 / 8–10 (текст фиксирован), подписи ровно «2–4 года», «5–7 лет», «8–10 лет»;
//  2) демо и запуск — только дети: подростки, взрослые и питомцы «скоро», их книг покупатель не видит нигде.
import { describe, expect, it } from "vitest";
import { PLOTS, validateContent } from "../src/content/registry";
import { bookAgeLabel, KID_AGE_GROUPS, kidGroupOf, normalizeAgeGroup } from "../src/content/ages";
import { AnswersV2, AGE_GROUPS, heroAge, segmentFor } from "../src/lib/quiz";
import { DEFAULTS } from "../src/lib/settings";
import { occasionIsLive, soonAudiences, visiblePlots } from "../src/lib/shelf";
import { ageLabel, getAgePage, getStories, getStory } from "../src/lib/catalog";
import { AGE_PAGES } from "../src/lib/catalog-defaults";
import { buildHolidayCards } from "../src/lib/holidays";
import { DEFAULT_HOLIDAYS, DEFAULT_LEAD, upcomingHolidays, type Holiday } from "../src/lib/holidays-core";

const ASSIGNED: Record<string, string[]> = {
  "kids-2-4": ["sonnaya-strana", "imya-i-morkovka-upryamica", "utro-kuvyrkom", "imya-i-lesnaya-yolochka", "imya-i-zvyozdnyj-drakonchik"],
  "kids-5-7": ["novogodnee-puteshestvie-s-dedom-morozom", "den-rozhdeniya-v-skazochnom-korolevstve", "kapitan-podvodnoj-lodki", "imya-i-mesyac-yasnyj", "poslednij-den-v-nashej-gruppe", "my-vyrosli", "volshebnyj-shkafchik", "nash-pervyj-klass"],
  "kids-8-10": ["imya-i-vesna-krasna", "delo-o-propavshem-kolokolchike", "lunnaya-oranzhereya", "odinnadcat-polunochej"],
};
const kids = PLOTS.filter((p) => p.audience === "CHILD");
const soonDefault = soonAudiences(DEFAULTS.storefront.soon);

describe("возрастные группы детских книг: строго 2–4, 5–7, 8–10", () => {
  it("каждая детская книга — ровно один сегмент kids-*, возраст = границы группы", () => {
    expect(kids.length).toBeGreaterThanOrEqual(17);
    for (const p of kids) {
      expect(p.segments, p.slug).toHaveLength(1);
      const g = kidGroupOf(p.segments);
      expect(g, p.slug).toBeDefined();
      expect([p.ageMin, p.ageMax], p.slug).toEqual([g!.min, g!.max]);
    }
    expect(validateContent().errors.filter((e) => /детской книги|у группы kids/.test(e))).toEqual([]);
  });

  it("книги распределены по группам, как решила владелица", () => {
    for (const [seg, slugs] of Object.entries(ASSIGNED)) for (const s of slugs) expect(PLOTS.find((p) => p.slug === s)?.segments, s).toEqual([seg]);
  });

  it("в каждой группе есть новогодняя книга", () => {
    expect(PLOTS.find((p) => p.slug === "imya-i-lesnaya-yolochka")?.segments).toEqual(["kids-2-4"]);
    expect(PLOTS.find((p) => p.slug === "novogodnee-puteshestvie-s-dedom-morozom")?.segments).toEqual(["kids-5-7"]);
    expect(PLOTS.find((p) => p.slug === "odinnadcat-polunochej")?.segments).toEqual(["kids-8-10"]);
    for (const g of KID_AGE_GROUPS) expect(kids.some((p) => p.segments[0] === g.segment && p.occasions.includes("novyj-god")), g.segment).toBe(true);
  });

  it("validateContent ловит детскую книгу с двумя группами или чужим возрастом", () => {
    const base = kids[0];
    PLOTS.push({ ...base, slug: "test-two-groups", segments: ["kids-2-4", "kids-5-7"] }, { ...base, slug: "test-wrong-ages", segments: ["kids-5-7"], ageMin: 3, ageMax: 9 });
    try {
      const errs = validateContent().errors;
      expect(errs.some((e) => e.includes("test-two-groups") && e.includes("ровно один сегмент"))).toBe(true);
      expect(errs.some((e) => e.includes("test-wrong-ages") && e.includes("5–7"))).toBe(true);
    } finally {
      PLOTS.splice(PLOTS.length - 2, 2);
    }
  });

  it("подписи возраста — ровно «2–4 года», «5–7 лет», «8–10 лет»", () => {
    expect(KID_AGE_GROUPS.map((g) => g.label)).toEqual(["2–4 года", "5–7 лет", "8–10 лет"]);
    for (const p of kids) expect(["2–4 года", "5–7 лет", "8–10 лет"]).toContain(ageLabel(p.ageMin!, p.ageMax!, "CHILD", p.segments));
    expect(bookAgeLabel({ audience: "CHILD", ageMin: 8, ageMax: 10 })).toBe("8–10 лет");
    expect(AGE_PAGES.map((a) => a.slug)).toEqual(["2-4-goda", "5-7-let", "8-10-let"]);
    expect(getAgePage("8-9-let")?.slug).toBe("8-10-let"); // старый адрес — та же страница
  });

  it("анкета: группы 2-4 / 5-7 / 8-10, старые ответы переводятся, сегмент — 1:1", () => {
    expect(AGE_GROUPS.map((g) => [g.key, g.label])).toEqual([["2-4", "2–4 года"], ["5-7", "5–7 лет"], ["8-10", "8–10 лет"]]);
    expect(["2-3", "4-5", "6-7", "8-9"].map(normalizeAgeGroup)).toEqual(["2-4", "5-7", "5-7", "8-10"]);
    for (const [old, now] of [["2-3", "2-4"], ["4-5", "5-7"], ["6-7", "5-7"], ["8-9", "8-10"], ["8-10", "8-10"]]) {
      const a = AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: old } });
      expect(a.hero.ageGroup).toBe(now);
      expect(segmentFor(a).id).toBe(`kids-${now}`);
    }
    expect(() => AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "11-12" } })).toThrow();
    expect(heroAge(AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "2-4" } }))).toBe(3);
    // Книга выбрана — сегмент книги (у детской книги он один)
    const a = AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "2-4" } });
    expect(segmentFor(a, ["kids-8-10"]).id).toBe("kids-8-10");
  });
});

describe("«скоро»: подростки, взрослые, питомцы", () => {
  it("по умолчанию продаются только дети", () => {
    expect(soonDefault).toEqual(["TEEN", "ADULT", "PET"]);
    expect(visiblePlots(PLOTS, soonDefault).every((p) => p.audience === "CHILD")).toBe(true);
  });

  it("каталог (без БД) отдаёт только детские книги; книга «скоро» не открывается", async () => {
    const list = await getStories();
    expect(list.length).toBe(kids.length);
    expect(list.every((s) => s.audience === "CHILD")).toBe(true);
    expect(list.every((s) => ["2–4 года", "5–7 лет", "8–10 лет"].includes(ageLabel(s.ageMin, s.ageMax, s.audience, s.segments)))).toBe(true);
    const teen = PLOTS.find((p) => p.audience === "TEEN")!;
    expect(await getStory(teen.slug)).toBeNull();
    expect(await getStory(teen.slug, { includeSoon: true })).not.toBeNull();
    // Фильтр по возрасту — ровно книги группы
    for (const g of KID_AGE_GROUPS) {
      const byAge = await getStories({ audience: "CHILD", segment: g.segment });
      expect(byAge.length, g.segment).toBeGreaterThan(0);
      expect(byAge.every((s) => s.ageMin === g.min && s.ageMax === g.max)).toBe(true);
    }
  });

  it("поводы и праздники только «скоро»-аудиторий скрыты, у общих — только детские книги", () => {
    expect(occasionIsLive("den-vlyublennyh", soonDefault)).toBe(false);
    expect(occasionIsLive("den-pitomca", soonDefault)).toBe(false);
    expect(occasionIsLive("novyj-god", soonDefault)).toBe(true);
    expect(occasionIsLive("pervyj-klass", soonDefault)).toBe(true);
    const feb: Holiday = { ...DEFAULT_HOLIDAYS[0], id: "feb14", title: "День влюблённых", occasionKey: "den-vlyublennyh", rule: { kind: "fixed", month: 2, day: 14 } as Holiday["rule"], showFromDays: 400, bookSlugs: [] };
    const now = new Date("2026-11-02T12:00:00+03:00");
    const calcs = upcomingHolidays([...DEFAULT_HOLIDAYS, feb], now, DEFAULT_LEAD);
    const stories = PLOTS.map((p) => ({ slug: p.slug, title: p.title, audience: p.audience, occasions: p.occasions })) as never[];
    const cards = buildHolidayCards(calcs, stories, now, DEFAULT_LEAD, soonDefault);
    expect(cards.some((c) => c.occasionKey === "den-vlyublennyh")).toBe(false);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.books.every((b) => b.audience === "CHILD"), c.id).toBe(true);
      expect(c.audiences.every((a) => a.href.includes("detyam")), c.id).toBe(true);
    }
  });
});
