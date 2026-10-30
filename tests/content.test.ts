// Контент-движок: целостность каталога, метки, склонение новых случаев, демо-рендер, анкета v2.
// Строгая проверка (полнота каталога: все стили, темы, настроения, минимум сюжетов) — по умолчанию;
// CONTENT_STRICT=0 отключает её на время работы над новым контентом.
import { describe, expect, it } from "vitest";
import {
  applyOccasion,
  getPlots,
  hooksFor,
  PLOTS,
  plotBySlug,
  plotsForOccasion,
  textStyle,
  TEXT_STYLES,
  validateContent,
} from "@/content/registry";
import { renderDemoCover, renderDemoSpread } from "@/content/art/render";
import { checkTags, maxExtraRef, nameAtLineEnd } from "@/content/tags";
import { AnswersV2, ContactV2, normalizePhone } from "@/content/answers";
import { AUDIENCES, OCCASIONS, TEXT_STYLE_IDS } from "@/content/profiles";
import { ageLabel, applyGender, declineName, fillTags, guessGender } from "@/lib/declension";

describe("validateContent", () => {
  it("нет ошибок", () => {
    const r = validateContent();
    expect(r.errors).toEqual([]);
  });
  it.runIf(process.env.CONTENT_STRICT !== "0")("строгая проверка: каталог полный", () => {
    expect(validateContent({ strict: true }).errors).toEqual([]);
  });
});

describe("каталог", () => {
  it("5 старых сюжетов на месте (slug не менялись)", () => {
    for (const slug of ["novogodnee-puteshestvie-s-dedom-morozom", "den-rozhdeniya-v-skazochnom-korolevstve", "imya-i-zvyozdnyj-drakonchik", "kapitan-podvodnoj-lodki", "sonnaya-strana"]) {
      const p = plotBySlug(slug);
      expect(p, slug).not.toBeNull();
      expect(p!.spreads).toHaveLength(12);
    }
    expect(plotBySlug("novogodnee-puteshestvie-s-dedom-morozom")!.spreads[2].scene).toMatch(/broken wooden sleigh/);
  });
  it("все стили текста описаны", () => {
    expect(TEXT_STYLES.map((s) => s.id).sort()).toEqual(TEXT_STYLE_IDS.map((s) => s.id).sort());
    expect(textStyle("pushkin-verse")?.verse).toBe(true);
    expect(textStyle("pushkin-verse")?.systemPrompt).toMatch(/хорей/);
  });
  it("plotsForOccasion никогда не пуст и ставит подходящие первыми", () => {
    for (const a of AUDIENCES) for (const o of OCCASIONS) expect(plotsForOccasion(o.key, a.key).length).toBeGreaterThan(0);
    expect(plotsForOccasion("novyj-god", "CHILD")[0].occasions).toContain("novyj-god");
  });
  it("getPlots фильтрует по возрасту и сегменту", () => {
    expect(getPlots({ audience: "CHILD", age: 3 }).every((p) => (p.ageMin ?? 0) <= 3)).toBe(true);
    expect(getPlots({ segment: "kids-2-4" }).length).toBeGreaterThan(0);
  });
  it("повод вплетается в развороты 1 и 12", () => {
    const p = plotBySlug("kapitan-podvodnoj-lodki")!;
    const s = applyOccasion(p, "novyj-god");
    expect(s[0].text).toMatch(/Новый год/);
    expect(s[11].text).toMatch(/С Новым годом/);
    expect(applyOccasion(p, "bez")[0].text).toBe(p.spreads[0].text);
    // Новогодний сюжет уже про Новый год — крючок пустой
    expect(applyOccasion(plotBySlug("novogodnee-puteshestvie-s-dedom-morozom")!, "novyj-god")[0].text).toBe(
      plotBySlug("novogodnee-puteshestvie-s-dedom-morozom")!.spreads[0].text,
    );
    const svoj = applyOccasion(p, "svoj", "окончание музыкальной школы");
    expect(fillTags(svoj[0].text, { hero: { name: "Марк", gender: "boy" }, occasion: "окончание музыкальной школы" })).toMatch(/окончание музыкальной школы/);
    expect(hooksFor(p, "svoj", "")).toBeNull();
  });
});

describe("метки", () => {
  it("грамматика", () => {
    expect(checkTags("{ГЕРОЙ.им} и {ДОП2.тв}, {Р:он|она|оно}, {Р1:ся|ась}, {МН:пришёл|пришли}, {ДОПЫ.дат}, {ПОВОД}, {ВОЗРАСТ}")).toEqual([]);
    expect(checkTags("{ГЕРОЙ.зв}")).toHaveLength(1);
    expect(checkTags("{ДОП4.им}")).toHaveLength(1);
    expect(checkTags("{ГЕРОЙ.им")).not.toEqual([]);
    expect(checkTags("[Имя]")).toHaveLength(1);
  });
  it("ссылки на доп. героев и имя в конце строки", () => {
    expect(maxExtraRef("{ДОП2.им} улыбнул{Р3:ся|ась}")).toBe(3);
    expect(maxExtraRef("{ДОПЫ.им}")).toBe(1);
    expect(nameAtLineEnd("Шёл по лесу {ГЕРОЙ.им}.\n{ГЕРОЙ.им} шёл по лесу")).toEqual(["Шёл по лесу {ГЕРОЙ.им}."]);
  });
});

describe("склонение и подстановка (новые случаи)", () => {
  it("клички с беглой гласной", () => {
    expect(declineName("Пушок", "род", "boy")).toBe("Пушка");
    expect(declineName("Пушок", "тв", "boy")).toBe("Пушком");
    expect(declineName("Уголёк", "дат", "boy")).toBe("Угольку");
    expect(declineName("Барсик", "род", "boy")).toBe("Барсика");
    expect(declineName("Мурка", "тв", "girl")).toBe("Муркой");
  });
  it("род взрослых: female/male", () => {
    expect(declineName("Любовь", "род", "female")).toBe("Любови");
    expect(applyGender("{Р:пришёл|пришла}", "female")).toBe("пришла");
    expect(applyGender("{Р:пришёл|пришла}", "male")).toBe("пришёл");
  });
  it("средний род и старый формат", () => {
    expect(applyGender("{Р:он|она|оно}", "n")).toBe("оно");
    expect(applyGender("{Р:он|она}", "n")).toBe("он");
    expect(applyGender("нашёл{Р:|а}", "girl")).toBe("нашёла"); // старое поведение сохраняется (validateContent ловит такие формы)
  });
  it("fillTags: доп. герои, список, число, повод, возраст", () => {
    const ctx = {
      hero: { name: "Маша", nickname: "Машенька", gender: "girl" },
      extras: [
        { name: "Пётр", gender: "boy" },
        { name: "Анна", gender: "girl" },
      ],
      occasion: "день рождения",
      age: 5,
    };
    expect(fillTags("{ДОП2.им} улыбнул{Р2:ся|ась}, а {ДОП1.им} засмеял{Р1:ся|ась}.", ctx)).toBe("Анна улыбнулась, а Пётр засмеялся.");
    expect(fillTags("Подарок от {ДОПЫ.род}: {МН:он сам|они сами} выбирали.", ctx)).toBe("Подарок от Петра и Анны: они сами выбирали.");
    expect(fillTags("{ЛАСКОВО.дат} — {ВОЗРАСТ}! Сегодня {ПОВОД}.", ctx)).toBe("Машеньке — 5 лет! Сегодня день рождения.");
    expect(fillTags("Рядом {ДОП3.им} и {ГЕРОЙ.им}.", { hero: { name: "Ян", gender: "boy" } })).toBe("Рядом и Ян.");
  });
  it("ageLabel и guessGender", () => {
    expect([1, 3, 5, 11, 21, 22, 25, 101].map(ageLabel)).toEqual(["1 год", "3 года", "5 лет", "11 лет", "21 год", "22 года", "25 лет", "101 год"]);
    expect(guessGender("Анна")).toBe("girl");
    expect(guessGender("Илья")).toBe("boy");
    expect(guessGender("Дуб")).toBe("boy");
  });
});

describe("демо-рендер", () => {
  it("каждый сюжет рисуется без NaN и undefined", () => {
    for (const p of PLOTS) {
      for (const i of [0, 1, 12]) {
        const svg = renderDemoSpread({
          plot: p,
          spreadIndex: i,
          artStyle: p.artStyles[0],
          mood: null,
          hero: { hair: "рыжие", gender: "girl", glasses: true },
          extras: [{ role: "pet", look: { species: "cat" } }, { role: "custom", look: { thing: "робот" } }],
          watermark: true,
        });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
        expect(svg).not.toMatch(/NaN|undefined/);
      }
    }
  });
  it("все виды героев и настроение", () => {
    const plot = PLOTS[0];
    for (const kind of ["child", "teen", "adult", "pet"] as const) {
      const svg = renderDemoCover({ plot: { ...plot, heroKind: kind }, hero: { species: "dog", beard: true }, title: "Тест", artStyle: "ink-humor" });
      expect(svg).toMatch(/Тест/);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
    const mood = { id: "test", title: "т", oneLine: "т", promptAdd: "", negativeAdd: "", demo: { tint: "#ffcc88", saturation: 1.2, brightness: 1.05, extraDeco: "sparkles" as const } };
    const svg = renderDemoSpread({ plot, spreadIndex: 2, mood, hero: {} });
    expect(svg).toMatch(/filter="url\(#mood-test\)"/);
  });
});

describe("анкета v2", () => {
  it("принимает старые ответы", () => {
    const a = AnswersV2.parse({ hero: { name: "Марк", gender: "boy", ageGroup: "4-5" }, style: "kind-classic", extras: [{ role: "mom", name: "Оля" }] });
    expect(a.audience).toBe("CHILD");
    expect(a.artStyle).toBe("kind-classic");
    expect(a.extras[0].role).toBe("mom");
    expect(a.contact.phone).toBe("");
  });
  it("новые аудитории и свой вариант доп. героя", () => {
    const a = AnswersV2.parse({
      audience: "PET",
      hero: { name: "Пушок", gender: "male" },
      pet: { species: "cat", furColor: "рыжий" },
      extras: [{ role: "owner", name: "Аня" }, { role: "custom", name: "Дуб", what: "дерево" }],
      mood: "warm",
    });
    expect(a.hero.gender).toBe("boy");
    expect(a.extras[1].what).toBe("дерево");
  });
  it("контакт: телефон обязателен, почта для кода", () => {
    expect(normalizePhone("8 (912) 345-67-89")).toBe("+79123456789");
    expect(ContactV2.safeParse({ phone: "", email: "a@b.ru" }).success).toBe(false);
    expect(ContactV2.parse({ phone: "+7 912 345 67 89", email: "A@B.ru" })).toEqual({ phone: "+79123456789", email: "a@b.ru" });
  });
});

describe("пробные стили по референсам владельца", () => {
  const plot = { slug: "ref", theme: "forest", heroKind: "child" as const };
  it("новые эффекты демо есть только у своих стилей и рисуются без NaN", async () => {
    const { TRIAL_ART_STYLES } = await import("@/content/art/trial");
    const fresh = /id="(pencil|bleed|palewash|twotone|warm|bd-jitter|bd-golden|bd-amber|bd-gouache|fx-sun|fx-floor|fx-halo)"/;
    for (const st of TRIAL_ART_STYLES) {
      for (const kind of ["child", "teen", "adult", "pet"] as const) {
        const svg = renderDemoSpread({ plot: { ...plot, heroKind: kind }, spreadIndex: 1, artStyle: st.id, hero: { species: "dog" }, extras: [{ role: "pet", look: { species: "cat" } }] });
        expect(svg).not.toMatch(/NaN|undefined/);
        const usesNew = ["pencil", "golden", "sparse", "backlight", "gouache", "mist", "journal"].includes(st.demo.backdrop ?? "") || ["pencil", "bleed", "palewash", "twotone", "warm"].includes(st.demo.filter ?? "") || (st.demo.overlays ?? []).includes("halo");
        if (!usesNew) expect(svg).not.toMatch(fresh);
      }
    }
  });
  it("негативы закрывают провалы референсов", async () => {
    const { artStyle } = await import("@/content/art/index");
    expect(artStyle("cel-70s")!.negative).toMatch(/bulging eyes/);
    expect(artStyle("cel-70s")!.negative).toMatch(/gaping mouth/);
    expect(artStyle("desert-stars")!.negative).toMatch(/green coat.*long scarf|long scarf/);
    expect(artStyle("desert-stars")!.negative).toMatch(/costume of a known character/);
    expect(artStyle("golden-animation")!.negative).toMatch(/villain/);
    expect(artStyle("field-journal")!.negative).toMatch(/insignia/);
    expect(artStyle("mystery-toon")!.negative).toMatch(/pine tree cap/);
    for (const id of ["cel-70s", "desert-stars", "fable-ink", "mystery-toon", "xerox-pencil"]) expect(artStyle(id)!.prompt).toMatch(/natural|own everyday clothing/);
  });
});
