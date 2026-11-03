// rev 15 (03.11.2026): у мальчиков и девочек свои 6 причёсок (не пересекаются) и свои 6 видов одежды; выбранная
// одежда и её цвет — на живой обложке, эскизах/страницах книги и в PDF (одна функция heroHairAndClothes). Без БД.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as obrazec } from "@/app/obrazec/route";
import { sampleUrl } from "@/lib/obrazec";
import { AnswersV2, coverSampleUrl, heroHairAndClothes, sketchUrls } from "@/lib/quiz";
import { KID_HAIRSTYLES, KID_HAIRSTYLE_KEYS, KID_OUTFITS, KID_OUTFIT_KEYS, kidHairCut, normalizeKidHairstyle, normalizeKidOutfit } from "@/content/looks";
import { renderDemoCharacter, renderDemoSpread } from "@/content/art/render";
import { extraDemoLook } from "@/lib/gen/extras";
import { EYE_COLORS, OUTFIT_COLORS } from "@/content/art/shared";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svgOf = async (u: string) => (await obrazec(new Request(`https://x${u}`))).text();
const heroMark = (svg: string) => /<g data-figure="child" data-gender="(\w)" data-haircut="(\w+)" data-outfit="([\w-]+)" data-outfit-color="(#\w+)"/.exec(svg);

describe("причёски по полу", () => {
  it("по 6 у мальчиков и девочек, наборы не пересекаются", () => {
    expect(KID_HAIRSTYLE_KEYS.boy).toHaveLength(6);
    expect(KID_HAIRSTYLE_KEYS.girl).toHaveLength(6);
    expect(KID_HAIRSTYLE_KEYS.boy.filter((x) => KID_HAIRSTYLE_KEYS.girl.includes(x))).toEqual([]);
    // и рисуются разными стрижками
    const cuts = [...KID_HAIRSTYLES.boy, ...KID_HAIRSTYLES.girl].map((x) => x.cut);
    expect(new Set(cuts).size).toBe(12);
  });
  it("каждая причёска рисуется по-своему во всех трёх возрастах", () => {
    for (const g of ["boy", "girl"] as const)
      for (const age of [3, 6, 9]) {
        const svgs = KID_HAIRSTYLE_KEYS[g].map((hs) => renderDemoCharacter({ kind: "child", look: { gender: g, age, hairstyle: hs }, face: "bust" }));
        expect(new Set(svgs.map((s) => heroMark(s)![2])).size).toBe(6);
        expect(new Set(svgs).size).toBe(6);
      }
  });
  it("старые ответы и чужие ключи → набор своего пола", () => {
    expect(normalizeKidHairstyle("косички", "boy")).toBe("короткая стрижка");
    expect(normalizeKidHairstyle("длинные", "girl")).toBe("длинные распущенные");
    expect(normalizeKidHairstyle("хвостик", "girl")).toBe("хвост");
    expect(normalizeKidHairstyle("кудряшки", "boy")).toBe("кудрявые");
    expect(normalizeKidHairstyle("кудряшки", "girl")).toBe("длинные кудри");
    expect(normalizeKidHairstyle("чёлка", "boy")).toBe("с чёлкой");
    expect(normalizeKidHairstyle("", "girl")).toBe("длинные распущенные");
    for (const g of ["boy", "girl"] as const) for (const x of [...KID_HAIRSTYLE_KEYS.boy, ...KID_HAIRSTYLE_KEYS.girl]) expect(KID_HAIRSTYLE_KEYS[g]).toContain(normalizeKidHairstyle(x, g));
    expect(kidHairCut("два хвостика", "boy")).not.toBe("pigtails");
  });
  it("/obrazec: мальчику с «косичками» в ссылке — мальчиковая причёска", async () => {
    const m = heroMark(await svgOf(sampleUrl({ portrait: true, kind: "child", gender: "boy", hairstyle: "косички" })));
    expect(m![1]).toBe("m");
    expect(KID_HAIRSTYLES.boy.map((x) => x.cut)).toContain(m![2]);
  });
  it("брат и сестра — причёски своего пола", () => {
    const bro = extraDemoLook({ role: "sibling", name: "Ваня", gender: "boy", look: { hairstyle: "два хвостика" } });
    const sis = extraDemoLook({ role: "sibling", name: "Аня", gender: "girl", look: { hairstyle: "ёжик" } });
    expect(KID_HAIRSTYLE_KEYS.boy).toContain(bro.hairstyle);
    expect(KID_HAIRSTYLE_KEYS.girl).toContain(sis.hairstyle);
    // взрослые — свои наборы, без перевода
    expect(extraDemoLook({ role: "grandma", name: "Валя", look: { hairstyle: "каре" } }).hairstyle).toBe("каре");
  });
  it("6 готовых героев — каждому своя причёска своего пола", () => {
    const src = read("src/components/quiz/QuizWizard.tsx");
    const block = src.slice(src.indexOf("const LOOK_PRESETS"), src.indexOf("const SKIN_WORD"));
    const boys = [...block.slice(block.indexOf("boy:"), block.indexOf("girl:")).matchAll(/hairstyle: "([^"]+)"/g)].map((m) => m[1]);
    const girls = [...block.slice(block.indexOf("girl:")).matchAll(/hairstyle: "([^"]+)"/g)].map((m) => m[1]);
    expect([...boys].sort()).toEqual([...KID_HAIRSTYLE_KEYS.boy].sort());
    expect([...girls].sort()).toEqual([...KID_HAIRSTYLE_KEYS.girl].sort());
  });
});

describe("одежда картинками по полу", () => {
  it("по 6 видов у мальчиков и девочек, каждая рисуется по-своему", () => {
    expect(KID_OUTFIT_KEYS.boy).toHaveLength(6);
    expect(KID_OUTFIT_KEYS.girl).toHaveLength(6);
    expect(KID_OUTFIT_KEYS.girl).toContain("платье");
    expect(KID_OUTFIT_KEYS.boy).not.toContain("платье");
    for (const g of ["boy", "girl"] as const) {
      expect(new Set(KID_OUTFITS[g].map((x) => x.kind)).size).toBe(6);
      const svgs = KID_OUTFIT_KEYS[g].map((o) => renderDemoCharacter({ kind: "child", look: { gender: g, age: 6, clothes: o } }));
      expect(new Set(svgs.map((s) => heroMark(s)![3])).size).toBe(6);
    }
  });
  it("старые «футболка», «толстовка с капюшоном», «платье» у мальчика → его набор", () => {
    expect(normalizeKidOutfit("толстовка с капюшоном", "boy")).toBe("худи с джинсами");
    expect(normalizeKidOutfit("футболка", "boy")).toBe("футболка с шортами");
    expect(normalizeKidOutfit("платье", "boy")).toBe("свитер с брюками");
    expect(normalizeKidOutfit("свитер", "girl")).toBe("свитер с джинсами");
    expect(normalizeKidOutfit("", "girl")).toBe("платье");
  });
  it("выбранная одежда и цвет — на живой обложке, эскизах страниц и в книге (spread)", async () => {
    const a = AnswersV2.parse({
      audience: "CHILD",
      hero: { name: "Петя", gender: "boy", ageGroup: "5-7" },
      story: { slug: "imya-i-mesyac-yasnyj" },
      appearance: { hair: "рыжие", hairstyle: "ёжик", clothes: "худи с джинсами", outfitColor: "зелёная" },
    });
    const color = OUTFIT_COLORS["зелёная"];
    for (const u of [coverSampleUrl(a), sketchUrls(a)[3]]) {
      const m = heroMark(await svgOf(u));
      expect(m!.slice(1)).toEqual(["m", "spiky", "hoodie-jeans", color]);
    }
    // страница книги / PDF: та же функция внешности, что в pipeline.ts
    const spread = renderDemoSpread({ plot: { slug: "imya-i-mesyac-yasnyj", theme: "sleep", heroKind: "child" }, spreadIndex: 5, hero: { kind: "child", gender: "boy", outfit: color, ...heroHairAndClothes(a) } });
    expect(heroMark(spread)!.slice(1)).toEqual(["m", "spiky", "hoodie-jeans", color]);
    const cover = renderDemoSpread({ plot: { slug: "imya-i-mesyac-yasnyj", theme: "sleep", heroKind: "child" }, spreadIndex: 0, hero: { kind: "child", gender: "boy", outfit: color, ...heroHairAndClothes(a) } });
    expect(heroMark(cover)![3]).toBe("hoodie-jeans");
    expect(read("src/lib/gen/pipeline.ts")).toContain("...heroHairAndClothes(a)");
    expect(read("tools/demo/api.ts")).toContain("...heroHairAndClothes(a)");
  });
  it("девочка в сарафане — на обложке сарафан", async () => {
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "2-4" }, story: { slug: "imya-i-mesyac-yasnyj" }, appearance: { hairstyle: "два хвостика", clothes: "сарафан", outfitColor: "розовая" } });
    expect(heroMark(await svgOf(coverSampleUrl(a)))!.slice(1)).toEqual(["f", "pigtails", "sarafan", OUTFIT_COLORS["розовая"]]);
  });
});

describe("цвет глаз читается", () => {
  it("зелёные — насыщенно-зелёные, все цвета далеко друг от друга", () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r, g, b] = rgb(EYE_COLORS["зелёные"]);
    expect(g - Math.max(r, b)).toBeGreaterThan(80);
    const vals = Object.values(EYE_COLORS);
    for (let i = 0; i < vals.length; i++)
      for (let j = i + 1; j < vals.length; j++) {
        const [a1, a2, a3] = rgb(vals[i]);
        const [b1, b2, b3] = rgb(vals[j]);
        expect(Math.hypot(a1 - b1, a2 - b2, a3 - b3)).toBeGreaterThan(70);
      }
  });
});
