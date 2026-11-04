// GEO: машиночитаемое описание сервиса для Алисы/Яндекс Нейро, ChatGPT, Perplexity.
// Собирается из БД — цены и сроки всегда актуальны.
import { faqItems, siteFacts } from "./seo";
import { getOccasions, getPriceTable, getSoonAudiences, getStories, displayTitle } from "./catalog";
import { occasionIsLive } from "./shelf";
import { bookAgeLabel } from "../content/ages";
import { cfg } from "./settings";
import { db, hasDatabase } from "./db";
import { getHolidayCards } from "./holidays";
import { AUDIENCE_PAGES } from "./storefront";
import { ADDONS } from "./catalog-defaults";
import { addonsForAudience } from "./addons-core";

const addonOut = (a: { key: string; title: string; description: string; priceRub: number | null; percentOff: number | null; kind: string; requiresPrint: boolean }) => ({
  key: a.key,
  title: a.title,
  ...(a.description ? { description: a.description } : {}),
  priceRub: a.priceRub,
  percentOff: a.percentOff,
  type: a.kind === "DIGITAL" ? "digital" : a.kind === "PHYSICAL" ? "printed" : "option",
  withPrintOnly: a.requiresPrint,
});
import { PLOTS } from "../content/registry";

/** Возрастная маркировка по аудитории (как на обложке PDF, src/lib/pdf.ts → bookWording; ASSUMPTIONS п. 41). */
export const AGE_RATING: Record<string, string> = { CHILD: "0+", TEEN: "6+", ADULT: "12+", PET: "0+" };
const AUD_AGES: Record<string, string> = { CHILD: "0-9", TEEN: "11-17", ADULT: "18+", PET: "любой" };

export async function catalogData() {
  const [stories, allOccasions, prices, shipping, limits, holidays, cartoon, bulk, flags, soon] = await Promise.all([
    getStories(),
    getOccasions(),
    getPriceTable(),
    cfg("shipping"),
    cfg("limits"),
    getHolidayCards().catch(() => []),
    cfg("cartoon"),
    cfg("bulk"),
    cfg("flags"),
    getSoonAudiences(),
  ]);
  // Аудитории «скоро»: книги не перечисляем, поводы только для них — тоже (getStories их уже не отдаёт)
  const occasions = allOccasions.filter((o) => occasionIsLive(o.slug, soon));
  const dbAddons = hasDatabase ? await db.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []) : [];
  // Без БД (или пустая таблица) — допы по умолчанию; цены мультфильма — всегда из настроек
  const addons = (
    dbAddons.length
      ? dbAddons.map((a) => ({ key: a.key, title: a.title, description: a.description === a.title ? "" : a.description, priceRub: a.priceRub, percentOff: a.percentOff, audiences: a.audiences, kind: a.kind, requiresPrint: a.requiresPrint }))
      : ADDONS.filter((a) => a.active).map((a) => ({ key: a.key as string, title: a.title as string, description: a.description as string, priceRub: a.price as number | null, percentOff: a.pct as number | null, audiences: [...a.audiences] as string[], kind: a.kind as string, requiresPrint: a.print as boolean }))
  )
    .filter((a) => cartoon.enabled || !a.key.startsWith("cartoon"))
    .filter((a) => flags.printEnabled || !a.requiresPrint)
    .map((a) => (a.key === "cartoon" ? { ...a, priceRub: cartoon.priceRub } : a.key === "cartoon-own-voice" ? { ...a, priceRub: cartoon.ownVoiceRub } : a));
  const ph = hasDatabase ? await db.printHouse.findFirst({ where: { isActive: true } }).catch(() => null) : null;
  const facts = await siteFacts();
  const seller = await cfg("seller").catch(() => null);
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  const plotBy = new Map(PLOTS.map((p) => [p.slug, p]));
  const pdf = prices.find((p) => p.kind === "PDF")?.priceRub;
  const printMin = Math.min(...prices.filter((p) => p.kind !== "PDF").map((p) => p.priceRub));
  return {
    name: "БУКИМИ",
    url: base,
    /** Определение одним предложением — для помощников («Что такое БУКИМИ»). */
    definition: "БУКИМИ — российский сервис, который по фото и анкете создаёт персональную иллюстрированную книгу, где главный герой — ваш ребёнок, близкий человек или питомец.",
    seller: seller?.fullName ? { name: seller.fullName, status: seller.status, inn: seller.inn } : null,
    updatedAt: new Date().toISOString().slice(0, 10),
    description: soon.length ? `Персональные иллюстрированные сказки по фото для детей 2–4, 5–7 и 8–10 лет (книги для подростков, взрослых и о питомцах — скоро).` + " Герой узнаваем на иллюстрациях, его имя — в тексте. Есть книги о группе (детский сад, класс) — «книга для каждого ребёнка»." : "Персональные иллюстрированные книги по фото: для детей, подростков, взрослых и о питомцах. Герой узнаваем на иллюстрациях, его имя — в тексте. Есть книги о группе (детский сад, класс) — «книга для каждого ребёнка», и мультфильм по книге.",
    language: "ru",
    country: "RU",
    /** Маркировка по 436-ФЗ зависит от аудитории книги — см. audiences[].ageRating. */
    ageRating: AGE_RATING,
    audiences: AUDIENCE_PAGES.map((a) => ({
      key: a.key,
      title: a.nav,
      hero: a.hero,
      ages: AUD_AGES[a.key],
      ageRating: AGE_RATING[a.key],
      url: `${base}/dlya/${a.slug}`,
      /** available — продаётся; soon — скоро (книг пока нет, создать нельзя). */
      status: soon.includes(a.key) ? "soon" : "available",
      books: stories.filter((s) => s.audience === a.key).length,
      /** Допы к книгам этой аудитории (у каждой аудитории свой набор). */
      addons: soon.includes(a.key) ? [] : addonsForAudience(addons, a.key).map(addonOut),
    })),
    howItWorks: [
      "Герои: кто главный герой (ребёнок, подросток, взрослый, питомец), имя и фото — после отдельного согласия — или описание словами; можно добавить других героев",
      "Повод и книга из каталога (для детей 0–3, 4–6 и 7–9 лет); для детского сада и класса — список группы",
      "Бесплатно: текст книги за минуту, его можно поправить",
      "Вход по коду на почту и бесплатное превью: обложка и 2 разворота за 2–5 минут",
      "Покупка PDF или печатной книги; по желанию — аудиокнига, раскраска, мультфильм по книге",
    ],
    stories: stories.map((s) => {
      const g = plotBy.get(s.slug)?.group;
      return {
        title: displayTitle(s.title, s.audience),
        url: `${base}/skazki/${s.slug}`,
        audience: s.audience,
        age: `${s.ageMin}-${s.ageMax}`,
        ageLabel: bookAgeLabel(s),
        ageRating: AGE_RATING[s.audience] ?? "0+",
        occasions: s.occasions,
        summary: s.tagline,
        ...(g ? { group: { label: g.label, maxKids: g.max } } : {}),
      };
    }),
    /** Книги о группе: «книга для каждого» — в каждой копии героем свой ребёнок, скидка за количество. */
    groups: { enabled: bulk.enabled, maxKids: Math.max(0, ...PLOTS.map((p) => p.group?.max ?? 0)), discounts: bulk.tiers.map((t) => ({ fromBooks: t.min, percentOff: t.pct })), previewCopies: bulk.previewCopies },
    cartoon: cartoon.enabled
      ? { title: "Мультфильм по книге", priceRub: cartoon.priceRub, ownVoiceRub: cartoon.ownVoiceRub, durationSec: cartoon.targetSec, formats: ["MP4 1080×1080", `MP4 9:16 (${cartoon.verticalHeight === 1920 ? "1080×1920" : "720×1280"})`], voice: "диктор или свой голос" }
      : null,
    occasions: occasions.map((o) => ({ title: o.title, url: `${base}/povod/${o.slug}` })),
    /** Ближайшие праздники (/prazdniki): дата, до какого дня заказать печатную книгу. */
    holidays: holidays.map((h) => ({ title: h.title, date: h.iso, daysLeft: h.daysLeft, printOrder: h.deadlineLine, url: `${base}${h.occasionHref ?? h.catalogHref}` })),
    prices: prices.map((p) => ({ product: p.title, priceRub: p.priceRub, type: p.kind === "PDF" ? "digital" : "printed", pages: 24 })),
    priceSummary: { pdfRub: pdf ?? null, printFromRub: Number.isFinite(printMin) ? printMin : null, preview: 0 },
    /** Все допы; audiences — для каких книг (пусто — для всех). */
    addons: addons.filter((a) => !a.audiences.length || a.audiences.some((x) => !soon.includes(x as never))).map((a) => ({ ...addonOut(a), audiences: a.audiences })),
    production: { printDays: `${ph?.leadDaysMin ?? 3}-${ph?.leadDaysMax ?? 5} рабочих дней`, pdf: "в течение часа после оплаты" },
    // Только включённые службы и их сроки из настроек (src/lib/seo.ts — один источник с FAQ и текстами)
    delivery: { services: facts.delivery.map((d) => d.title), lines: facts.delivery.map((d) => `${d.title} — ${d.days}`), freeFromBooks: shipping.freeShippingBooks },
    newYearOrderBy: facts.nyDeadline,
    faq: faqItems(facts),
    privacy: { photoStorage: "серверы в России", photoDeletedAfterDays: limits.photoTtlDays, photoUse: "только для иллюстраций, без идентификации личности" },
    returns: "Персонализированная книга надлежащего качества не возвращается; при браке — бесплатная перепечатка или возврат денег.",
    payment: ["СБП по QR-коду", "перевод по реквизитам"],
  };
}
