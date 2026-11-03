// rev 17 (03.11.2026): анкета ребёнка — сначала возраст картинками, потом мальчик/девочка картинками, все ряды
// внешности сразу (без «Подробнее»); рост и сложение заметно разные; детям — 5 стилей; 6 настроений, «Зимнее» — зима. Без БД.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as obrazec } from "@/app/obrazec/route";
import { sampleUrl } from "@/lib/obrazec";
import { AnswersV2, heroHairAndClothes } from "@/lib/quiz";
import { renderDemoCharacter, renderDemoSpread } from "@/content/art/render";
import { childBody } from "@/content/art/kids";
import { KID_BODIES, KID_BUILDS, kidLookExtras } from "@/content/looks";
import { ART_STYLE_IDS, KIDS_LIVE_ART_STYLES } from "@/content/profiles";
import { liveArtStyle } from "@/content/live-style";
import { visibleArtStyleIds } from "@/content/art/index";
import { PLOTS, validateContent } from "@/content/registry";
import { liveMoodId, moodsFor, VISIBLE_MOODS } from "@/content/moods";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svgOf = async (u: string) => (await obrazec(new Request(`https://x${u}`))).text();
const AGES = [3, 6, 9];
const swOf = (svg: string) => Number(/data-sw="([\d.]+)"/.exec(svg)?.[1]);

describe("rev 17: анкета — возраст, потом пол, потом всё сразу", () => {
  const qw = read("src/components/quiz/QuizWizard.tsx");
  it("возраст и пол ребёнка — картинками в начале сцены «Внешность», в сцене имени их нет", () => {
    const look = qw.indexOf("const ageGenderPicker");
    expect(look).toBeGreaterThan(0);
    const picker = qw.slice(look, qw.indexOf("const charPicker"));
    expect(picker.indexOf("Сколько лет?")).toBeGreaterThan(0);
    expect(picker.indexOf("Мальчик или девочка?")).toBeGreaterThan(picker.indexOf("Сколько лет?"));
    expect(picker).toContain("data-age={x.key}");
    expect(picker).toContain("data-gender-pic={gg}");
    expect(picker).toContain("hero({ ageGroup:");
    // в сцене имени (scene 0) ребёнку не задают ни пол, ни возраст — один раз, в сцене внешности
    expect(qw).not.toMatch(/<Chips name="age" label="Возраст" items=\{AGE_GROUPS/);
    expect(qw).toContain('{aud !== "CHILD" && (\n                  <>\n                    <span className="label">{aud === "PET" ? "Пол" : "Кто это?"}');
    expect(qw).toContain("Выберите возраст — нажмите на картинку");
    // готовые герои и ряды — только после возраста и пола
    expect(qw.indexOf("{aud === \"CHILD\" && ageGenderPicker}")).toBeLessThan(qw.indexOf("charPicker\n"));
  });
  it("без «Подробнее»: ряды сразу, с заголовками; на телефоне — прокрутка вбок с подсказкой", () => {
    expect(qw).not.toContain("data-look-more");
    expect(qw).not.toContain("Подробнее: кожа");
    for (const h of ['"Кожа"', '"Волосы"', '"Причёска"', '"Глаза"', '"Лицо"', '"Улыбка"', '"Одежда"', '"Цвет одежды"', '"Украшения"', '"Головной убор"', "Рост и сложение", 'label="Рост"', 'label="Сложение"', "Готовые герои"]) expect(qw).toContain(h);
    expect(qw).toContain("Ряды картинок листаются вбок");
    expect(read("src/app/globals.css")).toMatch(/@media \(max-width: 639px\) \{\n  \.describe\[data-describe="pics"\] \.pic-row \{ flex-wrap: nowrap; overflow-x: auto;/);
  });
});

describe("rev 17: рост и сложение", () => {
  it("рост: ~12–15% полного роста между «средним» и «пониже»/«повыше» во всех возрастах", () => {
    const full = (b: ReturnType<typeof childBody>) => b.footY - (b.hc - b.R * 1.3);
    for (const age of AGES) {
      const [lo, mid, hi] = KID_BUILDS.map((b) => childBody(age, b.key));
      for (const x of [lo, hi]) {
        const d = Math.abs(full(x) - full(mid)) / full(mid);
        expect(d).toBeGreaterThan(0.11);
        expect(d).toBeLessThan(0.16);
      }
    }
  });
  it("сложение: разная ширина в SVG (одежда по фигуре), у плотненького — круглые щёчки; подписи бережные", () => {
    for (const age of AGES)
      for (const g of ["boy", "girl"] as const)
        for (const clothes of g === "girl" ? ["платье", "комбинезон"] : ["свитер с брюками", "худи с джинсами"]) {
          const [slim, normal, sturdy] = KID_BODIES.map((b) => renderDemoCharacter({ kind: "child", look: { gender: g, age, clothes, body: b.key === "обычный" ? undefined : b.key } }));
          expect(swOf(slim)).toBeLessThan(swOf(normal) * 0.85);
          expect(swOf(sturdy)).toBeGreaterThan(swOf(normal) * 1.2);
          expect(slim).toContain('data-body="slim"');
          expect(sturdy).toContain('data-body="sturdy"');
          expect(sturdy).toContain('data-cheeks="round"');
          expect(normal).not.toContain('data-cheeks="round"');
        }
    expect(KID_BODIES.map((b) => b.label.girl)).toEqual(["Тоненькая", "Обычная", "Плотненькая"]);
    expect(KID_BODIES.map((b) => b.label.boy)).toEqual(["Тоненький", "Обычный", "Плотненький"]);
  });
  it("из ответов → живая обложка, эскиз и книга (spread) — одно и то же сложение и рост", async () => {
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "8-10" }, appearance: { build: "повыше", body: "плотненький" } });
    expect(kidLookExtras(a.appearance, "girl")).toMatchObject({ build: "повыше", body: "плотненький" });
    const svg = await svgOf(sampleUrl({ kind: "child", gender: "girl", age: 9, ...heroHairAndClothes(a) }));
    expect(svg).toContain('data-body="sturdy"');
    expect(svg).toContain('data-build="tall"');
    const spread = renderDemoSpread({ plot: { slug: "imya-i-mesyac-yasnyj", theme: "sleep", heroKind: "child" }, spreadIndex: 4, hero: { kind: "child", gender: "girl", age: 9, ...heroHairAndClothes(a) } });
    expect(spread).toContain('data-body="sturdy"');
    // старые ответы без сложения — обычное
    expect(AnswersV2.parse({ audience: "CHILD", hero: { name: "Петя", gender: "boy" } }).appearance.body).toBe("");
  });
});

describe("rev 17: детям — 5 стилей", () => {
  it("видны только 5; остальные скрыты (archived), код на месте; pen-vignette и golden-animation — живые", () => {
    const kids = (showTrial: boolean) => visibleArtStyleIds(showTrial).filter((s) => s.audiences.includes("CHILD")).map((s) => s.id).sort();
    expect(kids(false)).toEqual([...KIDS_LIVE_ART_STYLES].sort());
    expect(kids(true)).toEqual([...KIDS_LIVE_ART_STYLES].sort());
    expect(visibleArtStyleIds(true).map((s) => s.id).sort()).toEqual([...KIDS_LIVE_ART_STYLES].sort());
    for (const id of ["pen-vignette", "golden-animation"]) expect(ART_STYLE_IDS.find((s) => s.id === id)?.status).toBe("live");
    expect(ART_STYLE_IDS.filter((s) => s.status === "archived").length).toBe(ART_STYLE_IDS.length - 5);
  });
  it("у каждой детской книги — упорядоченный набор из 5; старые id → ближайший; validateContent зелёный", () => {
    for (const p of PLOTS.filter((x) => x.audience === "CHILD")) {
      expect(p.artStyles.length, p.slug).toBeGreaterThanOrEqual(3);
      for (const s of p.artStyles) expect(KIDS_LIVE_ART_STYLES as readonly string[], p.slug).toContain(s);
    }
    expect(liveArtStyle("watercolor-air")).toBe("soft-gouache");
    expect(liveArtStyle("kind-classic")).toBe("golden-animation");
    expect(liveArtStyle("folk-lubok")).toBe("pen-vignette");
    expect(liveArtStyle("naive-watercolor")).toBe("cozy-detail");
    expect(liveArtStyle("pen-ink-1920s")).toBe("pen-vignette");
    expect(liveArtStyle("pet-cartoon")).toBe("ink-humor");
    expect(liveArtStyle("linocut")).toBe("soft-gouache");
    expect(liveArtStyle("cozy-detail")).toBe("cozy-detail");
    expect(AnswersV2.parse({ hero: { name: "Петя", gender: "boy" } }).artStyle).toBe("soft-gouache");
    expect(AnswersV2.parse({ hero: { name: "Петя", gender: "boy" }, artStyle: "folk-lubok" }).artStyle).toBe("pen-vignette");
    expect(validateContent({ strict: true }).errors).toEqual([]);
  });
  it("витрина и страница книги — без скрытых стилей", () => {
    expect(read("src/components/Home.tsx")).toContain('const SHOW_STYLES = ["soft-gouache", "golden-animation", "cozy-detail"]');
    expect(read("src/app/skazki/[slug]/page.tsx")).toContain('s.status !== "archived"');
  });
});

describe("rev 17: настроения", () => {
  const plot = { slug: "imya-i-lesnaya-yolochka", theme: "winter", heroKind: "child" as const };
  const hero = { kind: "child" as const, gender: "boy", age: 6 };
  const out = "the child walking along a forest path";
  it("6 видимых; скрытые → «как задумал художник»", () => {
    expect(VISIBLE_MOODS.map((m) => m.id)).toEqual(["as-drawn", "adventure", "festive", "cheerful", "wintry", "magic"]);
    expect(moodsFor("CHILD").map((m) => m.id)).toEqual(VISIBLE_MOODS.map((m) => m.id));
    for (const h of ["warm", "sleepy", "tender", "retro", "romantic"]) {
      expect(liveMoodId(h)).toBe("");
      expect(AnswersV2.parse({ hero: { name: "Петя", gender: "boy" }, mood: h }).mood).toBe("");
      // скрытое настроение в книге рисуется как «как задумал художник»
      expect(renderDemoSpread({ plot, spreadIndex: 3, hero, mood: h, scene: out })).toBe(renderDemoSpread({ plot, spreadIndex: 3, hero, scene: out }));
    }
    expect(liveMoodId("wintry")).toBe("wintry");
  });
  it("каждое настроение даёт свой рисунок одного разворота", () => {
    const svgs = VISIBLE_MOODS.map((m) => renderDemoSpread({ plot, spreadIndex: 3, hero, mood: m.id, scene: out }));
    expect(new Set(svgs).size).toBe(6);
  });
  it("«Зимнее»: сугробы, снег на кронах и крышах, снегопад, шапка, шарф и пар; в помещении — без сугробов; «Праздничное» — гирлянда без снега", () => {
    const w = renderDemoSpread({ plot: { slug: "imya-i-bolshaya-luzha", theme: "meadow", heroKind: "child" }, spreadIndex: 3, hero, mood: "wintry", scene: out });
    for (const m of ['data-snow-ground="1"', 'data-snowcap="1"', 'data-fx="snowfall"', 'data-scarf="1"', 'data-breath="1"', 'data-hat="beanie"']) expect(w, m).toContain(m);
    const inside = renderDemoSpread({ plot, spreadIndex: 3, hero, mood: "wintry", scene: "the child in a cozy bedroom reading a book" });
    expect(inside).not.toContain("data-snow-ground");
    expect(inside).not.toContain("data-scarf");
    expect(inside).toContain('data-fx="snowfall"');
    const f = renderDemoSpread({ plot, spreadIndex: 3, hero, mood: "festive", scene: out });
    expect(f).toContain('data-fx="garland"');
    expect(f).not.toContain("data-snow-ground");
    expect(f).not.toContain('data-fx="snowfall"');
    const wintry = VISIBLE_MOODS.find((m) => m.id === "wintry")!;
    expect(wintry.promptAdd).toMatch(/snow covering the ground/);
    expect(wintry.promptAdd).toMatch(/snow caps on tree branches, roofs/);
    expect(wintry.promptAdd).toMatch(/warm glowing windows/);
    expect(VISIBLE_MOODS.find((m) => m.id === "festive")!.promptAdd).toMatch(/garlands/);
  });
});
