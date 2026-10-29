// Проверка меток в контенте (владелец — агент 1). Подстановка — src/lib/declension.ts (fillTags).
// Спецификация — docs/content/ARCHITECTURE.md, раздел «Метки».

const CASE = "(им|род|дат|вин|тв|пр)";

/** Все допустимые формы меток. Любой другой текст в {фигурных скобках} — ошибка. */
export const TAG_GRAMMAR: { re: RegExp; doc: string }[] = [
  { re: new RegExp(`^(ГЕРОЙ|ЛАСКОВО)\\.${CASE}$`), doc: "{ГЕРОЙ.дат}, {ЛАСКОВО.им} — имя / ласковое имя героя в падеже" },
  { re: /^(ГЕРОЙ|ЛАСКОВО)$/, doc: "{ГЕРОЙ} — именительный без падежа (лучше писать {ГЕРОЙ.им})" },
  { re: new RegExp(`^ДОП[1-3]\\.${CASE}$`), doc: "{ДОП1.вин} — доп. герой 1..3 в падеже" },
  { re: /^ДОП[1-3]$/, doc: "{ДОП1} — доп. герой, именительный" },
  { re: new RegExp(`^ДОПЫ\\.${CASE}$`), doc: "{ДОПЫ.дат} — все доп. герои списком: «Ане, Пете и Маше»" },
  { re: /^ДОПЫ$/, doc: "{ДОПЫ} — список, именительный" },
  { re: /^Р:[^|{}]*\|[^|{}]*(\|[^|{}]*)?$/, doc: "{Р:м|ж} или {Р:м|ж|ср} — форма по полу героя" },
  { re: /^Р[1-3]:[^|{}]*\|[^|{}]*(\|[^|{}]*)?$/, doc: "{Р1:м|ж} — форма по полу доп. героя 1..3" },
  { re: /^МН:[^|{}]*\|[^|{}]*$/, doc: "{МН:один|много} — по числу доп. героев (1 / больше 1)" },
  { re: /^ПОВОД$/, doc: "{ПОВОД} — повод словом для текста («новоселье», «годовщина») или текст «своего повода»" },
  { re: new RegExp(`^ПОВОД\\.${CASE}$`), doc: "{ПОВОД.род} — повод в падеже («к годовщине» — {ПОВОД.дат}); свой повод не склоняется" },
  { re: /^ВОЗРАСТ$/, doc: "{ВОЗРАСТ} — «5 лет», «3 года»" },
];

/** Метки имён — их нельзя ставить в конец стихотворной строки (имена разной длины ломают рифму). */
export const NAME_TAG_RE = /\{(ГЕРОЙ|ЛАСКОВО|ДОП[1-3]|ДОПЫ)(\.(им|род|дат|вин|тв|пр))?\}/;

/** Ошибки меток в тексте (пустой массив — всё хорошо). */
export function checkTags(text: string): string[] {
  const errors: string[] = [];
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0 || depth > 1) {
      errors.push("несбалансированные или вложенные фигурные скобки");
      break;
    }
  }
  if (depth !== 0 && !errors.length) errors.push("незакрытая фигурная скобка");
  for (const m of text.matchAll(/\{([^{}]*)\}/g)) {
    const body = m[1];
    if (!TAG_GRAMMAR.some((g) => g.re.test(body))) errors.push(`неизвестная метка {${body}}`);
  }
  if (/\[Имя\]/.test(text)) errors.push("[Имя] допустимо только в названии сюжета");
  return errors;
}

/** Максимальный номер доп. героя, на которого ссылается текст (0 — нет ссылок). Учитывает {ДОПn}, {Рn:…}. */
export function maxExtraRef(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{(?:ДОП|Р)([1-3])[.:}]/g)) max = Math.max(max, Number(m[1]));
  if (/\{ДОПЫ[.}]/.test(text)) max = Math.max(max, 1);
  return max;
}

/** Строки стиха, которые заканчиваются меткой имени (с учётом знаков препинания). */
export function nameAtLineEnd(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => new RegExp(NAME_TAG_RE.source + "[\\s.,!?;:…»—–-]*$").test(l));
}

/** Метки переменной длины в стихах: имена и повод ({ПОВОД} — от одного до шести слов). */
const VARIABLE_TAG_RE = new RegExp(`${NAME_TAG_RE.source}|\\{ПОВОД(\\.(им|род|дат|вин|тв|пр))?\\}`, "g");

/**
 * Строка-обращение вне метра: кроме меток имени/повода — не больше одного слова
 * («— {ГЕРОЙ.им}!», «Спи, {ЛАСКОВО.им}.», «{ПОВОД}!»).
 */
export function isStandaloneLine(line: string): boolean {
  const rest = line.replace(VARIABLE_TAG_RE, " ").replace(/\{[^{}]*\}/g, "x");
  return (rest.match(/[А-Яа-яЁёA-Za-z]+/g) ?? []).length <= 1;
}

/**
 * Стихотворные строки, в которых имя или повод стоит внутри метра. Имена — от 1 до 5 слогов,
 * поэтому в стихах метка имени — только в отдельной строке-обращении (isStandaloneLine).
 */
export function nameInMetricLine(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => new RegExp(VARIABLE_TAG_RE.source).test(l) && !isStandaloneLine(l));
}

/** Сколько меток имени в тексте (для лимита «не больше 4 на стихотворную книгу»). */
export function countNameTags(text: string): number {
  return (text.match(new RegExp(NAME_TAG_RE.source, "g")) ?? []).length;
}

const VOWELS = /[аеёиоуыэюя]/gi;
/** Формы рода {Р:…|…} с разным числом слогов (в стихах ломают метр): «{Р:наш герой|героиня}». */
export function unevenGenderForms(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/\{Р[1-3]?:([^{}]*)\}/g)) {
    const counts = m[1].split("|").map((f) => (f.match(VOWELS) ?? []).length);
    if (new Set(counts).size > 1) bad.push(m[0]);
  }
  return bad;
}
