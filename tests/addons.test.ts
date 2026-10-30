// Допы по аудиториям: наборы по умолчанию, фильтр в расчёте суммы, проверка формы админки, календарь 2027,
// размеры файлов для типографии (вылеты 3 мм) и обоев. Без БД; PDF через Chromium — только если задан CHROMIUM_PATH.
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { ADDONS } from "@/lib/catalog-defaults";
import { addonFits, addonsForAudience, audienceOfParams, parseAudiences, validateAddonForm, type AddonForm } from "@/lib/addons-core";
import { quote, type CatalogAddon, type CatalogFormat } from "@/lib/pricing";
import { calendarMonth, calendarYear, dayKind, holidayLine, isoWeekday, MONTHS_RU, transferLine, WEEKDAYS_RU } from "@/lib/calendar";
import { ADDON_FILES, BLEED_MM, addonHtml, printAddonKinds, setPrintBoxes, wallpaperPng, type AddonArt } from "@/lib/addon-files";

const keysFor = (aud: string) => addonsForAudience(ADDONS.filter((a) => a.active).map((a) => ({ ...a, audiences: [...a.audiences] as string[] })), aud).map((a) => a.key);

describe("наборы допов по аудиториям", () => {
  it("дети — прежние: ростомер, наклейки, раскраска, постер, упаковка с картой, аудио, «Читаю сам», мультфильм, своим голосом", () => {
    const k = keysFor("CHILD");
    for (const x of ["height-chart", "stickers", "coloring", "poster", "gift-box", "audiobook", "audio-self", "cartoon", "cartoon-own-voice"]) expect(k).toContain(x);
    for (const x of ["teen-poster", "wallpapers", "premium-box", "adult-calendar", "pet-passport"]) expect(k).not.toContain(x);
  });
  it("подростки — без ростомера, малышовой раскраски и карты приключений", () => {
    const k = keysFor("TEEN");
    expect(k).toEqual(expect.arrayContaining(["teen-poster", "teen-stickers", "wallpapers", "teen-bookmarks", "notebook", "cartoon", "audiobook"]));
    for (const x of ["height-chart", "coloring", "gift-box", "stickers", "poster", "audio-self"]) expect(k).not.toContain(x);
  });
  it("взрослые — коробка премиум, открытки, календарь, принт, закладка, мультфильм, своим голосом, аудиокнига", () => {
    const k = keysFor("ADULT");
    expect(k).toEqual(expect.arrayContaining(["premium-box", "postcards", "adult-calendar", "adult-print", "bookmark", "cartoon", "cartoon-own-voice", "audiobook"]));
    expect(k).not.toContain("framed-print"); // другой подрядчик — выключен по умолчанию
    expect(k).not.toContain("height-chart");
  });
  it("питомцы — постер, календарь, открытки с наклейками, паспорт, мультфильм; магнит выключен", () => {
    const k = keysFor("PET");
    expect(k).toEqual(expect.arrayContaining(["pet-poster", "pet-calendar", "pet-postcards", "pet-passport", "cartoon"]));
    for (const x of ["pet-magnet", "audiobook", "coloring", "height-chart", "cartoon-own-voice"]) expect(k).not.toContain(x);
  });
  it("другой подрядчик — только физические и выключены по умолчанию; цены по умолчанию из ТЗ", () => {
    for (const a of ADDONS.filter((x) => x.supplier === "other")) {
      expect(a.kind).toBe("PHYSICAL");
      expect(a.active).toBe(false);
    }
    const price = Object.fromEntries(ADDONS.map((a) => [a.key, a.price]));
    expect(price).toMatchObject({ "teen-stickers": 390, wallpapers: 290, "teen-bookmarks": 290, notebook: 690, "teen-poster": 590, "premium-box": 690, postcards: 490, "adult-calendar": 990, bookmark: 190, "pet-poster": 590, "pet-calendar": 990, "pet-postcards": 390, "pet-passport": 290 });
    // Физические — только с печатью (существующее правило)
    for (const a of ADDONS.filter((x) => x.kind === "PHYSICAL")) expect(a.print).toBe(true);
  });
  it("у каждого печатного допа нашей типографии — файл, кроме ростомера и упаковки (шаблоны типографии)", () => {
    for (const a of ADDONS.filter((x) => x.kind === "PHYSICAL" && x.supplier === "print" && !["height-chart", "gift-box"].includes(x.key))) {
      expect(ADDON_FILES[a.key]?.length, a.key).toBeGreaterThan(0);
    }
  });
  it("пустой список — для всех, аудитория книги по анкете (старые — детские)", () => {
    expect(addonFits({ audiences: [] }, "PET")).toBe(true);
    expect(addonFits({ audiences: ["TEEN"] }, "PET")).toBe(false);
    expect(addonFits({ audiences: ["TEEN"] }, undefined)).toBe(true);
    expect(audienceOfParams({ audience: "PET" })).toBe("PET");
    expect(audienceOfParams({})).toBe("CHILD");
    expect(audienceOfParams({ audience: "ALIEN" })).toBe("CHILD");
  });
});

const formats: CatalogFormat[] = [
  { key: "pdf", kind: "PDF", title: "PDF", priceRub: 990 },
  { key: "std-hard", kind: "PRINT", title: "Стандарт", priceRub: 3990 },
];
const catalog: CatalogAddon[] = ADDONS.map((a) => ({ key: a.key, kind: a.kind, title: a.title, priceRub: a.price, percentOff: a.pct, requiresPrint: a.print, audiences: [...a.audiences] }));

describe("расчёт суммы: только допы аудитории книги", () => {
  it("подростку ростомер не продаётся, постер в стиле книги — да", () => {
    const bad = quote({ whoPrints: "bookimi", formatKey: "std-hard", addons: ["height-chart"], audience: "TEEN" }, formats, catalog);
    expect(bad.errors[0]).toMatch(/не для этой книги/);
    const ok = quote({ whoPrints: "bookimi", formatKey: "std-hard", addons: ["teen-poster", "teen-stickers"], audience: "TEEN" }, formats, catalog);
    expect(ok.errors).toEqual([]);
    expect(ok.totalRub).toBe(3990 + 590 + 390);
  });
  it("питомцу — календарь и паспорт; аудиокнига — нет", () => {
    expect(quote({ whoPrints: "bookimi", formatKey: "std-hard", addons: ["pet-calendar", "pet-passport"], audience: "PET" }, formats, catalog).totalRub).toBe(3990 + 990 + 290);
    expect(quote({ whoPrints: "self", addons: ["audiobook"], audience: "PET" }, formats, catalog).errors[0]).toMatch(/не для этой книги/);
  });
  it("физический доп взрослого без печати — по-прежнему ошибка; обои подростка — к PDF можно", () => {
    expect(quote({ whoPrints: "self", addons: ["adult-calendar"], audience: "ADULT" }, formats, catalog).errors[0]).toMatch(/только для печатной книги/);
    expect(quote({ whoPrints: "self", addons: ["wallpapers"], audience: "TEEN" }, formats, catalog).totalRub).toBe(990 + 290);
  });
  it("докупка из кабинета: цифровой доп второй раз не продаётся", () => {
    const q = quote({ whoPrints: "self", addons: ["wallpapers"], addonsOnly: true, audience: "TEEN", paidAddons: ["wallpapers"] }, formats, catalog);
    expect(q.errors[0]).toMatch(/уже куплен/);
    expect(quote({ whoPrints: "self", addons: ["wallpapers"], addonsOnly: true, audience: "TEEN", paidAddons: [] }, formats, catalog).totalRub).toBe(290);
  });
  it("«своим голосом» у взрослых — к мультфильму", () => {
    expect(quote({ whoPrints: "self", addons: ["cartoon", "cartoon-own-voice"], audience: "ADULT" }, formats, catalog).errors).toEqual([]);
    expect(quote({ whoPrints: "self", addons: ["cartoon", "cartoon-own-voice"], audience: "TEEN" }, formats, catalog).errors[0]).toMatch(/не для этой книги/);
  });
});

describe("админка: проверка допа", () => {
  const form = (o: Partial<AddonForm> = {}): AddonForm => ({ title: "Постер А3", description: "Коротко", priceRub: 590, percentOff: null, audiences: ["TEEN"], supplier: "print", isActive: true, ...o });
  const row = { key: "teen-poster", kind: "PHYSICAL" };
  it("галочки: все четыре = для всех, ни одной — ошибка, неизвестная — ошибка", () => {
    expect(parseAudiences(["CHILD", "TEEN", "ADULT", "PET"])).toEqual({ ok: true, value: [] });
    expect(parseAudiences(["PET", "TEEN"])).toEqual({ ok: true, value: ["TEEN", "PET"] });
    expect(parseAudiences([]).ok).toBe(false);
    expect(parseAudiences(["KIDS"]).ok).toBe(false);
  });
  it("цена, скидка, название, описание, изготовитель", () => {
    expect(validateAddonForm(form(), row).ok).toBe(true);
    expect(validateAddonForm(form({ priceRub: -1 }), row)).toMatchObject({ ok: false, error: expect.stringMatching(/Цена/) });
    expect(validateAddonForm(form({ priceRub: 10.5 }), row).ok).toBe(false);
    expect(validateAddonForm(form({ percentOff: 95 }), row).ok).toBe(false);
    expect(validateAddonForm(form({ title: "  " }), row).ok).toBe(false);
    expect(validateAddonForm(form({ description: "x".repeat(241) }), row).ok).toBe(false);
    expect(validateAddonForm(form({ supplier: "china" }), row).ok).toBe(false);
    expect(validateAddonForm(form({ supplier: "other" }), { key: "wallpapers", kind: "DIGITAL" }).ok).toBe(false);
    expect(validateAddonForm(form({ audiences: [] }), row).ok).toBe(false);
  });
  it("«своим голосом» не шире мультфильма — в обе стороны", () => {
    const own = { key: "cartoon-own-voice", kind: "MODIFIER" };
    expect(validateAddonForm(form({ audiences: ["CHILD", "PET"] }), own, { cartoon: ["CHILD", "ADULT"] })).toMatchObject({ ok: false, error: expect.stringMatching(/Питомцы/) });
    expect(validateAddonForm(form({ audiences: ["CHILD"] }), own, { cartoon: [] }).ok).toBe(true);
    const cartoon = { key: "cartoon", kind: "DIGITAL" };
    expect(validateAddonForm(form({ audiences: ["CHILD"] }), cartoon, { ownVoice: ["CHILD", "ADULT"] })).toMatchObject({ ok: false, error: expect.stringMatching(/Взрослые/) });
    expect(validateAddonForm(form({ audiences: ["CHILD", "ADULT", "TEEN"] }), cartoon, { ownVoice: ["CHILD", "ADULT"] }).ok).toBe(true);
  });
});

describe("календарь 2027", () => {
  it("1 января 2027 — пятница, неделя с понедельника, русские месяцы", () => {
    expect(isoWeekday(2027, 1, 1)).toBe(5);
    expect(WEEKDAYS_RU[0]).toBe("Пн");
    const jan = calendarMonth(2027, 1);
    expect(jan.title).toBe("Январь");
    expect(jan.weeks[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(jan.weeks[0][4]?.day).toBe(1);
    expect(jan.weeks.every((w) => w.length === 7)).toBe(true);
    const year = calendarYear(2027);
    expect(year.map((m) => m.title)).toEqual(MONTHS_RU);
    expect(year.map((m) => m.weeks.flat().filter(Boolean).length).reduce((x, y) => x + y)).toBe(365);
    // Каждая ячейка стоит в колонке своего дня недели
    for (const m of year) for (const w of m.weeks) w.forEach((d, i) => d && expect(d.weekday).toBe(i + 1));
  });
  it("праздники РФ отмечены, переносы 2027 — по постановлению", () => {
    const hol = ["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"];
    for (const md of hol) expect(dayKind(2027, Number(md.slice(0, 2)), Number(md.slice(3))).kind, md).toBe("holiday");
    expect(dayKind(2027, 1, 7).title).toBe("Рождество Христово");
    for (const md of ["02-22", "05-03", "05-10", "06-14", "11-05", "12-31"]) expect(dayKind(2027, Number(md.slice(0, 2)), Number(md.slice(3))).kind, md).toBe("dayoff");
    expect(dayKind(2027, 2, 20).kind).toBe("workday"); // рабочая суббота
    expect(dayKind(2027, 1, 9).kind).toBe("weekend");
    expect(dayKind(2027, 1, 11).kind).toBe("work");
    expect(holidayLine(calendarMonth(2027, 1))).toBe("1–6, 8 — Новогодние каникулы; 7 — Рождество Христово");
    expect(transferLine(2027, calendarMonth(2027, 2))).toBe("22 — выходной (перенос); 20 — рабочий день");
    // Всего праздничных дней — 14 (ст. 112 ТК)
    expect(calendarYear(2027).flatMap((m) => m.weeks.flat()).filter((d) => d?.kind === "holiday").length).toBe(14);
  });
});

// Тестовые картинки: обложка 400×400, развороты 800×400
async function img(w: number, h: number, color: string) {
  return { data: await sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer(), contentType: "image/jpeg" };
}
async function art(audience: AddonArt["audience"] = "ADULT"): Promise<AddonArt> {
  const spreads = [];
  for (let i = 0; i < 12; i++) spreads.push({ text: `Разворот ${i + 1}. Герой идёт дальше!`, image: await img(800, 400, i % 2 ? "#336699" : "#996633") });
  return { title: "Наша история", dedication: "Тебе", heroName: "Анна", audience, heroGender: "girl", cover: await img(400, 400, "#228855"), spreads, orderCode: "BK-T", pet: { species: "cat", breed: "сфинкс", furColor: "серый" } };
}

describe("файлы допов: размеры с вылетами", () => {
  it("каждый PDF: страница = формат + 2 × 3 мм, число страниц как в спецификации", async () => {
    const a = await art();
    for (const [key, specs] of Object.entries(ADDON_FILES)) {
      for (const spec of specs.filter((s) => s.type === "pdf")) {
        const h = addonHtml(key, spec, a);
        expect(h, spec.kind).not.toBeNull();
        expect(spec.bleedMm).toBe(BLEED_MM);
        expect(h!.wMm, spec.kind).toBe(spec.wMm! + 6);
        expect(h!.hMm, spec.kind).toBe(spec.hMm! + 6);
        expect(h!.pages, spec.kind).toBe(spec.pages);
        expect((h!.html.match(/<section class="page"/g) ?? []).length, spec.kind).toBe(spec.pages);
        expect(h!.html).toContain(`@page{size:${spec.wMm! + 6}mm ${spec.hMm! + 6}mm`);
      }
    }
    expect(ADDON_FILES["teen-poster"][0]).toMatchObject({ wMm: 297, hMm: 420 });
    expect(ADDON_FILES["adult-calendar"][0]).toMatchObject({ wMm: 210, hMm: 297, pages: 13 });
    expect(ADDON_FILES.postcards[0]).toMatchObject({ wMm: 150, hMm: 100, pages: 12 });
    expect(printAddonKinds(["pet-postcards", "wallpapers", "audiobook"])).toEqual(["print-addon-pet-postcards", "print-addon-pet-postcards-stickers"]);
  });
  it("календарь: 13 страниц, праздники в сетке, «паспорт питомца» — кличка и порода", async () => {
    const a = await art("PET");
    const cal = addonHtml("pet-calendar", ADDON_FILES["pet-calendar"][0], a)!;
    expect(cal.html).toContain(">Январь<");
    expect(cal.html).toContain(">Декабрь<");
    expect(cal.html).toMatch(/data-day="1" data-kind="holiday"/);
    expect(cal.html).toMatch(/data-day="20" data-kind="workday"/);
    expect(cal.html).toContain("1–6, 8 — Новогодние каникулы");
    const pass = addonHtml("pet-passport", ADDON_FILES["pet-passport"][0], a)!;
    expect(pass.html).toContain("ПАСПОРТ ПИТОМЦА");
    expect(pass.html).toContain("сфинкс");
    expect(pass.html).toContain(">кошка<"); // героиня — кошка
  });
  it("TrimBox/BleedBox: обрез ровно по формату, вылет 3 мм", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 300]);
    const fixed = await PDFDocument.load(await setPrintBoxes(Buffer.from(await doc.save()), ADDON_FILES.postcards[0]));
    const p = fixed.getPage(0);
    const mm = (pt: number) => Math.round((pt * 25.4) / 72 * 100) / 100;
    expect([mm(p.getMediaBox().width), mm(p.getMediaBox().height)]).toEqual([156, 106]);
    const t = p.getTrimBox();
    expect([mm(t.x), mm(t.y), mm(t.width), mm(t.height)]).toEqual([3, 3, 150, 100]);
    expect(mm(p.getBleedBox().width)).toBe(156);
  });
  it("обои: PNG 1170×2532 и 2560×1440", async () => {
    const a = await art("TEEN");
    for (const spec of ADDON_FILES.wallpapers) {
      const png = await wallpaperPng(a, spec.px![0], spec.px![1]);
      const m = await sharp(png).metadata();
      expect([m.format, m.width, m.height]).toEqual(["png", ...spec.px!]);
    }
  });
  it.skipIf(!process.env.CHROMIUM_PATH)("Chromium: календарь и постер — настоящий PDF нужного размера", async () => {
    const { renderAddon } = await import("@/lib/addon-files");
    const a = await art("ADULT");
    for (const key of ["adult-calendar", "adult-print"]) {
      const [f] = await renderAddon(key, a);
      const doc = await PDFDocument.load(f.data);
      expect(doc.getPageCount()).toBe(f.spec.pages);
      const p = doc.getPage(0);
      expect(Math.round((p.getMediaBox().width * 25.4) / 72)).toBe(f.spec.wMm! + 6);
      expect(Math.round((p.getTrimBox().height * 25.4) / 72)).toBe(f.spec.hMm!);
    }
  }, 120_000);
});
