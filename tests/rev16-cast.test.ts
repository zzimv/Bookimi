// rev 16: персонажи сказок на картинках — дракончик, Дед Мороз, сова, лиса, заяц, кит… (art/cast.ts).
// Каждый разворот детской книги, где сцена называет известного персонажа, рисует его (метка data-cast);
// на обложке «звёздного дракончика» — дракончик. Работает в живой обложке (/obrazec), эскизах, книге и PDF
// (один рендер renderDemoSpread). Без БД.
import { describe, expect, it } from "vitest";
import { GET as obrazec } from "@/app/obrazec/route";
import { PLOTS, plotBySlug } from "@/content/registry";
import { renderDemoSpread } from "@/content/art/render";
import { CAST, castFor, castFromText, coverCast, drawCast, spreadCast } from "@/content/art/cast";
import { artStyle } from "@/content/art/index";
import { AnswersV2, coverSampleUrl, sketchUrls } from "@/lib/quiz";

const KIDS = PLOTS.filter((p) => p.audience === "CHILD");
const castIn = (svg: string) => [...svg.matchAll(/data-cast="([^"]+)"/g)].map((m) => m[1]);
/** Слова сцены, которые не персонаж: рисунок кита на карте, модель ракеты на столе, гипсовые слепки следов. */
const NOT_A_CHARACTER: Record<string, number[]> = {
  "kapitan-podvodnoj-lodki": [4],
  "imya-i-zagadka-kamennyh-sledov": [3, 11, 12],
  "imya-i-kosmodrom-vo-dvore": [4, 6, 7, 12],
  "odinnadcat-polunochej": [9],
};

describe("rev 16: персонажи сказок на картинках", () => {
  it("23 детские книги, у каждого разворота — явный список cast; все ключи известны", () => {
    expect(KIDS.length).toBe(23);
    for (const p of KIDS)
      for (const s of p.spreads) {
        expect(Array.isArray(s.cast), `${p.slug}: ${s.scene.slice(0, 40)}`).toBe(true);
        for (const k of s.cast!) expect(CAST.some((c) => c.key === k), k).toBe(true);
      }
  });
  it("кого называет сцена — тот нарисован (метка на развороте)", () => {
    for (const p of KIDS)
      p.spreads.forEach((s, i) => {
        const svg = renderDemoSpread({ plot: { slug: p.slug, theme: p.theme, heroKind: "child" }, spreadIndex: i + 1, artStyle: p.artStyles[0], hero: { kind: "child", gender: "girl", age: 6 }, scene: s.scene });
        const drawn = castIn(svg);
        // явный список — весь на картинке (до 8)
        expect(drawn.sort(), `${p.slug} #${i + 1}`).toEqual(spreadCast(s).slice(0, 8).sort());
        if (NOT_A_CHARACTER[p.slug]?.includes(i + 1)) return;
        for (const k of castFromText(s.scene)) expect(drawn, `${p.slug} #${i + 1}: ${k}`).toContain(k);
      });
  });
  it("обложка: дракончик у «звёздного дракончика», Дед Мороз, сова у «Месяца ясного», заяц у «Лесной ёлочки»", async () => {
    const want: Record<string, string> = { "imya-i-zvyozdnyj-drakonchik": "dragon", "novogodnee-puteshestvie-s-dedom-morozom": "ded-moroz", "imya-i-mesyac-yasnyj": "owl", "imya-i-lesnaya-yolochka": "hare", "lunnaya-oranzhereya": "robot" };
    for (const [slug, key] of Object.entries(want)) {
      expect(coverCast(plotBySlug(slug)!)[0]).toBe(key);
      const p = plotBySlug(slug)!;
      expect(castIn(renderDemoSpread({ plot: { slug, theme: p.theme, heroKind: "child" }, spreadIndex: 0, hero: { kind: "child" } }))).toContain(key);
    }
    // живая обложка анкеты и эскизы превью — через /obrazec
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "2-4" }, story: { slug: "imya-i-zvyozdnyj-drakonchik" } });
    expect(await (await obrazec(new Request(`https://x${coverSampleUrl(a)}`))).text()).toContain('data-cast="dragon"');
    expect(await (await obrazec(new Request(`https://x${sketchUrls(a, 9)[9]}`))).text()).toContain('data-cast="dragon"');
  });
  it("персонажи не заходят на героя и доп. героев, ниже текста и в кадре", () => {
    for (const p of KIDS)
      for (const idx of [0, 1, 5, 9]) {
        const svg = renderDemoSpread({ plot: { slug: p.slug, theme: p.theme, heroKind: "child" }, spreadIndex: idx, hero: { kind: "child", age: 6 }, extras: [{ role: "mom", look: { gender: "girl", age: 35 } }] });
        const W = idx === 0 ? 1024 : 2048;
        for (const m of svg.matchAll(/data-cast="([^"]+)" transform="translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.-]+)/g)) {
          const [, key, xs, ys, ss] = m;
          const c = CAST.find((x) => x.key === key)!;
          const x = +xs;
          const s = Math.abs(+ss);
          expect(x - (c.w * s) / 2, `${p.slug} #${idx} ${key}`).toBeGreaterThan(-2);
          expect(x + (c.w * s) / 2, `${p.slug} #${idx} ${key}`).toBeLessThan(W + 2);
          if (c.place !== "trail") expect(+ys - c.h * s, `${p.slug} #${idx} ${key} top`).toBeGreaterThan(1024 * (idx === 0 ? 0.3 : 0.38) - 4);
        }
      }
  });
  it("по стилю: контур и толщина линии стиля; без линии — без контура", () => {
    const bold = artStyle("kind-classic")!.demo;
    expect(drawCast("owl", { x: 0, y: 0, scale: 1, style: bold })).toContain('data-cast="owl"');
    expect(drawCast("owl", { x: 0, y: 0, scale: 1, style: { ...bold, line: "none" } })).not.toContain(`stroke="${bold.palette.ink}"`);
  });
  it("своя история и чужие книги — по словам сцены; пустая сцена — никого", () => {
    expect(castFor("svoya-ideya", 3, "a friendly fox and a little owl in the forest")).toEqual(expect.arrayContaining(["fox", "owl"]));
    expect(castFor("svoya-ideya", 3)).toEqual([]);
    expect(castFromText(undefined, "Совёнок и лиса пошли к Деду Морозу")).toEqual(expect.arrayContaining(["owlet", "fox", "ded-moroz"]));
  });
});
