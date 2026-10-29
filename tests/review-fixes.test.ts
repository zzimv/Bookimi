// Регрессия по замечаниям ревью: название с [Имя] и падеж, «об Ане» / «со Львом», обезличивание свободного
// текста для ИИ, промокод против скидки новичка, повод в тексте, детские табу, имена в стихах, CSRF «Origin: null».
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { caseAfter, titleForCatalog, titleTemplate } from "@/content/title";
import { declineName, fillTags, CASES } from "@/lib/declension";
import { occasionText, occasionWord } from "@/content/occasions";
import { applyOccasion, PLOTS, plotBySlug, textStyle } from "@/content/registry";
import { countNameTags, isStandaloneLine, nameInMetricLine, unevenGenderForms } from "@/content/tags";
import { AnswersV2 } from "@/content/answers";
import { brief, DemoTextProvider, ideaForModel, personalize, textStyleFor } from "@/lib/gen/text";
import { personsOf, redactForImage, redactForText, stripContacts } from "@/lib/gen/redact";
import { scenePrompt } from "@/lib/gen/image";
import { appearanceLine } from "@/lib/quiz";
import { pickDiscount, type CatalogAddon, type CatalogFormat } from "@/lib/pricing";
import { ipSubnet } from "@/lib/limits";
import { middleware, originHost } from "@/middleware";
import { dedicationsFor } from "@/lib/dedications";

const NAMES: [string, "boy" | "girl"][] = [
  ["Аня", "girl"], ["Илья", "boy"], ["Игорь", "boy"], ["Юля", "girl"], ["Яна", "girl"],
  ["Лев", "boy"], ["Всеволод", "boy"], ["Стас", "boy"], ["Саша", "boy"], ["Марк", "boy"], ["Любовь", "girl"],
];

describe("1. название с [Имя]: падеж по предлогу — один помощник", () => {
  it("падеж по предлогу", () => {
    expect(caseAfter("о")).toBe("пр");
    expect(caseAfter("для")).toBe("род");
    expect(caseAfter("к")).toBe("дат");
    expect(caseAfter("с")).toBe("тв");
    expect(caseAfter(undefined)).toBe("им");
  });
  it("шаблон для текста, брифа и обложки анкеты", () => {
    expect(titleTemplate("Былина о [Имя] и трёх подвигах")).toBe("Былина о {ГЕРОЙ.пр} и трёх подвигах");
    expect(titleTemplate("[Имя] и Месяц ясный")).toBe("{ГЕРОЙ.им} и Месяц ясный");
    expect(titleTemplate("Подарок для [Имя]")).toBe("Подарок для {ГЕРОЙ.род}");
    expect(titleTemplate("Вместе с [Имя]")).toBe("Вместе с {ГЕРОЙ.тв}");
  });
  it("каталог без имени", () => {
    expect(titleForCatalog("Былина о [Имя] и трёх подвигах", "TEEN")).toBe("Былина о вашем герое и трёх подвигах");
    expect(titleForCatalog("[Имя] и Месяц ясный", "CHILD")).toBe("Ваш ребёнок и Месяц ясный");
    expect(titleForCatalog("Подарок для [Имя]", "PET")).toBe("Подарок для вашего питомца");
    expect(titleForCatalog("День, когда ты {Р:появился|появилась} у нас", "PET")).toBe("День, когда ты появился у нас");
  });
  it("книга: «Былина об Ане…», «…о Юле…», «…о Льве…»", async () => {
    const plot = PLOTS.find((p) => p.title.includes("о [Имя]"))!;
    expect(plot).toBeTruthy();
    const want: Record<string, string> = { Аня: "об Ане", Илья: "об Илье", Игорь: "об Игоре", Юля: "о Юле", Лев: "о Льве" };
    for (const [name, g] of NAMES.filter(([n]) => want[n])) {
      const a = AnswersV2.parse({ audience: plot.audience, hero: { name, gender: g, age: 14 }, story: { slug: plot.slug } });
      const r = await new DemoTextProvider().write(a, plot, 0);
      const t = personalize(r.raw, a).title;
      expect(t).toContain(want[name]);
      expect(t).not.toMatch(/\[Имя\]|[{}]/);
      expect(brief(a, plot, textStyleFor(a, plot))).toContain(`«${titleTemplate(plot.title)}»`);
    }
  });
});

describe("2. предлоги перед именем: о/об, с/со, к/ко", () => {
  const ob: Record<string, string> = { Аня: "об Ане", Илья: "об Илье", Игорь: "об Игоре", Юля: "о Юле", Яна: "о Яне", Лев: "о Льве", Всеволод: "о Всеволоде", Стас: "о Стасе", Саша: "о Саше" };
  const so: Record<string, string> = { Аня: "с Аней", Илья: "с Ильёй", Игорь: "с Игорем", Юля: "с Юлей", Яна: "с Яной", Лев: "со Львом", Всеволод: "со Всеволодом", Стас: "со Стасом", Саша: "с Сашей" };
  for (const [name, g] of NAMES.filter(([n]) => ob[n])) {
    it(name, () => {
      const ctx = { hero: { name, gender: g } };
      expect(fillTags("Книга о {ГЕРОЙ.пр}.", ctx)).toBe(`Книга ${ob[name]}.`);
      expect(fillTags("Гуляли с {ГЕРОЙ.тв}.", ctx)).toBe(`Гуляли ${so[name]}.`);
      // Регистр предлога сохраняется
      const O = ob[name][0].toUpperCase() + ob[name].slice(1);
      const S = so[name][0].toUpperCase() + so[name].slice(1);
      expect(fillTags("О {ГЕРОЙ.пр} — песня. С {ГЕРОЙ.тв} — весело.", ctx)).toBe(`${O} — песня. ${S} — весело.`);
      // Шаблон с «об» перед согласной/йотированной — исправляется обратно
      expect(fillTags("об {ГЕРОЙ.пр}", ctx)).toBe(ob[name]);
    });
  }
  it("«ко Всеволоду», «к Саше»; обычные слова «о» не трогаем", () => {
    expect(fillTags("Пришли к {ДОП1.дат}.", { hero: { name: "Аня" }, extras: [{ name: "Всеволод", gender: "boy" }] })).toBe("Пришли ко Всеволоду.");
    expect(fillTags("Пришли к {ГЕРОЙ.дат}.", { hero: { name: "Саша", gender: "boy" } })).toBe("Пришли к Саше.");
    expect(fillTags("Сказка о море и о {ДОПЫ.пр}.", { hero: { name: "Аня" }, extras: [{ name: "Игорь" }, { name: "Яна", gender: "girl" }] })).toBe("Сказка о море и об Игоре и Яне.");
  });
});

describe("3. имена не уходят в ИИ: бриф и промпт картинок", () => {
  const extrasNames: [string, string, "boy" | "girl"][] = [["Лев", "friend", "boy"], ["Всеволод", "dad", "boy"], ["Юля", "sibling", "girl"]];
  const allForms = (name: string, g: string) => CASES.map((c) => declineName(name, c, g));
  for (const [name, g] of NAMES) {
    it(`${name}: ни одной падежной формы в брифе и промпте`, async () => {
      const forms = [...allForms(name, g), ...extrasNames.flatMap(([n, , eg]) => allForms(n, eg))];
      const mention = (f: string[]) => f.join(", ");
      const a = AnswersV2.parse({
        audience: "CHILD",
        hero: { name, gender: g, nickname: name === "Аня" ? "Анечка" : "", ageGroup: "6-7" },
        appearance: { custom: `${mention(allForms(name, g))} носит очки; телефон мамы +7 (912) 345-67-89, почта mama@mail.ru` },
        extras: extrasNames.map(([n, role, eg]) => ({ name: n, role, gender: eg, description: `${mention(allForms(n, eg))}, сайт https://vk.com/x` })),
        occasion: { key: "svoj", custom: `день, когда ${declineName(name, "дат", g)} подарили щенка` },
        story: { slug: "", idea: `${name} и ${declineName("Лев", "им", "boy")} строят ракету для ${declineName(name, "род", g)}, звонить 89123456789` },
      });
      const b = brief(a, null, textStyleFor(a, null));
      const idea = ideaForModel(a.story.idea, a);
      for (const f of forms) {
        const re = new RegExp(`(?<![А-Яа-яЁё])${f}(?![А-Яа-яЁё])`);
        expect(b, `бриф: ${f}`).not.toMatch(re);
        expect(idea, `идея: ${f}`).not.toMatch(re);
      }
      expect(b).toMatch(/\{ГЕРОЙ\.(им|род|дат)\}/);
      expect(b).not.toMatch(/912|345-67|mail\.ru|vk\.com|89123456789/);
      // Промпт картинки: роли вместо имён
      const persons = personsOf(a);
      const job = {
        plot: { slug: "x", theme: "meadow", heroKind: "child" as const },
        index: 1,
        scene: "the child in a meadow",
        style: "watercolor-air",
        mood: null,
        heroes: [
          { role: "main", description: redactForImage(appearanceLine(a), persons), photos: [] },
          ...a.extras.map((e) => ({ role: e.role, description: redactForImage(e.description, persons), photos: [] })),
        ],
        age: 6,
        gender: g,
        preview: true,
      };
      const { prompt } = scenePrompt(job);
      for (const f of forms) expect(prompt, `картинка: ${f}`).not.toMatch(new RegExp(`(?<![А-Яа-яЁё])${f}(?![А-Яа-яЁё])`));
      expect(prompt).toContain("the hero");
      expect(prompt).not.toMatch(/912|mail\.ru|vk\.com/);
    });
  }
  it("ласковые формы и домашнее имя → {ЛАСКОВО.*}; обычные слова не трогаем", () => {
    const p = personsOf({ hero: { name: "Аня", nickname: "Анечка", gender: "girl" }, extras: [] });
    expect(redactForText("Анюта, Анечка и Анна любят море", p)).toBe("{ЛАСКОВО.им}, {ЛАСКОВО.им} и {ЛАСКОВО.им} любят море");
    const lyuba = personsOf({ hero: { name: "Любовь", gender: "girl" }, extras: [] });
    expect(redactForText("любовь к морю; Любовь печёт пироги, у Любы кот", lyuba)).toBe("любовь к морю; {ГЕРОЙ.им} печёт пироги, у {ЛАСКОВО.род} кот");
  });
  it("контакты, ссылки, длинные числа", () => {
    expect(stripContacts("звоните +7 912 345-67-89 или 8(912)3456789, пишите a.b@ya.ru, t.me/abc, @nick_name, www.site.ru, код 123456. Нам 5 лет, дом 12")).toBe(
      "звоните или, пишите, код. Нам 5 лет, дом 12",
    );
  });
});

const formats: CatalogFormat[] = [{ key: "pdf", kind: "PDF", title: "PDF", priceRub: 990 }, { key: "std-hard", kind: "PRINT", title: "Книга", priceRub: 3990 }];
const addons: CatalogAddon[] = [];

describe("4. промокод против скидки новичка — по рублям", () => {
  it("фиксированный промокод 300 ₽ выигрывает у −10% новичка на PDF (99 ₽)", () => {
    const r = pickDiscount({ whoPrints: "self", addons: [] }, { percentOff: null, amountOffRub: 300 }, 10, formats, addons);
    expect(r.promoApplied).toBe(true);
    expect(r.newbieApplied).toBe(false);
    expect(r.quote.discountRub).toBe(300);
    expect(r.quote.totalRub).toBe(690);
  });
  it("на дорогой книге −10% новичка (399 ₽) выигрывает у 300 ₽ — промокод не тратится, скидки не суммируются", () => {
    const r = pickDiscount({ whoPrints: "bookimi", formatKey: "std-hard", addons: [] }, { amountOffRub: 300 }, 10, formats, addons);
    expect(r.promoApplied).toBe(false);
    expect(r.newbieApplied).toBe(true);
    expect(r.quote.discountRub).toBe(399);
  });
  it("без новичка — промокод; без промокода — ничего", () => {
    expect(pickDiscount({ whoPrints: "self", addons: [] }, { percentOff: 15 }, 0, formats, addons).promoApplied).toBe(true);
    const none = pickDiscount({ whoPrints: "self", addons: [] }, null, 0, formats, addons);
    expect(none.promoApplied || none.newbieApplied).toBe(false);
    expect(none.quote.discountRub).toBe(0);
  });
});

describe("6. повод в тексте", () => {
  it("короткая форма и падежи", () => {
    expect(occasionText("godovshchina")).toBe("годовщина");
    expect(occasionText("pensiya")).toBe("выход на пенсию");
    expect(occasionText("pereezd")).toBe("новоселье");
    expect(occasionText("novyj-god")).toBe("Новый год");
    expect(occasionText("svoj", "окончание школы")).toBe("окончание школы");
    expect(occasionWord("godovshchina")?.gender).toBe("f");
    const ctx = { hero: { name: "Аня" }, occasion: occasionWord("godovshchina")! };
    expect(fillTags("Готовимся к {ПОВОД.дат}. «{ПОВОД} — отметить». Сегодня {ПОВОД}.\n{ПОВОД}!", ctx)).toBe("Готовимся к годовщине. «Годовщина — отметить». Сегодня годовщина.\nГодовщина!");
  });
  it("рядом с {ПОВОД} нет прилагательных и глаголов прошедшего по роду", () => {
    const texts = PLOTS.flatMap((p) => [...p.spreads.map((s) => s.text), ...Object.values(p.occasionHooks ?? {}).flatMap((h) => (h ? [h.opening, h.closing] : []))]);
    for (const t of texts) {
      expect(t, t).not.toMatch(/\{ПОВОД\} (—\s)?(светел|светла|был|была|таким|такой|славным)/);
      expect(t, t).not.toMatch(/(был|такой|таким) \{ПОВОД\}/);
    }
  });
  it("посвящение «своего повода» работает с существительным", () => {
    const svoj = dedicationsFor("CHILD", "svoj") as unknown as (string | { text: string })[];
    const raw = svoj.map((d) => (typeof d === "string" ? d : d.text));
    expect(raw.some((d) => /о том, как \{ПОВОД\}/.test(d))).toBe(false);
    for (const d of raw) expect(fillTags(d, { hero: { name: "Аня", nickname: "Анечка" }, occasion: "новоселье" })).not.toMatch(/[{}]/);
  });
  it("доп. герои в демо-тексте: «И Облако, и Робот Бип — тоже рядом»", async () => {
    const plot = PLOTS.find((p) => p.audience === "CHILD" && !textStyle(p.textStyle)?.verse && !p.spreads.some((s) => /\{ДОП/.test(s.text)) && p.extras.max >= 2)!;
    const a = AnswersV2.parse({ hero: { name: "Аня", gender: "girl", ageGroup: "4-5" }, story: { slug: plot.slug }, extras: [{ role: "custom", name: "Облако", gender: "n" }, { role: plot.extras.roles.includes("toy") ? "toy" : "custom", name: "Робот Бип" }] });
    const t = personalize((await new DemoTextProvider().write(a, plot, 0)).raw, a);
    expect(t.spreads[10].text).toContain("И Облако, и Робот Бип — тоже рядом.");
  });
});

describe("7. детская безопасность: Месяц ясный", () => {
  const p = plotBySlug("imya-i-mesyac-yasnyj")!;
  it("ребёнок не уходит из дома один ночью; путешествие — во сне, под крылом Совы", () => {
    const all = p.spreads.map((s) => s.text).join("\n");
    expect(all).not.toMatch(/тьма густая|Дверь тихонько открывает|шапку надевает/);
    expect(all).toMatch(/во сне/);
    expect(all).toMatch(/крылом тебя укрою/);
    expect(p.coverScene).toMatch(/safely/);
    for (const s of p.spreads) expect(s.scene).not.toMatch(/alone|dark forest/);
  });
});

describe("8. имена в стихах — только отдельной строкой-обращением", () => {
  it("валидатор ловит имя внутри метра и разные по длине формы рода", () => {
    expect(nameInMetricLine("Там {ГЕРОЙ.им} перед сном\nМесяц ищет за окном.")).toEqual(["Там {ГЕРОЙ.им} перед сном"]);
    expect(nameInMetricLine("— {ГЕРОЙ.им}!\nСпи, {ЛАСКОВО.им}.\n{ПОВОД}!")).toEqual([]);
    expect(nameInMetricLine("Праздник — {ПОВОД} — вот:\nПусть идёт наоборот!")).toEqual(["Праздник — {ПОВОД} — вот:"]);
    expect(isStandaloneLine("— {ГЕРОЙ.им}!")).toBe(true);
    expect(isStandaloneLine("— {ГЕРОЙ.им}! — зовёт сова.")).toBe(false);
    expect(unevenGenderForms("{Р:наш герой|героиня} и {Р:Добрым|Доброй}")).toEqual(["{Р:наш герой|героиня}"]);
  });
  const versePlots = PLOTS.filter((p) => textStyle(p.textStyle)?.verse);
  it("стихотворных сюжетов 6, в каждом не больше 4 меток имени", () => {
    expect(versePlots.map((p) => p.slug).sort()).toEqual(["dve-planety", "dvenadcat-urokov", "imya-i-mesyac-yasnyj", "nosochnyj-klad", "skazka-pro-carya-nesmeyana", "utro-kuvyrkom"]);
    for (const p of versePlots) expect(p.spreads.reduce((n, s) => n + countNameTags(s.text), 0), p.slug).toBeLessThanOrEqual(4);
  });
  const heroes: Record<string, [string, "boy" | "girl"][]> = {
    CHILD: [["Марк", "boy"], ["Аня", "girl"], ["Илья", "boy"], ["Любовь", "girl"], ["Лев", "boy"]],
    ADULT: [["Игорь", "boy"], ["Любовь", "girl"], ["Илья", "boy"], ["Аня", "girl"]],
    PET: [["Пушок", "boy"], ["Мурка", "girl"], ["Лев", "boy"]],
  };
  for (const p of versePlots) {
    it(`${p.slug}: строки с именем — короткие обращения, «наш герой» нет`, async () => {
      for (const [name, g] of heroes[p.audience]) {
        for (const occ of ["bez", "novyj-god", "den-rozhdeniya", "svoj"]) {
          const extras = p.extras.min ? [{ role: p.extras.roles[0], name: "Всеволод" }] : [];
          const a = AnswersV2.parse({ audience: p.audience, hero: { name, gender: g, nickname: name === "Любовь" ? "Люба" : "", age: 30 }, story: { slug: p.slug }, occasion: { key: occ, custom: "окончание музыкальной школы" }, extras });
          const t = personalize((await new DemoTextProvider().write(a, p, 0)).raw, a);
          const nameForms = new Set([name, "Люба", "Всеволод", ...CASES.map((c) => declineName(name, c, g))]);
          for (const s of t.spreads) {
            for (const line of s.text.split("\n")) {
              const words = line.match(/[А-Яа-яЁё]+/g) ?? [];
              if (words.some((w) => nameForms.has(w))) expect(words.length, `${p.slug} ${name} ${occ}: «${line}»`).toBeLessThanOrEqual(2);
              if (/окончание музыкальной школы/i.test(line)) expect(words.length, line).toBeLessThanOrEqual(4);
            }
            if (g === "girl") expect(s.text).not.toMatch(/[Нн]аш герой/);
          }
        }
      }
    });
  }
});

describe("10–11. CSRF «Origin: null», подсеть IP", () => {
  it("originHost не бросает исключение", () => {
    expect(originHost("null")).toBeNull();
    expect(originHost("https://bookimi.ru")).toBe("bookimi.ru");
  });
  it("POST с Origin: null → 403", () => {
    const req = new NextRequest("http://localhost:3000/api/books", { method: "POST", headers: { origin: "null", host: "localhost:3000" } });
    expect(middleware(req).status).toBe(403);
  });
  it("лимит по IP — по /24 (IPv4) и /64 (IPv6)", () => {
    expect(ipSubnet("203.0.113.57")).toBe("203.0.113.0/24");
    expect(ipSubnet("::ffff:203.0.113.9")).toBe("203.0.113.0/24");
    expect(ipSubnet("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
  });
});
