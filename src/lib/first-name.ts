// «Как к вам обращаться»: те же правила, что cleanFirstName на сервере (src/lib/auth.ts) — до 40 символов,
// только буквы, слова через один пробел или дефис («Анна», «Анна-Мария»). Модуль без Node API — для форм и демо.
export const FIRST_NAME_MAX = 40;
export const FIRST_NAME_ERROR = "Имя: до 40 символов — буквы, пробел или дефис";
/** Фильтр при вводе: убираем всё, кроме букв, пробела и дефиса. */
export const typeFirstName = (v: string) => v.replace(/[^\p{L} -]/gu, "").replace(/ {2,}/g, " ").slice(0, FIRST_NAME_MAX);
/** null — пусто, false — не подходит, иначе — имя как сохранит сервер. */
export function checkFirstName(raw: string | null | undefined): string | null | false {
  const v = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!v) return null;
  if (v.length > FIRST_NAME_MAX || !/^\p{L}+(?:[ -]\p{L}+)*$/u.test(v)) return false;
  return v;
}
