// rev 13 (03.11.2026): превью = настоящая книга, которую листают и правят на месте; анкета — маленькие сцены,
// внешность героя картинкой. Без БД: вёрстка (book-layout), правки (book-edit), PDF, схема ответов, образцы.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { authorLine, bookPages, bookSpreads, finalText, layoutOf, singlePages, splitSpread, welcomeText } from "@/lib/book-layout";
import { applyLayoutEdit, LayoutEdit } from "@/lib/book-edit";
import { AnswersV2 } from "@/lib/quiz";
import { bookHtml, coverInner } from "@/lib/pdf";
import { personalize } from "@/lib/gen/text";
import { GET as obrazec } from "@/app/obrazec/route";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const base = () => AnswersV2.parse({ audience: "CHILD", hero: { name: "Марк", gender: "boy", ageGroup: "5-7" }, story: { slug: "imya-i-mesyac-yasnyj" } });

describe("текст на картинке: левая и правая страница", () => {
  it("стихи — по строфам, четверостишие — по две строки", () => {
    expect(splitSpread("А\nБ\n\nВ\nГ")).toEqual(["А\nБ", "В\nГ"]);
    expect(splitSpread("Раз-два,\nвот трава.\nТри-четыре,\nлучший в мире!")).toEqual(["Раз-два,\nвот трава.", "Три-четыре,\nлучший в мире!"]);
  });
  it("проза — по предложениям, поровну; внутри «кавычек» и реплик не режем", () => {
    const [l, r] = splitSpread("Нашёл записку: «Праздник спрятан в королевстве. Ищи подсказки!» Кошка Мурка тоже была тут.");
    expect(l).toBe("Нашёл записку: «Праздник спрятан в королевстве. Ищи подсказки!»");
    expect(r).toBe("Кошка Мурка тоже была тут.");
    expect(splitSpread("— Курс — на дно! — скомандовала Маша. Лодка погрузилась.")).toEqual(["— Курс — на дно! — скомандовала Маша.", "Лодка погрузилась."]);
    expect(splitSpread("Одно предложение.")).toEqual(["Одно предложение.", ""]);
    expect(splitSpread("")).toEqual(["", ""]);
  });
  it("разметка комикса сохраняется", () => {
    expect(splitSpread("[Утро.]\nДЗЫНЬ!\nСтрока")).toEqual(["[Утро.]", "ДЗЫНЬ!\nСтрока"]);
  });
});

describe("страницы книги", () => {
  it("обложка → форзац+приветствие → фото+посвящение → 12 разворотов → финал+задняя обложка", () => {
    expect(bookPages(12)).toHaveLength(31);
    const sp = bookSpreads(12);
    expect(sp[0].map((x) => x.kind)).toEqual(["cover"]);
    expect(sp[1].map((x) => x.kind)).toEqual(["endpaper", "welcome"]);
    expect(sp[2].map((x) => x.kind)).toEqual(["photo", "dedication"]);
    expect(sp[3]).toEqual([{ kind: "story", spread: 1, side: "left" }, { kind: "story", spread: 1, side: "right" }]);
    expect(sp.at(-1)!.map((x) => x.kind)).toEqual(["final", "back"]);
    expect(singlePages(12).some((x) => x.kind === "endpaper")).toBe(false);
  });
  it("подписи: имя с заглавной, род героя", () => {
    expect(welcomeText("маша")).toBe("Маша, добро пожаловать в твою единственную такую книгу!");
    expect(finalText("маша", "girl")).toMatch(/^Маша, эта книга — только твоя\..*главная героиня/);
    expect(finalText("марк", "boy")).toContain("главный герой");
    expect(authorLine("  мама  и папа ")).toBe("Автор: мама и папа");
    expect(authorLine("")).toBe("");
  });
});

describe("вёрстка в ответах книги (без миграции БД)", () => {
  it("старые ответы — по умолчанию: обложка 0, без автора и фото", () => {
    const a = base();
    expect(a.layout).toEqual({ coverVariant: 0, author: "" });
    expect(layoutOf(a)).toEqual({ coverVariant: 0, author: "" });
    expect(layoutOf({ layout: { coverVariant: 7, author: "x".repeat(80) } })).toEqual({ coverVariant: 0, author: "x".repeat(60) });
    expect(AnswersV2.safeParse({ ...a, layout: { coverVariant: 3 } }).success).toBe(false);
  });
  it("правка: обложка, автор, посвящение, фото, имя", () => {
    const a = base();
    const id = "11111111-1111-4111-8111-111111111111";
    const r = applyLayoutEdit(a, LayoutEdit.parse({ action: "layout", coverVariant: 2, author: "мама и папа", dedication: "С любовью", photoId: id }));
    expect(r.ok && r.answers.layout).toEqual({ coverVariant: 2, author: "мама и папа", photoId: id });
    expect(r.ok && r.answers.dedication).toBe("С любовью");
    const off = applyLayoutEdit(r.ok ? r.answers : a, LayoutEdit.parse({ action: "layout", photoId: null }));
    expect(off.ok && off.answers.layout.photoId).toBeUndefined();
    const bad = applyLayoutEdit(a, LayoutEdit.parse({ action: "layout", author: "www.spam.ru" }));
    expect(bad.ok).toBe(false);
    expect(LayoutEdit.safeParse({ action: "layout", author: "x".repeat(61) }).success).toBe(false);
    const n = applyLayoutEdit(a, LayoutEdit.parse({ action: "layout", name: "павел" }));
    expect(n.ok && n.nameChanged).toBe(true);
    expect(n.ok && n.answers.hero.name).toBe("Павел");
    expect(applyLayoutEdit(a, LayoutEdit.parse({ action: "layout", name: "" })).ok).toBe(false);
  });
  it("смена имени заново подставляет имя в текст с падежами (personalize)", () => {
    const raw = { title: "{ГЕРОЙ.им} и Месяц", spreads: [{ index: 1, text: "Все ждали {ГЕРОЙ.вин}." }] };
    const n = applyLayoutEdit(base(), LayoutEdit.parse({ action: "layout", name: "Павел" }));
    const t = personalize(raw as never, n.ok ? n.answers : base());
    expect(t.title).toBe("Павел и Месяц");
    expect(t.spreads[0].text).toBe("Все ждали Павла.");
  });
});

describe("PDF в новой вёрстке", () => {
  const img = { data: Buffer.from("x"), contentType: "image/png" };
  const b = { title: "Марк и Месяц", dedication: "", heroName: "марк", heroGender: "boy", audience: "CHILD" as const, cover: img, author: "мама и папа", photo: { data: Buffer.from("p"), contentType: "image/jpeg" }, spreads: [{ text: "Раз. Два.", image: img }], tones: [["light", "dark"]] as ("light" | "dark")[][] };
  it("приветствие, автор, фото, посвящение по умолчанию, текст на картинке слева и справа, финал", () => {
    const html = bookHtml(b, { kind: "screen" }).html;
    expect(html).toContain("Марк, добро пожаловать в твою единственную такую книгу!");
    expect(html).toContain("Автор: мама и папа");
    expect(html).toContain("Создано в");
    expect(html).toContain(`data:image/jpeg;base64,${Buffer.from("p").toString("base64")}`);
    expect(html).toContain("Эта книга создана специально для героя по имени Марк.");
    expect(html).toContain('<div class="text"');
    expect(html).toContain('<div class="text dark"');
    expect(html).toContain('<span class="sp-line">Раз.</span>');
    expect(html).toContain('<span class="sp-line">Два.</span>');
    expect(html).toContain("Марк, эта книга — только твоя.");
    const noAuthor = bookHtml({ ...b, author: "" }, { kind: "screen" }).html;
    expect(noAuthor).not.toContain("Автор:");
  });
  it("3 оформления обложки", () => {
    expect(coverInner({ ...b, coverVariant: 0 }, 210, 210)).toContain("rgba(252,251,247,.88)");
    expect(coverInner({ ...b, coverVariant: 1 }, 210, 210)).toContain("#f3d27a");
    expect(coverInner({ ...b, coverVariant: 2 }, 210, 210)).toContain("mask-image");
    const cov = bookHtml({ ...b, coverVariant: 1 }, { kind: "cover", wMm: 210, hMm: 210, hard: true, pages: 28 }).html;
    expect(cov).toContain("#f3d27a");
  });
});

describe("анкета: герой картинкой", () => {
  it("/obrazec?p=1 — портрет героя без сцены", async () => {
    const r = obrazec(new Request("https://x/obrazec?p=1&k=child&g=girl&a=6&h=рыжие&hs=хвостик&sk=смуглый"));
    const svg = await r.text();
    expect(svg).toContain('viewBox="0 0 360 360"');
    expect(svg).toContain("ch-bg");
  });
  it("сцены анкеты, 6 картинок на пол, «Подробнее», «Загрузить фото», искорки и «Книга готовится…»", () => {
    const src = read("src/components/quiz/QuizWizard.tsx");
    expect(src).toContain("Как зовут нашего героя?");
    expect(src).toContain("Кто отправится в путешествие вместе с ${fill(\"{ГЕРОЙ.тв}\")}?");
    expect(src).toContain("Какой повод мы празднуем?");
    expect(src).toContain("Подробнее: кожа, волосы, глаза, очки");
    expect(src).toContain(">Загрузить фото<");
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toContain("Книга готовится…");
    const presets = src.slice(src.indexOf("const LOOK_PRESETS"), src.indexOf("const SKIN_WORD"));
    expect(presets.match(/\{ skin: "/g)).toHaveLength(12);
  });
  it("превью книги: кнопки правок и переключатель вида", () => {
    const src = read("src/components/book/BookPreview.tsx");
    for (const t of ["Изменить имя", "Сменить обложку", "Добавить фото", "Написать посвящение", "Вписать автора", "Одна страница", "Разворот"]) expect(src).toContain(t);
  });
});
