// Регрессия по отчётам 31.10.2026 без БД: печать в 300 dpi (3), обезличивание (4а), доп. герои в стихах и питомцах (7),
// промпты и вставки по сцене (8), чек 54-ФЗ (9), SEO: robots, FAQ, факты, Markdown (12).
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";

describe("3. печать: 300 dpi на обрезной формат + вылеты, TrimBox/BleedBox", () => {
  const svg = (w: number, h: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#3a7"/><circle cx="${w / 3}" cy="${h / 2}" r="${h / 4}" fill="#fc0"/></svg>`);
  const png = async (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#58a" } }).png().toBuffer();
  const book = async (spread: { data: Buffer; contentType: string; source?: { data: Buffer; contentType: string } }) => ({
    title: "Тест",
    dedication: "",
    heroName: "Маша",
    cover: spread,
    spreads: Array.from({ length: 2 }, () => ({ text: "Текст", image: spread })),
  });

  it("SVG (демо) растрируется сразу в нужном размере: страница 216 мм = 2552 px, разворот делится на половины", async () => {
    const { preparePrint, mmToPx } = await import("@/lib/pdf");
    const s = svg(2048, 1024);
    const b = await book({ data: await sharp(s).jpeg().toBuffer(), contentType: "image/jpeg", source: { data: s, contentType: "image/svg+xml" } });
    const r = await preparePrint(b, { kind: "print", wMm: 210, hMm: 210 });
    expect(mmToPx(216)).toBe(2552);
    for (const half of r.data.spreads[0].halves!) {
      const m = await sharp(half.data).metadata();
      expect([m.width, m.height]).toEqual([2552, 2552]);
      expect(m.density).toBe(300);
    }
    expect(r.lowDpi).toEqual([]);
    // Обложка твёрдая 210×210: передняя часть с загибом 17 мм — (210 + 17) × (210 + 34) мм
    const c = await preparePrint(b, { kind: "cover", wMm: 210, hMm: 210, hard: true, pages: 26 });
    const cm = await sharp(c.data.cover.data).metadata();
    expect([cm.width, cm.height]).toEqual([mmToPx(227), mmToPx(244)]);
  });

  it("растр GPU меньше печатного — масштабируется до 300 dpi и попадает в предупреждение (< 250 dpi)", async () => {
    const { preparePrint } = await import("@/lib/pdf");
    const small = await png(2048, 1024); // старый размер: ~120 dpi на 21 см
    const r = await preparePrint(await book({ data: small, contentType: "image/png", source: { data: small, contentType: "image/png" } }), { kind: "print", wMm: 210, hMm: 210 });
    expect(r.lowDpi.length).toBe(2);
    expect(r.lowDpi[0].dpi).toBeGreaterThanOrEqual(115);
    expect(r.lowDpi[0].dpi).toBeLessThan(130);
    const big = await png(5102, 2551); // печатный размер с сервера иллюстраций
    const ok = await preparePrint(await book({ data: big, contentType: "image/png", source: { data: big, contentType: "image/png" } }), { kind: "print", wMm: 210, hMm: 210 });
    expect(ok.lowDpi).toEqual([]);
  });

  it("TrimBox — обрезной формат, BleedBox/MediaBox — с вылетами (точно, без округления Chromium)", async () => {
    const { setBoxes } = await import("@/lib/pdf");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage([611, 611]);
    const out = await PDFDocument.load(await setBoxes(Buffer.from(await doc.save()), 210, 210, 3));
    const p = out.getPage(0);
    const pt = 72 / 25.4;
    expect(p.getTrimBox().x).toBeCloseTo(3 * pt, 3);
    expect(p.getTrimBox().width).toBeCloseTo(210 * pt, 3);
    expect(p.getBleedBox().width).toBeCloseTo(216 * pt, 3);
    expect(p.getMediaBox().height).toBeCloseTo(216 * pt, 3);
  });

  // Настоящий PDF через Chromium: эффективное разрешение встроенных картинок (pdfimages -list) ≥ 300 dpi
  const canMeasure = Boolean(process.env.CHROMIUM_PATH) && (() => { try { execFileSync("pdfimages", ["-v"], { stdio: "ignore" }); return true; } catch { return false; } })();
  it.skipIf(!canMeasure)("Chromium: блок и обложка — картинки не меньше 300 dpi, TrimBox есть", async () => {
    const { renderPdf } = await import("@/lib/pdf");
    const s = svg(1024, 512);
    const b = await book({ data: await sharp(s).jpeg().toBuffer(), contentType: "image/jpeg", source: { data: s, contentType: "image/svg+xml" } });
    const dir = mkdtempSync(join(tmpdir(), "bk-dpi-"));
    for (const [name, k] of [["block", { kind: "print", wMm: 210, hMm: 210 }], ["cover", { kind: "cover", wMm: 210, hMm: 210, hard: true, pages: 26 }]] as const) {
      const f = join(dir, `${name}.pdf`);
      writeFileSync(f, await renderPdf(b, k));
      const rows = execFileSync("pdfimages", ["-list", f]).toString().split("\n").slice(2).filter(Boolean);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const c = r.trim().split(/\s+/);
        expect(Number(c[12])).toBeGreaterThanOrEqual(299);
        expect(Number(c[13])).toBeGreaterThanOrEqual(299);
      }
      expect(execFileSync("pdfinfo", ["-box", f]).toString()).toMatch(/TrimBox/);
    }
    expect(existsSync(dir)).toBe(true);
  }, 120_000);
});

describe("4а. обезличивание: все свободные поля брифа и новые формы имён", () => {
  it("порода и окрас питомца, свой повод — через redact (имена → метки, контакты прочь)", async () => {
    const { brief } = await import("@/lib/gen/text");
    const { AnswersV2 } = await import("@/lib/quiz");
    const { plotBySlug } = await import("@/content/registry");
    const a = AnswersV2.parse({
      audience: "PET",
      hero: { name: "Мурка", gender: "girl" },
      pet: { species: "cat", breed: "британка, как у Наташи, звоните +7 912 345-67-89", furColor: "серая, кличку дала Машка, tg mashka2018" },
      extras: [{ role: "owner", name: "Наталья" }, { role: "owner", name: "Мария" }],
      occasion: { key: "svoj", custom: "день рождения Натальи, пишите natasha@почта.рф" },
      story: { slug: "bolshaya-progulka" },
    });
    const t = brief(a, plotBySlug("bolshaya-progulka"), null);
    for (const leak of ["Наташ", "Натал", "Машк", "Мари", "912", "mashka2018", "почта.рф", "natasha"]) expect(t).not.toContain(leak);
    expect(t).toMatch(/порода: британка/);
    expect(t).toMatch(/\{ДОП1\.(им|род)\}/);
  });

  it("-ка/-ька/-юха, притяжательные, части двойного имени, кириллические почты и домены, ники без @", async () => {
    const { personsOf, redactForText, stripContacts } = await import("@/lib/gen/redact");
    const P = personsOf({ hero: { name: "Маша", gender: "girl" }, extras: [{ name: "Илья", role: "sibling" }, { name: "Пётр", role: "friend" }, { name: "Наталья", role: "mom" }] });
    const r = redactForText("Илюха защищает Машку, Петька смеётся, Ильюха тоже. Машин бантик, Натальин пирог, Илюшин ранец.", P);
    for (const n of ["Илюх", "Машк", "Петьк", "Ильюх", "Машин", "Натальин", "Илюшин"]) expect(r).not.toContain(n);
    expect(r).toContain("{ГЕРОЙ.род} бантик");
    // Обычные слова не трогаем
    expect(redactForText("любит танки, машинки и полку с книгами", P)).toBe("любит танки, машинки и полку с книгами");
    const D = personsOf({ hero: { name: "Анна-Мария", gender: "girl" }, extras: [] });
    expect(redactForText("Аня и Маша, Анечка, Мария", D)).not.toMatch(/Аня|Маша|Анечка|Мария/);
    const c = stripContacts("почта маша@почта.рф и masha.ivanova@mail.ru, сайт маша-иванова.рф, vk.com/masha2018, tg mashka2018, инста masha_kot, вк: masha_v, ник kot_masha07");
    for (const leak of ["@", "почта.рф", "маша-иванова", "vk.com", "mashka2018", "masha_kot", "masha_v", "kot_masha07"]) expect(c).not.toContain(leak);
  });
});

describe("7. доп. герои: в стихах и питомцах называются все", () => {
  const run = async (slug: string, raw: object) => {
    const { DemoTextProvider, personalize } = await import("@/lib/gen/text");
    const { AnswersV2 } = await import("@/lib/quiz");
    const { plotBySlug } = await import("@/content/registry");
    const a = AnswersV2.parse({ story: { slug }, ...raw });
    return personalize((await new DemoTextProvider().write(a, plotBySlug(slug), 0)).raw, a).spreads.map((s) => s.text).join("\n");
  };
  it("«Две планеты» — партнёр, «Царь Несмеян» — внуки, «Носочный клад» — хозяева названы", async () => {
    expect(await run("dve-planety", { audience: "ADULT", hero: { name: "Ольга", gender: "girl", age: 35 }, extras: [{ role: "partner", name: "Игорь" }] })).toContain("Игорь");
    const tsar = await run("skazka-pro-carya-nesmeyana", { audience: "ADULT", hero: { name: "Галина", gender: "girl", age: 66 }, extras: [{ role: "grandchild", name: "Лиза" }, { role: "grandchild", name: "Тимур" }] });
    expect(tsar).toContain("Лиза");
    expect(tsar).toContain("Тимур");
    const sock = await run("nosochnyj-klad", { audience: "PET", hero: { name: "Бублик", gender: "boy" }, pet: { species: "dog" }, extras: [{ role: "owner", name: "Вера" }, { role: "owner", name: "Олег" }] });
    expect(sock).toContain("Вера");
    expect(sock).toContain("Олег");
  });
  it("2-й и 3-й доп. герой не пропадают в сюжетах питомцев и «Тайне ночного музея»", async () => {
    const pet = await run("bolshaya-progulka", { audience: "PET", hero: { name: "Бублик", gender: "boy" }, pet: { species: "dog" }, extras: [{ role: "owner", name: "Вера" }, { role: "owner", name: "Олег" }, { role: "child", name: "Соня" }] });
    for (const n of ["Вера", "Олег", "Соня"]) expect(pet).toContain(n);
    const museum = await run("tajna-nochnogo-muzeya", { audience: "TEEN", hero: { name: "Илья", gender: "boy", age: 14 }, extras: [{ role: "friend", name: "Ева" }, { role: "sibling", name: "Сева" }] });
    for (const n of ["Ева", "Сева"]) expect(museum).toContain(n);
  });
  it("стихи без доп. героев в тексте — строка-обращение вне метра; validateContent строгий — зелёный", async () => {
    const { extrasAddressLine } = await import("@/lib/gen/text");
    const { isStandaloneLine } = await import("@/content/tags");
    const line = extrasAddressLine(3, new Set([1]))!;
    expect(line).toBe("— {ДОП2.им} и {ДОП3.им}!");
    expect(isStandaloneLine(line)).toBe(true);
    const verse = await run("utro-kuvyrkom", { audience: "CHILD", hero: { name: "Тёма", gender: "boy", ageGroup: "4-5" }, extras: [{ role: "mom", name: "Оля" }] });
    expect(verse).toMatch(/^— Оля!$/m);
    const { validateContent } = await import("@/content/registry");
    expect(validateContent({ strict: true }).errors).toEqual([]);
  });
  it("2-й и 3-й учитель названы: «Волшебный шкафчик», «Наш первый класс», «Музей нашего класса»", async () => {
    const { plotBySlug } = await import("@/content/registry");
    for (const slug of ["volshebnyj-shkafchik", "nash-pervyj-klass", "muzej-nashego-klassa"]) {
      const t = plotBySlug(slug)!.spreads.map((s) => s.text).join("\n");
      expect(t, slug).toContain("{ВОСПИТАТЕЛЬ2.им}");
    }
    expect(plotBySlug("volshebnyj-shkafchik")!.spreads.map((s) => s.text).join("")).toContain("{ВОСПИТАТЕЛЬ3.им}");
    expect(plotBySlug("muzej-nashego-klassa")!.spreads.map((s) => s.text).join("")).toContain("{ВОСПИТАТЕЛЬ3.им}");
  });
});

describe("8. промпты и вставки по сцене", () => {
  it("настроения не задают время суток: «весёлое» не запрещает ночь, нет полудня и луны", async () => {
    const { MOODS } = await import("@/content/moods");
    for (const m of MOODS) {
      expect(m.promptAdd, m.id).not.toMatch(/midday|noon|moonlight|golden-hour|sunset|morning|daylight|twilight/i);
      expect(m.negativeAdd, m.id).not.toMatch(/\bnight\b|\bnoon\b/i);
      if (m.promptAdd) expect(m.promptAdd).toMatch(/keep the scene's own time of day/);
    }
  });
  it("без фото: в промпте нет «exact face from the reference photo», грамматика «who is drawn»", async () => {
    const { scenePrompt } = await import("@/lib/gen/image");
    const { artStyle } = await import("@/content/registry");
    const base = { index: 1, scene: "the hero on an orbital station", age: 6, gender: "girl", preview: false, title: "Т", mood: null };
    for (const [kind, style] of [["child", "watercolor-air"], ["pet", "pet-watercolor"], ["adult", "naive-watercolor"], ["teen", "teen-comic"]] as const) {
      if (!artStyle(style)) continue;
      const p = scenePrompt({ ...base, plot: { slug: "x", theme: "meadow", heroKind: kind }, style, heroes: [{ role: "main", description: "", photos: [], sheet: null }] } as never);
      expect(p.prompt, style).not.toMatch(/reference photo/i);
    }
    const other = scenePrompt({ ...base, plot: { slug: "x", theme: "meadow", heroKind: "adult" }, style: "watercolor-air", heroes: [{ role: "main", description: "", photos: [], sheet: null }] } as never);
    expect(other.prompt).not.toMatch(/who drawn/);
  });
  it("вставки: без «ждал у порога»; в колыбельной-цепочке и стихах — без фраз про увлечения", async () => {
    const { extraLines, DemoTextProvider } = await import("@/lib/gen/text");
    const { AnswersV2 } = await import("@/lib/quiz");
    const { plotBySlug } = await import("@/content/registry");
    for (let v = 0; v < 6; v++) for (const [, t] of extraLines([{ role: "mom", name: "Наталья" }, { role: "dad", name: "Ян" }, { role: "toy", name: "Мишка" }], v)) expect(t).not.toMatch(/порог|пош[её]л|пошла/);
    const a = AnswersV2.parse({ audience: "CHILD", hero: { name: "Тёма", gender: "boy", ageGroup: "4-5" }, interests: ["спорт"], story: { slug: "imya-i-morkovka-upryamica" } });
    const t = (await new DemoTextProvider().write(a, plotBySlug("imya-i-morkovka-upryamica"), 0)).raw.spreads.map((s) => s.text).join(" ");
    expect(t).not.toMatch(/быстрее всех/);
  });
});

describe("9. чек 54-ФЗ для ЮKassa", () => {
  it("позиции со скидкой и доставкой, сумма = сумме заказа, НДС и СНО из настроек, ФФД 1.2", async () => {
    const { buildReceipt54, settlementReceipt54 } = await import("@/lib/receipt54");
    const order = { publicCode: "BK-1", whoPrints: "bookimi", subtotalRub: 3480, discountRub: 348, pdfCreditRub: 0, shippingRub: 290, totalRub: 3422, contactEmail: "a@b.ru", contactPhone: "+7 (900) 123-45-67" };
    const r = buildReceipt54(order, [{ kind: "format", title: "Изготовление книги «Т» на заказ: 21×21", priceRub: 2990, qty: 1 }, { kind: "addon", title: "Изготовление на заказ: Постер", priceRub: 490, qty: 1 }], { vatCode: 1, taxSystemCode: 2, ffd12: true });
    expect(r.customer).toEqual({ email: "a@b.ru", phone: "79001234567" });
    expect(r.tax_system_code).toBe(2);
    const sum = r.items.reduce((s, i) => s + Number(i.amount.value) * Number(i.quantity), 0);
    expect(Math.round(sum * 100)).toBe(342200);
    expect(r.items.every((i) => i.vat_code === 1 && i.measure === "piece" && i.payment_mode === "full_prepayment" && i.payment_subject === "service")).toBe(true);
    expect(r.items.at(-1)!.description).toMatch(/Доставка/);
    const pdf = buildReceipt54({ ...order, whoPrints: "self", shippingRub: 0, totalRub: 990, subtotalRub: 990, discountRub: 0 }, [{ kind: "format", title: "PDF", priceRub: 990, qty: 1 }], { vatCode: 11, taxSystemCode: 0, ffd12: false });
    expect(pdf.items[0]).toMatchObject({ payment_mode: "full_payment", vat_code: 11 });
    expect(pdf.tax_system_code).toBeUndefined();
    expect(pdf.items[0].measure).toBeUndefined();
    const s = settlementReceipt54("pay-1", r, 3422);
    expect(s).toMatchObject({ type: "payment", payment_id: "pay-1", send: true, settlements: [{ type: "prepayment", amount: { value: "3422.00" } }] });
    expect(s.items.every((i) => i.payment_mode === "full_payment")).toBe(true);
    expect(() => buildReceipt54({ ...order, contactEmail: null, contactPhone: null }, [], { vatCode: 1, taxSystemCode: 2, ffd12: true })).toThrow(/email или телефон/);
  });
});

describe("12. SEO", () => {
  it("robots.txt: Clean-param из отчёта, без Host", async () => {
    const { robotsTxt } = await import("@/lib/seo");
    const t = robotsTxt("bookimi.ru");
    expect(t).toContain("Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&ref&yclid&ysclid&gclid&_openstat&from");
    expect(t).toContain("Clean-param: dlya&segment&povod /skazki");
    expect(t).toContain("Sitemap: https://bookimi.ru/sitemap.xml");
    expect(t).not.toMatch(/^Host:/m);
  });
  it("факты: срок к Новому году один (из настроек), Почта России — только если включена; прямые ответы в FAQ", async () => {
    const { fillFacts, faqItems } = await import("@/lib/seo");
    const f = { nyDeadline: "17 декабря", delivery: [{ title: "СДЭК", days: "2–7 дней" }], pdfRub: 990, printFromRub: 2490 };
    expect(fillFacts("закажите печать до 20 декабря: изготовление", f)).toBe("закажите печать до 17 декабря: изготовление");
    expect(fillFacts("Доставка: {DELIVERY}. К празднику — до {NY_DEADLINE}", f)).toBe("Доставка: СДЭК 2–7 дней. К празднику — до 17 декабря");
    const faq = faqItems(f);
    const all = JSON.stringify(faq);
    expect(all).not.toContain("Почта России");
    expect(all).not.toContain("20 декабря");
    for (const q of ["Что такое БУКИМИ?", "Сколько стоит книга?", "До какого числа заказать книгу к Новому году?", "Можно ли сделать книгу для бабушки или для собаки?"]) expect(faq.map((x) => x.q)).toContain(q);
    expect(faq.find((x) => x.q.startsWith("До какого"))!.a).toContain("до 17 декабря");
  });
  it("Markdown: текст и списки после «##» не теряются (блог и документы)", async () => {
    const { renderMarkdown } = await import("@/lib/markdown");
    const html = renderToStaticMarkup(renderMarkdown("Вступление.\n\n## Раздел\nТекст сразу после заголовка.\n- пункт 1\n- пункт 2\nПосле списка.\n\n### Подраздел\n1. раз\n2. два") as never);
    expect(html).toBe("<p>Вступление.</p><h2>Раздел</h2><p>Текст сразу после заголовка.</p><ul><li>пункт 1</li><li>пункт 2</li></ul><p>После списка.</p><h3>Подраздел</h3><ol><li>раз</li><li>два</li></ol>");
    expect(renderToStaticMarkup(renderMarkdown("<script>alert(1)</script>") as never)).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
  it("Метрика: нет на личных страницах; поля маскируются", async () => {
    const { metrikaAllowed, hideContentPath } = await import("@/lib/metrika");
    for (const p of ["/admin", "/kabinet/zakazy", "/kniga/1", "/zakaz/1", "/chek/1", "/mult/abc", "/vhod", "/otpiska"]) expect(metrikaAllowed(p), p).toBe(false);
    for (const p of ["/", "/skazki/x", "/povod/yubilej", "/sozdat"]) expect(metrikaAllowed(p), p).toBe(true);
    expect(metrikaAllowed("/", "admin.bookimi.ru")).toBe(false);
    expect(hideContentPath("/sozdat")).toBe(true);
  });
  it("разметка FAQPage — только на главной; иконки и манифест на месте", async () => {
    const { readFileSync, existsSync: ex } = await import("node:fs");
    const pages = ["src/app/povod/[slug]/page.tsx", "src/app/dlya/[audience]/page.tsx", "src/app/skazki/[slug]/page.tsx"];
    for (const p of pages) expect(readFileSync(p, "utf8"), p).not.toMatch(/<Faq[^>]*jsonLd/);
    expect(readFileSync("src/app/page.tsx", "utf8")).toMatch(/<Faq[^>]*jsonLd/);
    for (const f of ["src/app/icon.svg", "src/app/apple-icon.png", "src/app/manifest.ts", "public/icon-192.png", "public/icon-512.png"]) expect(ex(f), f).toBe(true);
  });
});
