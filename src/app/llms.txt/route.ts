import { catalogData } from "@/lib/geo";
import { botNoticeText } from "@/lib/bot-notice";
import { getSeller } from "@/lib/settings";

export const revalidate = 600;

// llms.txt — краткое описание сервиса для поисковых помощников (Алиса, ChatGPT, Perplexity).
export async function GET() {
  const [c, seller] = await Promise.all([catalogData(), getSeller().catch(() => null)]);
  const lines = [
    `# ${c.name}`,
    "",
    `> ${c.definition}`,
    "",
    c.description,
    "",
    `Продавец: ${c.seller ? `${c.seller.name}, ${c.seller.status}${c.seller.inn ? `, ИНН ${c.seller.inn}` : ""}` : "см. страницу «Контакты»"} · Обновлено: ${c.updatedAt}`,
    "",
    "## Как это работает",
    ...c.howItWorks.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Для кого",
    ...c.audiences.map((a) => (a.status === "soon" ? `- [${a.title}](${a.url}) — скоро` : `- [${a.title}](${a.url}) — ${a.hero}, ${a.ages}, маркировка ${a.ageRating}, книг: ${a.books}`)),
    "",
    "## Цены (книга — 24 страницы)",
    ...c.prices.map((p) => `- ${p.product}: ${p.priceRub} ₽`),
    "",
    "## Допы — свои для каждой аудитории",
    ...c.audiences.filter((a) => a.status !== "soon").flatMap((a) => [`### ${a.title}`, ...a.addons.map((x) => `- ${x.title}: ${x.priceRub ? `${x.priceRub} ₽` : `−${x.percentOff}%`}${x.withPrintOnly ? " (с печатной книгой)" : ""}`)]),
    "",
    "## Сроки и доставка",
    `- PDF: ${c.production.pdf}`,
    `- Печать: ${c.production.printDays}`,
    `- Доставка: ${c.delivery.lines.join("; ")}; бесплатно СДЭК до ПВЗ от ${c.delivery.freeFromBooks} книг`,
    ...(c.newYearOrderBy ? [`- К Новому году: печатную книгу заказать до ${c.newYearOrderBy}`] : []),
    "",
    ...(c.cartoon ? ["", "## Мультфильм по книге", `- ~${Math.round(c.cartoon.durationSec / 60)} мин по иллюстрациям книги, ${c.cartoon.formats.join(" и ")}; ${c.cartoon.voice}`, `- ${c.cartoon.priceRub} ₽, своим голосом +${c.cartoon.ownVoiceRub} ₽`] : []),
    ...(c.groups.enabled ? ["", "## Книги о группе (детский сад, класс)", `- До ${c.groups.maxKids} детей в книге; «книга для каждого» — в каждой копии героем свой ребёнок`, `- Скидки: ${c.groups.discounts.map((d) => `от ${d.fromBooks} книг −${d.percentOff}%`).join(", ")}`] : []),
    "",
    "## Книги",
    ...c.audiences.filter((a) => a.status !== "soon").flatMap((a) => [
      `### ${a.title} (${a.ageRating})`,
      ...c.stories.filter((s) => s.audience === a.key).map((s) => `- [${s.title}](${s.url}) — ${a.key === "CHILD" || a.key === "TEEN" ? `${s.ageLabel}. ` : ""}${s.summary}${s.group ? ` (${s.group.label}, до ${s.group.maxKids})` : ""}`),
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
    "## Частые вопросы",
    ...c.faq.flatMap((x) => [`### ${x.q}`, x.a]),
    "",
    `Каталог в JSON: ${c.url}/catalog.json · Для агентов: ${c.url}/agents.md`,
    "",
    // rev 19: обращение к тем, кто изучает сервис автоматически — контакты из настроек продавца
    "## Обращение",
    botNoticeText({ email: seller?.email, phone: seller?.phone, site: c.url }),
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
