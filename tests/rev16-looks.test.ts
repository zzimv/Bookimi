// rev 16 (03.11.2026): новые приметы ребёнка картинками — ямочки, щербинка, украшение для волос (только девочки),
// головной убор, рост; поле «Своё описание» убрано из анкеты (старые черновики читаются). Без БД.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as obrazec } from "@/app/obrazec/route";
import { sampleUrl } from "@/lib/obrazec";
import { AnswersV2, appearanceLine, coverSampleUrl, heroHairAndClothes, sketchUrls } from "@/lib/quiz";
import { renderDemoCharacter, renderDemoSpread } from "@/content/art/render";
import { childBody } from "@/content/art/kids";
import { KID_BUILDS, KID_HAIR_ACCS, KID_HATS, kidLookExtras } from "@/content/looks";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svgOf = async (u: string) => (await obrazec(new Request(`https://x${u}`))).text();
const AGES = [3, 6, 9];

describe("rev 16: новые приметы рисуются во всех возрастах", () => {
  it("ямочки и щербинка — метки на лице", () => {
    for (const age of AGES)
      for (const smile of ["", "smile", "wide", "calm"]) {
        const svg = renderDemoCharacter({ kind: "child", look: { gender: "boy", age, smile: smile || undefined, dimples: true, toothGap: true }, face: true });
        expect(svg).toContain('data-dimples="1"');
        expect(svg).toContain('data-tooth-gap="1"');
      }
    const plain = renderDemoCharacter({ kind: "child", look: { gender: "boy", age: 6 }, face: true });
    expect(plain).not.toContain("data-dimples");
    expect(plain).not.toContain("data-tooth-gap");
  });
  it("украшение для волос — только у девочки, каждое своё", () => {
    for (const age of AGES)
      for (const x of KID_HAIR_ACCS) {
        expect(renderDemoCharacter({ kind: "child", look: { gender: "girl", age, hairAcc: x.key }, face: "bust" })).toContain(`data-hair-acc="${x.kind}"`);
        expect(renderDemoCharacter({ kind: "child", look: { gender: "boy", age, hairAcc: x.key }, face: "bust" })).not.toContain("data-hair-acc");
      }
    // цвет из палитры
    expect(renderDemoCharacter({ kind: "child", look: { gender: "girl", age: 6, hairAcc: "бантик", hairAccColor: "розовая" } })).toContain("#f28fb1");
  });
  it("головной убор — у обоих полов; рост — меняет пропорции заметно (rev 17)", () => {
    for (const age of AGES)
      for (const g of ["boy", "girl"])
        for (const h of KID_HATS) expect(renderDemoCharacter({ kind: "child", look: { gender: g, age, hat: h.key } })).toContain(`data-hat="${h.kind}"`);
    for (const age of AGES) {
      const [lo, mid, hi] = KID_BUILDS.map((b) => childBody(age, b.key));
      expect(lo.hc).toBeGreaterThan(mid.hc);
      expect(hi.hc).toBeLessThan(mid.hc);
      // rev 17: рост различается заметно (полный рост ~±12–15%, см. rev17-age-body.test.ts)
      expect(Math.abs(hi.hc - mid.hc) / (mid.footY - mid.hc)).toBeGreaterThan(0.1);
      expect(renderDemoCharacter({ kind: "child", look: { gender: "boy", age, build: "повыше" } })).toContain('data-build="tall"');
    }
  });
  it("из ответов → живая обложка, эскизы страниц, книга (spread) — одно и то же", async () => {
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "5-7" }, appearance: { dimples: true, toothGap: true, hairAcc: "ободок", hairAccColor: "жёлтая", hat: "", build: "пониже" } });
    for (const u of [coverSampleUrl(a), sketchUrls(a, 2)[2]]) {
      const svg = await svgOf(u);
      for (const m of ['data-dimples="1"', 'data-tooth-gap="1"', 'data-hair-acc="band"', 'data-build="short"']) expect(svg, u).toContain(m);
    }
    const spread = renderDemoSpread({ plot: { slug: "imya-i-mesyac-yasnyj", theme: "sleep", heroKind: "child" }, spreadIndex: 4, hero: { kind: "child", gender: "girl", ...heroHairAndClothes(a) } });
    expect(spread).toContain('data-hair-acc="band"');
    expect(appearanceLine(a)).toContain("ямочки на щеках");
    expect(appearanceLine(a)).toContain("жёлтый ободок");
  });
  it("мальчику украшение не достаётся даже из ссылки и старых ответов; чужие значения отбрасываются", async () => {
    expect(await svgOf(sampleUrl({ portrait: true, kind: "child", gender: "boy", hairAcc: "бантик" }))).not.toContain("data-hair-acc");
    expect(await svgOf("/obrazec?p=1&k=child&g=girl&ha=корона&hat=цилиндр&bd=великан")).not.toMatch(/data-hair-acc|data-hat=/);
    expect(kidLookExtras({ hairAcc: "бантик", hat: "кепка", build: "повыше" }, "boy")).toEqual({ dimples: undefined, toothGap: undefined, hairAcc: undefined, hairAccColor: undefined, hat: "кепка", build: "повыше", body: undefined });
  });
  it("старые черновики: без новых полей — по умолчанию; с описанием — читаются", () => {
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Петя", gender: "boy" }, appearance: { custom: "ямочки и кепка" } });
    expect(a.appearance).toMatchObject({ dimples: false, toothGap: false, hairAcc: "", hairAccColor: "", hat: "", build: "", body: "", custom: "ямочки и кепка" });
  });
});

describe("rev 16: анкета — картинки, без «Своё описание»", () => {
  const qw = read("src/components/quiz/QuizWizard.tsx");
  it("ряды новых примет картинками; украшение — только девочкам", () => {
    for (const row of ['name="hairAcc"', 'name="hairAccColor"', 'name="hat"', 'name="build"', '"dimples"', '"toothGap"']) expect(qw).toContain(row);
    expect(qw).toMatch(/kidSets && g === "girl" && \(\s*<PicRow\s+name="hairAcc"/);
    for (const l of ["Ямочки на щеках", "Щербинка — выпал зуб", "Без украшения", "Без головного убора", "Рост и сложение", "Головной убор"]) expect(qw).toContain(l);
  });
  it("полей описания внешности нет (главный герой и спутники); «Кто или что это» и «Какой это питомец» остались", () => {
    for (const gone of ['name="look-custom"', "extra-desc-", "Своё описание", "Своими словами", ">Описать<"]) expect(qw).not.toContain(gone);
    expect(qw).toContain("Кто или что это");
    expect(qw).toContain("Какой это питомец");
  });
});
