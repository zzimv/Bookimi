// Склонение русских имён по падежам — чтобы имя ребёнка не отправлять во внешний ИИ.
// Модель пишет текст с метками {ГЕРОЙ.им}, {ГЕРОЙ.род}…; имена подставляются здесь.
// Правила покрывают типичные имена и домашние формы (Марк, Маша, Андрей, Игорь, Мария, Илья, Любовь).

export type Case = "им" | "род" | "дат" | "вин" | "тв" | "пр";
export const CASES: Case[] = ["им", "род", "дат", "вин", "тв", "пр"];
type Gender = "boy" | "girl" | string | undefined;

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
  if (gender === "girl") {
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

/** {Р:мальчик|девочка} → форма по полу (по умолчанию — мужская). */
export function applyGender(text: string, gender?: string) {
  return text.replace(/\{Р:([^|}]*)\|([^}]*)\}/g, (_, m, f) => (gender === "girl" ? f : m));
}
