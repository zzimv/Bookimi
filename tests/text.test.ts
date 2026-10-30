import { describe, expect, it } from "vitest";
import { declineName, fillNames, applyGender } from "@/lib/declension";
import { checkText } from "@/lib/moderation";

describe("склонение имён", () => {
  const cases: [string, string, string[]][] = [
    ["Марк", "boy", ["Марка", "Марку", "Марка", "Марком", "Марке"]],
    ["Маша", "girl", ["Маши", "Маше", "Машу", "Машей", "Маше"]],
    ["Илья", "boy", ["Ильи", "Илье", "Илью", "Ильёй", "Илье"]],
    ["Дмитрий", "boy", ["Дмитрия", "Дмитрию", "Дмитрия", "Дмитрием", "Дмитрии"]],
    ["Мария", "girl", ["Марии", "Марии", "Марию", "Марией", "Марии"]],
    ["Лев", "boy", ["Льва", "Льву", "Льва", "Львом", "Льве"]],
  ];
  for (const [name, g, forms] of cases) {
    it(name, () => {
      expect((["род", "дат", "вин", "тв", "пр"] as const).map((c) => declineName(name, c, g))).toEqual(forms);
    });
  }
  it("подстановка меток и рода", () => {
    const t = applyGender("{ГЕРОЙ.им} нашёл{Р:|а} подарок для {ЛАСКОВО.род}", "girl");
    expect(fillNames(t, { name: "Маша", nickname: "Машенька", gender: "girl" })).toBe("Маша нашёла подарок для Машеньки");
  });
});

describe("модерация", () => {
  it("пропускает обычный текст", () => expect(checkText("Небо было синим, а сукно — зелёным")).toBeNull());
  it("ловит ссылки", () => expect(checkText("пишите в t.me/abc")).not.toBeNull());
});

describe("демо: доп. герои и «своя история»", () => {
  it("фразы про доп. героев разные и не повторяются", async () => {
    const { extraLines } = await import("../src/lib/gen/text");
    const lines = extraLines([{ role: "mom", name: "Оля" }, { role: "friend", name: "Петя" }, { role: "toy", name: "Мишка" }], 0);
    expect(lines).toHaveLength(6);
    const texts = lines.map(([, t]) => t.replace(/\{ДОП\d\.[^}]+\}|\{Р\d?:[^}]*\}/g, "_"));
    expect(new Set(texts).size).toBe(6);
    expect(lines.map(([i]) => i).slice(0, 1)).toEqual([0]);
    expect(lines.some(([, t]) => t.includes("Мама {ДОП1.им}") || t.includes("мама {ДОП1.им}"))).toBe(true);
  });
  it("своя идея: название — начало идеи с заглавной (≤ 40, по границе слова), текст — про идею", async () => {
    const { DemoTextProvider, ideaTopic, ideaTitle } = await import("../src/lib/gen/text");
    const { AnswersV2 } = await import("../src/lib/quiz");
    const p = new DemoTextProvider();
    const idea = "Про дракона, который боится темноты. И ещё про маму";
    expect(ideaTopic(idea)).toBe("Про дракона, который боится темноты");
    const ideas = await p.ideas(idea);
    expect(ideas[0].title).toBe("Тайна: Про дракона, который боится темноты");
    const a = AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "4-5" }, story: { slug: "", idea, ideaChoice: ideas[1] } });
    const r = await p.write(a, null, 0);
    expect(r.raw.title).toBe("Про дракона, который боится темноты");
    expect(r.raw.spreads).toHaveLength(12);
    expect(r.raw.spreads[0].text).toContain("история про дракона, который боится темноты");
    expect(r.raw.spreads[1].text).toMatch(/Рюкзак/);
    // Длинная идея: название обрезано по слову и не на предлоге; служебное начало убрано
    expect(ideaTitle("Лёва строит ракету из коробок и летит к бабушке на Луну")).toBe("Лёва строит ракету из коробок");
    expect(ideaTitle("хочу сказку о том, как кот Барсик ищет потерянный клубок по всему городу")).toBe("Кот Барсик ищет потерянный клубок");
    for (const i of ["как мы с папой ловили самую большую рыбу в нашем озере прошлым летом", "очень-очень длинное слово-без-пробелов-которое-никак-не-помещается-в-сорок"]) {
      const t = ideaTitle(i);
      expect(t.length).toBeLessThanOrEqual(40);
      expect(t[0]).toBe(t[0].toUpperCase());
      expect(t).not.toMatch(/\s(и|в|на|с|к|о|по|из|который)$/);
    }
  });
  it("своя идея с именем героя: идея звучит в развороте через один-два, без повтора имени («он строит ракету»)", async () => {
    const { DemoTextProvider } = await import("../src/lib/gen/text");
    const { AnswersV2 } = await import("../src/lib/quiz");
    const { fillTags } = await import("../src/lib/declension");
    const p = new DemoTextProvider();
    const idea = "Лёва строит ракету из коробок и летит к бабушке на Луну";
    const ideas = await p.ideas(idea);
    for (const choice of ideas) {
      const a = AnswersV2.parse({ hero: { name: "Лёва", gender: "boy", ageGroup: "4-5" }, story: { slug: "", idea, ideaChoice: choice } });
      const r = await p.write(a, null, 0);
      expect(r.raw.title).toBe("Лёва строит ракету из коробок");
      const texts = r.raw.spreads.map((s) => fillTags(s.text, { hero: { name: "Лёва", gender: "boy" } }));
      expect(texts.filter((t) => /ракету из коробок/.test(t)).length).toBeGreaterThanOrEqual(4);
      expect(texts.join(" ")).not.toMatch(/доброе дело/);
      for (const t of texts) expect(t).not.toMatch(/Лёва[^.!?]*: Лёва строит/);
    }
  });
  it("фразы доп. героев: имя не повторяется в одной фразе («Мама Оля тоже была тут — куда же без неё!»)", async () => {
    const { extraLines } = await import("../src/lib/gen/text");
    const { fillTags } = await import("../src/lib/declension");
    const seen = new Set<string>();
    for (let v = 0; v < 12; v++)
      for (const [, t] of extraLines([{ role: "mom", name: `Оля${"я".repeat(v % 3)}` }, { role: "dad", name: "Петя" }, { role: "grandma", name: "Нина" }], v)) seen.add(t);
    for (const t of seen) {
      const out = fillTags(t, { hero: { name: "Лёва", gender: "boy" }, extras: [{ name: "Оля", gender: "girl" }, { name: "Пётр", gender: "boy" }, { name: "Нина", gender: "girl" }] });
      for (const n of ["Оля", "Оли", "Олей", "Олю", "Пётр", "Петра", "Нина", "Нины", "Ниной", "Нину"]) {
        const stem = n.slice(0, 3);
        expect(out.split(stem).length - 1, out).toBeLessThanOrEqual(1);
      }
    }
  });
});
