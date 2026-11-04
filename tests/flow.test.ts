// Новый путь создания книги: шаги по случаям, порядок разделов повода, список группы (вставка, пол по имени),
// скидки «для каждого», анкета копии, обработка фото (синтетические лица — никаких настоящих детских фото).
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PLOTS, plotBySlug, plotSections, sectionPlot } from "@/content/registry";
import { CUSTOM_STORY_ENABLED, sectionOrder, sectionsOf } from "@/content/sections";
import { AUDIENCES, type AudienceKey } from "@/content/profiles";
import { AnswersV2 } from "@/content/answers";
import { flowSteps, stepProgress } from "@/lib/flow";
import { guessChildGender, parseNames, rosterIssues } from "@/lib/roster";
import { bulkCopyAnswers, bulkPct, bulkQuote, DEFAULT_BULK_TIERS, groupChildren } from "@/lib/bulk";
import { judgePhoto, sniffImage } from "@/lib/photo-check";
import { PhotoError, processPhoto, recropPhoto } from "@/lib/photo-process";
import { faceSvg, petSvg } from "./fixtures/synthetic-face";

const AUD = AUDIENCES.map((a) => a.key) as AudienceKey[];

describe("шаги пути по случаям", () => {
  it("книга выбрана заранее: Герои → (Группа) → Детали — без повода и книги, для каждой книги каждой аудитории", () => {
    for (const p of PLOTS) {
      const steps = flowSteps({ preselected: true, group: Boolean(p.group) });
      expect(steps, p.slug).toEqual(p.group ? ["heroes", "group", "details"] : ["heroes", "details"]);
    }
  });
  it("«Создать книгу»: Герои → Для кого и повод → Книга → (Группа) → Детали", () => {
    for (const aud of AUD)
      for (const group of [false, true]) {
        expect(flowSteps({ preselected: false, group }), `${aud} ${group}`).toEqual(["heroes", "occasion", "book", ...(group ? ["group"] : []), "details"]);
        // Аудитория и повод из ссылки — шаг «Для кого и повод» не нужен; только одно из двух — нужен
        expect(flowSteps({ preselected: false, presetAudience: true, presetOccasion: true, group })).toEqual(["heroes", "book", ...(group ? ["group"] : []), "details"]);
        expect(flowSteps({ preselected: false, presetAudience: true, group })[1]).toBe("occasion");
        expect(flowSteps({ preselected: false, presetOccasion: true, group })[1]).toBe("occasion");
      }
  });
  it("прогресс показывает настоящее число шагов", () => {
    const steps = flowSteps({ preselected: false, group: true });
    expect(stepProgress(steps, "group")).toEqual({ index: 4, total: 5, pct: 80 });
    expect(stepProgress(flowSteps({ preselected: true, group: false }), "details")).toEqual({ index: 2, total: 2, pct: 100 });
  });
  it("группа бывает только у книг детсада и класса: до 30 в саду, до 40 в классе", () => {
    for (const p of PLOTS.filter((x) => x.group)) {
      if (p.occasions.includes("vypusknoj-v-sadu")) expect(p.group!.max, p.slug).toBe(30);
      else expect(p.group!.max, p.slug).toBe(40);
    }
  });
});

describe("разделы повода: порядок показа", () => {
  it("«Без повода» и «Свой повод» — все книги; «Своя история» убрана (rev 20, CUSTOM_STORY_ENABLED)", () => {
    for (const aud of AUD)
      for (const key of ["bez", "svoj"]) {
        const s = plotSections(key, aud);
        expect(s.customFirst, `${aud} ${key}`).toBe(true);
        expect(s.custom).toBe(false);
        expect(sectionOrder(s)).not.toContain("custom");
        expect(sectionOrder({ customFirst: true, custom: true })[0]).toBe(CUSTOM_STORY_ENABLED ? "custom" : "core");
        expect(s.others.length).toBeGreaterThan(0);
      }
  });
  it("выпускной в детском саду: только книги детского сада (все — с группой), остальные скрыты", () => {
    const s = plotSections("vypusknoj-v-sadu", "CHILD");
    expect(s.core.length).toBeGreaterThanOrEqual(3);
    for (const p of s.core) {
      expect(p.occasions).toContain("vypusknoj-v-sadu");
      expect(p.group?.label).toBe("группа");
      expect(p.group?.max).toBe(30);
    }
    expect(s.fits).toEqual([]);
    expect(s.others).toEqual([]);
    expect(s.hiddenCount).toBeGreaterThan(0);
    expect(s.customFirst).toBe(false);
    expect(sectionOrder(s)).toEqual(["core", "fits", "others"]); // rev 20: без «Своей истории»
  });
  it("анкета в браузере (sectionsOf по проекции) показывает то же, что сайт (plotSections)", () => {
    for (const aud of AUD)
      for (const key of ["bez", "svoj", "den-rozhdeniya", "novyj-god", "vypusknoj-v-sadu", "pervyj-klass", "rozhdestvo", "svadba", "8-marta"]) {
        const site = plotSections(key, aud);
        const pool = PLOTS.filter((p) => p.audience === aud).map(sectionPlot);
        const quiz = sectionsOf(pool, key);
        const slugs = (xs: { slug: string }[]) => xs.map((x) => x.slug);
        expect(slugs(quiz.core), `${aud} ${key}`).toEqual(slugs(site.core));
        expect(slugs(quiz.fits)).toEqual(slugs(site.fits));
        expect(slugs(quiz.others)).toEqual(slugs(site.others));
        expect(quiz.hiddenCount).toBe(site.hiddenCount);
        expect(quiz.customFirst).toBe(site.customFirst);
      }
  });
});

describe("список группы: вставка и пол по имени", () => {
  it("строки, запятые, «;», номера и маркеры; пометка пола (м)/(ж)", () => {
    const r = parseNames("1. Аня\n2) Петя, Саша; женя (ж)\n- Маша К.\n• Илья\n\n  ");
    expect(r.map((x) => x.name)).toEqual(["Аня", "Петя", "Саша", "Женя", "Маша К.", "Илья"]);
    expect(r.map((x) => x.gender)).toEqual(["girl", "boy", undefined, "girl", "girl", "boy"]);
    expect(r.find((x) => x.name === "Саша")!.ambiguous).toBe(true);
    expect(r.find((x) => x.name === "Женя")!.ambiguous).toBe(false);
  });
  it("Саша, Женя, Валя — спрашиваем; остальное угадываем", () => {
    for (const n of ["Саша", "Женя", "Валя", "Шура"]) expect(guessChildGender(n), n).toBeNull();
    expect(guessChildGender("Илья")).toBe("boy");
    expect(guessChildGender("Никита")).toBe("boy");
    expect(guessChildGender("Анна")).toBe("girl");
    expect(guessChildGender("Любовь")).toBe("girl");
    expect(guessChildGender("Тимофей")).toBe("boy");
    expect(guessChildGender("Ким")).toBe("boy");
    expect(parseNames("Ким")[0]).toMatchObject({ name: "Ким", gender: "boy" });
    expect(parseNames("Саша м")[0]).toMatchObject({ name: "Саша", gender: "boy", ambiguous: false });
  });
  it("25 имён вставкой — все в списке, проверка: повторы, имя героя, пустые, длина, пол", () => {
    const names = "Аня, Петя, Ваня, Оля, Катя, Миша, Даша, Гоша, Соня, Лиза, Глеб, Варя, Егор, Мила, Ева, Рома, Ника, Тимур, Вера, Марк, Полина, Артём, Злата, Фёдор, Алиса";
    const list = parseNames(names);
    expect(list).toHaveLength(25);
    expect(rosterIssues(list, { heroName: "Маша", max: 29 })).toEqual([]);
    const bad = rosterIssues([{ name: "Аня", gender: "girl" }, { name: "аня", gender: "girl" }, { name: "Маша", gender: "girl" }, { name: " " }, { name: "Саша" }, { name: "А".repeat(31), gender: "boy" }], { heroName: "Маша" });
    expect(bad.map((x) => x.kind).sort()).toEqual(["duplicate", "empty", "gender", "hero", "long"].sort());
    expect(rosterIssues(parseNames(names + ", Яна, Лёва, Тоня, Юра, Ира"), { max: 29 }).some((x) => x.message.includes("до 29"))).toBe(true);
  });
});

describe("книга для каждого в группе", () => {
  it("скидки по количеству (по умолчанию 5+ −20%, 15+ −30%, 25+ −35%)", () => {
    expect([1, 4, 5, 14, 15, 24, 25, 40].map((n) => bulkPct(n, DEFAULT_BULK_TIERS))).toEqual([0, 0, 20, 20, 30, 30, 35, 35]);
  });
  const formats = [
    { key: "pdf", kind: "PDF" as const, title: "PDF", priceRub: 990 },
    { key: "std-hard", kind: "PRINT" as const, title: "Стандарт, твёрдая", priceRub: 2990 },
  ];
  const heroes = Array.from({ length: 26 }, (_, i) => `Ребёнок ${i + 1}`);
  it("строка на каждую книгу, скидка за количество, одна доставка — бесплатно до ПВЗ от 2 книг", () => {
    const q = bulkQuote({ whoPrints: "self", heroes }, formats);
    expect(q.lines).toHaveLength(26);
    expect(q.subtotalRub).toBe(26 * 990);
    expect(q.bulkPct).toBe(35);
    expect(q.discountRub).toBe(Math.round(26 * 990 * 0.35));
    expect(q.totalRub).toBe(26 * 990 - q.discountRub);
    const p = bulkQuote({ whoPrints: "bookimi", formatKey: "std-hard", heroes: heroes.slice(0, 6), shippingMethod: "cdek_pvz", shippingRub: 390, freeShippingBooks: 2 }, formats);
    expect(p.books).toBe(6);
    expect(p.shippingRub).toBe(0);
    expect(p.bulkPct).toBe(20);
    expect(bulkQuote({ whoPrints: "bookimi", formatKey: "std-hard", heroes: heroes.slice(0, 3), shippingMethod: "cdek_courier", shippingRub: 490, freeShippingBooks: 2 }, formats).shippingRub).toBe(490);
  });
  it("промокод и скидка за количество не суммируются — берётся большая", () => {
    const q = bulkQuote({ whoPrints: "self", heroes: heroes.slice(0, 5), discountPct: 40 }, formats);
    expect(q.bulkApplied).toBe(false);
    expect(q.discountRub).toBe(Math.round(5 * 990 * 0.4));
    expect(bulkQuote({ whoPrints: "self", heroes: heroes.slice(0, 5), discountPct: 10 }, formats).bulkApplied).toBe(true);
    expect(bulkQuote({ whoPrints: "self", heroes: ["Один"] }, formats).errors.length).toBeGreaterThan(0);
  });
  it("анкета копии: герой — ребёнок группы, в группе — все остальные и герой основной книги", () => {
    const a = AnswersV2.parse({
      audience: "CHILD",
      hero: { name: "Маша", gender: "girl", ageGroup: "6-7" },
      appearance: { hair: "рыжие" },
      story: { slug: "poslednij-den-v-nashej-gruppe" },
      occasion: { key: "vypusknoj-v-sadu" },
      extras: [{ role: "toy", name: "Зайка" }],
      group: { members: [{ name: "Петя", gender: "boy", description: "очки" }, { name: "Аня" }, { name: "Саша", gender: "girl" }], adults: [{ name: "Мария Ивановна", role: "воспитатель" }] },
    });
    expect(groupChildren(a).map((c) => c.name)).toEqual(["Маша", "Петя", "Аня", "Саша"]);
    const c = bulkCopyAnswers(a, 3, "Для {ГЕРОЙ.род}");
    expect(c.hero).toMatchObject({ name: "Саша", gender: "girl", ageGroup: "4-6" }); // старое «6-7» → 4–6 лет (rev 20)
    expect(c.group!.members.map((m) => m.name)).toEqual(["Маша", "Петя", "Аня"]);
    expect(c.group!.members[0].description).toContain("рыжие");
    expect(c.group!.adults[0].name).toBe("Мария Ивановна");
    expect(c.extras).toEqual([]);
    expect(c.dedication).toBe("Для {ГЕРОЙ.род}");
    expect(c.story.slug).toBe(a.story.slug);
    expect(AnswersV2.safeParse(c).success).toBe(true);
    expect(plotBySlug(c.story.slug)?.group).toBeTruthy();
  });
});

describe("обработка фото (синтетические лица)", () => {
  const jpg = (svg: string) => sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
  it("тип — по байтам: текст под видом картинки не принимается", async () => {
    expect(sniffImage(await jpg(faceSvg()))).toBe("jpeg");
    expect(sniffImage(Buffer.from("<html>not an image</html>"))).toBeNull();
    await expect(processPhoto(Buffer.from("GIF89a....... not really"), { kind: "human" })).rejects.toBeInstanceOf(PhotoError);
  });
  it("одно лицо: портрет 1024×1024 «голова и плечи», без замечаний, подсказка цвета волос", async () => {
    const r = await processPhoto(await jpg(faceSvg()), { kind: "human" });
    expect(r.meta.faces).toHaveLength(1);
    expect(r.meta.verdict).toBe("ok");
    expect(r.meta.hair).toBe("каштановые");
    const m = await sharp(r.portrait).metadata();
    expect([m.width, m.height]).toEqual([1024, 1024]);
    // EXIF и геометки удалены
    expect((await sharp(r.original).metadata()).exif).toBeUndefined();
  });
  it("поворот по EXIF: снимок «на боку» выпрямляется", async () => {
    const rotated = await sharp(await jpg(faceSvg())).rotate(90).withMetadata({ orientation: 8 }).jpeg().toBuffer();
    const r = await processPhoto(rotated, { kind: "human" });
    expect(r.meta.height).toBeGreaterThan(r.meta.width);
    expect(r.meta.faces).toHaveLength(1);
  });
  it("несколько людей → подсказка и выбор нужного лица", async () => {
    const svg = faceSvg({ w: 1600, h: 1200, faces: [{ cx: 500, cy: 520, r: 180 }, { cx: 1120, cy: 560, r: 160, skin: "#c99272" }] });
    const r = await processPhoto(await jpg(svg), { kind: "human" });
    expect(r.meta.faces.length).toBe(2);
    expect(r.meta.codes).toContain("many-faces");
    expect(r.meta.hints.join(" ")).toMatch(/несколько людей — выберите нужное лицо/);
    const other = await recropPhoto(r.original, r.meta, 1);
    expect(other.meta.chosen).toBe(1);
    expect(other.meta.codes).not.toContain("many-faces");
    expect(other.portrait.equals(r.portrait)).toBe(false);
  });
  it("лицо слишком мелко, темновато, смаз — подсказки и отказ", async () => {
    const tiny = await processPhoto(await jpg(faceSvg({ w: 1600, h: 1600, faces: [{ cx: 800, cy: 700, r: 55 }] })), { kind: "human" });
    expect(tiny.meta.hints.join(" ")).toMatch(/Лицо слишком мелко/);
    const dark = await processPhoto(await jpg(faceSvg({ dim: 0.4 })), { kind: "human" });
    expect(dark.meta.codes).toContain("dark");
    await expect(processPhoto(await jpg(faceSvg({ blur: 9 })), { kind: "human" })).rejects.toThrow(/смазано/);
    await expect(processPhoto(await sharp(Buffer.from(faceSvg({ w: 400, h: 400 }))).jpeg().toBuffer(), { kind: "human" })).rejects.toThrow(/маленькое/);
  });
  it("питомец: без поиска лица, кадр по центру, подсказка окраса", async () => {
    const r = await processPhoto(await jpg(petSvg()), { kind: "pet" });
    expect(r.meta.kind).toBe("pet");
    expect(r.meta.fur).toBe("рыжий");
    expect(r.meta.verdict).toBe("ok");
  });
  it("пороги — как в preprocess.py", () => {
    const base = { kind: "human" as const, width: 1200, height: 1500, faces: 1, otherFaces: 0, facePx: 400, sharpness: 300, brightness: 150, contrast: 50 };
    expect(judgePhoto(base).verdict).toBe("ok");
    expect(judgePhoto({ ...base, facePx: 200 }).codes).toEqual(["small-face"]);
    expect(judgePhoto({ ...base, sharpness: 10 }).verdict).toBe("reject");
    expect(judgePhoto({ ...base, brightness: 230 }).codes).toEqual(["bright"]);
    expect(judgePhoto({ ...base, faces: 0 }).codes).toEqual(["no-face"]);
  });
});
