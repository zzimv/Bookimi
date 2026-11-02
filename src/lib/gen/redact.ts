// Обезличивание свободного текста анкеты перед отправкой во внешние сервисы текста и иллюстраций (YandexGPT, Qwen).
// Имена героя, домашнего имени и доп. героев во всех падежах и ласковых формах заменяются:
//  • в брифе модели — метками {ГЕРОЙ.падеж}, {ЛАСКОВО.падеж}, {ДОПn.падеж} (модель пишет метки, имена ставим мы);
//  • в промпте картинок — нейтральными словами роли: «the hero», «the friend».
// Телефоны, почта, ссылки, @ники и длинные числа удаляются. Без Node API (собирается и в демо-стенд).
import { CASES, declineName, guessGender, isPatronymic, type Case } from "../declension";

export interface RedactPerson {
  /** Метка без падежа: ГЕРОЙ, ЛАСКОВО, ДОП1… */
  tag: string;
  name: string;
  gender?: string;
  /** Слово для промпта картинки: «the hero», «the friend». */
  role: string;
  /**
   * Вместо метки в брифе — нейтральное слово (дети группы: слот {ДРУГn} зависит от размера группы,
   * поэтому имя ребёнка из свободного текста становится «друг из группы»).
   */
  textWord?: string;
}

/** Частые пары «полное имя ↔ домашние формы» (в обе стороны). */
const NAME_GROUPS: string[][] = [
  ["Анна", "Аня", "Анечка", "Анюта", "Аннушка", "Нюра"],
  ["Мария", "Маша", "Машенька", "Маруся", "Машуля"],
  ["Александр", "Александра", "Саша", "Сашенька", "Шура", "Саня"],
  ["Илья", "Илюша", "Илюшка"],
  ["Игорь", "Игорёк", "Игорюша", "Гоша"],
  ["Георгий", "Гоша", "Жора", "Гошенька"],
  ["Любовь", "Люба", "Любочка", "Любаша"],
  ["Лев", "Лёва", "Лёвушка", "Лёвочка"],
  ["Иван", "Ваня", "Ванечка", "Ванюша"],
  ["Дмитрий", "Дима", "Димочка", "Митя"],
  ["Михаил", "Миша", "Мишенька", "Мишутка"],
  ["Екатерина", "Катя", "Катенька", "Катюша"],
  ["Елена", "Лена", "Леночка"],
  ["Ольга", "Оля", "Оленька"],
  ["Наталья", "Наталия", "Наташа", "Наташенька"],
  ["Татьяна", "Таня", "Танечка", "Танюша"],
  ["Сергей", "Серёжа", "Серёженька"],
  ["Алексей", "Лёша", "Алёша", "Лёшенька"],
  ["Никита", "Никитка", "Никитушка"],
  ["Юлия", "Юля", "Юленька"],
  ["Яна", "Яночка"],
  ["Всеволод", "Сева", "Севушка"],
  ["Станислав", "Стас", "Стасик"],
  ["Святослав", "Слава", "Славик"],
  ["Владислав", "Влад", "Владик"],
  ["Евгений", "Евгения", "Женя", "Женечка"],
  ["Анастасия", "Настя", "Настенька"],
  ["Дарья", "Даша", "Дашенька"],
  ["Софья", "София", "Соня", "Сонечка"],
  ["Елизавета", "Лиза", "Лизонька"],
  ["Ксения", "Ксюша"],
  ["Варвара", "Варя", "Варенька"],
  ["Полина", "Поля", "Полечка"],
  ["Виктория", "Вика", "Викуля"],
  ["Артём", "Тёма", "Тёмочка"],
  ["Максим", "Макс", "Максимка"],
  ["Тимофей", "Тимоша", "Тима"],
  ["Матвей", "Мотя", "Матвейка"],
  ["Фёдор", "Федя", "Феденька"],
  ["Павел", "Паша", "Павлик"],
  ["Пётр", "Петя", "Петенька"],
  ["Николай", "Коля", "Коленька"],
  ["Константин", "Костя", "Костенька"],
  ["Андрей", "Андрюша", "Андрюшка"],
  ["Владимир", "Володя", "Вова", "Вовочка"],
  ["Галина", "Галя", "Галочка"],
  ["Людмила", "Люда", "Людочка"],
  ["Надежда", "Надя", "Наденька"],
  ["Вера", "Верочка"],
  // Частые клички питомцев и их домашние формы
  ["Мурка", "Мура", "Муся", "Мурочка", "Мурёнок", "Мурзик"],
  ["Пушок", "Пушистик", "Пушка", "Пушочек", "Пуша"],
  ["Барсик", "Барс", "Барсюша"],
  ["Рыжик", "Рыжий", "Рыжуля"],
  ["Снежок", "Снежка", "Снежинка"],
];

/** Имена, совпадающие с обычными словами: ищем только с заглавной буквы («любовь к морю» не трогаем). */
const COMMON_WORDS = new Set(["любовь", "лев", "вера", "надежда", "роза", "мира", "слава", "лада", "заря", "люба", "надя", "майя", "марка", "лёва", "пушок", "дружок", "соня", "вика", "тёма", "рыжий", "рыжик", "рыжуля", "пушка", "пуша", "снежка", "снежинка", "снежок", "барс", "мура", "муся"]);

const L = "А-Яа-яЁё";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Form {
  word: string;
  person: RedactPerson;
  case: Case;
  /** Ласковая/другая форма имени — в брифе метка ЛАСКОВО (для героя). */
  variant: boolean;
}

/** Все падежные формы имени: [форма, падеж]. */
function caseForms(name: string, gender?: string): [string, Case][] {
  const g = gender ?? guessGender(name);
  return CASES.map((c) => [declineName(name, c, g), c] as [string, Case]);
}

/** Имя + домашние формы из таблицы (для «Аня» — «Анна», «Анечка»…). */
function variantsOf(name: string): string[] {
  const low = name.trim().toLowerCase();
  const group = NAME_GROUPS.find((g) => g.some((x) => x.toLowerCase() === low));
  return group ? group.filter((x) => x.toLowerCase() !== low) : [];
}

function formsFor(persons: RedactPerson[]): Form[] {
  const forms: Form[] = [];
  for (const p of persons) {
    const name = p.name.trim();
    if (name.length < 2) continue;
    for (const [word, c] of caseForms(name, p.gender)) forms.push({ word, person: p, case: c, variant: false });
    // «Мария Ивановна», «Анна-Мария»: части по отдельности («спросили Марию», «Ивановна сказала», «Мария»)
    const words = name.split(/[\s-]+/).filter((w) => w.length >= 2);
    if (words.length > 1) for (const w of words) for (const [word, c] of caseForms(w, isPatronymic(w) ? guessGender(`x ${w}`) : p.gender)) forms.push({ word, person: p, case: c, variant: false });
    // Домашние формы имени и частей двойного имени («Аня», «Маша» для «Анна-Мария»)
    const vars = new Set([...variantsOf(name), ...(words.length > 1 ? words.filter((w) => !isPatronymic(w)).flatMap(variantsOf) : [])]);
    for (const v of vars) for (const [word, c] of caseForms(v, guessGender(v))) forms.push({ word, person: p, case: c, variant: true });
  }
  return forms;
}

/** Регулярное выражение «слово целиком» для формы имени: с заглавной — всегда, со строчной — если это не обычное слово. */
function formRe(word: string) {
  const ci = !COMMON_WORDS.has(word.toLowerCase());
  return new RegExp(`(?<![${L}A-Za-z])${escape(word)}(?![${L}])`, ci ? "giu" : "gu");
}

/** «ё» в имени совпадает и с «е» (Пётр — Петруша, Лёва — Левушка). */
const yoLoose = (s: string) => escape(s).replace(/[ёеЁЕ]/g, (c) => (c === c.toUpperCase() ? "[ЁЕ]" : "[ёе]"));

/** Основы имени для ласковых форм: «Илья» → «Иль», «Ил»; «Маша» → «Маш»; «Пётр» → «Пётр». */
function stemsOf(name: string): string[] {
  const n = name.trim();
  const out = new Set<string>();
  for (const re of [/[аяьйоеёиыую]$/i, /(?:ья|ия|ея|ий|ей|ь)$/i, /[ьй]?[аяоеёиыую]$/i]) {
    const s = n.replace(re, "");
    if (s.length >= 2) out.add(s);
  }
  return [...out];
}

/** Окончания на -а в падежах (Машка, Машки, Машке, Машку, Машкой). */
const A_END = "(?:а|и|ы|е|у|ой|ою)";

/**
 * Ласковые и разговорные формы, которых нет в таблице: «Маркуша», «Марусечка» (суффиксы), «Машка», «Петька»,
 * «Илюха», «Ильюха» (-ка/-ька/-юха/-уха — с падежами), притяжательные «Машин», «Натальин», «Илюшин»
 * (только с заглавной: «машина», «машинка» остаются).
 */
function diminutiveRes(name: string): { re: RegExp; possessive?: boolean }[] {
  const res: { re: RegExp; possessive?: boolean }[] = [];
  const ci = !COMMON_WORDS.has(name.toLowerCase());
  const fl = ci ? "giu" : "gu";
  const pre = `(?<![${L}A-Za-z])`;
  const post = `(?![${L}])`;
  for (const stem of stemsOf(name)) {
    const s = yoLoose(stem);
    res.push({ re: new RegExp(`${pre}${s}(?:ечк|еньк|оньк|ушк|юшк|очк|юш|уш|ул|ус|ют|ик|ёк|ок)[${L}]{0,3}${post}`, fl) });
    // -ка/-ька/-юха/-уха — только с заглавной: иначе «танки», «полка», «петуха» приняли бы за имена
    res.push({ re: new RegExp(`${pre}${s}(?:ьк|юх|ух|${stem.length >= 3 ? "к|" : ""}х)${A_END}${post}`, "gu") });
  }
  // Притяжательные: имя без -а/-я + «ин» с окончаниями (Машин, Машина, Машиной, Натальин, Илюшино) — только с заглавной
  const n = name.trim();
  if (/[ая]$/i.test(n) && n.length >= 3) res.push({ re: new RegExp(`${pre}${yoLoose(n.slice(0, -1))}ин(?:а|о|у|ы|ой|ою|ом|ому|ым|ых|ыми|ую|е)?${post}`, "gu"), possessive: true });
  return res;
}

/** Указатели соцсетей и мессенджеров перед ником: «tg mashka2018», «инста masha_kot», «вк: masha». */
const SOCIAL = "(?:tg|тг|телега|телеграм\\p{L}*|telegram|инст\\p{L}*|insta\\p{L}*|ig|вк|vk|вконтакте|ник|nick|тикток|tiktok|ютуб\\p{L}*|youtube|whatsapp|ватсап|вотсап|viber|вайбер)";
/** Доменные зоны, в т. ч. кириллические. */
const TLD = "(?:ru|рф|рус|москва|дети|орг|ком|com|net|org|su|me|io|info|online|site|pro|by|kz|ua|app|dev|tv|cc|link)";
const DOMAIN_RE = new RegExp(`(?<![\\p{L}\\p{N}_.-])[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.${TLD}(?![\\p{L}\\p{N}])(?:\\/\\S*)?`, "giu");
const SOCIAL_RE = new RegExp(`(?<![\\p{L}])${SOCIAL}(?![\\p{L}])[\\s:—–-]*@?[A-Za-z0-9_.]{3,}`, "giu");

/**
 * Телефоны, почта (и кириллическая: маша@почта.рф), ссылки, домены (и .рф), @ники, ники после «tg/инста/вк»
 * и латинские ники с цифрами («mashka2018»), длинные числа (≥ 6 цифр) — удаляем.
 */
export function stripContacts(text: string): string {
  return text
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, "")
    .replace(/(?:https?:\/\/|www\.)\S+/giu, "")
    .replace(DOMAIN_RE, "")
    .replace(/(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.]{3,}/gu, "")
    .replace(SOCIAL_RE, "")
    .replace(/(?<![\p{L}\p{N}_])[A-Za-z][A-Za-z_.]{2,}\d{2,}[A-Za-z0-9_]*(?![\p{L}\p{N}_])/gu, "")
    .replace(/(?:\+\s*\d[\d\s()\-]{8,}\d)|(?:\d[\d\s()\-]{8,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 6 ? "" : m))
    .replace(/\d{6,}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/[,;:]+(?=\s*[.!?]|$)/g, "")
    .trim();
}

/** Имя, части двойного имени и домашние формы каждой («Анна-Мария» → Анна, Мария, Аня, Маша…). */
function baseNames(name: string): string[] {
  const n = name.trim();
  const parts = n.split(/[\s-]+/).filter((w) => w.length >= 2 && !isPatronymic(w));
  return [...new Set([n, ...parts].flatMap((x) => [x, ...variantsOf(x)]))];
}

function replaceNames(text: string, persons: RedactPerson[], put: (f: Form) => string, dimPut: (p: RedactPerson, possessive?: boolean) => string) {
  // Длинные формы — первыми («Анечка» раньше «Ан…», «Александра» раньше «Александр»)
  const forms = formsFor(persons).sort((x, y) => y.word.length - x.word.length);
  let out = text;
  const seen = new Set<string>();
  for (const f of forms) {
    const key = f.word.toLowerCase();
    if (seen.has(key)) continue; // одинаковая форма у нескольких людей / падежей — первая (герой, род. п.)
    seen.add(key);
    out = out.replace(formRe(f.word), () => put(f));
  }
  for (const p of persons) {
    const all = baseNames(p.name).flatMap(diminutiveRes);
    // Притяжательные — первыми: «Илюшин» иначе съест суффикс «-юш…» от «Илья»
    for (const d of [...all.filter((x) => x.possessive), ...all.filter((x) => !x.possessive)]) out = out.replace(d.re, () => dimPut(p, d.possessive));
  }
  return out;
}

/** Свободный текст для брифа модели: имена → метки, контакты удалены. */
export function redactForText(text: string | undefined | null, persons: RedactPerson[]): string {
  if (!text) return "";
  // Ласковая форма имени героя → {ЛАСКОВО.*} (без домашнего имени fillTags подставит имя)
  const tagOf = (p: RedactPerson, variant: boolean) => (variant && p.tag === "ГЕРОЙ" ? "ЛАСКОВО" : p.tag);
  return replaceNames(
    stripContacts(text),
    persons,
    (f) => f.person.textWord ?? `{${tagOf(f.person, f.variant)}.${f.case}}`,
    // Притяжательное «Машин» → «{ГЕРОЙ.род}» («бантик Маши» — порядок слов модель поправит)
    (p, possessive) => p.textWord ?? (possessive ? `{${p.tag}.род}` : `{${tagOf(p, true)}.им}`),
  );
}

/** Свободный текст для промпта картинки: имена → «the hero» / «the friend», контакты удалены. */
export function redactForImage(text: string | undefined | null, persons: RedactPerson[]): string {
  if (!text) return "";
  return replaceNames(stripContacts(text), persons, (f) => f.person.role, (p, possessive) => (possessive ? `${p.role}'s` : p.role)).replace(/\s{2,}/g, " ").trim();
}

const ROLE_WORD: Record<string, string> = {
  sibling: "the sibling",
  mom: "the mother",
  dad: "the father",
  grandma: "the grandmother",
  grandpa: "the grandfather",
  pet: "the pet",
  partner: "the partner",
  friend: "the friend",
  toy: "the toy",
  child: "the child",
  grandchild: "the grandchild",
  owner: "the owner",
  colleague: "the colleague",
  custom: "the companion",
};

interface AnswersLike {
  hero: { name: string; nickname?: string; gender?: string };
  extras: { name: string; role: string; gender?: string }[];
  /** Группа (детсад, класс): дети → {ДРУГn}, взрослые → {ВОСПИТАТЕЛЬn}. */
  group?: { members: { name: string; gender?: string }[]; adults: { name: string; role?: string; gender?: string }[] };
}

const ADULT_ROLE_WORD: Record<string, string> = { воспитатель: "the kindergarten teacher", "помощник воспитателя": "the teacher's assistant", учитель: "the teacher" };

/**
 * Люди анкеты для обезличивания: герой, домашнее имя, доп. герои (ДОП1..3), дети группы (ДРУГn — по порядку
 * анкеты; в брифе модели слоты уже раскрыты под размер группы) и взрослые группы (ВОСПИТАТЕЛЬn).
 */
export function personsOf(a: AnswersLike, extraGender?: (e: AnswersLike["extras"][number]) => string): RedactPerson[] {
  const list: RedactPerson[] = [{ tag: "ГЕРОЙ", name: a.hero.name, gender: a.hero.gender, role: "the hero" }];
  if (a.hero.nickname?.trim() && a.hero.nickname.trim() !== a.hero.name.trim()) list.push({ tag: "ЛАСКОВО", name: a.hero.nickname, gender: a.hero.gender, role: "the hero" });
  a.extras.forEach((e, i) => list.push({ tag: `ДОП${i + 1}`, name: e.name, gender: extraGender ? extraGender(e) : e.gender, role: ROLE_WORD[e.role] ?? "the companion" }));
  a.group?.members.forEach((m, i) => list.push({ tag: `ДРУГ${i + 1}`, name: m.name, gender: m.gender, role: "a child from the group", textWord: "друг из группы" }));
  a.group?.adults.forEach((m, i) => list.push({ tag: `ВОСПИТАТЕЛЬ${i + 1}`, name: m.name, gender: m.gender ?? guessGender(m.name), role: ADULT_ROLE_WORD[m.role ?? ""] ?? "the teacher" }));
  return list;
}
