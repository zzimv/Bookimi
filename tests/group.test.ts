// Группа (детсад, класс): склонение списков и имени-отчества, слоты {ДРУГn} — каждый назван, никто дважды,
// пока не прозвучали все; стихи — имена в строках-обращениях; каталог повода по разделам; обезличивание; демо-толпа.
import { describe, expect, it } from "vitest";
import { applyGroupScenes, applyOccasion, groupSlotCount, plotBySlug, PLOTS, plotSections, plotsForOccasion, slotMentions, validateContent } from "@/content/registry";
import { blockVariant, isStandaloneLine, nameInMetricLine } from "@/content/tags";
import { crowdLayout, crowdLooks, renderDemoSpread } from "@/content/art/render";
import { AnswersV2 } from "@/content/answers";
import { CASES, chunkNames, declineName, distributeMembers, fillTags, guessGender, type TagPerson } from "@/lib/declension";
import { personsOf, redactForImage, redactForText } from "@/lib/gen/redact";
import type { Plot } from "@/content/types";

const NAMES: [string, string][] = [
  ["Аня", "girl"], ["Илья", "boy"], ["Любовь", "girl"], ["Лев", "boy"], ["Никита", "boy"], ["Соня", "girl"], ["Тимур", "boy"], ["Вера", "girl"],
  ["Гоша", "boy"], ["Оля", "girl"], ["Ян", "boy"], ["Катя", "girl"], ["Марк", "boy"], ["Даша", "girl"], ["Фёдор", "boy"], ["Полина", "girl"],
  ["Игорь", "boy"], ["Юля", "girl"], ["Артём", "boy"], ["Лиза", "girl"], ["Савва", "boy"], ["Варя", "girl"], ["Глеб", "boy"], ["Ксюша", "girl"],
  ["Матвей", "boy"], ["Алиса", "girl"], ["Егор", "boy"], ["Мила", "girl"], ["Захар", "boy"], ["Ева", "girl"], ["Кирилл", "boy"], ["Злата", "girl"],
  ["Роман", "boy"], ["Ника", "girl"], ["Степан", "boy"], ["Агата", "girl"], ["Демид", "boy"], ["Таисия", "girl"], ["Платон", "boy"],
];
const members = (n: number): TagPerson[] => NAMES.slice(0, n).map(([name, gender]) => ({ name, gender }));
const GROUP_PLOTS = PLOTS.filter((p) => p.group);
const HERO = { name: "Маша", gender: "girl" };

/** Встречается ли имя (в любом падеже) в тексте отдельным словом. */
function mentions(text: string, p: TagPerson) {
  return CASES.some((c) => new RegExp(`(?<![А-Яа-яЁё])${declineName(p.name, c, p.gender)}(?![А-Яа-яЁё])`).test(text));
}

function bookText(plot: Plot, n: number, adults: TagPerson[] = []) {
  const ctx = { hero: HERO, group: { members: members(n), adults, slots: groupSlotCount(plot) }, occasion: "" };
  return applyOccasion(plot, plot.occasions[0]).map((s) => fillTags(s.text, ctx));
}

describe("склонение группы", () => {
  const ctx = (n: number) => ({ hero: HERO, group: { members: members(n) } });
  it("список из 2 и 5 имён — одной фразой, с падежом", () => {
    expect(fillTags("Мы подарили {ГРУППА.дат} цветы.", ctx(2))).toBe("Мы подарили Ане и Илье цветы.");
    expect(fillTags("Мы гуляли с {ГРУППА.тв}.", ctx(5))).toBe("Мы гуляли с Аней, Ильёй, Любовью, Львом и Никитой.");
    expect(fillTags("Нет {ГРУППА.род}.", ctx(5))).toBe("Нет Ани, Ильи, Любови, Льва и Никиты.");
  });
  it("больше 8 имён — продолжение следующей фразой, предлог повторяется", () => {
    const nine = fillTags("Мы гуляли с {ГРУППА.тв} весь день. Потом пили чай.", ctx(9));
    expect(nine).toBe("Мы гуляли с Аней, Ильёй, Любовью, Львом и Никитой весь день. И с Соней, Тимуром, Верой и Гошей — тоже. Потом пили чай.");
    const fifteen = fillTags("Спасибо {ГРУППА.дат}!", ctx(15));
    expect(fifteen).toMatch(/^Спасибо Ане, Илье, Любови, Льву, Никите, Соне, Тимуру и Вере! И Гоше, Оле, Яну, Кате, Марку, Даше и Фёдору — тоже\.$/);
    expect(chunkNames(NAMES.slice(0, 39)).map((c) => c.length)).toEqual([8, 8, 8, 8, 7]);
  });
  it("«со Львом»: предлог перед слотом правится", () => {
    const g = { hero: HERO, group: { members: [{ name: "Лев", gender: "boy" }] } };
    expect(fillTags("[[?ДРУГ1:Маша играла с {ДРУГ1.тв}.]]", g)).toBe("Маша играла со Львом.");
  });
  it("имя-отчество", () => {
    const f = (n: string, c: (typeof CASES)[number]) => declineName(n, c, guessGender(n));
    expect(f("Мария Ивановна", "дат")).toBe("Марии Ивановне");
    expect(f("Мария Ивановна", "тв")).toBe("Марией Ивановной");
    expect(f("Ольга Петровна", "род")).toBe("Ольги Петровны");
    expect(f("Анна Сергеевна", "вин")).toBe("Анну Сергеевну");
    expect(f("Иван Петрович", "дат")).toBe("Ивану Петровичу");
    expect(f("Иван Петрович", "тв")).toBe("Иваном Петровичем");
    expect(f("Никита Сергеевич", "род")).toBe("Никиты Сергеевича");
    expect(guessGender("Любовь Ильинична")).toBe("girl");
    const g = { hero: HERO, group: { members: [], adults: [{ name: "Мария Ивановна" }, { name: "Иван Петрович" }] } };
    expect(fillTags("Спасибо {ВОСПИТАТЕЛИ.дат}! {ВОСПИТАТЕЛЬ.им} улыбнул{РВ:ся|ась}, {ВОСПИТАТЕЛЬ2.им} — тоже.", g)).toBe("Спасибо Марии Ивановне и Ивану Петровичу! Мария Ивановна улыбнулась, Иван Петрович — тоже.");
  });
  it("слоты: свои дети, кучки при большой группе, формы {РДn}", () => {
    expect(distributeMembers(3, 14).slice(0, 4)).toEqual([[0], [1], [2], []]);
    expect(distributeMembers(39, 14).flat()).toEqual([...Array(39).keys()]);
    expect(Math.max(...distributeMembers(39, 14).map((s) => s.length))).toBe(3);
    const t = "[[?ДРУГ2:{ДРУГ2.им} {РД2:нашёл|нашла|нашли} ключ. || Ключ нашёлся сам.]]";
    expect(fillTags(t, { hero: HERO, group: { members: members(1), slots: 14 } })).toBe("Ключ нашёлся сам.");
    expect(fillTags(t, { hero: HERO, group: { members: members(2), slots: 14 } })).toBe("Илья нашёл ключ.");
    expect(fillTags(t, { hero: HERO, group: { members: members(40 - 1), slots: 14 } })).toBe("Любовь, Лев и Никита нашли ключ.");
    expect(fillTags("{МН_ГРУППЫ:пришёл|пришла|пришли}", { hero: HERO, group: { members: members(1) } })).toBe("пришла");
  });
});

describe("сюжеты группы: каждого назвали", () => {
  it("есть 3+ сюжета на выпускной в саду, первый класс и выпускной в школе", () => {
    expect(GROUP_PLOTS.filter((p) => p.occasions.includes("vypusknoj-v-sadu")).length).toBeGreaterThanOrEqual(3);
    expect(GROUP_PLOTS.some((p) => p.occasions.includes("pervyj-klass") && p.group!.max === 40)).toBe(true);
    expect(GROUP_PLOTS.some((p) => p.audience === "TEEN" && p.occasions.includes("vypusknoj-v-shkole") && p.group!.max === 40)).toBe(true);
    for (const p of GROUP_PLOTS.filter((p) => p.occasions.includes("vypusknoj-v-sadu"))) {
      expect(p.occasions).toEqual(["vypusknoj-v-sadu"]);
      expect(p.group!.max).toBe(30);
    }
  });
  const sizes = [...Array(15).keys()].map((i) => i + 1).concat([25, 30, 40]);
  for (const plot of GROUP_PLOTS) {
    it(`${plot.slug}: размеры ${sizes.join(", ")} — каждый ребёнок назван в истории, никто дважды раньше всех`, () => {
      for (const size of sizes.filter((s) => s <= plot.group!.max)) {
        const n = size - 1;
        const texts = bookText(plot, n, [{ name: "Мария Ивановна" }]);
        const story = texts.filter((_, i) => !plot.spreads[i].text.includes("{ПЕРЕКЛИЧКА}")).join("\n");
        for (const m of members(n)) expect(mentions(story, m), `${plot.slug} size ${size}: ${m.name}`).toBe(true);
        // Ведомость — все имена и герой
        const roster = texts.find((_, i) => plot.spreads[i].text.includes("{ПЕРЕКЛИЧКА}"))!;
        if (n) for (const m of [...members(n), HERO]) expect(roster).toContain(m.name);
        // Порядок появлений
        const seen = new Set<number>();
        for (const spread of slotMentions(plot, n)) {
          for (const i of spread) if (seen.has(i)) expect(seen.size, `${plot.slug} size ${size}: повтор до того, как прозвучали все`).toBe(n);
          spread.forEach((i) => seen.add(i));
        }
        expect(seen.size).toBe(n);
        for (const t of texts) {
          expect(t).not.toMatch(/[{}]|\[\[|\]\]|\|\|/);
          expect(t).not.toMatch(/ {2}|\s[.,!?]/);
        }
      }
    });
  }
  it("стихи: имена детей и взрослых — только в строках-обращениях", () => {
    const verse = GROUP_PLOTS.filter((p) => p.textStyle === "funny-verse");
    expect(verse.length).toBeGreaterThan(0);
    for (const p of verse) {
      for (const s of p.spreads) for (const b of ["then", "else"] as const) expect(nameInMetricLine(blockVariant(s.text, b))).toEqual([]);
      for (const n of [3, 14, 29]) {
        const lines = bookText(p, n, [{ name: "Мария Ивановна" }, { name: "Иван Петрович" }]).join("\n").split("\n");
        const named = lines.filter((l) => members(n).some((m) => mentions(l, m)) || /Ивановн|Петрович/.test(l));
        expect(named.length).toBeGreaterThan(0);
        for (const l of named) expect(/^— .+!$/.test(l) || l.includes(" · "), `«${l}»`).toBe(true);
      }
    }
    expect(isStandaloneLine("— {ДРУГ3.им}!")).toBe(true);
    expect(nameInMetricLine("Кто шнурки завяжет {ДРУГ1.им}")).toHaveLength(1);
  });
  it("сцены: {GROUP} → «a group of N … children», без имён", () => {
    const p = plotBySlug("poslednij-den-v-nashej-gruppe")!;
    const s = applyGroupScenes(p, p.spreads, 14, 2);
    expect(s.some((x) => x.scene.includes("a group of 14 kindergarten children"))).toBe(true);
    expect(s.every((x) => !/\{GROUP/.test(x.scene) && !/[а-яё]/i.test(x.scene))).toBe(true);
    expect(applyGroupScenes(plotBySlug("nash-pervyj-klass")!, plotBySlug("nash-pervyj-klass")!.spreads, 39).some((x) => x.scene.includes("a group of 39 first-graders"))).toBe(true);
  });
});

describe("validateContent: группа", () => {
  const base = plotBySlug("poslednij-den-v-nashej-gruppe")!;
  const check = (patch: Partial<Plot>) => {
    PLOTS.push({ ...base, slug: "test-group-plot", ...patch });
    try {
      return validateContent().errors.filter((e) => e.includes("test-group-plot"));
    } finally {
      PLOTS.pop();
    }
  };
  it("ловит ошибки группы", () => {
    expect(check({})).toEqual([]);
    expect(check({ group: { ...base.group!, max: 41 } }).join()).toMatch(/max ≤ 40/);
    const spreads = base.spreads.map((s) => ({ ...s }));
    spreads[1].text = "Пришли все: {ДРУГ1.им} и {ДРУГ2.им}.";
    expect(check({ spreads }).join()).toMatch(/вне блока/);
    const noAdultsBlock = base.spreads.map((s) => ({ ...s }));
    noAdultsBlock[0].text += " {ВОСПИТАТЕЛЬ.им} пришла.";
    expect(check({ spreads: noAdultsBlock }).join()).toMatch(/метки взрослых вне блока/);
    expect(check({ group: undefined }).join()).toMatch(/только у сюжетов с group/);
    const swapped = base.spreads.map((s) => ({ ...s }));
    [swapped[1].text, swapped[2].text] = [swapped[2].text, swapped[1].text];
    expect(check({ spreads: swapped }).join()).toMatch(/появляется раньше/);
  });
});

describe("каталог повода по разделам", () => {
  it("выпускной в саду: книги про сад первыми, потом «Своя история», чужие скрыты", () => {
    const s = plotSections("vypusknoj-v-sadu", "CHILD");
    expect(s.strong).toBe(true);
    expect(s.customFirst).toBe(false);
    expect(s.core.map((p) => p.slug)).toEqual(expect.arrayContaining(["poslednij-den-v-nashej-gruppe", "my-vyrosli", "volshebnyj-shkafchik"]));
    const shown = [...s.core, ...s.fits, ...s.others].map((p) => p.slug);
    expect(shown).not.toContain("kapitan-podvodnoj-lodki");
    expect(shown).not.toContain("novogodnee-puteshestvie-s-dedom-morozom");
    expect(s.hiddenCount).toBeGreaterThan(0);
    expect(s.fitsTitle).toBe("Тоже подойдут — впишем ваш повод");
  });
  it("без повода и свой повод: «Своя история» первой, затем все сюжеты", () => {
    const all = PLOTS.filter((p) => p.audience === "CHILD").length;
    for (const k of ["bez", "svoj"]) {
      const s = plotSections(k, "CHILD");
      expect(s.customFirst).toBe(true);
      expect(s.core).toEqual([]);
      expect(s.others).toHaveLength(all);
      expect(s.hiddenCount).toBe(0);
    }
  });
  it("Новый год: core — новогодняя книга; садовские книги скрыты; старая функция совместима", () => {
    const s = plotSections("novyj-god", "CHILD");
    expect(s.core[0].slug).toBe("novogodnee-puteshestvie-s-dedom-morozom");
    expect([...s.core, ...s.fits].some((p) => p.group)).toBe(false);
    expect(plotsForOccasion("vypusknoj-v-sadu", "CHILD")[0].occasions).toContain("vypusknoj-v-sadu");
    expect(plotsForOccasion("vypusknoj-v-sadu", "CHILD")).toHaveLength(PLOTS.filter((p) => p.audience === "CHILD").length);
  });
  it("повод без core-сюжетов: «Своя история» первой", () => {
    const s = plotSections("rozhdestvo", "PET");
    expect(s.core).toEqual([]);
    expect(s.customFirst).toBe(true);
  });
});

describe("обезличивание группы", () => {
  const a = {
    hero: { name: "Маша", gender: "girl" },
    extras: [],
    group: { members: [{ name: "Петя", gender: "boy" }, { name: "Любовь", gender: "girl" }], adults: [{ name: "Мария Ивановна", role: "воспитатель" }] },
  };
  const persons = personsOf(a);
  it("имена детей и воспитателей не уходят в ИИ", () => {
    const t = redactForText("Петя дружит с Машей, а Марии Ивановне все дарят цветы. Ивановна строгая. Любовь любит рисовать.", persons);
    expect(t).not.toMatch(/Петя|Мари|Ивановн|Любовь/);
    expect(t).toMatch(/друг из группы/);
    expect(t).toMatch(/\{ВОСПИТАТЕЛЬ1\.дат\}/);
    const img = redactForImage("Петя и Мария Ивановна на прогулке", persons);
    expect(img).toBe("a child from the group и the kindergarten teacher на прогулке");
  });
  it("анкета: группа необязательна и проверяется", () => {
    expect(AnswersV2.parse({ hero: { name: "Маша", gender: "girl" } }).group).toBeUndefined();
    const g = AnswersV2.parse({ hero: { name: "Маша", gender: "girl" }, group: { members: [{ name: "Петя", gender: "boy" }], adults: [{ name: "Мария Ивановна", role: "воспитатель" }] } }).group!;
    expect(g.members[0]).toMatchObject({ name: "Петя", gender: "boy", photo: false });
    expect(AnswersV2.safeParse({ hero: { name: "М", gender: "girl" }, group: { members: Array(40).fill({ name: "А" }) } }).success).toBe(false);
  });
});

describe("демо-толпа", () => {
  it("до 40 фигур рядами, ни одна не заходит на героя", () => {
    for (const [W, n] of [[2048, 40], [1024, 40], [2048, 3], [1024, 15]] as const) {
      const zoneLo = W * 0.38 - 110;
      const zoneHi = W * 0.38 + 260;
      const slots = crowdLayout({ W, H: 1024, count: n, kinds: Array(n).fill("child"), heroFeet: 850, heroScale: W > 1024 ? 1.25 : 1.5, zoneLo, zoneHi });
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.x + s.halfWidth <= zoneLo || s.x - s.halfWidth >= zoneHi).toBe(true);
        expect(s.x - s.halfWidth).toBeGreaterThanOrEqual(0);
        expect(s.x + s.halfWidth).toBeLessThanOrEqual(W);
        expect(s.feet - 250 * s.scale).toBeGreaterThan(0);
      }
      expect(new Set(slots.map((s) => s.feet)).size).toBeLessThanOrEqual(4);
    }
  });
  it("рендер группы без NaN, детерминированно", () => {
    const plot = plotBySlug("nash-pervyj-klass")!;
    const crowd = crowdLooks(members(39).map((m) => ({ gender: m.gender, description: "рыжие, очки" })), [{ gender: "girl" }]);
    expect(crowd).toHaveLength(40);
    for (const layout of ["around", "photo"] as const) {
      const svg = renderDemoSpread({ plot, spreadIndex: 11, artStyle: "kind-classic", hero: { gender: "girl" }, crowd, crowdLayout: layout, extras: [{ role: "sibling", look: {} }] });
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toBe(renderDemoSpread({ plot, spreadIndex: 11, artStyle: "kind-classic", hero: { gender: "girl" }, crowd, crowdLayout: layout, extras: [{ role: "sibling", look: {} }] }));
    }
  });
});
