import { describe, expect, it } from "vitest";
import { checkFirstName, typeFirstName } from "@/lib/first-name";
import { cleanFirstName } from "@/lib/auth";

describe("«Как к вам обращаться»: правила формы = правила сервера", () => {
  it("буквы, пробел, дефис; апостроф и цифры — нет", () => {
    for (const v of ["Анна", "Анна-Мария", "Анна Мария", "", "  Ян  ", "Д'Артаньян", "Аня2", "Анна--Мария", "-Аня", "А".repeat(41)]) {
      expect(checkFirstName(v), v).toBe(cleanFirstName(v));
    }
    expect(typeFirstName("Д'Арт 7аньян")).toBe("ДАрт аньян");
  });
});
