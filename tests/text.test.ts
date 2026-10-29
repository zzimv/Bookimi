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
  it("своя идея: название — вариант идеи, текст — про идею", async () => {
    const { DemoTextProvider, ideaTopic } = await import("../src/lib/gen/text");
    const { AnswersV2 } = await import("../src/lib/quiz");
    const p = new DemoTextProvider();
    const idea = "Про дракона, который боится темноты. И ещё про маму";
    expect(ideaTopic(idea)).toBe("про дракона, который боится темноты");
    const ideas = await p.ideas(idea);
    expect(ideas[0].title).toBe("Тайна: про дракона, который боится темноты");
    const a = AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "4-5" }, story: { slug: "", idea, ideaChoice: ideas[1] } });
    const r = await p.write(a, null, 0);
    expect(r.raw.title).toBe(ideas[1].title);
    expect(r.raw.spreads).toHaveLength(12);
    expect(r.raw.spreads[0].text).toContain("«про дракона, который боится темноты»");
    expect(r.raw.spreads[1].text).toMatch(/Рюкзак/);
  });
});
