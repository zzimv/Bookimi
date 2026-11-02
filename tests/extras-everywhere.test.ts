// Доп. герои детской книги: в фиксированном тексте (≥ 3 разных упоминания каждого, во всех голосах),
// вид питомца (кошка — это кошка), все доп. герои — на обложке и на каждом развороте демо-картинок.
import { describe, expect, it } from "vitest";
import { getPlots, textStyle } from "@/content/registry";
import { AnswersV2 } from "@/lib/quiz";
import { DemoTextProvider, personalize } from "@/lib/gen/text";
import { extraKind, extraMentions, extraPetLook, extraSpecies, extraThing, extraWord, speciesFromText } from "@/lib/gen/extras";
import { declineName, guessGender, CASES } from "@/lib/declension";
import { extraGender } from "@/content/answers";
import { nameInMetricLine } from "@/content/tags";
import { extraDrawKind } from "@/content/art/index";
import { renderDemoSpread } from "@/content/art/render";
import { DemoImageProvider, extraPromptWho, scenePrompt, type HeroRef } from "@/lib/gen/image";

type Ex = { role: string; name: string; species?: "cat" | "dog" | "other"; description?: string; what?: string; gender?: "boy" | "girl" | "n" };

const SETS: Ex[][] = [
  [{ role: "mom", name: "Оля" }],
  [{ role: "pet", name: "Пушок", species: "cat" }],
  [{ role: "sibling", name: "Миша" }, { role: "toy", name: "Тим", what: "плюшевый заяц" }],
  [{ role: "pet", name: "Мурка", description: "серая кошка" }, { role: "grandma", name: "Галя" }, { role: "friend", name: "Аня" }],
  [{ role: "dad", name: "Петя" }, { role: "custom", name: "Дуб", what: "дерево", gender: "n" }, { role: "pet", name: "Бублик", species: "dog" }],
  [{ role: "mom", name: "Оля" }, { role: "grandma", name: "Галя" }, { role: "dad", name: "Петя" }],
];
const HEROES = [
  { name: "Маша", gender: "girl" },
  { name: "Марк", gender: "boy" },
] as const;

const forms = (e: Ex) => {
  const g = extraGender(e as never, guessGender);
  return new Set(CASES.map((c) => declineName(e.name, c, g)));
};
const mentions = (text: string, e: Ex) => [...forms(e)].some((f) => new RegExp(`(?<![А-Яа-яЁё])${f}(?![а-яё])`).test(text));

describe("доп. герои в фиксированном тексте детских книг", () => {
  const plots = getPlots({ audience: "CHILD" });
  it("детских сюжетов достаточно для проверки", () => expect(plots.length).toBeGreaterThanOrEqual(10));

  for (const plot of plots) {
    it(`${plot.slug}: каждый доп. герой — минимум 3 раза, на разных разворотах, разными словами`, async () => {
      const verse = !!textStyle(plot.textStyle)?.verse;
      for (const set of SETS) {
        const extras = set.slice(0, plot.extras.max);
        if (!extras.length) continue;
        for (const h of HEROES) {
          for (const v of [0, 1]) {
            const a = AnswersV2.parse({ audience: "CHILD", hero: { ...h, ageGroup: "6-7" }, extras, story: { slug: plot.slug } });
            const raw = (await new DemoTextProvider().write(a, plot, v)).raw;
            const book = personalize(raw, a);
            const all = book.spreads.map((s) => s.text).join("\n");
            expect(all, `${plot.slug}: метки не подставлены`).not.toMatch(/[{}]/);
            extras.forEach((e, i) => {
              const where = book.spreads.filter((s) => mentions(s.text, e)).length;
              expect(where, `${plot.slug} / ${e.role} ${e.name}: разворотов с именем`).toBeGreaterThanOrEqual(3);
              expect(raw.spreads.filter((s) => s.text.includes(`{ДОП${i + 1}`)).length).toBeGreaterThanOrEqual(3);
            });
            // Стихи: имя доп. героя — только в строке-обращении вне метра
            if (verse) for (const s of raw.spreads) expect(nameInMetricLine(s.text).filter((l) => /\{ДОП/.test(l)), plot.slug).toEqual([]);
          }
        }
        // Формулировки в книге не повторяются (одинаковые шаблоны — даже у разных героев)
        const voice = verse ? "verse" : ["cumulative-bedtime", "gentle-bedtime"].includes(plot.textStyle) ? "calm" : "prose";
        const ms = extraMentions(extras as never, voice, 0);
        const shapes = ms.map((m) => m.tpl);
        expect(new Set(shapes).size, `${plot.slug}: ${shapes.join(" | ")}`).toBe(shapes.length);
        expect(ms).toHaveLength(extras.length * 3);
        for (let i = 1; i <= extras.length; i++) expect(new Set(ms.filter((m) => m.n === i).map((m) => m.spread)).size).toBe(3);
      }
    });
  }

  it("роль звучит словами: «мама Оля», «кошка Мурка», «кот Пушок», «брат Миша», «плюшевый заяц Тим»; питомец не говорит", async () => {
    const plot = plots.find((p) => p.slug === "kapitan-podvodnoj-lodki")!;
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "6-7" }, extras: [{ role: "mom", name: "Оля" }, { role: "pet", name: "Пушок", species: "cat" }, { role: "sibling", name: "Миша" }], story: { slug: plot.slug } });
    const t = personalize((await new DemoTextProvider().write(a, plot, 0)).raw, a).spreads.map((s) => s.text).join(" ");
    expect(t).toMatch(/[Мм]ама Оля/);
    expect(t).toMatch(/[Кк]от Пушок/);
    expect(t).toMatch(/[Бб]рат Миша/);
    expect(t).not.toMatch(/собак|пёс/i);
    expect(extraWord({ role: "pet", name: "Мурка", species: "cat" })).toBe("кошка");
    expect(extraWord({ role: "toy", name: "Тим", what: "плюшевый заяц" })).toBe("плюшевый заяц");
    expect(extraWord({ role: "mom", name: "Мама Оля" })).toBe("");
    // Ни в одной фразе питомец не шепчет и не говорит «я с тобой»
    for (const voice of ["prose", "calm", "verse"] as const)
      for (const sp of ["cat", "dog", "other"] as const)
        for (const m of extraMentions([{ role: "pet", name: "Пушок", species: sp }, { role: "pet", name: "Бублик", species: sp }, { role: "pet", name: "Кеша", species: sp }], voice, 0))
          expect(m.text, m.text).not.toMatch(/шепн|сказал|я с тобой/i);
  });
});

describe("вид питомца — доп. героя", () => {
  it("из анкеты, описания, «кто это» и клички", () => {
    expect(extraSpecies({ role: "pet", name: "Бублик", species: "cat" })).toBe("cat");
    expect(extraSpecies({ role: "pet", name: "Пушок", description: "рыжий кот с белыми лапками" })).toBe("cat");
    expect(extraSpecies({ role: "pet", name: "Мурка", description: "серая кошечка" })).toBe("cat");
    expect(extraSpecies({ role: "pet", name: "Котик" })).toBe("cat");
    expect(extraSpecies({ role: "pet", name: "Кисуля" })).toBe("cat");
    expect(extraSpecies({ role: "pet", name: "Шарик", description: "щенок корги" })).toBe("dog");
    expect(extraSpecies({ role: "pet", name: "Рекс", what: "пёс" })).toBe("dog");
    expect(extraSpecies({ role: "pet", name: "Тузик", description: "собака" })).toBe("dog");
    expect(extraSpecies({ role: "pet", name: "Кеша", species: "other", what: "попугай" })).toBe("other");
    expect(speciesFromText("особый, который всё понимает")).toBeNull();
    expect(extraKind({ role: "pet", name: "Пушок", description: "кот" })).toBe("cat");
    expect(extraSpecies({ role: "mom", name: "Оля" })).toBeNull();
  });

  it("демо рисует кошку, когда выбрано «Кошка» (и когда «кот» только в описании)", () => {
    for (const e of [{ role: "pet" as const, name: "Пушок", species: "cat" as const }, { role: "pet" as const, name: "Мурка", description: "серая кошка" }]) {
      const svg = renderDemoSpread({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, spreadIndex: 3, hero: { gender: "girl", age: 6 }, extras: [{ role: "pet", kind: "pet", look: extraPetLook(e) }] });
      expect(svg).toMatch(/data-species="cat"/);
      expect(svg).not.toMatch(/data-species="dog"/);
    }
    const dog = renderDemoSpread({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, spreadIndex: 3, hero: {}, extras: [{ role: "pet", kind: "pet", look: extraPetLook({ role: "pet", name: "Бублик", species: "dog" }) }] });
    expect(dog).toMatch(/data-species="dog"/);
  });

  it("промпт GPU: кошка — кошка, мама — взрослая, игрушка — предмет; без имён", () => {
    const refs: HeroRef[] = [
      { role: "main", description: "", photos: [] },
      { role: "mom", description: "", photos: [], look: { gender: "girl", age: 35 }, drawKind: "adult" },
      { role: "pet", description: "серая", photos: [], look: extraPetLook({ role: "pet", name: "Пушок", species: "cat" }), drawKind: "pet" },
      { role: "toy", description: "плюшевый заяц", photos: [], look: { thing: "плюшевый заяц" }, drawKind: "toy" },
    ];
    expect(extraPromptWho(refs[2], "child")).toMatch(/cat, not a dog/);
    const p = scenePrompt({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, index: 1, scene: "the child on a hill", style: "watercolor-air", mood: null, heroes: refs, age: 6, gender: "girl", preview: true }).prompt;
    expect(p).toMatch(/the hero's mother, an adult woman/);
    expect(p).toMatch(/a pet cat/);
    expect(p).toMatch(/favourite toy/);
    expect(p).not.toMatch(/Пушок|Оля/);
  });
});

describe("все доп. герои — на обложке и на каждом развороте демо", () => {
  const extras: Ex[] = [{ role: "mom", name: "Оля" }, { role: "pet", name: "Пушок", species: "cat" }, { role: "toy", name: "Тим", what: "плюшевый заяц" }];
  const looks = extras.map((e) => ({ role: e.role, kind: extraDrawKind(e.role, "child"), look: { gender: extraGender(e as never, guessGender) === "girl" ? "girl" : "boy", ...extraPetLook(e as never), thing: extraThing(e as never) } }));

  it("renderDemoSpread: обложка + 12 разворотов, все три — в кадре, взрослый, кошка и игрушка", () => {
    for (let idx = 0; idx <= 12; idx++) {
      const W = idx === 0 ? 1024 : 2048;
      const svg = renderDemoSpread({ plot: { slug: "kapitan-podvodnoj-lodki", theme: "ocean", heroKind: "child" }, spreadIndex: idx, hero: { gender: "girl", age: 6 }, extras: looks });
      expect(svg).toMatch(/data-extra="1" data-kind="adult"/);
      expect(svg).toMatch(/data-extra="2" data-kind="pet"/);
      expect(svg).toMatch(/data-extra="3" data-kind="toy"/);
      expect(svg).toMatch(/data-species="cat"/);
      // Точка опоры каждого доп. героя — внутри кадра
      for (const m of svg.matchAll(/data-extra="\d" data-kind="\w+"><g[^>]*?transform="translate\(([-\d.]+)/g)) {
        const x = Number(m[1]);
        expect(x, `разворот ${idx}`).toBeGreaterThan(0);
        expect(x, `разворот ${idx}`).toBeLessThan(W);
      }
    }
  });

  it("три питомца на квадратной обложке тоже помещаются", () => {
    const pets = ["cat", "dog", "cat"].map((sp) => ({ role: "pet", kind: "pet" as const, look: extraPetLook({ role: "pet", name: "X", species: sp as "cat" }) }));
    const svg = renderDemoSpread({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, spreadIndex: 0, hero: {}, extras: pets });
    const xs = [...svg.matchAll(/data-extra="\d" data-kind="pet"><g data-species="\w+" transform="translate\(([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(xs).toHaveLength(3);
    for (const x of xs) {
      expect(x).toBeGreaterThan(40);
      expect(x).toBeLessThan(1024 - 40);
    }
  });

  it("DemoImageProvider (как в пайплайне): все доп. герои на обложке и развороте", async () => {
    const heroes: HeroRef[] = [{ role: "main", description: "", photos: [], look: { gender: "boy", age: 6 } }, ...looks.map((l) => ({ role: l.role, description: "", photos: [], look: l.look, drawKind: l.kind }))];
    for (const index of [0, 1, 7, 12]) {
      const img = await new DemoImageProvider().scene({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, index, scene: "the child in a garden", style: "watercolor-air", mood: null, heroes, age: 6, gender: "boy", preview: true });
      const svg = img.data.toString();
      for (const n of [1, 2, 3]) expect(svg).toContain(`data-extra="${n}"`);
      expect(svg).toMatch(/data-species="cat"/);
    }
  });
});
