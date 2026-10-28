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
