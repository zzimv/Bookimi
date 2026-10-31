// «Ближайшие праздники»: правила дат, ближайшая дата (по Москве), срок заказа печатной книги, дни рождения героев.
// Чистые функции без БД — безопасно для клиента (редактор в админке, демо-стенд) и покрыто тестами.
// Список праздников хранится в настройке `holidays` (таблица Setting, JSON) — см. src/lib/holidays.ts.
import { z } from "zod";
import "./zod-ru";

/** Правило даты: каждый год (день-месяц), разовая дата, N-й день недели месяца, «всегда» (дни рождения). */
export type HolidayRule =
  | { kind: "fixed"; month: number; day: number }
  | { kind: "date"; date: string } // ГГГГ-ММ-ДД, один раз (праздник «плавает» — дату обновляют каждый год)
  | { kind: "nth"; month: number; weekday: number; n: number } // weekday: 1 = пн … 7 = вс; n: 1–4 или -1 (последний)
  | { kind: "always" };

export interface Holiday {
  id: string;
  title: string;
  /** Ключ повода (OCCASIONS) — для каталога, анкеты и крючков; можно новый. */
  occasionKey: string;
  rule: HolidayRule;
  /** За сколько календарных дней до праздника заказать печать; null — посчитать (печать + доставка из настроек). */
  giftDeadlineDays: number | null;
  /** Показывать за столько дней до даты. */
  showFromDays: number;
  description: string;
  /** Книги на карточке; пусто — книги к поводу из каталога. */
  bookSlugs: string[];
  active: boolean;
  sortOrder: number;
}

/** Сроки: печать (рабочие дни) + доставка (календарные дни). По умолчанию — 5 раб. дней + 7 дней СДЭК. */
export interface LeadTimes {
  productionDays: number;
  deliveryDays: number;
}
export const DEFAULT_LEAD: LeadTimes = { productionDays: 5, deliveryDays: 7 };

export const DEFAULT_HOLIDAYS: Holiday[] = [
  {
    id: "novyj-god",
    title: "Новый год",
    occasionKey: "novyj-god",
    rule: { kind: "fixed", month: 12, day: 31 },
    giftDeadlineDays: null,
    showFromDays: 90,
    description: "Главный зимний праздник: книга под ёлку для ребёнка, подростка, любимого человека — и даже для кота.",
    bookSlugs: [],
    active: true,
    sortOrder: 10,
  },
  {
    id: "rozhdestvo",
    title: "Рождество",
    occasionKey: "rozhdestvo",
    rule: { kind: "fixed", month: 1, day: 7 },
    giftDeadlineDays: null,
    showFromDays: 90,
    description: "Тихий семейный праздник 7 января: тёплая зимняя история с огоньками в окнах и снегом за окном.",
    bookSlugs: [],
    active: true,
    sortOrder: 20,
  },
  {
    id: "staryj-novyj-god",
    title: "Старый Новый год",
    occasionKey: "staryj-novyj-god",
    rule: { kind: "fixed", month: 1, day: 14 },
    giftDeadlineDays: null,
    showFromDays: 90,
    description: "Праздник продолжается: 14 января — повод порадовать тех, кого не успели поздравить под бой курантов.",
    bookSlugs: [],
    active: true,
    sortOrder: 30,
  },
  {
    id: "dni-rozhdeniya",
    title: "Дни рождения",
    occasionKey: "den-rozhdeniya",
    rule: { kind: "always" },
    giftDeadlineDays: null,
    showFromDays: 365,
    description: "Самый личный праздник — в любой день года. Книга, где именинник — главный герой.",
    bookSlugs: [],
    active: true,
    sortOrder: 40,
  },
];

/** Текущий список в браузере (демо-стенд подменяет items своим хранилищем); на сайте — запасной вариант без БД. */
export const HOLIDAY_STORE: { items: Holiday[] } = { items: DEFAULT_HOLIDAYS };

// ───────── календарь: день = номер суток от 1970-01-01 (UTC-полночь календарной даты) ─────────

const DAY = 86400_000;
export type Day = number;
export const dayOf = (y: number, m: number, d: number): Day => Date.UTC(y, m - 1, d) / DAY;
export function partsOf(day: Day) {
  const t = new Date(day * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() || 7 }; // wd: 1 = пн … 7 = вс
}
/** Сегодня по Москве (UTC+3, без перехода на летнее время). */
export const mskToday = (now: Date = new Date()): Day => Math.floor((now.getTime() + 3 * 3600_000) / DAY);
export const dayFromIso = (s: string): Day | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = dayOf(+m[1], +m[2], +m[3]);
  const p = partsOf(d);
  return p.y === +m[1] && p.m === +m[2] && p.d === +m[3] ? d : null;
};
export const isoOf = (day: Day) => new Date(day * DAY).toISOString().slice(0, 10);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Нерабочие праздничные дни РФ (ТК РФ ст. 112) + 31 декабря (последние годы — выходной по постановлению).
 * Переносы выходных по постановлениям Правительства не учитываем — срок получается с запасом.
 */
const RU_NON_WORKING = new Set(["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04", "12-31"]);
export function isWorkday(day: Day) {
  const p = partsOf(day);
  if (p.wd >= 6) return false;
  return !RU_NON_WORKING.has(`${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`);
}
export function minusWorkdays(day: Day, n: number): Day {
  let x = day;
  while (n > 0) {
    x--;
    if (isWorkday(x)) n--;
  }
  return x;
}

/** Последний день заказа печатной книги: −доставка (календарные дни) −печать (рабочие дни) либо −N дней вручную. */
export function orderDeadline(date: Day, giftDeadlineDays: number | null, lead: LeadTimes = DEFAULT_LEAD): Day {
  if (giftDeadlineDays != null) return date - giftDeadlineDays;
  return minusWorkdays(date - lead.deliveryDays, lead.productionDays);
}
/** Примерно сколько календарных дней нужно печатной книге (для «всегда»: дни рождения). */
export const leadCalendarDays = (lead: LeadTimes = DEFAULT_LEAD) => lead.deliveryDays + Math.ceil((lead.productionDays * 7) / 5);

/** Дата праздника в году y (null — в этом году нет). */
export function occurrence(rule: HolidayRule, y: number): Day | null {
  switch (rule.kind) {
    case "fixed":
      return dayOf(y, rule.month, Math.min(rule.day, daysInMonth(y, rule.month)));
    case "date": {
      const d = dayFromIso(rule.date);
      return d != null && partsOf(d).y === y ? d : null;
    }
    case "nth": {
      if (rule.n === -1) {
        let d = dayOf(y, rule.month, daysInMonth(y, rule.month));
        while (partsOf(d).wd !== rule.weekday) d--;
        return d;
      }
      let d = dayOf(y, rule.month, 1);
      while (partsOf(d).wd !== rule.weekday) d++;
      d += (rule.n - 1) * 7;
      return partsOf(d).m === rule.month ? d : null;
    }
    case "always":
      return null;
  }
}

/** Ближайшая дата праздника, начиная с сегодняшнего дня (сегодня — тоже «ближайшая»). */
export function nextDate(rule: HolidayRule, today: Day): Day | null {
  if (rule.kind === "always") return null;
  if (rule.kind === "date") {
    const d = dayFromIso(rule.date);
    return d != null && d >= today ? d : null;
  }
  const y = partsOf(today).y;
  for (const yy of [y, y + 1, y + 2]) {
    const d = occurrence(rule, yy);
    if (d != null && d >= today) return d;
  }
  return null;
}

export interface HolidayCalc {
  holiday: Holiday;
  /** null — «всегда» или разовая дата уже прошла. */
  date: Day | null;
  daysLeft: number | null;
  deadline: Day | null;
  /** Печатная книга успевает к дате. */
  printOk: boolean;
  /** Показывать на витрине сейчас. */
  visible: boolean;
}

export function computeHoliday(h: Holiday, now: Date = new Date(), lead: LeadTimes = DEFAULT_LEAD): HolidayCalc {
  const today = mskToday(now);
  if (h.rule.kind === "always") return { holiday: h, date: null, daysLeft: null, deadline: null, printOk: true, visible: h.active };
  const date = nextDate(h.rule, today);
  if (date == null) return { holiday: h, date: null, daysLeft: null, deadline: null, printOk: false, visible: false };
  const deadline = orderDeadline(date, h.giftDeadlineDays, lead);
  const daysLeft = date - today;
  return { holiday: h, date, daysLeft, deadline, printOk: today <= deadline, visible: h.active && daysLeft <= h.showFromDays };
}

/** Праздники для витрины: видимые сейчас, по ближайшей дате; «всегда» (дни рождения) — в конце. */
export function upcomingHolidays(list: Holiday[], now: Date = new Date(), lead: LeadTimes = DEFAULT_LEAD): HolidayCalc[] {
  return list
    .map((h) => computeHoliday(h, now, lead))
    .filter((c) => c.visible)
    .sort((a, b) => (a.daysLeft ?? 1e6) - (b.daysLeft ?? 1e6) || a.holiday.sortOrder - b.holiday.sortOrder);
}

/** Ближайший праздник с датой (для кнопки на главной и полосы промо). */
export function nearestHoliday(list: Holiday[], now: Date = new Date(), lead: LeadTimes = DEFAULT_LEAD): HolidayCalc | null {
  return upcomingHolidays(list, now, lead).find((c) => c.date != null) ?? null;
}

// ───────── тексты ─────────

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
export const MONTH_NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
export const WEEKDAY_NAMES = WEEKDAYS;

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 10;
  const b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/** «17 декабря» (год — если не текущий по Москве и просили). */
export function fmtDay(day: Day, opts: { year?: boolean; weekday?: boolean } = {}) {
  const p = partsOf(day);
  return `${p.d} ${MONTHS_GEN[p.m - 1]}${opts.year ? ` ${p.y}` : ""}${opts.weekday ? `, ${WEEKDAYS[p.wd - 1]}` : ""}`;
}

/** «осталось 63 дня», «остался 21 день», «завтра», «сегодня». */
export function daysLeftText(n: number) {
  if (n <= 0) return "сегодня";
  if (n === 1) return "завтра";
  return `${plural(n, "остался", "осталось", "осталось")} ${n} ${plural(n, "день", "дня", "дней")}`;
}

/** Строка о сроке печати для карточки. */
export function deadlineText(c: HolidayCalc, now: Date = new Date(), lead: LeadTimes = DEFAULT_LEAD) {
  if (c.holiday.rule.kind === "always") {
    const n = leadCalendarDays(lead);
    return `Печатную книгу успеем ко дню рождения, если заказать за ${n} ${plural(n, "день", "дня", "дней")}. PDF — в тот же день.`;
  }
  if (c.deadline == null || !c.printOk) return "Печать к празднику уже не успеет — PDF в тот же день, его можно распечатать дома.";
  if (c.deadline === mskToday(now)) return "Печатную книгу успеем к празднику, если заказать сегодня.";
  return `Печатную книгу успеем к празднику, если заказать до ${fmtDay(c.deadline)}.`;
}

/** Описание правила для админки: «каждый год 7 января», «последнее воскресенье ноября». */
export function ruleLabel(r: HolidayRule) {
  switch (r.kind) {
    case "fixed":
      return `каждый год ${r.day} ${MONTHS_GEN[r.month - 1]}`;
    case "date": {
      const d = dayFromIso(r.date);
      return d == null ? "дата не указана" : `${fmtDay(d, { year: true })} (один раз)`;
    }
    case "nth": {
      // род дня недели: м — пн, вт, чт; ж — ср, пт, сб; ср — вс
      const g = [0, 0, 1, 0, 1, 1, 2][r.weekday - 1];
      const ord: Record<number, [string, string, string]> = {
        1: ["первый", "первая", "первое"],
        2: ["второй", "вторая", "второе"],
        3: ["третий", "третья", "третье"],
        4: ["четвёртый", "четвёртая", "четвёртое"],
        5: ["пятый", "пятая", "пятое"],
        [-1]: ["последний", "последняя", "последнее"],
      };
      return `${(ord[r.n] ?? ord[1])[g]} ${WEEKDAYS[r.weekday - 1]} ${MONTHS_GEN[r.month - 1]}`;
    }
    case "always":
      return "любой день (всегда на странице)";
  }
}

// ───────── проверка (zod; в демо — мини-zod с тем же поведением) ─────────

const num = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v), z.number().int().min(min).max(max));

const RawHoliday = z.object({
  id: z.string().trim().max(40).default(""),
  title: z.string().trim().min(2, "Название — от 2 символов").max(80, "Название — до 80 символов"),
  occasionKey: z.string().trim().toLowerCase().max(40, "Ключ повода — до 40 символов"),
  rule: z.object({
    kind: z.enum(["fixed", "date", "nth", "always"]),
    month: num(1, 12).optional(),
    day: num(1, 31).optional(),
    date: z.string().trim().max(10).optional(),
    weekday: num(1, 7).optional(),
    n: num(-1, 5).optional(),
  }),
  // -1 / пусто — посчитать автоматически
  giftDeadlineDays: z.preprocess((v) => (v === "" || v == null ? -1 : typeof v === "string" ? Number(v) : v), z.number().int().min(-1).max(120)),
  showFromDays: num(1, 366).default(60),
  description: z.string().trim().max(600, "Описание — до 600 символов").default(""),
  bookSlugs: z.array(z.string().trim().max(80)).max(8).default([]),
  active: z.boolean().default(true),
  sortOrder: num(0, 100000).default(0),
});

export const HolidayInput = RawHoliday.transform((v, ctx): Holiday => {
  const bad = (message: string) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    return z.NEVER as never;
  };
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(v.occasionKey)) return bad("Ключ повода — латиница, цифры и дефис, например novyj-god");
  if (v.id && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(v.id)) return bad("Некорректный id");
  const r = v.rule;
  let rule: HolidayRule;
  if (r.kind === "fixed") {
    if (!r.month || !r.day) return bad("Укажите день и месяц");
    if (r.day > daysInMonth(2024, r.month)) return bad(`В этом месяце нет ${r.day}-го числа`);
    rule = { kind: "fixed", month: r.month, day: r.day };
  } else if (r.kind === "date") {
    if (!r.date || dayFromIso(r.date) == null) return bad("Укажите дату в формате ГГГГ-ММ-ДД");
    rule = { kind: "date", date: r.date };
  } else if (r.kind === "nth") {
    if (!r.month || !r.weekday || r.n == null || ![1, 2, 3, 4, -1].includes(r.n)) return bad("Укажите месяц, день недели и номер (1–4 или «последний»)");
    rule = { kind: "nth", month: r.month, weekday: r.weekday, n: r.n };
  } else rule = { kind: "always" };
  const slugs = Array.from(new Set((v.bookSlugs as string[]).filter((s) => /^[a-z0-9-]{1,80}$/.test(s))));
  return {
    id: v.id,
    title: v.title,
    occasionKey: v.occasionKey,
    rule,
    giftDeadlineDays: v.giftDeadlineDays < 0 ? null : v.giftDeadlineDays,
    showFromDays: v.showFromDays,
    description: v.description,
    bookSlugs: slugs,
    active: v.active,
    sortOrder: v.sortOrder,
  };
});

/** Проверка одного праздника: данные или первая ошибка по-русски. */
export function parseHoliday(v: unknown): { ok: true; holiday: Holiday } | { ok: false; error: string } {
  const r = HolidayInput.safeParse(v);
  if (r.success) return { ok: true, holiday: r.data as Holiday };
  const i = r.error.issues[0];
  const field: Record<string, string> = { title: "Название", occasionKey: "Ключ повода", giftDeadlineDays: "Срок заказа", showFromDays: "Показывать за (дней)", description: "Описание", sortOrder: "Порядок", bookSlugs: "Книги", month: "Месяц", day: "День", weekday: "День недели", n: "Номер недели", date: "Дата" };
  const key = i?.path?.length ? String(i.path[i.path.length - 1]) : undefined;
  const f = key ? field[key] : undefined;
  const msg = i?.message ?? "Проверьте поля";
  // Сообщения zod — по-русски (zod-ru); поле добавляем, если сообщение само его не называет
  return { ok: false, error: f && !msg.startsWith(f.split(" ")[0]) ? `${f}: ${msg[0].toLowerCase()}${msg.slice(1)}` : msg };
}

/** Проверка всего списка (настройка целиком): каждый праздник и уникальные id. */
export function parseHolidayList(v: unknown): { ok: true; items: Holiday[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) return { ok: false, error: "Ожидается список праздников" };
  if (v.length > 50) return { ok: false, error: "Не больше 50 праздников" };
  const out: Holiday[] = [];
  for (const x of v) {
    const r = parseHoliday(x);
    if (!r.ok) return r;
    if (!r.holiday.id) return { ok: false, error: `«${r.holiday.title}»: нет id` };
    if (out.some((h) => h.id === r.holiday.id)) return { ok: false, error: `Повторяется id ${r.holiday.id}` };
    out.push(r.holiday);
  }
  return { ok: true, items: out };
}

/** id для нового праздника: из ключа повода, с суффиксом при совпадении. */
export function newHolidayId(occasionKey: string, taken: string[]) {
  const base = occasionKey.replace(/[^a-z0-9-]/g, "").slice(0, 32) || "prazdnik";
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** Порядок: переставить праздник вверх/вниз и перенумеровать sortOrder (10, 20, …). */
export function moveHoliday(list: Holiday[], id: string, dir: -1 | 1): Holiday[] {
  const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  const i = sorted.findIndex((h) => h.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted.map((h, k) => ({ ...h, sortOrder: (k + 1) * 10 }));
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((h, k) => ({ ...h, sortOrder: (k + 1) * 10 }));
}

// ───────── дни рождения героев (кабинет и триггер) ─────────

export interface HeroBirthday {
  id?: string;
  userId?: string | null;
  name: string;
  gender?: string | null;
  birthDate: Date | string;
}

export interface BirthdayCalc {
  id?: string;
  userId?: string | null;
  name: string;
  gender?: string | null;
  date: Day;
  daysLeft: number;
  /** Сколько исполнится (если год рождения реальный). */
  turns: number | null;
  deadline: Day;
  printOk: boolean;
}

function birthParts(b: Date | string) {
  if (typeof b === "string") {
    const d = dayFromIso(b.slice(0, 10));
    return d == null ? null : partsOf(d);
  }
  if (isNaN(+b)) return null;
  // Дата рождения хранится как полночь UTC (из «ГГГГ-ММ-ДД»); на всякий случай — по Москве
  return partsOf(mskToday(b));
}

/** Ближайшие дни рождения героев: по одному на имя, в пределах withinDays, по возрастанию. */
export function upcomingBirthdays(heroes: HeroBirthday[], now: Date = new Date(), withinDays = 60, lead: LeadTimes = DEFAULT_LEAD): BirthdayCalc[] {
  const today = mskToday(now);
  const ty = partsOf(today).y;
  const seen = new Set<string>();
  const out: BirthdayCalc[] = [];
  for (const h of heroes) {
    const key = `${h.userId ?? ""}:${h.name.trim().toLowerCase()}`;
    if (!h.name.trim() || seen.has(key)) continue;
    const p = birthParts(h.birthDate);
    if (!p) continue;
    seen.add(key);
    const rule: HolidayRule = { kind: "fixed", month: p.m, day: p.d };
    let date = occurrence(rule, ty)!;
    if (date < today) date = occurrence(rule, ty + 1)!;
    const daysLeft = date - today;
    if (daysLeft > withinDays) continue;
    const turns = p.y > 1900 && p.y <= ty ? partsOf(date).y - p.y : null;
    const deadline = orderDeadline(date, null, lead);
    out.push({ id: h.id, userId: h.userId, name: h.name.trim(), gender: h.gender, date, daysLeft, turns: turns && turns > 0 ? turns : null, deadline, printOk: today <= deadline });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, "ru"));
}

/** За сколько дней до дня рождения героя напоминаем (письмо/мессенджер, правило hero_birthday): за месяц. */
export const BIRTHDAY_REMINDER_DAYS = 30;

/**
 * Кому напомнить о дне рождения героя: за daysBefore дней (по Москве), с окном graceDays — если в нужный день
 * сообщение не ушло (лимит «1 в сутки»), уйдёт в следующие дни. subjectId — одно напоминание на героя (по имени) в год.
 */
export function birthdayReminders(heroes: HeroBirthday[], now: Date = new Date(), daysBefore = BIRTHDAY_REMINDER_DAYS, graceDays = 2, lead: LeadTimes = DEFAULT_LEAD) {
  return upcomingBirthdays(heroes.filter((h) => h.userId), now, daysBefore, lead)
    .filter((b) => b.daysLeft <= daysBefore && b.daysLeft >= daysBefore - graceDays)
    .map((b) => ({ ...b, subjectId: `hero-bday:${b.userId}:${b.name.toLowerCase()}:${partsOf(b.date).y}` }));
}
