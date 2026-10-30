// Список группы (детсад, класс): быстрый ввод — вставить имена списком, пол угадывается по имени
// (Саша, Женя, Валя… — спрашиваем), проверка пустых, повторов и длины. Безопасно для клиента.
import { guessGender } from "./declension";

export type RosterGender = "boy" | "girl";

export interface RosterItem {
  name: string;
  /** Угаданный или указанный пол; для неоднозначных имён — пусто, пока покупатель не выберет. */
  gender?: RosterGender;
  /** Имя бывает и мальчика, и девочки — нужно выбрать вручную. */
  ambiguous: boolean;
}

/** Уменьшительные, которые бывают и у мальчиков, и у девочек. */
const AMBIGUOUS = new Set(["sasha", "zhenya", "zhenia", "valya", "valia", "slava", "shura", "alex", "sam", "nikki", "саша", "женя", "валя", "шура", "слава", "сеня", "стася", "мика", "ники", "нико", "лёля", "леля", "тоша", "вася", "сима"]);
/** Однозначные исключения из правила «на -а/-я — девочка» (плюс список guessGender). */
const BOY_A = new Set(["илья", "никита", "кузьма", "фома", "лука", "савва", "данила", "гаврила", "миша", "паша", "гоша", "лёша", "алёша", "ваня", "петя", "дима", "витя", "толя", "коля", "серёжа", "сережа", "юра", "федя", "тёма", "тема", "тима", "лёва", "лева", "вова", "костя", "стёпа", "степа", "гриша", "боря", "саня", "сёма", "сема", "яша", "лёня", "леня", "матвей", "добрыня", "ерёма", "ростя", "владя", "алёша", "миля", "жора", "гена", "веня", "мотя", "кеша", "лёва"]);
const GIRL_CONSONANT = new Set(["любовь", "эстер", "рахиль", "мирьям", "нинель", "суламифь", "эсфирь", "ассоль", "адель", "жизель", "нонна"]);

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, "е");

/** Пол по имени ребёнка: null — неоднозначно (Саша, Женя, Валя…) или непонятно (иностранное на -и/-о/-у). */
export function guessChildGender(name: string): RosterGender | null {
  const first = name.trim().split(/[\s-]+/)[0] ?? "";
  const low = first.toLowerCase();
  if (!low) return null;
  if (AMBIGUOUS.has(low) || AMBIGUOUS.has(norm(low))) return null;
  if (BOY_A.has(low) || BOY_A.has(norm(low))) return "boy";
  if (GIRL_CONSONANT.has(low)) return "girl";
  if (/[ая]$/.test(low)) return "girl";
  if (/[иоуэюе]$/.test(low)) return null; // Лео, Ники, Рене — не угадываем
  return guessGender(first);
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/** Пометка пола в строке: «Аня (ж)», «Женя м», «Саша — девочка». */
const MARK = /(?:\s+|\s*[([—–-]\s*)(м|ж|мальчик|девочка|мал\.?|дев\.?)\s*[)\]]?\s*$/i;

/**
 * Разбор вставленного списка: по строкам, запятым или «;». Номера («1.», «2)»), маркеры («-», «•») и лишние пробелы
 * убираются, первая буква — заглавная. Пол — из пометки «(м)/(ж)» или по имени.
 */
export function parseNames(text: string): RosterItem[] {
  const parts = text
    .replace(/\r/g, "")
    .split(/[\n,;]+/)
    .map((x) => x.replace(/^\s*(\d+[.)]|[-•*·—–])\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.map((raw) => {
    let gender: RosterGender | undefined;
    let name = raw;
    const m = raw.match(MARK);
    if (m && raw.length > m[0].length) {
      gender = /^(м|мал)/i.test(m[1]) ? "boy" : "girl";
      name = raw.slice(0, raw.length - m[0].length).trim();
    }
    name = name.split(" ").map(cap).join(" ");
    const g = gender ?? guessChildGender(name) ?? undefined;
    return { name, gender: g, ambiguous: !gender && !g };
  });
}

export interface RosterIssue {
  index: number;
  kind: "empty" | "long" | "duplicate" | "gender" | "hero";
  message: string;
}

/**
 * Проверка списка детей: пустые имена, длиннее 30 символов, повторы (без учёта регистра и ё/е; совпадение с героем),
 * невыбранный пол у неоднозначных имён. Повтор — это разные дети с одним именем: просим уточнить («Саша К.»).
 */
export function rosterIssues(members: { name: string; gender?: string }[], opts: { heroName?: string; max?: number } = {}): RosterIssue[] {
  const out: RosterIssue[] = [];
  const seen = new Map<string, number>();
  const hero = opts.heroName ? norm(opts.heroName) : "";
  members.forEach((m, i) => {
    const n = norm(m.name ?? "");
    if (!n) return out.push({ index: i, kind: "empty", message: `Строка ${i + 1}: впишите имя или уберите строку` });
    if (m.name.trim().length > 30) out.push({ index: i, kind: "long", message: `«${m.name.slice(0, 30)}…» — не длиннее 30 символов` });
    if (hero && n === hero) out.push({ index: i, kind: "hero", message: `${m.name} — это имя героя книги. Если это другой ребёнок, добавьте первую букву фамилии: «${cap(m.name.trim())} К.»` });
    else if (seen.has(n)) out.push({ index: i, kind: "duplicate", message: `${m.name} — уже есть в списке. Чтобы различать детей, добавьте букву фамилии: «${cap(m.name.trim())} К.»` });
    seen.set(n, i);
    if (!m.gender) out.push({ index: i, kind: "gender", message: `${m.name}: мальчик или девочка?` });
  });
  if (opts.max !== undefined && members.length > opts.max) out.push({ index: opts.max, kind: "long", message: `В этой книге — до ${opts.max} детей кроме героя` });
  return out;
}

/** Взрослый группы: пол по отчеству («Мария Ивановна»), иначе по имени. */
export const adultGender = (name: string): RosterGender => guessGender(name);

/**
 * Вставка списка в группу с лимитом: сколько поместилось и кто не поместился. Не помещается — не молчим:
 * сообщение с лимитом группы и именами, которые не добавлены (они остаются в поле вставки для правки).
 */
export function addWithLimit<T extends { name: string }>(current: number, parsed: T[], maxKids: number, groupLabel: string) {
  const room = Math.max(0, maxKids - current);
  const added = parsed.slice(0, room);
  const overflow = parsed.slice(room);
  const where = groupLabel === "класс" ? "В классе" : groupLabel === "команда" ? "В команде" : "В группе детского сада";
  const message = overflow.length
    ? `${where} — до ${maxKids + 1} детей вместе с героем; лишние имена не добавлены: ${overflow.map((x) => x.name).join(", ")}. Они остались в поле вставки: освободите место в списке ниже и добавьте снова.`
    : null;
  return { added, overflow, message };
}
