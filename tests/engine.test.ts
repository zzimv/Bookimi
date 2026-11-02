// Подключение контент-движка к приложению: анкета v2 → текст (демо, бриф YandexGPT) → промпт картинок → демо-SVG.
import { describe, expect, it } from "vitest";
import { AnswersV2, heroAge, segmentFor } from "@/lib/quiz";
import { brief, DemoTextProvider, personalize, plotForAnswers, textStyleFor } from "@/lib/gen/text";
import { DemoImageProvider, filterNegative, scenePrompt, stylePrompt } from "@/lib/gen/image";
import { artStyle, mood, plotBySlug, PLOTS } from "@/content/registry";
import { bookWording } from "@/lib/pdf";
import { getStories, getStoriesForOccasion } from "@/lib/catalog";

const CASES = {
  child: { audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "4-5" }, occasion: { key: "novyj-god" }, story: { slug: "novogodnee-puteshestvie-s-dedom-morozom" }, extras: [{ role: "pet", name: "Пушок", species: "cat" }] },
  teen: { audience: "TEEN", hero: { name: "Артём", gender: "boy", age: 12 }, occasion: { key: "den-rozhdeniya" }, story: { slug: "uroven-kotorogo-net" } },
  couple: { audience: "ADULT", hero: { name: "Ольга", gender: "female", age: 31 }, occasion: { key: "godovshchina" }, story: { slug: "nasha-istoriya" }, extras: [{ role: "partner", name: "Игорь" }] },
  cat: { audience: "PET", hero: { name: "Барсик", gender: "boy" }, pet: { species: "cat", furColor: "рыжий" }, occasion: { key: "den-koshek" }, story: { slug: "skazanie-o-divane" }, extras: [{ role: "owner", name: "Аня" }] },
} as const;

describe("анкета v2 → книга", () => {
  for (const [name, raw] of Object.entries(CASES)) {
    it(`${name}: демо-текст без меток, сегмент и голос`, async () => {
      const a = AnswersV2.parse(raw);
      const plot = plotForAnswers(a)!;
      expect(plot.audience).toBe(a.audience);
      expect(segmentFor(a, plot.segments)?.audience).toBe(a.audience);
      expect(textStyleFor(a, plot)?.id).toBe(plot.textStyle);
      const r = await new DemoTextProvider().write(a, plot, 0);
      expect(r.raw.spreads).toHaveLength(12);
      const t = personalize(r.raw, a);
      const all = [t.title, ...t.spreads.map((s) => s.text)].join("\n");
      expect(all).not.toMatch(/[{}]|\[Имя\]/);
      expect(all).toContain(a.hero.name);
      for (const e of a.extras) expect(all).toContain(e.name);
      const b = brief(a, plot, textStyleFor(a, plot));
      expect(b).not.toContain(a.hero.name); // имя не уходит в ИИ
      expect(b).toMatch(/Сегмент/);
    });
  }
  it("повод вплетается: новый год у детей, день кошек у питомца", async () => {
    const a = AnswersV2.parse({ ...CASES.child, story: { slug: "kapitan-podvodnoj-lodki" } });
    const t = personalize((await new DemoTextProvider().write(a, plotForAnswers(a), 0)).raw, a);
    expect(t.spreads[11].text).toMatch(/Новым годом/);
  });
  it("своя идея: голос — первый голос сегмента", async () => {
    const a = AnswersV2.parse({ audience: "ADULT", hero: { name: "Ира", gender: "girl" }, story: { idea: "поход в горы", ideaChoice: { title: "Вершина", summary: "о походе" } }, segment: "adult-friend" });
    expect(textStyleFor(a, null)?.id).toBe("mock-epic");
    const r = await new DemoTextProvider().write(a, null, 0);
    expect(r.raw.title).toBe("Вершина");
    expect(r.raw.spreads).toHaveLength(12);
  });
  it("возраст по аудитории и старые ответы", () => {
    expect(heroAge(AnswersV2.parse({ hero: { name: "А", gender: "boy", ageGroup: "6-7" } }))).toBe(6); // старое «6–7» → группа 5–7 лет
    expect(heroAge(AnswersV2.parse({ audience: "ADULT", hero: { name: "А", gender: "boy" } }))).toBe(35);
  });
});

describe("промпт картинок", () => {
  it("стиль своей аудитории — как есть; чужой — без чужой фразы о герое", () => {
    expect(stylePrompt(artStyle("pet-cartoon"), "pet-cartoon", "pet").own).toBe(true);
    const kidsForPet = stylePrompt(artStyle("watercolor-air"), "watercolor-air", "pet");
    expect(kidsForPet.prompt).not.toMatch(/The child keeps/);
    const petForChild = stylePrompt(artStyle("soft-gouache"), "soft-gouache", "child");
    expect(petForChild.prompt).not.toMatch(/the hero is the specific pet/);
    expect(filterNegative(petForChild.negative, "child", "")).not.toMatch(/human body/);
  });
  it("костюм в сцене снимает запрет костюмов (art/pets.ts)", () => {
    const neg = artStyle("pet-cartoon")!.negative;
    expect(filterNegative(neg, "pet", "the cat in a carnival costume")).not.toMatch(/costumes/);
    expect(filterNegative(neg, "pet", "the cat on a sofa")).toMatch(/costumes/);
  });
  it("настроение добавляется к промпту и негативу", () => {
    const job = { plot: { slug: "x", theme: "winter", heroKind: "child" as const }, index: 1, scene: "the child in a snowy forest", style: "kind-classic", mood: mood("warm"), heroes: [{ role: "main", description: "", photos: [] }], age: 5, preview: true };
    const p = scenePrompt(job);
    expect(p.prompt).toMatch(/Scene: the child in a snowy forest/);
    expect(p.prompt).toMatch(/Mood: warm amber/);
    expect(p.negative).toMatch(/cold blue cast/);
  });
  it("демо-картинка: герой и доп. герои, настроение", async () => {
    const plot = plotBySlug("nasha-istoriya")!;
    const r = await new DemoImageProvider().scene({ plot, index: 0, scene: "", style: "linocut", mood: mood("romantic"), heroes: [{ role: "main", description: "", photos: [], look: { gender: "girl" } }, { role: "partner", description: "", photos: [], look: { gender: "boy" } }], age: 30, preview: true, title: "Наша история" });
    const svg = r.data.toString();
    expect(svg).toMatch(/^<svg/);
    // Название на обложку накладывают сайт и PDF — в самой картинке его нет (иначе на демо-обложке оно дважды)
    expect(svg).not.toMatch(/Наша история/);
    expect(svg).not.toMatch(/NaN|undefined/);
  });
});

describe("каталог и PDF", () => {
  it("без БД — все сюжеты реестра с полями движка", async () => {
    // Покупателю — только продающиеся аудитории (по умолчанию дети); админке — все сюжеты
    const all = await getStories({ includeSoon: true });
    expect(all).toHaveLength(PLOTS.length);
    expect(await getStories()).toHaveLength(PLOTS.filter((p) => p.audience === "CHILD").length);
    expect(all.every((s) => s.coverColors && s.extras && s.artStyles.length)).toBe(true);
    expect((await getStories({ audience: "PET", includeSoon: true })).every((s) => s.audience === "PET")).toBe(true);
    expect(await getStories({ audience: "PET" })).toEqual([]);
    const ny = await getStoriesForOccasion("novyj-god", "CHILD");
    expect(ny[0].occasions[0]).toBe("novyj-god");
    // Публичный срез без системных промптов и планов
    expect(JSON.stringify(all)).not.toMatch(/systemPrompt|spreads|coverScene/);
  });
  it("подписи PDF по аудитории", () => {
    expect(bookWording({ heroName: "Барсик", audience: "PET" }).madeFor).toMatch(/кличке Барсик/);
    expect(bookWording({ heroName: "Ольга", audience: "ADULT", heroGender: "girl" }).back).toMatch(/главная героиня/);
    expect(bookWording({ heroName: "Марк" }).back).toMatch(/^Сказка/);
  });
});
