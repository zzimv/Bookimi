import { describe, expect, it } from "vitest";
import { dedicationsFor } from "../src/lib/dedications";
import { audienceFromParam, pickFavorites, printDeadlineLine, seasonByDate } from "../src/lib/storefront";
import { fillTags } from "../src/lib/declension";
import { PLOTS } from "../src/content/registry";

describe("витрина", () => {
  it("сезон по дате: с 15 октября — Новый год", () => {
    expect(seasonByDate(new Date(2026, 9, 29))).toBe("novyj-god");
    expect(seasonByDate(new Date(2026, 9, 1))).toBeNull();
    expect(seasonByDate(new Date(2027, 1, 10))).toBe("den-vlyublennyh");
  });
  it("срок печати к Новому году — до праздника, после срока — про PDF", () => {
    expect(printDeadlineLine("novyj-god", "", new Date(2026, 10, 1))).toMatch(/закажите до \d+ декабря/);
    expect(printDeadlineLine("novyj-god", "", new Date(2026, 11, 29))).toMatch(/PDF придёт сразу/);
  });
  it("?dlya= принимает и ключ, и slug", () => {
    expect(audienceFromParam("PET")).toBe("PET");
    expect(audienceFromParam("vzroslym")).toBe("ADULT");
    expect(audienceFromParam("xxx")).toBeUndefined();
  });
  it("«Самые любимые»: сезонная книга первой, не больше двух на аудиторию", () => {
    const stories = PLOTS.map((p) => ({ slug: p.slug, audience: p.audience, occasions: p.occasions })) as never[];
    const fav = pickFavorites(stories, "novyj-god") as unknown as { slug: string; audience: string }[];
    expect(fav[0].slug).toBe("novogodnee-puteshestvie-s-dedom-morozom");
    expect(fav).toHaveLength(4);
  });
  it("посвящения: к поводу и с формами рода", () => {
    const d = dedicationsFor("CHILD", "novyj-god");
    expect(d[0]).toMatch(/Новым годом/);
    const pet = dedicationsFor("PET", "poyavlenie-pitomca")[0];
    expect(fillTags(pet, { hero: { name: "Муся", nickname: "Муся", gender: "girl" } })).toMatch(/появилась/);
    expect(dedicationsFor("ADULT", "svoj").some((x) => x.includes("{ПОВОД}"))).toBe(true);
  });
});
