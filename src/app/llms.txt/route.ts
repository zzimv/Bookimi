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
    "## Цены (книга — 24 страницы)",
    ...c.prices.map((p) => `- ${p.product}: ${p.priceRub} ₽`),
    ...c.addons.map((a) => `- ${a.title}: ${a.priceRub ? `${a.priceRub} ₽` : `−${a.percentOff}%`}`),
    "",
    "## Сроки и доставка",
    `- PDF: ${c.production.pdf}`,
    `- Печать: ${c.production.printDays}`,
    `- Доставка: ${c.delivery.services.join(", ")}; СДЭК ${c.delivery.cdekDays} дней, Почта ${c.delivery.pochtaDays} дней; бесплатно СДЭК до ПВЗ от ${c.delivery.freeFromBooks} книг`,
    "",
    "## Сказки",
    ...c.stories.map((s) => `- [${s.title}](${s.url}) — ${s.age} лет. ${s.summary}`),
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
