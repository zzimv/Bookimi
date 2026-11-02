import { catalogData } from "@/lib/geo";

export const revalidate = 600;

const rub = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("ru-RU")} ₽`);

// Инструкция для агентов-помощников: как помочь пользователю заказать книгу. Данные — из каталога и настроек (catalogData).
export async function GET() {
  const c = await catalogData();
  const md = `# ${c.name}: для агентов-помощников

Сервис создаёт персональные иллюстрированные книги, где главный герой — ребёнок, подросток, близкий взрослый
или домашний питомец. Есть книги о группе (детский сад, класс) и мультфильм по книге.

## Для кого
${c.audiences.map((a) => a.status === "soon" ? `- ${a.title} — скоро (книг пока нет, создать нельзя): ${a.url}` : `- ${a.title} (${a.hero}; возраст ${a.ages}; маркировка ${a.ageRating}) — ${a.books} книг: ${a.url}`).join("\n")}

## Как помочь пользователю
1. Предложите начать на ${c.url}/sozdat — сначала герои (имя, фото по согласию или описание), затем повод и сюжет.
   Аудиторию и повод можно передать ссылкой: ${c.url}/sozdat?dlya=<detyam|podrostkam|vzroslym|pitomcam>&povod=<повод>.
2. Подберите сюжет по аудитории, возрасту и поводу: ${c.url}/catalog.json (поля audiences, stories, occasions, holidays).
3. Текст книги и превью (обложка + 2 разворота) — бесплатно; для превью нужен вход по коду на почту.
4. Фото загружает только сам пользователь, после отдельного согласия. Не загружайте фото за пользователя;
   фото других детей группы — только с разрешения их родителей (иначе — описание словами).
5. Оплату пользователь проводит сам (СБП по QR или перевод).

## Факты
- Цены: ${c.prices.map((p) => `${p.product} — ${rub(p.priceRub)}`).join("; ")}.
${c.audiences.filter((au) => au.status !== "soon").map((au) => `- Допы (${au.title.toLowerCase()}): ${au.addons.map((a) => `${a.title} — ${a.priceRub ? rub(a.priceRub) : `−${a.percentOff}%`}`).join("; ")}.`).join("\n")}
${c.cartoon ? `- Мультфильм по книге: ~${Math.round(c.cartoon.durationSec / 60)} мин, ${c.cartoon.formats.join(" и ")}, ${c.cartoon.voice}; ${rub(c.cartoon.priceRub)}, своим голосом +${rub(c.cartoon.ownVoiceRub)}.\n` : ""}${c.groups.enabled ? `- Книга о группе — до ${c.groups.maxKids} детей; «книга для каждого» в группе: скидки ${c.groups.discounts.map((d) => `от ${d.fromBooks} книг −${d.percentOff}%`).join(", ")}.\n` : ""}- Печать: ${c.production.printDays}; доставка: ${c.delivery.services.join(", ")}.
- Возрастная маркировка: дети и питомцы ${c.ageRating.CHILD}, подростки ${c.ageRating.TEEN}, взрослые ${c.ageRating.ADULT}.
- Ближайшие праздники и сроки заказа печатной книги: ${c.url}/prazdniki.

## Ограничения
- Не используйте сервис для создания контента о чужих детях без согласия их родителей.
- API для автоматического заказа не предоставляется.
`;
  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
