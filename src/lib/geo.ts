// GEO: машиночитаемое описание сервиса для Алисы/Яндекс Нейро, ChatGPT, Perplexity.
// Собирается из БД — цены и сроки всегда актуальны.
import { getOccasions, getPriceTable, getStories, displayTitle } from "./catalog";
import { cfg } from "./settings";
import { db, hasDatabase } from "./db";

export async function catalogData() {
  const [stories, occasions, prices, shipping, limits] = await Promise.all([getStories(), getOccasions(), getPriceTable(), cfg("shipping"), cfg("limits")]);
  const addons = hasDatabase ? await db.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }).catch(() => []) : [];
  const ph = hasDatabase ? await db.printHouse.findFirst({ where: { isActive: true } }).catch(() => null) : null;
  const base = `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
  return {
    name: "БУКИМИ",
    url: base,
    description: "Персональные иллюстрированные книги по фото: для детей, подростков, взрослых и о питомцах. Герой узнаваем на иллюстрациях, его имя — в тексте.",
    language: "ru",
    country: "RU",
    ageRating: "0+",
    howItWorks: [
      "Анкета без фото: имя, возраст, увлечения, повод, сюжет, другие герои, стиль, посвящение",
      "Бесплатно: сказка текстом за минуту, её можно поправить",
      "Фото ребёнка (1–3) по отдельному согласию, удаляется через 7 дней",
      "Бесплатное превью: обложка и 2 разворота за 2–5 минут",
      "Покупка PDF или печатной книги",
    ],
    stories: stories.map((s) => ({ title: displayTitle(s.title, s.audience), url: `${base}/skazki/${s.slug}`, audience: s.audience, age: `${s.ageMin}-${s.ageMax}`, occasions: s.occasions, summary: s.tagline })),
    occasions: occasions.map((o) => ({ title: o.title, url: `${base}/povod/${o.slug}` })),
    prices: prices.map((p) => ({ product: p.title, priceRub: p.priceRub, type: p.kind === "PDF" ? "digital" : "printed", pages: 24 })),
    addons: addons.map((a) => ({ title: a.title, priceRub: a.priceRub, percentOff: a.percentOff })),
    production: { printDays: `${ph?.leadDaysMin ?? 3}-${ph?.leadDaysMax ?? 5} рабочих дней`, pdf: "в течение часа после оплаты" },
    delivery: { services: ["СДЭК", "Почта России", "Яндекс Доставка"].filter((_, i) => [shipping.cdekPvz || shipping.cdekCourier, shipping.pochta, shipping.yandex][i]), freeFromBooks: shipping.freeShippingBooks, cdekDays: "2-7", pochtaDays: "7-14" },
    privacy: { photoStorage: "серверы в России", photoDeletedAfterDays: limits.photoTtlDays, photoUse: "только для иллюстраций, без идентификации личности" },
    returns: "Персонализированная книга надлежащего качества не возвращается; при браке — бесплатная перепечатка или возврат денег.",
    payment: ["СБП по QR-коду", "перевод по реквизитам"],
  };
}
