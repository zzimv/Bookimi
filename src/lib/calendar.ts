// Календарь для допов «Календарь 2027»: месяцы по неделям (неделя с понедельника), русские названия,
// государственные праздники РФ (ст. 112 ТК) и переносы выходных. Чистые функции — тестируются без БД.

export const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Нерабочие праздничные дни (ст. 112 ТК РФ): месяц-день → название. */
export const RU_HOLIDAYS: Record<string, string> = {
  "01-01": "Новогодние каникулы",
  "01-02": "Новогодние каникулы",
  "01-03": "Новогодние каникулы",
  "01-04": "Новогодние каникулы",
  "01-05": "Новогодние каникулы",
  "01-06": "Новогодние каникулы",
  "01-07": "Рождество Христово",
  "01-08": "Новогодние каникулы",
  "02-23": "День защитника Отечества",
  "03-08": "Международный женский день",
  "05-01": "Праздник Весны и Труда",
  "05-09": "День Победы",
  "06-12": "День России",
  "11-04": "День народного единства",
};

/**
 * Переносы выходных по годам (постановление Правительства РФ). 2027 — № 1187 от 17.09.2026: 2 января → 5 ноября,
 * 3 января → 31 декабря, суббота 20 февраля → понедельник 22 февраля (20 февраля — рабочая суббота). Праздник
 * в выходной без отдельного переноса переходит на следующий рабочий день (ч. 2 ст. 112 ТК): 3 и 10 мая, 14 июня.
 * На новый год — добавить строку сюда (без строки календарь отмечает только праздники и выходные).
 */
export const RU_TRANSFERS: Record<number, { daysOff: string[]; workdays: string[] }> = {
  2027: { daysOff: ["02-22", "05-03", "05-10", "06-14", "11-05", "12-31"], workdays: ["02-20"] },
};

export type DayKind = "work" | "weekend" | "holiday" | "dayoff" | "workday";

export interface CalDay {
  day: number;
  /** 1 = понедельник … 7 = воскресенье */
  weekday: number;
  kind: DayKind;
  /** Название праздника (только для holiday). */
  title?: string;
}

export interface CalMonth {
  month: number; // 1–12
  title: string;
  /** Недели по 7 ячеек с понедельника; null — день соседнего месяца. */
  weeks: (CalDay | null)[][];
  holidays: { day: number; title: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKind(year: number, month: number, day: number): { kind: DayKind; title?: string } {
  const md = `${pad(month)}-${pad(day)}`;
  const wd = isoWeekday(year, month, day);
  const t = RU_TRANSFERS[year];
  if (RU_HOLIDAYS[md]) return { kind: "holiday", title: RU_HOLIDAYS[md] };
  if (t?.workdays.includes(md)) return { kind: "workday" };
  if (t?.daysOff.includes(md)) return { kind: "dayoff" };
  return { kind: wd >= 6 ? "weekend" : "work" };
}

/** День недели по ISO: 1 = понедельник … 7 = воскресенье (UTC — без сдвигов часового пояса). */
export function isoWeekday(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calendarMonth(year: number, month: number): CalMonth {
  const n = daysInMonth(year, month);
  const first = isoWeekday(year, month, 1);
  const cells: (CalDay | null)[] = Array.from({ length: first - 1 }, () => null);
  const holidays: { day: number; title: string }[] = [];
  for (let d = 1; d <= n; d++) {
    const k = dayKind(year, month, d);
    cells.push({ day: d, weekday: isoWeekday(year, month, d), ...k });
    if (k.title && !holidays.some((h) => h.title === k.title)) holidays.push({ day: d, title: k.title });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (CalDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, title: MONTHS_RU[month - 1], weeks, holidays };
}

export function calendarYear(year: number): CalMonth[] {
  return Array.from({ length: 12 }, (_, i) => calendarMonth(year, i + 1));
}

/** Подпись праздников месяца под сеткой: «1–6, 8 — Новогодние каникулы; 7 — Рождество Христово». */
export function holidayLine(m: CalMonth) {
  const days = m.weeks.flat().filter((d): d is CalDay => !!d && d.kind === "holiday");
  const byTitle = new Map<string, number[]>();
  for (const d of days) byTitle.set(d.title!, [...(byTitle.get(d.title!) ?? []), d.day]);
  const ranges = (list: number[]) => {
    const out: string[] = [];
    for (let i = 0; i < list.length; ) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      out.push(i === j ? `${list[i]}` : `${list[i]}–${list[j]}`);
      i = j + 1;
    }
    return out.join(", ");
  };
  return [...byTitle].map(([title, list]) => `${ranges(list)} — ${title}`).join("; ");
}

/** Пометка переносов месяца: «22 — выходной (перенос); 20 — рабочая суббота». */
export function transferLine(year: number, m: CalMonth) {
  const t = RU_TRANSFERS[year];
  if (!t) return "";
  const mm = String(m.month).padStart(2, "0");
  const off = t.daysOff.filter((d) => d.startsWith(mm)).map((d) => Number(d.slice(3)));
  const work = t.workdays.filter((d) => d.startsWith(mm)).map((d) => Number(d.slice(3)));
  return [off.length ? `${off.join(", ")} — выходной (перенос)` : "", work.length ? `${work.join(", ")} — рабочий день` : ""].filter(Boolean).join("; ");
}
