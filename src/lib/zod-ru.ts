// Сообщения zod по-русски для всех форм (админка, анкета, API): z.setErrorMap — глобально для процесса.
// Подключается побочным импортом (`import "./zod-ru"`) в модулях со схемами; свои сообщения в схемах важнее.
// В демо-стенде вместо zod — мини-zod (tools/demo/shims/zod.ts) с русскими сообщениями, setErrorMap там — пустышка.
import { z } from "zod";

const n = (x: number | bigint) => String(x);

export const ruErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Обязательное поле" };
      if (issue.expected === "integer") return { message: "Введите целое число" };
      if (issue.expected === "number") return { message: "Введите число" };
      if (issue.expected === "string") return { message: "Ожидается текст" };
      if (issue.expected === "boolean") return { message: "Ожидается да/нет" };
      if (issue.expected === "array") return { message: "Ожидается список" };
      if (issue.expected === "date") return { message: "Укажите дату" };
      return { message: "Некорректное значение" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") return { message: issue.minimum === 1 ? "Заполните поле" : `Не меньше ${n(issue.minimum)} символов` };
      if (issue.type === "array") return { message: `Выберите не меньше ${n(issue.minimum)}` };
      if (issue.type === "number" || issue.type === "bigint") return { message: issue.inclusive ? `Число должно быть не меньше ${n(issue.minimum)}` : `Число должно быть больше ${n(issue.minimum)}` };
      return { message: "Слишком маленькое значение" };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Не больше ${n(issue.maximum)} символов` };
      if (issue.type === "array") return { message: `Не больше ${n(issue.maximum)} в списке` };
      if (issue.type === "number" || issue.type === "bigint") return { message: issue.inclusive ? `Число должно быть не больше ${n(issue.maximum)}` : `Число должно быть меньше ${n(issue.maximum)}` };
      return { message: "Слишком большое значение" };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Проверьте адрес почты" };
      if (issue.validation === "url") return { message: "Проверьте ссылку" };
      if (issue.validation === "uuid") return { message: "Некорректный идентификатор" };
      return { message: "Проверьте формат" };
    case z.ZodIssueCode.invalid_enum_value:
    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: "Выберите вариант из списка" };
    case z.ZodIssueCode.not_multiple_of:
      return { message: `Число должно быть кратно ${n(issue.multipleOf as number)}` };
    case z.ZodIssueCode.not_finite:
      return { message: "Введите число" };
    case z.ZodIssueCode.invalid_date:
      return { message: "Некорректная дата" };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: "Лишние поля в форме" };
    default:
      return { message: ctx.defaultError === "Invalid input" ? "Проверьте значение" : ctx.defaultError };
  }
};

z.setErrorMap(ruErrorMap);
