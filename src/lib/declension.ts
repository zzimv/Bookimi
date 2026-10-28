// Склонение русских имён по падежам — чтобы имя ребёнка не отправлять во внешний ИИ.
// Модель пишет текст с метками {ГЕРОЙ.им}, {ГЕРОЙ.род}…; имена подставляются здесь.
// Правила покрывают типичные имена и домашние формы (Марк, Маша, Андрей, Игорь, Мария, Илья, Любовь).

export type Case = "им" | "род" | "дат" | "вин" | "тв" | "пр";
export const CASES: Case[] = ["им", "род", "дат", "вин", "тв", "пр"];
type Gender = "boy" | "girl" | string | undefined;

/** Женский род: girl (ребёнок, питомец-она), female / f (взрослые, доп. герои). */
export function isFeminine(g: Gender) {
  return g === "girl" || g === "female" || g === "f";
}
/** Средний род — для «своих» доп. героев-предметов: облако, солнце. */
export function isNeuter(g: Gender) {
  return g === "n" || g === "neuter";
}
/** Род по имени, если пол не указан: -а/-я → женский (кроме частых мужских), иначе мужской. */
export function guessGender(name: string): "boy" | "girl" {
  const low = name.trim().split(/[\s-]/)[0].toLowerCase();
  if (/^(илья|никита|кузьма|фома|лука|савва|данила|гаврила|миша|саша|паша|гоша|лёша|алёша|ваня|петя|вася|дима|женя|витя|толя|коля|серёжа|юра|слава|сеня|федя|тёма|тима|лёва|вова|костя|стёпа|гриша|боря)$/.test(low)) return "boy";
  if (/[ая]$/.test(low) || /^(любовь|рысь|ночь|мышь)$/.test(low)) return "girl";
  return "boy";
}

const INDECLINABLE = /(о|е|э|и|у|ю|ы)$/i; // Саша → но «Саша» на «а»; Лео, Ники, Рене — не склоняются
const HUSHING = /[жшчщц]$/i;
const SOFT_STEM = /[кгхжшчщ]$/i;

function cap(src: string, out: string) {
  return src[0] === src[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
}

export function declineName(name: string, c: Case, gender: Gender): string {
  const n = name.trim();
  if (!n || c === "им") return n;
  // Двойные имена: «Анна-Мария»
  if (n.includes("-")) return n.split("-").map((p) => declineName(p, c, gender)).join("-");
  if (n.includes(" ")) {
    const [first, ...rest] = n.split(" ");
    return [declineName(first, c, gender), ...rest].join(" ");
  }
  const low = n.toLowerCase();
  const stem = n.slice(0, -1);
  const stem2 = n.slice(0, -2);

  // -ия: Мария, Наталия, Илия
  if (low.endsWith("ия")) {
    return { род: stem + "и", дат: stem + "и", вин: stem + "ю", тв: stem + "ей", пр: stem + "и" }[c];
  }
  // -а / -я: Маша, Лиза, Илья, Ваня, Никита (и мужские, и женские склоняются одинаково)
  if (low.endsWith("а") || low.endsWith("я")) {
    const soft = low.endsWith("я");
    const s = stem;
    const genA = SOFT_STEM.test(s) || soft ? "и" : "ы";
    const tvA = soft ? "ей" : HUSHING.test(s) ? "ей" : "ой";
    const datA = soft && low.endsWith("ья") ? "е" : "е";
    return { род: s + genA, дат: s + datA, вин: s + (soft ? "ю" : "у"), тв: s + (soft && low.endsWith("ья") ? "ёй" : tvA), пр: s + "е" }[c];
  }
  // Женские имена на согласную не склоняются (Ассоль), кроме «-ь» (Любовь — особый случай)
  if (isFeminine(gender)) {
    if (low === "любовь") return cap(n, { род: "любови", дат: "любови", вин: "любовь", тв: "любовью", пр: "любови" }[c]);
    if (low.endsWith("ь")) return { род: stem + "и", дат: stem + "и", вин: n, тв: n + "ю", пр: stem + "и" }[c];
    return n;
  }
  if (INDECLINABLE.test(low)) return n;
  // -й: Андрей, Тимофей, Дмитрий
  if (low.endsWith("ий")) return { род: stem + "я", дат: stem + "ю", вин: stem + "я", тв: stem + "ем", пр: stem2 + "ии" }[c];
  if (low.endsWith("й")) return { род: stem + "я", дат: stem + "ю", вин: stem + "я", тв: stem + "ем", пр: stem + "е" }[c];
  // -ь: Игорь, Лазарь (мужские)
  if (low.endsWith("ь")) return { род: stem + "я", дат: stem + "ю", вин: stem + "я", тв: stem + "ем", пр: stem + "е" }[c];
  // Беглое «е»: Лев → Льва, Павел → Павла (только частые случаи)
  if (low === "лев") return cap(n, { род: "льва", дат: "льву", вин: "льва", тв: "львом", пр: "льве" }[c]);
  if (low === "пётр" || low === "петр") return cap(n, { род: "петра", дат: "петру", вин: "петра", тв: "петром", пр: "петре" }[c]);
  // Беглое «о/ё» в кличках: Пушок → Пушка, Дружок → Дружка, Уголёк → Уголька
  if (low.length >= 5 && /[бвгджзклмнпрстфхцчшщ]ок$/.test(low)) {
    const s2 = n.slice(0, -2) + "к";
    return { род: s2 + "а", дат: s2 + "у", вин: s2 + "а", тв: s2 + "ом", пр: s2 + "е" }[c];
  }
  if (low.length >= 5 && /[бвгджзклмнпрстфх]ёк$/.test(low)) {
    const s2 = n.slice(0, -2) + "ьк";
    return { род: s2 + "а", дат: s2 + "у", вин: s2 + "а", тв: s2 + "ом", пр: s2 + "е" }[c];
  }
  // Согласная: Марк, Иван, Глеб, Миша-нет; шипящие — «-ем» в творительном (Святослав-ом, но Игнат-ом)
  const tv = HUSHING.test(low) ? "ем" : "ом";
  return { род: n + "а", дат: n + "у", вин: n + "а", тв: n + tv, пр: n + "е" }[c];
}

export interface HeroNames {
  name: string;
  nickname?: string;
  gender?: Gender;
}

/** Подставляет {ГЕРОЙ.падеж} и {ЛАСКОВО.падеж} в тексте модели. */
export function fillNames(text: string, hero: HeroNames, extras: { key: string; name: string; gender?: Gender }[] = []) {
  let out = text.replace(/\{(ГЕРОЙ|ЛАСКОВО)\.(им|род|дат|вин|тв|пр)\}/g, (_, who, c: Case) => {
    const base = who === "ЛАСКОВО" ? hero.nickname || hero.name : hero.name;
    return declineName(base, c, hero.gender);
  });
  for (const e of extras) {
    const re = new RegExp(`\\{${e.key}\\.(им|род|дат|вин|тв|пр)\\}`, "g");
    out = out.replace(re, (_, c: Case) => declineName(e.name, c, e.gender));
  }
  // Метка без падежа — именительный
  return out.replace(/\{ГЕРОЙ\}/g, hero.name).replace(/\{ЛАСКОВО\}/g, hero.nickname || hero.name);
}

/** Выбор формы из «м|ж» или «м|ж|ср» по роду. Без формы среднего рода — мужская. */
function pickForm(forms: string, gender: Gender) {
  const [m, f = m, n] = forms.split("|");
  if (isFeminine(gender)) return f;
  if (isNeuter(gender) && n !== undefined) return n;
  return m;
}

/** {Р:мальчик|девочка} или {Р:он|она|оно} → форма по полу героя (по умолчанию — мужская). */
export function applyGender(text: string, gender?: string) {
  return text.replace(/\{Р:([^}]*)\}/g, (_, forms: string) => pickForm(forms, gender));
}

/** «5 лет», «3 года», «21 год». */
export function ageLabel(n: number) {
  const a = Math.abs(Math.trunc(n));
  const d = a % 10;
  const dd = a % 100;
  const w = dd >= 11 && dd <= 14 ? "лет" : d === 1 ? "год" : d >= 2 && d <= 4 ? "года" : "лет";
  return `${a} ${w}`;
}

export interface TagPerson {
  name: string;
  gender?: Gender;
}
export interface TagContext {
  hero: HeroNames;
  /** Доп. герои по порядку: ДОП1, ДОП2, ДОП3. */
  extras?: TagPerson[];
  /** Название повода или текст «своего повода» — для {ПОВОД}. */
  occasion?: string;
  /** Возраст героя — для {ВОЗРАСТ}. */
  age?: number;
}

const joinRu = (xs: string[]) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " и " + xs.at(-1) : xs[0] ?? "");

/**
 * Полная подстановка меток (спецификация — docs/content/ARCHITECTURE.md):
 * {Р:м|ж(|ср)}, {Р1..3:…}, {МН:один|много}, {ДОПЫ.падеж}, {ПОВОД}, {ВОЗРАСТ},
 * {ГЕРОЙ.падеж}, {ЛАСКОВО.падеж}, {ДОП1..3.падеж}. Метки отсутствующих доп. героев удаляются.
 */
export function fillTags(text: string, ctx: TagContext) {
  const extras = ctx.extras ?? [];
  let out = applyGender(text, ctx.hero.gender);
  out = out.replace(/\{Р([1-3]):([^}]*)\}/g, (_, n: string, forms: string) => pickForm(forms, extras[Number(n) - 1]?.gender));
  out = out.replace(/\{МН:([^|}]*)\|([^}]*)\}/g, (_, one: string, many: string) => (extras.length > 1 ? many : one));
  out = out.replace(/\{ДОПЫ\.(им|род|дат|вин|тв|пр)\}/g, (_, c: Case) => joinRu(extras.map((e) => declineName(e.name, c, e.gender))));
  out = out.replace(/\{ДОПЫ\}/g, joinRu(extras.map((e) => e.name)));
  out = out.replace(/\{ПОВОД\}/g, ctx.occasion ?? "");
  out = out.replace(/\{ВОЗРАСТ\}/g, ctx.age ? ageLabel(ctx.age) : "");
  out = fillNames(out, ctx.hero, extras.map((e, i) => ({ key: `ДОП${i + 1}`, name: e.name, gender: e.gender })));
  extras.forEach((e, i) => (out = out.replace(new RegExp(`\\{ДОП${i + 1}\\}`, "g"), e.name)));
  return out.replace(/\{ДОП\d(\.(им|род|дат|вин|тв|пр))?\}/g, "").replace(/ {2,}/g, " ");
}
