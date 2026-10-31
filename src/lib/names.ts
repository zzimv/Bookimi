// Имена людей и питомцев: одна точка нормализации (normalizeName из declension.ts) и проверки для всех входов —
// анкета (герой, ласковое имя, доп. герои, дети и взрослые группы), «Как к вам обращаться», получатель заказа,
// адресная книга, подпись отзыва. Модуль безопасен для клиента (только zod): те же правила в формах (на blur),
// в схемах API и в демо-стенде.
import { z } from "zod";
import "./zod-ru";
import { isLatinName, normalizeName } from "./declension";

export { isLatinName, normalizeName };

/**
 * Какие знаки можно в имени:
 *  person — буквы, пробел, дефис, апостроф и точка инициала («Саша К.», «Мария Ивановна», «O'Brien»);
 *  free   — ещё цифры («Робот Бип-2», «R2-D2») — для «своего варианта» доп. героя и кличек.
 */
export type NameKind = "person" | "free";
const PERSON = /^[\p{L}][\p{L}\p{M}' .-]*$/u;
const FREE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}' .-]*$/u;

export const NAME_CHARS_ERROR = "Имя: только буквы, пробел, дефис или апостроф";
export const FREE_CHARS_ERROR = "Имя: буквы, цифры, пробел или дефис";

/** null — имя подходит (или пустое), иначе — текст ошибки по-русски. */
export function nameError(raw: string | null | undefined, kind: NameKind = "person"): string | null {
  const v = normalizeName(raw ?? "");
  if (!v) return null;
  if (!(kind === "free" ? FREE : PERSON).test(v) || !/\p{L}/u.test(v)) return kind === "free" ? FREE_CHARS_ERROR : NAME_CHARS_ERROR;
  return null;
}

/** Получатель печатной книги: «Имя и фамилия» — не меньше двух слов. */
export const FULL_NAME_ERROR = "Укажите имя и фамилию получателя — например, «Анна Петрова»: так курьер и пункт выдачи найдут посылку";
export function fullNameError(raw: string | null | undefined): string | null {
  const v = normalizeName(raw ?? "");
  if (!v) return "Укажите имя и фамилию получателя";
  const bad = nameError(v, "person");
  if (bad) return "Имя получателя: только буквы, пробел, дефис или апостроф — без ссылок и цифр";
  const words = v.split(" ").filter((w) => /\p{L}{2,}/u.test(w));
  return words.length >= 2 ? null : FULL_NAME_ERROR;
}

/** Подпись отзыва («Ольга, мама Вари»): свободная фраза — только пробелы и заглавная первая буква. */
export function normalizeSignature(raw: string | null | undefined): string {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  return v ? v[0].toUpperCase() + v.slice(1) : v;
}

// ---------------------------------------------------------------------------
// zod: имя на входе API всегда приводится к виду «Маша» (как и в форме на blur)
// ---------------------------------------------------------------------------

const check = (kind: NameKind) => (v: string, ctx: z.RefinementCtx) => {
  const e = nameError(v, kind);
  if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
};

/** Обязательное имя: «маша» → «Маша». */
export const zName = (max: number, msg = "Укажите имя", kind: NameKind = "person") =>
  z.string().max(max * 2).transform(normalizeName).pipe(z.string().min(1, msg).max(max).superRefine(check(kind)));
/** Необязательное имя (ласковое, «свой вариант» без имени): пустая строка допустима. */
export const zNameOpt = (max: number, kind: NameKind = "person") =>
  z.string().max(max * 2).optional().default("").transform(normalizeName).pipe(z.string().max(max).superRefine(check(kind)));
/** «Имя и фамилия» получателя: нормализуется; два слова проверяет оформление печатного заказа (fullNameError). */
export const zRecipientName = (max = 80) => z.string().max(max * 2).optional().default("").transform(normalizeName).pipe(z.string().max(max));

// ---------------------------------------------------------------------------
// Латиница → подсказка «Лучше по-русски» с предложением в один клик
// ---------------------------------------------------------------------------

export const LATIN_HINT = "Лучше написать имя по-русски — тогда мы склоним его правильно";

/** Частые имена латиницей → кириллица (покупатель подтверждает кнопкой). */
const TRANSLIT: Record<string, string> = {
  anna: "Анна", ann: "Анна", anya: "Аня", mark: "Марк", marc: "Марк", nikita: "Никита", ilya: "Илья", ilia: "Илья", ilja: "Илья",
  leo: "Лео", lev: "Лев", sofia: "София", sophia: "София", sofya: "Софья", sonya: "Соня", maria: "Мария", mariya: "Мария", mary: "Мария",
  masha: "Маша", alice: "Алиса", alisa: "Алиса", eva: "Ева", eve: "Ева", ivan: "Иван", vanya: "Ваня", alexander: "Александр",
  aleksandr: "Александр", alexandra: "Александра", sasha: "Саша", alex: "Алекс", alexey: "Алексей", aleksey: "Алексей", misha: "Миша",
  mikhail: "Михаил", michael: "Михаил", dasha: "Даша", daria: "Дарья", darya: "Дарья", dmitry: "Дмитрий", dmitriy: "Дмитрий", dima: "Дима",
  egor: "Егор", kirill: "Кирилл", roman: "Роман", artem: "Артём", artyom: "Артём", timofey: "Тимофей", timur: "Тимур", matvey: "Матвей",
  maxim: "Максим", max: "Макс", daniil: "Даниил", daniel: "Даниэль", david: "Давид", adam: "Адам", leon: "Леон", lucas: "Лукас",
  fedor: "Фёдор", fyodor: "Фёдор", petr: "Пётр", pyotr: "Пётр", peter: "Пётр", pavel: "Павел", paul: "Павел", semyon: "Семён", semen: "Семён",
  ekaterina: "Екатерина", katya: "Катя", kate: "Кейт", olga: "Ольга", polina: "Полина", varvara: "Варвара", varya: "Варя", vera: "Вера",
  nina: "Нина", mila: "Мила", milana: "Милана", mia: "Мия", emma: "Эмма", liza: "Лиза", lisa: "Лиза", elizaveta: "Елизавета",
  zlata: "Злата", vika: "Вика", viktoria: "Виктория", victoria: "Виктория", ksenia: "Ксения", kseniya: "Ксения", arina: "Арина",
  nastya: "Настя", anastasia: "Анастасия", anastasiya: "Анастасия", yana: "Яна", zoe: "Зоя", zoya: "Зоя", lily: "Лили", lilia: "Лилия",
  natalia: "Наталья", natalya: "Наталья", tanya: "Таня", tatiana: "Татьяна", tatyana: "Татьяна", irina: "Ирина", elena: "Елена",
  helen: "Елена", alena: "Алёна", alyona: "Алёна", vasilisa: "Василиса", ulyana: "Ульяна", veronika: "Вероника", diana: "Диана",
  kira: "Кира", lyuba: "Люба", lubov: "Любовь", lyubov: "Любовь", nikolay: "Николай", nikolai: "Николай", kolya: "Коля", oleg: "Олег",
  igor: "Игорь", andrey: "Андрей", andrei: "Андрей", sergey: "Сергей", sergei: "Сергей", gleb: "Глеб", stepan: "Степан", platon: "Платон",
  miron: "Мирон", savva: "Савва", yaroslav: "Ярослав", vladimir: "Владимир", vova: "Вова", tim: "Тим", tom: "Том", ben: "Бен",
};

/** Предложение кириллицей для имени латиницей («Anna» → «Анна», «Anna-Maria» → «Анна-Мария»); null — не знаем. */
export function cyrillicSuggestion(raw: string | null | undefined): string | null {
  const v = normalizeName(raw ?? "");
  if (!v || !isLatinName(v)) return null;
  const parts = v.split(/([ -])/);
  const out = parts.map((p) => (p === " " || p === "-" ? p : TRANSLIT[p.toLowerCase()] ?? null));
  return out.every((x) => x !== null) ? (out as string[]).join("") : null;
}

/**
 * Для миграции старых записей (scripts/normalize-names.ts): новое значение, если имя надо привести к виду
 * «Анна» и оно после этого корректно; иначе null (уже нормально, пусто или не похоже на имя — не трогаем).
 */
export function nameFix(current: string | null | undefined): string | null {
  if (!current) return null;
  const n = normalizeName(current);
  if (!n || n === current || nameError(n, "person")) return null;
  return n;
}
