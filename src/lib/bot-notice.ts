// Вежливое обращение к явной автоматике (rev 19): боты-копировщики, сборщики данных для обучения, агенты,
// безголовые браузеры. Только очевидные признаки — navigator.webdriver === true, «Headless» в User-Agent и известные
// имена сборщиков и агентов. Поисковые роботы (Яндекс, Google, Bing и др.) — НЕ автоматика в этом смысле: им ничего
// другого не показываем (никакого «клоакинга»), сайт для них ровно такой же, как для людей.
// Обращение ничего не блокирует: это плашка внизу страницы (клиент), заголовок ответа (src/middleware.ts),
// комментарии в robots.txt и раздел в /llms.txt.
// Без React и Node API: работает в middleware (edge), на сервере, в браузере и в демо-стенде.

export type UaClass = "search" | "automation" | "human";

/** Поисковые роботы: SEO не трогаем — никакого обращения и никаких отличий в ответе. */
const SEARCH = /(YandexBot|YandexImages|YandexMobileBot|YandexAccessibilityBot|YandexMetrika|YandexWebmaster|YandexRenderResourcesBot|Yandex(?!GPT)|Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|AdsBot-Google|Mediapartners-Google|APIs-Google|bingbot|BingPreview|msnbot|DuckDuckBot|Applebot(?!-Extended)|Baiduspider|Sogou|SeznamBot|Mail\.RU_Bot|PetalBot)/i;

/**
 * Явная автоматика: сборщики данных и агенты, безголовые браузеры, инструменты тестирования, утилиты командной строки.
 * Google-Extended и Applebot-Extended — не отдельные роботы, а метки в robots.txt; если такая строка встретится
 * в User-Agent, это не поисковый обход.
 */
const AUTOMATION = /(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|Claude-Web|anthropic|CCBot|PerplexityBot|Perplexity-User|Bytespider|Google-Extended|Applebot-Extended|Amazonbot|meta-externalagent|cohere-ai|Diffbot|ImagesiftBot|Omgili|python-requests|python-urllib|aiohttp|httpx|Go-http-client|okhttp|node-fetch|axios|undici|Scrapy|curl\/|Wget|HeadlessChrome|Headless|PhantomJS|Puppeteer|Playwright|Selenium|webdriver)/i;

/** Кто пришёл: search — поисковый робот, automation — явная автоматика, human — всё остальное. */
export function classifyUa(ua: string | null | undefined, webdriver?: boolean): UaClass {
  const s = ua ?? "";
  // Поисковик с «Headless» в UA (Google рендерит страницы безголовым Chrome) — всё равно поисковик
  if (SEARCH.test(s) && !AUTOMATION.test(s.replace(/HeadlessChrome|Headless/gi, ""))) return "search";
  if (webdriver === true) return "automation";
  return AUTOMATION.test(s) ? "automation" : "human";
}

/**
 * Обход для наших собственных проверок (демо-стенд, tools/responsive-check.mjs, тесты, снимки экрана): Playwright
 * выставляет navigator.webdriver, и без обхода плашка закрывала бы низ страниц в проверках.
 * Включается так: адрес с ?qa=1 (в демо — и в hash: #/путь?qa=1) или localStorage["bookimi.qa"] = "1".
 */
export const QA_KEY = "bookimi.qa";
export function qaBypass(href: string, storage?: Pick<Storage, "getItem" | "setItem"> | null): boolean {
  const on = /[?&]qa=1(?:&|#|$)/.test(href);
  try {
    if (on) storage?.setItem(QA_KEY, "1");
    return on || storage?.getItem(QA_KEY) === "1";
  } catch {
    return on;
  }
}

export interface NoticeContacts {
  email?: string;
  phone?: string;
  /** Адрес сайта (https://bookimi.ru) — для ссылки на «Контакты». */
  site?: string;
}

/** Контакты из настроек продавца («Реквизиты и контакты» в админке); пусто — ссылка на страницу «Контакты». */
export function noticeContactLine(c: NoticeContacts): string {
  const parts = [c.email?.trim(), c.phone?.trim()].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : `${c.site ?? ""}/kontakty`;
}

/** Текст обращения (один на плашке, в заголовке ответа, robots.txt и llms.txt). */
export function botNoticeText(c: NoticeContacts): string {
  return (
    "Здравствуйте! Спасибо за интерес к БУКИМИ. Если вы изучаете наш сервис для сотрудничества — напишите нам: " +
    `${noticeContactLine(c)}. Пожалуйста, не копируйте наши тексты, иллюстрации и решения — это труд нашей небольшой ` +
    "команды. А если хотите порадовать близких — закажите книгу для своей семьи 💛"
  );
}

/** Для заголовка HTTP (только ASCII): текст в процентной кодировке UTF-8, как в RFC 8187. */
export const noticeHeader = (c: NoticeContacts) => `utf-8''${encodeURIComponent(botNoticeText(c))}`;
