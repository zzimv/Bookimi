// Один источник фактов для текстов сайта, FAQ, llms.txt и разметки: срок заказа к Новому году и службы доставки
// берутся из настроек («Праздники», «Сезон», «Доставка»), а не пишутся в тексты руками (отчёт SEO 31.10, К-2).
import { cfg } from "./settings";
import { FAQ, MIN_PRINT_PRICE, PDF_PRICE } from "./catalog-defaults";

export interface SiteFacts {
  /** «17 декабря» — последний день заказа печатной книги к Новому году; null — сезон прошёл/не считается. */
  nyDeadline: string | null;
  /** Включённые службы доставки со сроками: «СДЭК — 2–7 дней». */
  delivery: { title: string; days: string }[];
  pdfRub: number;
  printFromRub: number;
}

const RU_MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${RU_MONTHS_GEN[m - 1]}`;
};

/** Последний день заказа к Новому году: ручная дата из «Сезона» или расчёт по «Праздникам» (печать + доставка). */
export async function newYearDeadline(now = new Date()): Promise<string | null> {
  const season = await cfg("season").catch(() => null);
  if (season?.printDeadline) return dayMonth(season.printDeadline);
  const { getHolidays, getLeadTimes } = await import("./holidays");
  const { computeHoliday, isoOf } = await import("./holidays-core");
  const [items, lead] = await Promise.all([getHolidays(), getLeadTimes()]);
  const ny = items.find((h) => h.occasionKey === "novyj-god");
  if (!ny) return null;
  const c = computeHoliday(ny, now, lead);
  return c.deadline != null ? dayMonth(isoOf(c.deadline)) : null;
}

export async function siteFacts(now = new Date()): Promise<SiteFacts> {
  const s = await cfg("shipping");
  const days = (k: string, d: [number, number]) => `${(s.fallbackDays[k] ?? d)[0]}–${(s.fallbackDays[k] ?? d)[1]} дней`;
  const delivery = [
    ...(s.cdekPvz || s.cdekCourier ? [{ title: "СДЭК", days: days("cdek_pvz", [2, 7]) }] : []),
    ...(s.pochta ? [{ title: "Почта России", days: days("pochta", [7, 14]) }] : []),
    ...(s.yandex ? [{ title: "Яндекс Доставка", days: days("yandex", [1, 4]) }] : []),
  ];
  return { nyDeadline: await newYearDeadline(now), delivery, pdfRub: PDF_PRICE, printFromRub: MIN_PRINT_PRICE };
}

export const deliveryText = (f: SiteFacts) => (f.delivery.length ? f.delivery.map((d) => `${d.title} ${d.days}`).join(", ") : "СДЭК");

/**
 * Подстановка фактов в текст: {NY_DEADLINE}, {DELIVERY}; старые тексты из БД с датой «до 20 декабря» и «Почта России»
 * (если выключена) приводятся к фактам.
 */
export function fillFacts(text: string, f: SiteFacts): string {
  let out = text
    .replace(/\{NY_DEADLINE\}/g, f.nyDeadline ?? "середины декабря")
    .replace(/\{DELIVERY\}/g, deliveryText(f));
  if (f.nyDeadline) out = out.replace(/до \d{1,2} декабря/g, `до ${f.nyDeadline}`);
  if (!f.delivery.some((d) => d.title === "Почта России")) out = out.replace(/,?\s*Почта России[^,.;]*/g, "");
  return out;
}

/**
 * FAQ сайта: сначала прямые ответы (для Алисы и помощников — вопрос как его задают), затем общие.
 * Разметка FAQPage — только на главной (src/app/page.tsx), на остальных страницах — без неё.
 */
export function faqItems(f: SiteFacts): { q: string; a: string }[] {
  const direct = [
    {
      q: "Что такое БУКИМИ?",
      a: `БУКИМИ — сервис персональных книг: по фото и анкете мы создаём книгу, где главный герой — ваш ребёнок, подросток, близкий взрослый или питомец. Превью бесплатно, PDF — ${f.pdfRub.toLocaleString("ru-RU")} ₽, печатная книга — от ${f.printFromRub.toLocaleString("ru-RU")} ₽.`,
    },
    {
      q: "До какого числа заказать книгу к Новому году?",
      a: f.nyDeadline
        ? `Печатную книгу к Новому году — до ${f.nyDeadline}: изготовление 3–5 рабочих дней и доставка (${deliveryText(f)}). PDF можно купить в любой день — он готов в течение часа.`
        : `Печатную книгу — примерно за две недели до праздника: изготовление 3–5 рабочих дней и доставка (${deliveryText(f)}). PDF готов в течение часа после оплаты.`,
    },
    {
      q: "Можно ли сделать книгу для бабушки или для собаки?",
      a: "Да. Кроме детских книг есть книги для подростков, для взрослых (бабушке, маме, паре, коллеге) и книги о питомце — кошке, собаке или другом любимце. Герой рисуется по фото или по описанию.",
    },
  ];
  const general = FAQ.map((x) => ({ q: x.q, a: fillFacts(x.a, f) }));
  return [...direct, ...general.filter((x) => !direct.some((d) => d.q.slice(0, 12) === x.q.slice(0, 12)))];
}

/** robots.txt — текстом: Clean-param для меток и фильтров каталога; без устаревшего Host. */
/** Длинный текст — строками комментария robots.txt по ~100 знаков. */
function wrapComment(text: string, width = 100): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if (line && line.length + w.length + 1 > width) {
      out.push(`# ${line}`);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(`# ${line}`);
  return out;
}

export function robotsTxt(domain = process.env.DOMAIN ?? "bookimi.ru", notice?: string) {
  return [
    // rev 19: обращение к сборщикам и агентам — комментарием (одинаково для всех, поисковики комментарии не читают)
    ...(notice ? [...wrapComment(notice), "#"] : []),
    "User-agent: *",
    "Allow: /",
    ...["/api/", "/admin", "/kabinet", "/kniga/", "/zakaz/", "/sozdat", "/vhod", "/chek/", "/otpiska", "/mult/"].map((p) => `Disallow: ${p}`),
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&ref&yclid&ysclid&gclid&_openstat&from",
    "Clean-param: dlya&segment&povod /skazki",
    `Sitemap: https://${domain}/sitemap.xml`,
    "",
  ].join("\n");
}
