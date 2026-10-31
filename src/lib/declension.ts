// Склонение русских имён по падежам — чтобы имя ребёнка не отправлять во внешние сервисы.
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
  // Имя-отчество: «Мария Ивановна», «Иван Петрович» — род по отчеству
  const words = name.trim().toLowerCase().split(/\s+/);
  if (words.length > 1 && FEM_PATRONYMIC.test(words[1])) return "girl";
  if (words.length > 1 && MASC_PATRONYMIC.test(words[1])) return "boy";
  const low = name.trim().split(/[\s-]/)[0].toLowerCase();
  if (/^[a-z']+$/.test(low)) return guessLatin(low);
  if (/^(илья|никита|кузьма|фома|лука|савва|данила|гаврила|миша|саша|паша|гоша|лёша|алёша|ваня|петя|вася|дима|женя|витя|толя|коля|серёжа|юра|слава|сеня|федя|тёма|тима|лёва|вова|костя|стёпа|гриша|боря)$/.test(low)) return "boy";
  if (/[ая]$/.test(low) || /^(любовь|рысь|ночь|мышь)$/.test(low)) return "girl";
  return "boy";
}

/** Мужские имена латиницей на -a/-ya (транслит и иностранные): Nikita, Ilya, Luca… */
const LATIN_BOY_A = new Set(["nikita", "ilya", "ilia", "ilja", "iliya", "kuzma", "foma", "luka", "luca", "savva", "danila", "gavrila", "misha", "pasha", "grisha", "vanya", "vania", "petya", "petia", "dima", "kolya", "kolia", "tolya", "vitya", "yura", "jura", "fedya", "tyoma", "tema", "tima", "lyova", "leva", "vova", "kostya", "kostia", "styopa", "stepa", "borya", "gosha", "lyosha", "alyosha", "yasha", "senya", "joshua", "andrea", "jonah", "noah", "elijah", "isaiah", "ezra", "dobrynya", "sasha", "zhenya", "zhenia", "slava", "valya", "shura"]);
/** Женские имена латиницей не на -a: Ann, Kate, Sophie… */
const LATIN_GIRL = new Set(["ann", "anne", "kate", "marie", "sophie", "natalie", "julie", "alice", "grace", "rose", "chloe", "zoe", "mary", "emily", "lucy", "elizabeth", "ruth", "esther", "ingrid", "karin", "miriam", "lyubov", "lubov", "nadezhda", "esfir", "adel", "assol", "abigail", "isabel", "rachel", "ellie", "amelie", "nicole", "michelle", "olivia", "evelyn", "lily", "ruby", "sarah", "hannah", "leah", "eve", "elise", "anais", "ines", "carmen"]);

/**
 * Пол по имени латиницей («Anna», «Maria», «Nikita»): на -a/-ya/-ia — девочка, кроме известных мужских (Nikita, Ilya,
 * Luca…; Sasha, Zhenya — бывают и у девочек, в списках группы их спрашиваем); отдельные женские не на -a (Ann, Kate).
 * Остальное — мальчик (переключатель пола в анкете остаётся).
 */
function guessLatin(low: string): "boy" | "girl" {
  if (LATIN_BOY_A.has(low)) return "boy";
  if (LATIN_GIRL.has(low)) return "girl";
  if (/a$/.test(low)) return "girl";
  return "boy";
}

/** Отчества: «Ивановна», «Ильинична», «Кузьминична» / «Петрович», «Сергеевич», «Ильич». */
const FEM_PATRONYMIC = /(овна|евна|ична|инична)$/i;
const MASC_PATRONYMIC = /(ович|евич|ич)$/i;
export const isPatronymic = (w: string) => FEM_PATRONYMIC.test(w) || MASC_PATRONYMIC.test(w);

// Имена на -ья с ударным окончанием: творительный «-ёй» (Ильёй); остальные — «-ей» (Натальей, Дарьей, Софьей)
const STRESSED_YA = new Set(["илья"]);
const INDECLINABLE = /(о|е|э|и|у|ю|ы)$/i; // Саша → но «Саша» на «а»; Лео, Ники, Рене — не склоняются
const HUSHING = /[жшчщц]$/i;
const SOFT_STEM = /[кгхжшчщ]$/i;

function cap(src: string, out: string) {
  return src[0] === src[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
}

/** Частицы в составе имени — со строчной, если не первое слово: «Ибрагим оглы», «Людвиг ван Бетховен», «Анна де Вер». */
const NAME_PARTICLES = new Set(["де", "ди", "да", "дю", "дель", "делла", "ле", "ла", "фон", "ван", "дер", "цу", "ибн", "бин", "бинт", "оглы", "кызы", "улы", "de", "di", "da", "du", "del", "della", "le", "la", "von", "van", "der", "zu", "ibn", "bin", "bint"]);
/** Смешанный регистр, который сохраняем как ввели: «McDonald», «LeBron», «МакСим», «DeShawn» (заглавная — вторая или позже). */
const KEEP_MIXED = /^\p{Lu}\p{Ll}+\p{Lu}\p{Ll}*$/u;

function capWord(part: string, first: boolean): string {
  if (!part) return part;
  if (KEEP_MIXED.test(part)) return part;
  const low = part.toLowerCase();
  if (!first && NAME_PARTICLES.has(low)) return low;
  // Mc + заглавная: «mcdonald» → «McDonald»
  if (/^mc\p{L}{2,}$/u.test(low)) return "Mc" + low[2].toUpperCase() + low.slice(3);
  // O'/D'/Д' + заглавная: «o'brien» → «O'Brien», «д'артаньян» → «Д'Артаньян»; прочие апострофы — без заглавной после
  const ap = low.match(/^(\p{L})'(\p{L}.*)$/u);
  if (ap) return ap[1].toUpperCase() + "'" + ap[2][0].toUpperCase() + ap[2].slice(1);
  return low[0].toUpperCase() + low.slice(1);
}

/**
 * Единая точка нормализации имён (герой, ласковое имя, доп. герои, дети и взрослые группы, «Как к вам обращаться»,
 * получатель заказа, адресная книга): пробелы схлопываются, дефисы и апострофы — к одному виду, каждая часть
 * через пробел или дефис — с заглавной: «маша» → «Маша», «ЕВА» → «Ева», «анна-мария» → «Анна-Мария»,
 * «мария ивановна» → «Мария Ивановна», «ибрагим оглы» → «Ибрагим оглы», «o'brien» → «O'Brien», «саша к.» → «Саша К.».
 * Смешанный регистр с заглавной внутри сохраняем («McDonald», «МакСим»); «мАША» → «Маша».
 */
export function normalizeName(name: string): string {
  const n = (name ?? "")
    .normalize("NFC")
    .replace(/[‘’ʼʹ`´]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/ ?- ?/g, "-")
    .replace(/-{2,}/g, "-")
    .trim()
    .replace(/^[-' ]+|[-' ]+$/g, "");
  if (!n) return n;
  let first = true;
  return n
    .split(/([ -])/)
    .map((part) => {
      if (part === " " || part === "-" || !part) return part;
      const out = capWord(part, first);
      first = false;
      return out;
    })
    .join("");
}

/** Имя латиницей (без кириллицы): склоняем как несклоняемое — без русских окончаний («Anna», не «Annaу»). */
export const isLatinName = (name: string) => /[A-Za-z]/.test(name) && !/[А-Яа-яЁё]/.test(name);

/** Клички и слова с ударным окончанием после шипящей — творительный «-ом»: Малышом, Ежом, Карандашом. */
const STRESSED_HUSH = new Set(["малыш", "черныш", "крепыш", "голыш", "камыш", "кругляш", "мураш", "барыш", "кураж", "карандаш", "шалаш", "лаваш", "беляш", "ёж", "еж", "чиж", "уж", "ёрш", "ерш", "грач", "силач", "богач", "трюкач", "калач", "кулич", "мяч", "ключ", "рогач", "лихач", "хрыч", "сыч", "морж", "стриж"]);
/** «Ё» уходит при переносе ударения на окончание: Ёж → Ежа, Ёрш → Ерша. */
const YO_SHIFT: Record<string, string> = { ёж: "Еж", ёрш: "Ерш" };

/** Отчества с ударным «-и́ч»: творительный на «-ом» (Ильичом, Кузьмичом). Остальные -ович/-евич/-ич — «-ем». */
const STRESSED_ICH = new Set(["ильич", "лукич", "кузьмич", "фомич"]);

export function declineName(name: string, c: Case, gender: Gender): string {
  const n = normalizeName(name);
  if (!n || c === "им") return n;
  // Латиница — как ввели, без русских окончаний (в анкете подсказываем написать по-русски)
  if (isLatinName(n)) return n;
  if (n.includes(" ")) {
    // Имя + отчество склоняются оба («Марии Ивановне», «Ивану Петровичу»); фамилия, частицы и инициалы — как есть
    const [first, ...rest] = n.split(/\s+/);
    return [declineName(first, c, gender), ...rest.map((w) => (isPatronymic(w) ? declineName(w, c, FEM_PATRONYMIC.test(w) ? "girl" : "boy") : w))].join(" ");
  }
  // Двойные имена: «Анна-Мария», «Жан-Поль»
  if (n.includes("-")) return n.split("-").map((p) => declineName(p, c, gender)).join("-");
  // Инициал или сокращение с точкой («К.») и имена с апострофом — не склоняем
  if (/[.']/.test(n) || n.length < 2) return n;
  const low = n.toLowerCase();
  const stem = n.slice(0, -1);
  const stem2 = n.slice(0, -2);

  // -ия: Мария, Наталия, Илия, Ия, Лия
  if (low.endsWith("ия")) {
    return { род: stem + "и", дат: stem + "и", вин: stem + "ю", тв: stem + "ей", пр: stem + "и" }[c];
  }
  // Иностранные на гласную + «а»: Франсуа, Гоа — не склоняются
  if (/[аоуэеиыю]а$/.test(low)) return n;
  // -а / -я: Маша, Лиза, Илья, Ваня, Никита (и мужские, и женские склоняются одинаково)
  if (low.endsWith("а") || low.endsWith("я")) {
    const soft = low.endsWith("я");
    const s = stem;
    const genA = SOFT_STEM.test(s) || soft ? "и" : "ы";
    const tvA = soft ? "ей" : HUSHING.test(s) ? "ей" : "ой";
    const datA = soft && low.endsWith("ья") ? "е" : "е";
    return { род: s + genA, дат: s + datA, вин: s + (soft ? "ю" : "у"), тв: s + (soft && STRESSED_YA.has(low) ? "ёй" : tvA), пр: s + "е" }[c];
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
  if (low === "павел") return cap(n, { род: "павла", дат: "павлу", вин: "павла", тв: "павлом", пр: "павле" }[c]);
  if (low === "пётр" || low === "петр") return cap(n, { род: "петра", дат: "петру", вин: "петра", тв: "петром", пр: "петре" }[c]);
  const masc = (s: string, tv = "ом") => ({ род: s + "а", дат: s + "у", вин: s + "а", тв: s + tv, пр: s + "е" })[c as Exclude<Case, "им">];
  // Беглое «е» в уменьшительных кличках: Пушочек → Пушочка, Дружочек → Дружочка, Цветочек → Цветочка
  if (low.length >= 6 && /[оеё][чш]ек$/.test(low)) return masc(n.slice(0, -2) + "к");
  // Беглое «о»: Котёнок → Котёнка, Мышонок → Мышонка
  if (low.length >= 6 && /[оё]нок$/.test(low)) return masc(n.slice(0, -2) + "к");
  // Беглое «о/ё» в кличках: Пушок → Пушка, Дружок → Дружка, Колобок → Колобка, Уголёк → Уголька
  if (low.length >= 5 && /[бвгджзклмнпрстфхцчшщ]ок$/.test(low)) return masc(n.slice(0, -2) + "к");
  if (low.length >= 5 && /[бвгджзклмнпрстфх]ёк$/.test(low)) return masc(n.slice(0, -2) + "ьк");
  // Ёж → Ежа, Ежом; Ёрш → Ерша
  if (YO_SHIFT[low]) return masc(cap(n, YO_SHIFT[low]), "ом");
  // Согласная: Марк, Иван, Глеб. После шипящей и «ц» творительный «-ем» (Игнатьевич-ем), под ударением — «-ом»:
  // отчества Ильич, Лукич, Кузьмич, Фомич → Ильичом; клички Малыш, Черныш, Чиж, Карандаш → Малышом.
  const plain = low.replace(/ё/g, "е");
  const stressed = STRESSED_ICH.has(plain) || STRESSED_HUSH.has(low) || STRESSED_HUSH.has(plain);
  return masc(n, HUSHING.test(low) && !stressed ? "ем" : "ом");
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
  return out.replace(/\{ГЕРОЙ\}/g, normalizeName(hero.name)).replace(/\{ЛАСКОВО\}/g, normalizeName(hero.nickname || hero.name));
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
/** Группа (детский сад, класс, команда): дети без героя и взрослые (воспитатели, учитель). */
export interface TagGroup {
  /** Дети группы, кроме героя, по порядку анкеты. */
  members: TagPerson[];
  /** Взрослые: «Мария Ивановна» (имя-отчество склоняется целиком). */
  adults?: TagPerson[];
  /**
   * Сколько слотов {ДРУГn} в книге (groupSlotCount(plot) в registry.ts). Если детей больше, чем слотов,
   * слот получает несколько детей подряд («Ваня, Петя и Оля»). Не задано — слот n = ребёнок n.
   */
  slots?: number;
}

export interface TagContext {
  hero: HeroNames;
  /** Доп. герои по порядку: ДОП1, ДОП2, ДОП3. */
  extras?: TagPerson[];
  /**
   * Повод для {ПОВОД} / {ПОВОД.падеж}: строка (одна форма на все падежи — «свой повод») или
   * падежные формы (occasionWord из src/content/occasions.ts).
   */
  occasion?: string | Partial<Record<Case, string>>;
  /** Возраст героя — для {ВОЗРАСТ}. */
  age?: number;
  /** Группа для {ГРУППА.*}, {ДРУГn.*}, {РДn:…}, {ВОСПИТАТЕЛЬn.*}, {ПЕРЕКЛИЧКА} и блоков [[?…: …]]. */
  group?: TagGroup;
}

function occasionForm(occ: TagContext["occasion"], c: Case): string {
  if (!occ) return "";
  if (typeof occ === "string") return occ;
  return occ[c] ?? occ.им ?? "";
}

export const joinRu = (xs: string[]) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " и " + xs.at(-1) : xs[0] ?? "");

// Подставленные значения помечаются служебными символами, чтобы после подстановки поправить предлог
// перед ними («о Ане» → «об Ане», «с Львом» → «со Львом») и поднять регистр в начале фразы.
const OPEN = "\u0001";
const CLOSE = "\u0002";
const mark = (v: string) => (v ? OPEN + v + CLOSE : "");

/** «о» → «об» перед а, о, у, э, и, ы (перед е, ё, ю, я — «о»: «о Юле», «о Яне»). */
const OB_BEFORE = /^[аоуэиыaouei]/i;
/** «с» → «со» перед стечением согласных: «со Львом», «со Всеволодом», «со Святославом», «со Стасом», «со Звездой». */
const SO_BEFORE = /^(?:[сзшжщ][бвгджзйклмнпрстфхцчшщ]|вс|вз|вт|льв|мн)/i;
/** «к» → «ко» — только «ко Всеволоду», «ко Мне»-подобные стечения. */
const KO_BEFORE = /^(?:вс|мн)/i;

/** Предлог перед значением по норме: «о» → «об Ане», «с» → «со Львом», «к» → «ко Всеволоду». Регистр предлога сохраняется. */
export function prepositionFor(prep: string, value: string): string {
  const low = prep.toLowerCase();
  const up = prep[0] !== prep[0].toLowerCase();
  let want = low;
  if (low === "о" || low === "об") want = OB_BEFORE.test(value) ? "об" : "о";
  else if (low === "с" || low === "со") want = SO_BEFORE.test(value) ? "со" : "с";
  else if (low === "к" || low === "ко") want = KO_BEFORE.test(value) ? "ко" : "к";
  else return prep;
  return up ? want[0].toUpperCase() + want.slice(1) : want;
}

function fixPrepositions(text: string) {
  return text.replace(
    new RegExp(`(?<![А-Яа-яЁё])(об|обо|о|со|с|ко|к) ${OPEN}([^${CLOSE}]*)${CLOSE}`, "gi"),
    (m, prep: string, value: string) => (prep.toLowerCase() === "обо" ? m : `${prepositionFor(prep, value)} ${OPEN}${value}${CLOSE}`),
  );
}

/** Значение метки в начале фразы, строки или цитаты — с заглавной («— Новоселье!», «Выход на пенсию — …»). */
function capitalizeStarts(text: string) {
  return text.replace(new RegExp(`(^|[.!?…]\\s+|\\n\\s*|[«"„]|^—\\s|\\n—\\s)${OPEN}(\\p{Ll})`, "gu"), (_m, pre: string, ch: string) => pre + OPEN + ch.toUpperCase());
}

// ---------------------------------------------------------------------------
// Группа: распределение детей по слотам, блоки-условия, списки
// ---------------------------------------------------------------------------

/** Больше стольких имён в одном перечислении — продолжение уходит в следующие фразы. */
export const LIST_MAX = 8;

/**
 * Дети по слотам {ДРУГ1..ДРУГS}: результат[i] — индексы детей в слоте i+1.
 *  M ≤ S: слот i — ребёнок i, слоты после M пустые (необязательные фразы выпадают);
 *  M > S: дети делятся на S подряд идущих кучек почти равного размера («Ваня, Петя и Оля»).
 * Так каждый ребёнок назван хотя бы раз и никто не назван дважды, пока не прозвучали все
 * (если слоты в книге идут по возрастанию номеров и каждый живёт в одном развороте — это проверяет validateContent).
 */
export function distributeMembers(members: number, slots: number): number[][] {
  const S = Math.max(0, Math.floor(slots));
  const M = Math.max(0, Math.floor(members));
  const out: number[][] = Array.from({ length: S }, () => []);
  if (!M || !S) return out;
  if (M <= S) {
    for (let i = 0; i < M; i++) out[i] = [i];
    return out;
  }
  for (let i = 0; i < S; i++) {
    const a = Math.floor((i * M) / S);
    const b = Math.floor(((i + 1) * M) / S);
    for (let k = a; k < b; k++) out[i].push(k);
  }
  return out;
}

/** Делит список на куски ≤ max почти равной длины: 9 → 5+4, 15 → 8+7, 39 → 8+8+8+8+7. */
export function chunkNames<T>(xs: T[], max = LIST_MAX): T[][] {
  if (xs.length <= max) return xs.length ? [xs] : [];
  const parts = Math.ceil(xs.length / max);
  const out: T[][] = [];
  for (let i = 0; i < parts; i++) out.push(xs.slice(Math.ceil((i * xs.length) / parts), Math.ceil(((i + 1) * xs.length) / parts)));
  return out;
}

/** Продолжения длинного перечисления — нейтральны к падежу («И Ване, Оле и Тимуру — тоже.»). */
const LIST_TAILS = ["И {X} — тоже.", "А ещё {X}.", "И, конечно, {X}.", "И {X} — тоже!", "А с ними {X}."];

/**
 * Перечисление, которое не душит фразу: до 8 имён — одной фразой («Ане, Пете и Маше»);
 * больше — первая часть в самой фразе, остальные — следующими фразами («И Ване, Оле и Тимуру — тоже.»).
 * Возвращает [в строку, хвостовые фразы]. Предлог перед списком (с, к, о, у…) повторяется в хвостах.
 */
export function flowingList(names: string[], prep = "", max = LIST_MAX, wrap: (s: string) => string = (x) => x): [string, string[]] {
  const chunks = chunkNames(names, max);
  if (!chunks.length) return ["", []];
  const p = prep ? prep.toLowerCase() + " " : "";
  return [joinRu(chunks[0]), chunks.slice(1).map((c, i) => LIST_TAILS[i % LIST_TAILS.length].replace("{X}", p + wrap(joinRu(c))))];
}

/** Как условие блока [[?…]] относится к группе. */
export interface GroupCounts {
  members: number;
  adults: number;
  slots?: number;
}

const BLOCK_RE = /\[\[\?([^:\]\n]+):\s?([\s\S]*?)\]\]/g;
const DROPPED = "\u0003";

/** Истинно ли условие блока: ДРУГn (у слота n есть свои дети), ГРУППА / ГРУППА>k / ГРУППА<k, ВОСПИТАТЕЛЬn, ВОСПИТАТЕЛИ / ВОСПИТАТЕЛИ>k. */
export function blockCondition(cond: string, g: GroupCounts): boolean {
  const c = cond.trim();
  let m = c.match(/^ДРУГ(\d+)$/);
  if (m) return (distributeMembers(g.members, g.slots ?? Math.max(g.members, Number(m[1])))[Number(m[1]) - 1]?.length ?? 0) > 0;
  m = c.match(/^ВОСПИТАТЕЛЬ(\d)?$/);
  if (m) return g.adults >= Number(m[1] ?? 1);
  m = c.match(/^(ГРУППА|ВОСПИТАТЕЛИ)(?:([<>])(\d+))?$/);
  if (m) {
    const n = m[1] === "ГРУППА" ? g.members : g.adults;
    if (!m[2]) return n >= 1;
    return m[2] === ">" ? n > Number(m[3]) : n < Number(m[3]);
  }
  return false;
}

/**
 * Раскрывает блоки [[?УСЛОВИЕ: текст]] и [[?УСЛОВИЕ: текст || иначе]] под размер группы.
 * Выпавший блок, занимавший целую строку (стихи), убирает и строку. Метки внутри не трогает —
 * так можно готовить план для модели (знает только число детей, без имён).
 */
export function resolveGroupBlocks(text: string, g: GroupCounts): string {
  if (!text.includes("[[?")) return text;
  const out = text.replace(BLOCK_RE, (_m, cond: string, body: string) => {
    const [then, ...rest] = body.split("||");
    const v = blockCondition(cond, g) ? then : rest.join("||");
    return v.trim() ? v.replace(/\s+$/, "") : DROPPED;
  });
  return out
    .split("\n")
    .filter((l) => !(l.includes(DROPPED) && !l.replace(new RegExp(DROPPED, "g"), "").trim()))
    .join("\n")
    .replace(new RegExp(DROPPED, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/^[ \t]+|[ \t]+$/gm, "");
}

/** Ведомость «Наш класс»: все имена через « · », герой — посередине (как на общей фотографии). */
export function rosterLine(heroName: string, members: string[]): string {
  const all = [...members];
  all.splice(Math.floor(all.length / 2), 0, heroName);
  return all.filter(Boolean).join(" · ");
}

/**
 * Полная подстановка меток (спецификация — docs/content/ARCHITECTURE.md):
 * {Р:м|ж(|ср)}, {Р1..3:…}, {МН:один|много}, {ДОПЫ.падеж}, {ПОВОД}, {ВОЗРАСТ},
 * {ГЕРОЙ.падеж}, {ЛАСКОВО.падеж}, {ДОП1..3.падеж}. Метки отсутствующих доп. героев удаляются.
 * После подстановки: «о/с/к» перед именем по норме («об Ане», «со Львом»), значение в начале фразы — с заглавной.
 */
export function fillTags(text: string, ctx: TagContext) {
  const extras = ctx.extras ?? [];
  const hero = ctx.hero;
  let out = text;
  if (ctx.group || /\[\[\?|\{(ДРУГ|РД|РВ|ГРУППА|МН_ГРУППЫ|ВОСПИТАТЕЛ|ПЕРЕКЛИЧКА)/.test(text)) out = fillGroup(out, ctx);
  out = applyGender(out, hero.gender);
  out = out.replace(/\{Р([1-3]):([^}]*)\}/g, (_, n: string, forms: string) => pickForm(forms, extras[Number(n) - 1]?.gender));
  out = out.replace(/\{МН:([^|}]*)\|([^}]*)\}/g, (_, one: string, many: string) => (extras.length > 1 ? many : one));
  out = out.replace(/\{ДОПЫ\.(им|род|дат|вин|тв|пр)\}/g, (_, c: Case) => mark(joinRu(extras.map((e) => declineName(e.name, c, e.gender)))));
  out = out.replace(/\{ДОПЫ\}/g, () => mark(joinRu(extras.map((e) => normalizeName(e.name)))));
  out = out.replace(/\{ПОВОД(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, c?: Case) => mark(occasionForm(ctx.occasion, c ?? "им")));
  out = out.replace(/\{ВОЗРАСТ\}/g, () => mark(ctx.age ? ageLabel(ctx.age) : ""));
  out = out.replace(/\{(ГЕРОЙ|ЛАСКОВО)(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, who: string, c?: Case) =>
    mark(declineName(who === "ЛАСКОВО" ? hero.nickname || hero.name : hero.name, c ?? "им", hero.gender)),
  );
  out = out.replace(/\{ДОП([1-3])(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, n: string, c?: Case) => {
    const e = extras[Number(n) - 1];
    return e ? mark(declineName(e.name, c ?? "им", e.gender)) : "";
  });
  out = capitalizeStarts(fixPrepositions(out));
  // Имя с точкой в конце («Саша К.») перед точкой предложения: «К..» → «К.» (многоточие «...» не трогаем)
  return out.replace(new RegExp(`[${OPEN}${CLOSE}]`, "g"), "").replace(/ {2,}/g, " ").replace(/(?<!\.)\.\.(?!\.)/g, ".");
}

/** Метки и блоки группы (часть fillTags). Значения помечены для правки предлогов и заглавных. */
function fillGroup(text: string, ctx: TagContext): string {
  const g = ctx.group ?? { members: [] };
  const members = g.members;
  const adults = g.adults ?? [];
  const M = members.length;
  const slots = g.slots ?? Math.max(M, 1);
  const dist = distributeMembers(M, slots);
  /** Дети слота n: свои, иначе — повтор по кругу (только после того, как прозвучали все). */
  const slot = (n: number): TagPerson[] => {
    const own = dist[n - 1];
    if (own?.length) return own.map((i) => members[i]);
    return M ? [members[(n - 1) % M]] : [];
  };
  const genderOf = (ps: TagPerson[]) => (ps.length > 1 ? "many" : ps[0]?.gender ?? (ps[0] ? guessGender(ps[0].name) : undefined));
  const pick3 = (forms: string, who: TagPerson[]) => {
    const [m, f = m, many = m] = forms.split("|");
    const gg = genderOf(who);
    return gg === "many" ? many : isFeminine(gg) ? f : m;
  };
  const dec = (p: TagPerson, c: Case) => declineName(p.name, c, p.gender ?? guessGender(p.name));

  let out = resolveGroupBlocks(text, { members: M, adults: adults.length, slots });
  out = out.replace(/\{РД(\d+):([^}]*)\}/g, (_, n: string, forms: string) => pick3(forms, slot(Number(n))));
  out = out.replace(/\{РВ(\d)?:([^}]*)\}/g, (_, n: string | undefined, forms: string) => pickForm(forms, adults[Number(n ?? 1) - 1]?.gender ?? guessGender(adults[Number(n ?? 1) - 1]?.name ?? "")));
  out = out.replace(/\{МН_ГРУППЫ:([^}]*)\}/g, (_, forms: string) => pick3(forms, members));
  out = out.replace(/\{ПЕРЕКЛИЧКА\}/g, () => mark(rosterLine(normalizeName(ctx.hero.name), members.map((p) => normalizeName(p.name)))));
  out = out.replace(/\{ДРУГ(\d+)(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, n: string, c?: Case) => mark(joinRu(slot(Number(n)).map((p) => dec(p, c ?? "им")))));
  out = out.replace(/\{ВОСПИТАТЕЛЬ(\d)?(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, n: string | undefined, c?: Case) => {
    const a = adults[Number(n ?? 1) - 1];
    return a ? mark(dec(a, c ?? "им")) : "";
  });
  out = out.replace(/\{ВОСПИТАТЕЛИ(?:\.(им|род|дат|вин|тв|пр))?\}/g, (_, c?: Case) => mark(joinRu(adults.map((a) => dec(a, c ?? "им")))));
  // {ГРУППА.падеж}: длинный список — первая часть во фразе, остальное — хвостами после конца этой фразы
  const re = /(?:(?<![А-Яа-яЁё])(с|со|к|ко|о|об|у|от|для|про|при|за|над|перед|между|без|до|из|по)\s)?\{ГРУППА(?:\.(им|род|дат|вин|тв|пр))?\}/i;
  for (let m = out.match(re); m && m.index !== undefined; m = out.match(re)) {
    const prep = m[1] ?? "";
    const [head, rest] = flowingList(members.map((p) => dec(p, (m![2] as Case) ?? "им")), prep, LIST_MAX, mark);
    const put = (prep ? prep + " " : "") + mark(head);
    out = out.slice(0, m.index) + put + out.slice(m.index + m[0].length);
    if (!rest.length) continue;
    const from = m.index + put.length;
    const tail = out.slice(from);
    const end = tail.match(/[.!?…]+(?:»|")?(?=\s|$)/);
    const cut = end?.index !== undefined ? from + end.index + end[0].length : out.length;
    out = out.slice(0, cut) + " " + rest.join(" ") + out.slice(cut);
  }
  return out;
}
