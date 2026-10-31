import { describe, expect, it } from "vitest";
import { checkFirstName, typeFirstName } from "@/lib/first-name";
import { cleanFirstName } from "@/lib/auth";

describe("«Как к вам обращаться»: правила формы = правила сервера", () => {
  it("буквы, пробел, дефис и апостроф; цифры — нет; регистр — с заглавной", () => {
    for (const v of ["Анна", "Анна-Мария", "Анна Мария", "", "  Ян  ", "Д'Артаньян", "Аня2", "Анна--Мария", "-Аня", "А".repeat(41)]) {
      expect(checkFirstName(v), v).toBe(cleanFirstName(v));
    }
    expect(typeFirstName("Д'Арт 7аньян")).toBe("Д'Арт аньян");
    expect(checkFirstName("анна")).toBe("Анна");
    expect(checkFirstName("АННА-МАРИЯ")).toBe("Анна-Мария");
    expect(checkFirstName("д'артаньян")).toBe("Д'Артаньян");
    expect(checkFirstName("Аня2")).toBe(false);
  });
});
