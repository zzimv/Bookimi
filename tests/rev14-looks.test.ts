// rev 14 (03.11.2026): доп. герои рисуются собой (мама ≠ папа ≠ бабушка ≠ дедушка, кошка — кошка) везде —
// живая обложка (/obrazec), эскизы страниц, страницы книги и PDF (extraDemoLook); внешность картинками;
// один мягкий водяной знак «букими» на страницу. Без БД.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET as obrazec } from "@/app/obrazec/route";
import { sampleUrl, decodeSampleExtra, encodeSampleExtra, type SampleExtra } from "@/lib/obrazec";
import { AnswersV2, sketchUrls, coverSampleUrl } from "@/lib/quiz";
import { extraDemoLook } from "@/lib/gen/extras";
import { renderDemoSpread, watermark } from "@/content/art/render";
import { extraDrawKind } from "@/content/art/index";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const svgOf = async (u: string) => (await obrazec(new Request(`https://x${u}`))).text();
/** Метки первого доп. героя на картинке. */
function extraMarks(svg: string) {
  const at = svg.indexOf('data-extra="1"');
  expect(at).toBeGreaterThan(-1);
  const head = svg.slice(at, at + 400);
  const attr = (k: string) => new RegExp(`data-${k}="([^"]+)"`).exec(head)?.[1];
  return { kind: attr("kind"), figure: attr("figure"), gender: attr("gender"), age: attr("age"), species: attr("species"), hair: attr("hair"), body: svg.slice(at, svg.indexOf("</g></g>", at) + 8) };
}

const ROLES: [string, SampleExtra, (m: ReturnType<typeof extraMarks>) => void][] = [
  ["мама", { role: "mom" }, (m) => expect([m.figure, m.gender, m.age]).toEqual(["adult", "f", "adult"])],
  ["папа", { role: "dad" }, (m) => expect([m.figure, m.gender, m.age]).toEqual(["adult", "m", "adult"])],
  ["бабушка", { role: "grandma" }, (m) => {
    expect([m.figure, m.gender, m.age]).toEqual(["adult", "f", "old"]);
    expect(m.hair).toBe("#c9c9c9"); // седые
    expect(m.body).toContain('data-glasses="1"');
  }],
  ["дедушка", { role: "grandpa" }, (m) => {
    expect([m.figure, m.gender, m.age]).toEqual(["adult", "m", "old"]);
    expect(m.hair).toBe("#c9c9c9");
    expect(m.body).toContain('data-moustache="1"');
    expect(m.body).toContain('data-glasses="1"');
  }],
  ["брат", { role: "sibling", gender: "boy" }, (m) => expect([m.figure, m.gender]).toEqual(["child", "m"])],
  ["подружка", { role: "friend", gender: "girl" }, (m) => expect([m.figure, m.gender]).toEqual(["child", "f"])],
  ["кошка", { role: "pet", species: "cat" }, (m) => expect([m.kind, m.species]).toEqual(["pet", "cat"])],
  ["собака", { role: "pet", species: "dog" }, (m) => expect([m.kind, m.species]).toEqual(["pet", "dog"])],
  ["игрушка", { role: "toy", look: { toy: "робот" } }, (m) => expect(m.figure).toBe("toy")],
];

describe("доп. герои рисуются собой (живая обложка /obrazec)", () => {
  it.each(ROLES)("%s", async (_n, ex, check) => {
    const svg = await svgOf(sampleUrl({ slug: "imya-i-mesyac-yasnyj", kind: "child", gender: "girl", age: 6, extraLooks: [ex] }));
    check(extraMarks(svg));
  });
  it("все роли рисуются по-разному (мама ≠ папа ≠ бабушка ≠ дедушка, кошка ≠ собака)", async () => {
    const sig = await Promise.all(ROLES.map(async ([, ex]) => {
      const m = extraMarks(await svgOf(sampleUrl({ slug: "imya-i-mesyac-yasnyj", kind: "child", gender: "girl", extraLooks: [ex] })));
      return [m.kind, m.figure, m.gender, m.age, m.species, m.hair].join("|");
    }));
    expect(new Set(sig).size).toBe(ROLES.length);
  });
  it("старые ссылки (только роли, x=mom,grandma,pet) — тоже по роли, без случайного пола", async () => {
    const svg = await svgOf("/obrazec?s=imya-i-mesyac-yasnyj&x=mom,grandpa");
    expect(svg).toMatch(/data-extra="1" data-kind="adult"><g data-figure="adult" data-gender="f" data-age="adult"/);
    expect(svg).toMatch(/data-extra="2" data-kind="adult"><g data-figure="adult" data-gender="m" data-age="old"/);
  });
  it("выбор картинками доходит до рисунка: каре у бабушки, борода у дедушки, рыжая кошка, портрет доп. героя", async () => {
    const g = extraMarks(await svgOf(sampleUrl({ kind: "child", extraLooks: [{ role: "grandpa", look: { beard: true, glasses: false } }] })));
    expect(g.body).toContain('data-beard="1"');
    expect(g.body).not.toContain("data-glasses");
    const cat = await svgOf(sampleUrl({ kind: "child", extraPortrait: true, extraLooks: [{ role: "pet", species: "cat", look: { fur: "рыжий" } }] }));
    expect(cat).toContain('data-species="cat"');
    const grey = await svgOf(sampleUrl({ kind: "child", extraPortrait: true, extraLooks: [{ role: "pet", species: "cat", look: { fur: "серый" } }] }));
    expect(grey).not.toBe(cat);
    const gm = await svgOf(sampleUrl({ kind: "child", extraPortrait: true, face: true, extraLooks: [{ role: "grandma" }] }));
    expect(gm).toMatch(/data-figure="adult" data-gender="f" data-age="old"/);
  });
  it("кодирование внешности в ссылке — туда и обратно; чужие значения отбрасываются маршрутом", async () => {
    const e: SampleExtra = { role: "grandma", gender: "girl", look: { hair: "седые", hairstyle: "каре", glasses: true, fur: "x;y:z" } };
    expect(decodeSampleExtra("grandma", encodeSampleExtra(e))).toEqual({ role: "grandma", gender: "girl", look: { hair: "седые", hairstyle: "каре", glasses: true, fur: "x y z" } });
    const svg = await svgOf(`/obrazec?x=mom&x1=${encodeURIComponent("h:<script>;hs:пучок")}`);
    expect(svg).not.toContain("<script>");
  });
});

describe("страницы книги, эскизы и PDF — та же внешность (extraDemoLook)", () => {
  it("бабушка седая с пучком и в очках, дедушка с усами, брат — ребёнок, кошка — кошка", () => {
    const gm = extraDemoLook({ role: "grandma", name: "Валя" });
    expect(gm).toMatchObject({ gender: "girl", age: 68, hair: "седые", hairstyle: "пучок", glasses: true });
    expect(extraDemoLook({ role: "grandpa", name: "Коля" })).toMatchObject({ gender: "boy", age: 70, hair: "седые", moustache: true, glasses: true });
    expect(extraDemoLook({ role: "mom", name: "Оля" })).toMatchObject({ gender: "girl", age: 35 });
    expect(extraDemoLook({ role: "sibling", name: "Петя" }, { heroAge: 6 })).toMatchObject({ gender: "boy", age: 6 });
    expect(extraDemoLook({ role: "pet", name: "Мурка", species: "cat", look: { fur: "рыжий" } })).toMatchObject({ species: "cat", furColor: "рыжий" });
    expect(extraDemoLook({ role: "toy", name: "", look: { toy: "кукла" } }).thing).toBe("кукла");
    expect(extraDemoLook({ role: "grandpa", name: "", look: { moustache: false, glasses: false } })).toMatchObject({ moustache: false, glasses: false });
  });
  it("разворот книги: каждый доп. герой — свой рисунок", () => {
    const roles = [{ role: "grandma" as const }, { role: "grandpa" as const }, { role: "pet" as const, species: "cat" as const }];
    const svg = renderDemoSpread({
      plot: { slug: "x", theme: "dragon", heroKind: "child" },
      spreadIndex: 4,
      hero: { gender: "girl", age: 6, kind: "child" },
      extras: roles.map((e) => ({ role: e.role, kind: extraDrawKind(e.role, "child"), look: extraDemoLook({ ...e, name: "" }) })),
    });
    expect(svg).toMatch(/data-extra="1" data-kind="adult"><g data-figure="adult" data-gender="f" data-age="old"/);
    expect(svg).toMatch(/data-extra="2" data-kind="adult"><g data-figure="adult" data-gender="m" data-age="old"/);
    expect(svg).toMatch(/data-extra="3" data-kind="pet"><g data-species="cat"/);
  });
  it("страница книги, PDF и демо берут внешность из одной функции", () => {
    expect(read("src/lib/gen/pipeline.ts")).toContain("return extraDemoLook(e,");
    expect(read("tools/demo/api.ts")).toContain("return extraDemoLook(e,");
    expect(read("src/app/obrazec/route.ts")).toContain("extraDemoLook(e,");
  });
  it("эскизы всех 12 разворотов и обложки: с водяным знаком и доп. героями", async () => {
    const a = AnswersV2.parse({
      audience: "CHILD",
      hero: { name: "Маша", gender: "girl", ageGroup: "5-7" },
      story: { slug: "imya-i-mesyac-yasnyj" },
      appearance: { hair: "рыжие", eyes: "зелёные", smile: "wide", blush: true, outfitColor: "зелёная" },
      extras: [{ role: "grandma", name: "Валя", look: { hairstyle: "каре" } }, { role: "pet", name: "Мурка", species: "cat" }],
    });
    const urls = sketchUrls(a);
    expect(urls).toHaveLength(13);
    expect(coverSampleUrl(a)).toContain("x1=");
    for (const u of [urls[0], urls[7]]) {
      const svg = await svgOf(u);
      expect(svg).toContain('data-watermark="букими"');
      expect(svg).toMatch(/data-extra="1" data-kind="adult"><g data-figure="adult" data-gender="f" data-age="old"/);
      expect(svg).toMatch(/data-extra="2" data-kind="pet"><g data-species="cat"/);
      expect(svg).toContain('data-eyes="#1fb847"');
    }
  });
});

describe("внешность главного героя картинками: рисовальщик умеет глаза, улыбку, румянец, цвет одежды", () => {
  it("каждый вариант меняет рисунок", async () => {
    const base = { portrait: true, face: true, kind: "child" as const, gender: "girl", age: 6, hair: "рыжие", hairstyle: "косички" };
    const plain = await svgOf(sampleUrl(base));
    for (const eyes of ["карие", "голубые", "зелёные", "серые"]) expect(await svgOf(sampleUrl({ ...base, eyes }))).toContain("data-eyes=");
    expect(await svgOf(sampleUrl({ ...base, smile: "calm" }))).toContain('data-smile="calm"');
    expect(await svgOf(sampleUrl({ ...base, blush: true }))).toContain('data-blush="1"');
    expect(await svgOf(sampleUrl({ ...base, face: "bust", outfit: "синяя" }))).toContain("#3d6fc4");
    expect(new Set(await Promise.all(["smile", "wide", "calm"].map((sm) => svgOf(sampleUrl({ ...base, smile: sm }))))).size).toBe(3);
    expect(plain).not.toContain("data-eyes=");
  });
  it("анкета: варианты — кнопки с aria-label, стрелки, выбранное видно; текст — только в «Своё описание»", () => {
    const pp = read("src/components/quiz/PicPicker.tsx");
    expect(pp).toContain('role="radiogroup"');
    expect(pp).toContain("aria-label={o.label}");
    expect(pp).toContain("aria-checked={on}");
    expect(pp).toContain("ArrowRight");
    const qw = read("src/components/quiz/QuizWizard.tsx");
    for (const row of ['name="skin"', 'name="hair"', 'name="hairstyle"', 'name="eyes"', 'name="face"', 'name="smile"', 'name="outfit"', "extra-species-", "extra-fur-", "extra-toy-", "extra-hair-", "extra-face-"]) expect(qw).toContain(row);
    expect(qw).toContain("<summary>Своё описание</summary>");
    expect(qw).not.toContain('label="Кошка или собака" items=');
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Маша", gender: "girl", ageGroup: "5-7" }, extras: [{ role: "grandpa", name: "Коля", look: { beard: true, hair: "седые" } }] });
    expect(a.extras[0].look).toEqual({ beard: true, hair: "седые" });
    expect(a.appearance).toMatchObject({ eyes: "", smile: "", blush: false, outfitColor: "" });
  });
});

describe("водяной знак превью: один мягкий штамп «букими» на страницу", () => {
  it("обложка — один, разворот — по одному на левую и правую страницу, без сетки «БУКИМИ · ПРЕВЬЮ»", () => {
    const words = (s: string) => (s.match(/>букими</g) ?? []).length / 3; // тень, свет, оттиск
    expect(words(watermark(1024, 1024))).toBe(1);
    expect(words(watermark(2048, 1024))).toBe(2);
    expect(words(watermark(900, 450))).toBe(2); // превью-JPEG разворота (savePage)
    const svg = renderDemoSpread({ plot: { slug: "x", theme: "dragon", heroKind: "child" }, spreadIndex: 2, hero: {}, watermark: true });
    expect(svg).not.toContain("ПРЕВЬЮ");
    expect(svg.match(/data-watermark/g)).toHaveLength(1);
  });
  it("знак — внизу у внешнего края страницы (текст сверху, герои в середине), прозрачный", () => {
    const wm = watermark(2048, 1024);
    expect(wm).toContain('opacity=".34"');
    const ys = [...wm.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThan(900);
    const xs = [...wm.matchAll(/<text x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeLessThan(200);
    expect(Math.max(...xs)).toBeGreaterThan(1800);
  });
  it("сервер: превью страниц (savePage) — тот же знак, без старой сетки", () => {
    const src = read("src/lib/gen/pipeline.ts");
    expect(src).toContain("${watermark(w, h)}");
    expect(src).not.toContain('font-size="28"');
  });
});

describe("превью книги: все страницы с картинками", () => {
  it("нерисованные страницы — эскизы с подписью «эскиз»; в демо превью рисует всю книгу", () => {
    const bf = read("src/components/book/BookFlow.tsx");
    expect(bf).toContain("sketches[s.index]");
    expect(read("src/components/book/BookPreview.tsx")).toContain('className="bk-sketch" data-sketch>эскиз<');
    expect(read("src/app/kniga/[id]/page.tsx")).toContain("sketchUrls(a.data)");
    expect(read("tools/demo/api.ts")).toContain("b.pages = Array.from({ length: 13 }, (_, i) => i);");
  });
});
