// Имя в сказке — всегда с заглавной буквы и в правильном падеже, как бы его ни ввели.
import { describe, expect, it } from "vitest";
import { declineName, normalizeName } from "../src/lib/declension";
import { AnswersV2 } from "../src/content/answers";
import { PLOTS } from "../src/content/registry";
import { DemoTextProvider, personalize } from "../src/lib/gen/text";

describe("имя с заглавной буквы", () => {
  it("normalizeName", () => {
    expect(normalizeName("маша")).toBe("Маша");
    expect(normalizeName("ЕВА")).toBe("Ева");
    expect(normalizeName("  анна-мария ")).toBe("Анна-Мария");
    expect(normalizeName("мария   ивановна")).toBe("Мария Ивановна");
  });
  it("падежи трудных имён", () => {
    expect(declineName("павел", "род", "boy")).toBe("Павла");
    expect(declineName("Наталья", "тв", "girl")).toBe("Натальей");
    expect(declineName("Дарья", "тв", "girl")).toBe("Дарьей");
    expect(declineName("Илья", "тв", "boy")).toBe("Ильёй");
    expect(declineName("лев", "дат", "boy")).toBe("Льву");
  });
  it("анкета приводит имена к заглавной", () => {
    const a = AnswersV2.parse({ hero: { name: "маша", nickname: "машенька", gender: "girl", ageGroup: "4-5" }, story: { slug: PLOTS[0].slug } });
    expect(a.hero.name).toBe("Маша");
    expect(a.hero.nickname).toBe("Машенька");
  });
  it("в тексте сказки нет имени со строчной буквы", async () => {
    for (const plot of PLOTS.filter((p) => p.audience === "CHILD").slice(0, 6)) {
      const raw = { hero: { name: "маша", nickname: "машенька", gender: "girl", ageGroup: "4-5" }, story: { slug: plot.slug }, extras: plot.extras?.min ? [{ role: "mom", name: "оля" }] : [] };
      const a = AnswersV2.parse(raw);
      const r = await new DemoTextProvider().write(a as never, plot as never, 0);
      const t = personalize(r.raw, a as never);
      const all = [t.title, ...t.spreads.map((s) => s.text)].join("\n");
      expect(all, plot.slug).not.toMatch(/(^|[^а-яё])(маш[аеиуо]й?|машеньк[а-яё]*|ол[яиеюь]й?)(?![а-яё])/u);
    }
  });
});
