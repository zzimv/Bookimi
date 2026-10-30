// Сброс кэша страниц с праздниками после правки в админке (Next: полный кэш маршрутов).
import { revalidatePath } from "next/cache";

/**
 * Страницы, где видны праздники: сам список, главная (кнопка ближайшего праздника), машиночитаемые
 * llms.txt / agents.md / catalog.json. Полоса промо — в общем макете, поэтому ещё и «/» с типом layout
 * (все страницы под корневым макетом). Пути перечислены явно: одно «/», "layout" на проверке не всегда
 * сбрасывало /prazdniki.
 */
export const HOLIDAY_PATHS = ["/prazdniki", "/", "/llms.txt", "/agents.md", "/catalog.json"] as const;

export function revalidateHolidays() {
  for (const p of HOLIDAY_PATHS) revalidatePath(p);
  revalidatePath("/", "layout");
}
