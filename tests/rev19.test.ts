// rev 19: «сказочные» страницы книги, мягкая защита от копирования, вежливое обращение к автоматике,
// «Другая обложка» за 100 ₽, правила правок после оплаты.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { botNoticeText, classifyUa, noticeHeader, qaBypass } from "@/lib/bot-notice";
import { robotsTxt } from "@/lib/seo";
import { quote, type CatalogFormat } from "@/lib/pricing";
import { editLocked, PAID_LOCKED } from "@/lib/book-edit";
import { fairyText, finalLines, welcomeLines, welcomeText, finalText, fairyPalette } from "@/lib/book-layout";
import { wmCode } from "@/lib/protect";
import { bookHtml } from "@/lib/pdf";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("классификатор User-Agent: обращение только к явной автоматике", () => {
  const SEARCH = [
    "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)",
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    // Google рендерит страницы безголовым Chrome — всё равно поисковик
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
    "Mozilla/5.0 (compatible; Mail.RU_Bot/2.0; +http://go.mail.ru/help/robots)",
  ];
  const AUTOMATION = [
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Claude-User/1.0 (+https://www.anthropic.com)",
    "anthropic-ai",
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
    "Google-Extended",
    "python-requests/2.32.3",
    "curl/8.5.0",
    "Wget/1.21.4",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1",
    "Mozilla/5.0 Puppeteer",
    "Mozilla/5.0 Playwright/1.49",
  ];
  const HUMAN = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 YaBrowser/24.12.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  ];
  it("поисковые роботы — search (никакого обращения, SEO не трогаем)", () => {
    for (const ua of SEARCH) expect(classifyUa(ua), ua).toBe("search");
    // Поисковик не становится «автоматикой» даже с webdriver
    expect(classifyUa(SEARCH[0], true)).toBe("search");
  });
  it("сборщики данных, агенты, безголовые браузеры, curl — automation", () => {
    for (const ua of AUTOMATION) expect(classifyUa(ua), ua).toBe("automation");
  });
  it("люди — human; navigator.webdriver === true — automation", () => {
    for (const ua of HUMAN) expect(classifyUa(ua), ua).toBe("human");
    expect(classifyUa(HUMAN[0], true)).toBe("automation");
    expect(classifyUa("", false)).toBe("human");
    expect(classifyUa(null)).toBe("human");
  });
  it("обход для наших проверок: ?qa=1 (и в hash демо) или localStorage bookimi.qa", () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(qaBypass("https://bookimi.ru/skazki", s)).toBe(false);
    expect(qaBypass("file:///demo.html#/kniga/1?qa=1", s)).toBe(true);
    expect(store.get("bookimi.qa")).toBe("1");
    expect(qaBypass("https://bookimi.ru/", s)).toBe(true);
    expect(qaBypass("https://bookimi.ru/?qa=10", null)).toBe(false);
    expect(read("tools/responsive-check.mjs")).toContain('localStorage.setItem("bookimi.qa", "1")');
  });
  it("текст обращения: контакты из настроек; пусто — ссылка на «Контакты»; заголовок — только ASCII", () => {
    const t = botNoticeText({ email: "hello@bookimi.ru", phone: "+7 900 000-00-00", site: "https://bookimi.ru" });
    expect(t).toMatch(/^Здравствуйте! Спасибо за интерес к БУКИМИ\./);
    expect(t).toContain("напишите нам: hello@bookimi.ru, +7 900 000-00-00.");
    expect(t).toContain("закажите книгу для своей семьи");
    expect(botNoticeText({ site: "https://bookimi.ru" })).toContain("напишите нам: https://bookimi.ru/kontakty.");
    expect(noticeHeader({ site: "https://bookimi.ru" })).toMatch(/^utf-8''[\x21-\x7e]+$/);
  });
  it("robots.txt: обращение комментарием в начале, правила и Sitemap на месте; middleware — заголовок только автоматике", () => {
    const r = robotsTxt("bookimi.ru", botNoticeText({ site: "https://bookimi.ru" }));
    const lines = r.split("\n");
    expect(lines[0]).toMatch(/^# Здравствуйте!/);
    const head = lines.slice(0, lines.indexOf("User-agent: *"));
    expect(head.every((l) => l.startsWith("#"))).toBe(true);
    expect(r).toContain("Sitemap: https://bookimi.ru/sitemap.xml");
    expect(robotsTxt("bookimi.ru")).not.toContain("#");
    const mw = read("src/middleware.ts");
    expect(mw).toContain('classifyUa(req.headers.get("user-agent")) === "automation"');
    expect(read("src/app/llms.txt/route.ts")).toContain("## Обращение");
  });
});

describe("«сказочные» страницы книги", () => {
  it("строки: имя крупно, «единственную» — ключевое слово; фраза та же, что раньше", () => {
    const w = welcomeLines("маша");
    expect(w[0]).toEqual([{ k: "name", t: "Маша," }]);
    expect(w.flat().find((x) => x.k === "key")?.t).toBe("единственную");
    expect(fairyText(w)).toBe(welcomeText("маша"));
    expect(fairyText(finalLines("марк", "boy"))).toBe(finalText("марк", "boy"));
    expect(fairyText(finalLines("маша", "girl"))).toContain("главная героиня");
  });
  it("цвета по оформлению обложки — глубокий синий / бордо", () => {
    expect(fairyPalette(0).ink).toBe("#1f3566");
    expect(fairyPalette(2).ink).toBe("#5e1f2e");
  });
  it("PDF: Yeseva One и Lora встроены, страницы в «сказочной» вёрстке", () => {
    const img = { data: Buffer.from("p"), contentType: "image/jpeg" };
    const html = bookHtml({ title: "Т", dedication: "", heroName: "маша", heroGender: "girl", cover: img, spreads: [{ text: "Раз.", image: img }] }, { kind: "screen" }).html;
    expect(html).toContain("font-family:'Yeseva One'");
    expect(html).toContain("font-family:'Lora';font-weight:400;font-style:italic");
    expect(html).toContain('class="orn"');
    expect(html).toContain('<span class="fk-name"');
  });
  it("демо и сайт: шрифты книги — свои файлы, без Google Fonts", () => {
    const b = read("tools/demo/build.mjs");
    expect(b).toContain("yeseva-one-%s-400");
    expect(b).not.toMatch(/fonts\.googleapis/);
    expect(read("src/app/layout.tsx")).toContain('@fontsource/lora/cyrillic-400-italic.css');
  });
});

describe("защита превью", () => {
  it("код в водяном знаке: конец id книги · сеанс · дата", () => {
    expect(wmCode("0f3c2a1b-aaaa-bbbb-cccc-1234567890ab", "K7QX", new Date(2026, 10, 3))).toBe("890AB·K7QX·03.11.26");
  });
  it("CSS: без выделения на страницах книги, печать превью — подсказка, размытие только до оплаты; комментарий про снимки экрана", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain("-webkit-touch-callout: none");
    expect(css).toContain("Печать превью недоступна — оформите книгу");
    expect(css).toContain('.bk-veiled [data-book-preview][data-paid="0"] .bk__book');
    const p = read("src/lib/protect.ts");
    expect(p).toMatch(/снимок экрана запретить нельзя/);
    expect(p).not.toMatch(/addEventListener\("key/);
  });
});

describe("«Другая обложка» — 100 ₽", () => {
  const formats: CatalogFormat[] = [
    { key: "pdf", kind: "PDF", title: "PDF", priceRub: 990 },
    { key: "std-hard", kind: "PRINT", title: "21×21, твёрдая", priceRub: 2990 },
  ];
  const base = { whoPrints: "self" as const, addons: [], coverPriceRub: 100 };
  it("«Классика» бесплатно, «Звёздная ночь» и «Светлая рамка» — строка «Другая обложка»", () => {
    expect(quote({ ...base, coverVariant: 0 }, formats, []).totalRub).toBe(990);
    for (const v of [1, 2]) {
      const q = quote({ ...base, coverVariant: v }, formats, []);
      expect(q.lines[1]).toEqual({ kind: "cover", key: "cover-variant", title: "Другая обложка", priceRub: 100 });
      expect(q.totalRub).toBe(1090);
    }
    const p = quote({ ...base, whoPrints: "bookimi", formatKey: "std-hard", coverVariant: 2 }, formats, []);
    expect(p.subtotalRub).toBe(3090);
  });
  it("цена из настроек; 0 — без строки; докупка допов — без строки; скидка считается и с обложки", () => {
    expect(quote({ ...base, coverVariant: 1, coverPriceRub: 150 }, formats, []).totalRub).toBe(1140);
    expect(quote({ ...base, coverVariant: 1, coverPriceRub: 0 }, formats, []).lines).toHaveLength(1);
    expect(quote({ ...base, coverVariant: 1, addonsOnly: true, addons: [] }, formats, []).lines.some((l) => l.kind === "cover")).toBe(false);
    expect(quote({ ...base, coverVariant: 1, discountPct: 10 }, formats, []).discountRub).toBe(109);
  });
});

describe("правки после оплаты", () => {
  it("оплаченная книга: все правки отклоняются одним понятным текстом; до оплаты — можно", () => {
    for (const a of ["layout", "mood", "redraw", "rewrite", "text", "photo"]) {
      expect(editLocked({ paidFull: true }, a)).toBe(PAID_LOCKED);
      expect(editLocked({ paidFull: false }, a)).toBeNull();
    }
    expect(editLocked({ paidFull: true }, "consent")).toBeNull();
    expect(PAID_LOCKED).toBe("Книга оплачена и передана в работу. Если нужно что-то исправить — напишите в поддержку");
  });
  it("превью после оплаты — без кнопок правок, со ссылкой на поддержку; оформление — «Редактировать книгу»", () => {
    const bp = read("src/components/book/BookPreview.tsx");
    expect(bp).toContain("{p.paid ? (\n        <PaidNote />");
    expect(bp).toContain('href="/kabinet/podderzhka"');
    expect(read("src/components/book/Checkout.tsx")).toContain("Редактировать книгу");
    expect(read("src/components/book/BookFlow.tsx")).toContain("Вернуться к оформлению");
    expect(read("src/app/kabinet/kniga/[id]/BookCabinet.tsx")).not.toContain("Перерисовать</button>");
  });
});
