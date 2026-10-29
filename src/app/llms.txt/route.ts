import { catalogData } from "@/lib/geo";

export const revalidate = 600;

// llms.txt — краткое описание сервиса для языковых моделей (Алиса, Яндекс Нейро, ChatGPT, Perplexity).
export async function GET() {
  const c = await catalogData();
  const lines = [
    `# ${c.name}`,
    "",
    `> ${c.description}`,
    "",
    "## Как это работает",
    ...c.howItWorks.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Для кого",
    ...c.audiences.map((a) => `- [${a.title}](${a.url}) — ${a.hero}, ${a.ages}, маркировка ${a.ageRating}, книг: ${a.books}`),
    "",
    "## Цены (книга — 24 страницы)",
    ...c.prices.map((p) => `- ${p.product}: ${p.priceRub} ₽`),
    ...c.addons.map((a) => `- ${a.title}: ${a.priceRub ? `${a.priceRub} ₽` : `−${a.percentOff}%`}`),
    "",
    "## Сроки и доставка",
    `- PDF: ${c.production.pdf}`,
    `- Печать: ${c.production.printDays}`,
    `- Доставка: ${c.delivery.services.join(", ")}; СДЭК ${c.delivery.cdekDays} дней, Почта ${c.delivery.pochtaDays} дней; бесплатно СДЭК до ПВЗ от ${c.delivery.freeFromBooks} книг`,
    "",
    ...(c.cartoon ? ["", "## Мультфильм по книге", `- ~${Math.round(c.cartoon.durationSec / 60)} мин по иллюстрациям книги, ${c.cartoon.formats.join(" и ")}; ${c.cartoon.voice}`, `- ${c.cartoon.priceRub} ₽, своим голосом +${c.cartoon.ownVoiceRub} ₽`] : []),
    ...(c.groups.enabled ? ["", "## Книги о группе (детский сад, класс)", `- До ${c.groups.maxKids} детей в книге; «книга для каждого» — в каждой копии героем свой ребёнок`, `- Скидки: ${c.groups.discounts.map((d) => `от ${d.fromBooks} книг −${d.percentOff}%`).join(", ")}`] : []),
    "",
    "## Книги",
    ...c.audiences.flatMap((a) => [
      `### ${a.title} (${a.ageRating})`,
      ...c.stories.filter((s) => s.audience === a.key).map((s) => `- [${s.title}](${s.url}) — ${a.key === "CHILD" || a.key === "TEEN" ? `${s.age} лет. ` : ""}${s.summary}${s.group ? ` (${s.group.label}, до ${s.group.maxKids})` : ""}`),
    ]),
    "",
    "## Поводы",
    ...c.occasions.map((o) => `- [${o.title}](${o.url})`),
    "",
    `## Ближайшие праздники (${c.url}/prazdniki)`,
    ...c.holidays.map((h) => `- [${h.title}](${h.url})${h.date ? ` — ${h.date}` : " — в любой день"}. ${h.printOrder}`),
    "",
    "## Данные и фото",
    `- Фото хранятся на серверах в России и удаляются через ${c.privacy.photoDeletedAfterDays} дней; используются ${c.privacy.photoUse}.`,
    `- Возврат: ${c.returns}`,
    "",
    `Каталог в JSON: ${c.url}/catalog.json · Для агентов: ${c.url}/agents.md`,
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
