import { describe, expect, it } from "vitest";
import { SHELF, shelfLinks, soonAudiences, soonNote, type SoonSettings } from "../src/lib/shelf";
import { DEFAULTS } from "../src/lib/settings";
import { audienceFromParam, pickFavorites } from "../src/lib/storefront";
import { OCCASIONS, SEGMENTS } from "../src/content/profiles";
import { PLOTS } from "../src/content/registry";

const q = (href: string) => Object.fromEntries(new URLSearchParams(href.split("?")[1] ?? ""));
const byId = (id: string) => SHELF.find((s) => s.id === id)!;
const clone = (): SoonSettings => structuredClone(DEFAULTS.storefront.soon);
/** Отметки «скоро» по умолчанию (02.11.2026): продаются только детские книги. */
const mockup = (): SoonSettings => clone();
/** Всё открыто — как до 02.11. */
const allOpen = (): SoonSettings => {
  const s = clone();
  s.TEEN = s.ADULT = s.PET = false;
  return s;
};

describe("полка на главной (rev 06)", () => {
  it("книги и порядок — как на макете, обложки с правильной грамматикой", () => {
    expect(SHELF.map((s) => s.id)).toEqual(["syn", "pervyj-klass", "doch", "babushka", "den-rozhdeniya", "mama", "brat-sestra", "papa", "pitomec", "novyj-god", "vypusknoj", "dedushka", "lyubimomu", "podruge"]);
    expect(`${byId("doch").coverLead} ${byId("doch").title}`).toBe("Книга для Дочери");
    expect(`${byId("novyj-god").coverLead} ${byId("novyj-god").title}`).toBe("Книга к Новому году");
  });

  it("каждая книга ведёт в нужную анкету", () => {
    const want: Record<string, Record<string, string>> = {
      syn: { dlya: "CHILD", pol: "boy" },
      doch: { dlya: "CHILD", pol: "girl" },
      "pervyj-klass": { povod: "pervyj-klass" },
      "den-rozhdeniya": { povod: "den-rozhdeniya" },
      "brat-sestra": { povod: "rozhdenie-brata-ili-sestry" },
      mama: { dlya: "ADULT", segment: "adult-parent", pol: "girl" },
      papa: { dlya: "ADULT", segment: "adult-parent", pol: "boy" },
      babushka: { dlya: "ADULT", segment: "adult-grandparent" },
      dedushka: { dlya: "ADULT", segment: "adult-grandparent" },
      lyubimomu: { dlya: "ADULT", segment: "adult-couple" },
      podruge: { dlya: "ADULT", segment: "adult-friend" },
      pitomec: { dlya: "PET" },
      "novyj-god": { povod: "novyj-god" },
      vypusknoj: { povod: "vypusknoj-v-sadu" },
    };
    for (const it of SHELF) {
      expect(it.href.startsWith("/sozdat?"), it.id).toBe(true);
      expect(q(it.href), it.id).toMatchObject(want[it.id]);
    }
  });

  it("параметры ссылок понимает анкета: аудитория, повод, сегмент своей аудитории, пол", () => {
    for (const it of SHELF) {
      const p = q(it.href);
      const aud = audienceFromParam(p.dlya);
      if (p.dlya) expect(aud, it.id).toBeDefined();
      if (p.povod) {
        const o = OCCASIONS.find((x) => x.key === p.povod);
        expect(o, it.id).toBeDefined();
        if (aud) expect(o!.audiences).toContain(aud);
      }
      if (p.segment) expect(SEGMENTS.some((s) => s.id === p.segment && s.audience === aud), it.id).toBe(true);
      if (p.pol) expect(["boy", "girl"]).toContain(p.pol);
    }
  });

  it("по умолчанию продаются только дети: подростки, взрослые и питомцы — «скоро», их книги полки — «скоро»", () => {
    const soon = DEFAULTS.storefront.soon;
    expect(soonAudiences(soon)).toEqual(["TEEN", "ADULT", "PET"]);
    expect(shelfLinks(soon).filter((s) => s.soon).map((s) => s.id)).toEqual(["babushka", "mama", "papa", "pitomec", "dedushka", "lyubimomu", "podruge"]);
    expect(shelfLinks(allOpen()).filter((s) => s.soon)).toEqual([]);
    // В настройках есть отметка для каждой книги полки — иначе её не выключить в админке
    expect(Object.keys(soon.shelf).sort()).toEqual(SHELF.map((s) => s.id).sort());
  });

  it("книга «скоро» ведёт на страницу аудитории «скоро» (без анкеты); запущенная аудитория — в анкету", () => {
    const soon = mockup();
    const mama = shelfLinks(soon).find((s) => s.id === "mama")!;
    expect(mama.to).toBe("/dlya/vzroslym");
    expect(mama.to).not.toMatch(/sozdat/);
    expect(shelfLinks(soon).find((s) => s.id === "pitomec")!.to).toBe("/dlya/pitomcam");
    soon.ADULT = false;
    expect(shelfLinks(soon).find((s) => s.id === "mama")!.to).toBe(byId("mama").href);
    soon.shelf.mama = true; // отдельная отметка книги полки — тоже «скоро»
    expect(shelfLinks(soon).find((s) => s.id === "mama")!.soon).toBe(true);
    for (const it of shelfLinks(soon)) if (it.soon) expect(audienceFromParam(q(it.to).dlya) ?? audienceFromParam(it.to.split("/").pop()), it.id).toBe(it.audience);
  });

  it("аудитории «скоро» снимаются в настройках; плашка без сбора почты", () => {
    const soon = mockup();
    soon.ADULT = false;
    soon.TEEN = false;
    expect(soonAudiences(soon)).toEqual(["PET"]);
    expect(soonNote("ADULT")).toBe("Скоро — книги для взрослых готовим к запуску. Сейчас можно создать сказку для ребёнка 2–10 лет");
    expect(soonNote("PET")).not.toMatch(/почт|email/i);
  });

  it("«Самые любимые» из открытых аудиторий — всё равно 4 книги", () => {
    const stories = PLOTS.filter((p) => p.audience === "CHILD").map((p) => ({ slug: p.slug, audience: p.audience, occasions: p.occasions })) as never[];
    expect(pickFavorites(stories, "novyj-god")).toHaveLength(4);
  });
});
