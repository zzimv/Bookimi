// «Как к вам обращаться»: те же правила, что cleanFirstName на сервере (src/lib/auth.ts) — до 40 символов,
// только буквы, слова через один пробел или дефис («Анна», «Анна-Мария», «Д'Арси»). Регистр приводится
// единой нормализацией имён (normalizeName): «анна» → «Анна». Модуль без Node API — для форм и демо.
import { normalizeName } from "./declension";

export const FIRST_NAME_MAX = 40;
export const FIRST_NAME_ERROR = "Имя: до 40 символов — буквы, пробел, дефис или апостроф";
/** Фильтр при вводе: убираем всё, кроме букв, пробела, дефиса и апострофа. */
export const typeFirstName = (v: string) => v.replace(/[^\p{L} '’-]/gu, "").replace(/ {2,}/g, " ").slice(0, FIRST_NAME_MAX);
const WORD = String.raw`\p{L}+(?:'\p{L}+)*`;
const FIRST_NAME_RE = new RegExp(`^${WORD}(?:[ -]${WORD})*$`, "u");
/** null — пусто, false — не подходит, иначе — имя как сохранит сервер («анна» → «Анна»). */
export function checkFirstName(raw: string | null | undefined): string | null | false {
  const v = normalizeName(raw ?? "");
  if (!v) return null;
  if (v.length > FIRST_NAME_MAX || !FIRST_NAME_RE.test(v)) return false;
  return v;
}

/** Имя для приветствия в кабинете — только «Как к вам обращаться» (User.firstName), целиком («Анна Петровна»).
 *  Старые записи («анна») нормализуются при показе. */
export function greetName(firstName: string | null | undefined): string | null {
  return checkFirstName(firstName) || null;
}

/** «Здравствуйте, Анна!» или просто «Здравствуйте!». */
export const greeting = (name: string | null) => (name ? `Здравствуйте, ${normalizeName(name)}!` : "Здравствуйте!");
