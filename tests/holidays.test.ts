// «Ближайшие праздники»: ближайшая дата через границу года (по Москве), срок заказа с рабочими днями,
// проверка настроек, дни рождения героев и выбор напоминаний для триггера.
import { describe, expect, it } from "vitest";
import {
  birthdayReminders,
  computeHoliday,
  dayOf,
  DEFAULT_HOLIDAYS,
  deadlineText,
  fmtDay,
  isoOf,
  isWorkday,
  minusWorkdays,
  moveHoliday,
  mskToday,
  nearestHoliday,
  nextDate,
  orderDeadline,
  parseHoliday,
  parseHolidayList,
  ruleLabel,
  upcomingBirthdays,
  upcomingHolidays,
  type Holiday,
  BIRTHDAY_REMINDER_DAYS,
} from "../src/lib/holidays-core";
import { buildHolidayCards } from "../src/lib/holidays";
import { canSendTrigger, DEFAULT_RULES, TRIGGER_EVENTS } from "../src/lib/triggers";
import { printDeadlineLine } from "../src/lib/storefront";
import { OCCASIONS } from "../src/content/profiles";
import { occasionWord } from "../src/content/occasions";
import { applyOccasion, PLOTS } from "../src/content/registry";
import { checkTags } from "../src/content/tags";

/** Полдень по Москве: 2026-10-29 12:00 МСК = 09:00 UTC. */
const msk = (iso: string, hh = 12) => new Date(`${iso}T${String(hh - 3).padStart(2, "0")}:00:00Z`);
const byId = (id: string) => DEFAULT_HOLIDAYS.find((h) => h.id === id)!;
const dayMother: Holiday = { ...byId("novyj-god"), id: "den-materi", title: "День матери", occasionKey: "den-materi", rule: { kind: "nth", month: 11, weekday: 7, n: -1 }, showFromDays: 45, sortOrder: 50 };

describe("ближайшая дата (по Москве)", () => {
  it("29 октября: Новый год через 63 дня, Рождество — 7 января следующего года", () => {
    const now = msk("2026-10-29");
    const ny = computeHoliday(byId("novyj-god"), now);
    expect(isoOf(ny.date!)).toBe("2026-12-31");
    expect(ny.daysLeft).toBe(63);
    const xmas = computeHoliday(byId("rozhdestvo"), now);
    expect(isoOf(xmas.date!)).toBe("2027-01-07");
    expect(xmas.daysLeft).toBe(70);
    expect(computeHoliday(byId("staryj-novyj-god"), now).daysLeft).toBe(77);
  });
  it("после 14 января — следующий год; в сам день — сегодня (0 дней)", () => {
    expect(isoOf(nextDate({ kind: "fixed", month: 1, day: 14 }, mskToday(msk("2027-01-15")))!)).toBe("2028-01-14");
    expect(isoOf(nextDate({ kind: "fixed", month: 1, day: 7 }, mskToday(msk("2027-01-15")))!)).toBe("2028-01-07");
    expect(computeHoliday(byId("staryj-novyj-god"), msk("2027-01-14")).daysLeft).toBe(0);
    // 00:30 МСК 14 января (21:30 UTC 13-го) — уже 14-е; 23:30 МСК 13-го — ещё 13-е
    expect(mskToday(new Date("2027-01-13T21:30:00Z"))).toBe(dayOf(2027, 1, 14));
    expect(mskToday(new Date("2027-01-13T20:30:00Z"))).toBe(dayOf(2027, 1, 13));
  });
  it("N-й день недели: День матери — последнее воскресенье ноября", () => {
    expect(isoOf(nextDate(dayMother.rule, mskToday(msk("2026-10-29")))!)).toBe("2026-11-29");
    expect(isoOf(nextDate(dayMother.rule, mskToday(msk("2026-11-30")))!)).toBe("2027-11-28");
    expect(isoOf(nextDate({ kind: "nth", month: 10, weekday: 7, n: 3 }, dayOf(2026, 1, 1))!)).toBe("2026-10-18"); // День отца
    expect(ruleLabel(dayMother.rule)).toBe("последнее воскресенье ноября");
    expect(ruleLabel({ kind: "nth", month: 10, weekday: 7, n: 3 })).toBe("третье воскресенье октября");
  });
  it("разовая дата: прошла — не показываем; 29 февраля в невисокосный год — 28-е", () => {
    expect(nextDate({ kind: "date", date: "2026-03-01" }, dayOf(2026, 10, 29))).toBeNull();
    expect(isoOf(nextDate({ kind: "fixed", month: 2, day: 29 }, dayOf(2026, 10, 29))!)).toBe("2027-02-28");
  });
  it("витрина: по ближайшей дате, «всегда» — в конце, окно «показывать за»", () => {
    const now = msk("2026-10-29");
    const list = upcomingHolidays([...DEFAULT_HOLIDAYS, dayMother], now);
    expect(list.map((c) => c.holiday.id)).toEqual(["den-materi", "novyj-god", "rozhdestvo", "staryj-novyj-god", "dni-rozhdeniya"]);
    expect(upcomingHolidays(DEFAULT_HOLIDAYS, msk("2026-08-01")).map((c) => c.holiday.id)).toEqual(["dni-rozhdeniya"]);
    expect(nearestHoliday(DEFAULT_HOLIDAYS, now)!.holiday.id).toBe("novyj-god");
    const off = DEFAULT_HOLIDAYS.map((h) => (h.id === "novyj-god" ? { ...h, active: false } : h));
    expect(nearestHoliday(off, now)!.holiday.id).toBe("rozhdestvo");
  });
});

describe("срок заказа печатной книги", () => {
  it("рабочие дни: выходные и праздники РФ (1–8 января, 31 декабря) не считаются", () => {
    expect(isWorkday(dayOf(2026, 10, 30))).toBe(true); // пятница
    expect(isWorkday(dayOf(2026, 10, 31))).toBe(false); // суббота
    expect(isWorkday(dayOf(2026, 11, 4))).toBe(false); // День народного единства
    expect(isWorkday(dayOf(2027, 1, 5))).toBe(false);
    expect(isoOf(minusWorkdays(dayOf(2026, 12, 24), 5))).toBe("2026-12-17");
    expect(isoOf(minusWorkdays(dayOf(2027, 1, 11), 1))).toBe("2026-12-30"); // 1–8 января и 31 декабря — нерабочие; 9–10 — выходные
  });
  it("Новый год — до 17 декабря, Рождество и Старый Новый год — до 24 декабря (печать 5 раб. дн. + доставка 7 дн.)", () => {
    const now = msk("2026-10-29");
    expect(fmtDay(computeHoliday(byId("novyj-god"), now).deadline!)).toBe("17 декабря");
    expect(fmtDay(computeHoliday(byId("rozhdestvo"), now).deadline!)).toBe("24 декабря");
    expect(fmtDay(computeHoliday(byId("staryj-novyj-god"), now).deadline!)).toBe("24 декабря");
    expect(fmtDay(computeHoliday(dayMother, now).deadline!)).toBe("16 ноября");
  });
  it("ручной срок и другие сроки типографии/доставки", () => {
    expect(isoOf(orderDeadline(dayOf(2026, 12, 31), 10))).toBe("2026-12-21");
    expect(isoOf(orderDeadline(dayOf(2026, 12, 31), null, { productionDays: 3, deliveryDays: 2 }))).toBe("2026-12-24");
  });
  it("тексты: «успеем, если заказать до», в день срока — «сегодня», после — «PDF — в тот же день»", () => {
    expect(deadlineText(computeHoliday(byId("novyj-god"), msk("2026-10-29")))).toBe("Печатную книгу успеем к празднику, если заказать до 17 декабря.");
    expect(deadlineText(computeHoliday(byId("novyj-god"), msk("2026-12-17")), msk("2026-12-17"))).toMatch(/заказать сегодня/);
    const late = computeHoliday(byId("novyj-god"), msk("2026-12-18"));
    expect(late.printOk).toBe(false);
    expect(deadlineText(late)).toMatch(/PDF в тот же день/);
    expect(deadlineText(computeHoliday(byId("dni-rozhdeniya"), msk("2026-10-29")))).toMatch(/за 14 дней/);
  });
  it("строка сезона на главной — тот же расчёт", () => {
    expect(printDeadlineLine("novyj-god", "", msk("2026-11-01"))).toMatch(/закажите до 17 декабря/);
    expect(printDeadlineLine("staryj-novyj-god", "", msk("2026-11-01"))).toMatch(/закажите до 24 декабря/);
    expect(printDeadlineLine("novyj-god", "2026-12-20", msk("2026-12-19"))).toMatch(/до 20 декабря/);
  });
});

describe("проверка настроек", () => {
  it("значения по умолчанию проходят проверку", () => {
    const r = parseHolidayList(DEFAULT_HOLIDAYS);
    expect(r.ok).toBe(true);
  });
  it("строки из формы приводятся к числам, пустой срок — авто", () => {
    const r = parseHoliday({ title: "День матери", occasionKey: "den-materi", rule: { kind: "nth", month: "11", weekday: "7", n: "-1" }, giftDeadlineDays: "", showFromDays: "45" });
    expect(r.ok && r.holiday.rule).toEqual({ kind: "nth", month: 11, weekday: 7, n: -1 });
    expect(r.ok && r.holiday.giftDeadlineDays).toBeNull();
    expect(r.ok && r.holiday.active).toBe(true);
  });
  it("ошибки — по-русски", () => {
    const base = { title: "Праздник", occasionKey: "novyj-god", giftDeadlineDays: null, showFromDays: 30 };
    expect(parseHoliday({ ...base, rule: { kind: "fixed", month: 2, day: 30 } })).toEqual({ ok: false, error: "В этом месяце нет 30-го числа" });
    expect(parseHoliday({ ...base, rule: { kind: "date", date: "2026-13-01" } })).toMatchObject({ ok: false });
    expect(parseHoliday({ ...base, rule: { kind: "nth", month: 11, weekday: 7, n: 5 } })).toMatchObject({ ok: false });
    expect(parseHoliday({ ...base, occasionKey: "Новый год", rule: { kind: "always" } })).toMatchObject({ ok: false, error: expect.stringMatching(/латиница/) });
    expect(parseHoliday({ ...base, title: "Н", rule: { kind: "always" } })).toMatchObject({ ok: false, error: expect.stringMatching(/Название/) });
    expect(parseHoliday({ ...base, rule: { kind: "fixed", month: 1, day: 7 }, giftDeadlineDays: 500 })).toMatchObject({ ok: false });
    expect(parseHolidayList([DEFAULT_HOLIDAYS[0], DEFAULT_HOLIDAYS[0]])).toMatchObject({ ok: false, error: expect.stringMatching(/Повторяется/) });
  });
  it("порядок: вверх/вниз с перенумерацией", () => {
    const m = moveHoliday(DEFAULT_HOLIDAYS, "rozhdestvo", -1);
    expect(m.map((h) => h.id).slice(0, 2)).toEqual(["rozhdestvo", "novyj-god"]);
    expect(m.map((h) => h.sortOrder)).toEqual([10, 20, 30, 40]);
  });
});

describe("карточки /prazdniki", () => {
  it("книги к поводу, дни рождения — по одной на каждую аудиторию", () => {
    const now = msk("2026-10-29");
    const stories = PLOTS.map((p) => ({ slug: p.slug, title: p.title, audience: p.audience, occasions: p.occasions })) as never[];
    const cards = buildHolidayCards(upcomingHolidays(DEFAULT_HOLIDAYS, now), stories, now, { productionDays: 5, deliveryDays: 7 });
    const ny = cards.find((c) => c.id === "novyj-god")!;
    expect(ny.daysLeftLabel).toBe("осталось 63 дня");
    expect(ny.dateLabel).toBe("31 декабря, четверг");
    expect(ny.books.length).toBeGreaterThanOrEqual(3);
    expect(ny.catalogHref).toBe("/skazki?povod=novyj-god");
    expect(cards.find((c) => c.id === "rozhdestvo")!.dateLabel).toBe("7 января 2027, четверг");
    const bd = cards.find((c) => c.id === "dni-rozhdeniya")!;
    expect(new Set(bd.books.map((b) => b.audience))).toEqual(new Set(["CHILD", "TEEN", "ADULT", "PET"]));
    expect(bd.audiences.map((a) => a.label)).toEqual(["Детям", "Подросткам", "Взрослым", "Питомцам"]);
  });
});

describe("новые поводы", () => {
  it("Рождество и Старый Новый год — в поводах, с падежами и общими крючками для любого сюжета", () => {
    for (const k of ["rozhdestvo", "staryj-novyj-god"]) {
      expect(OCCASIONS.find((o) => o.key === k)?.audiences).toEqual(["CHILD", "TEEN", "ADULT", "PET"]);
      expect(occasionWord(k)).not.toBeNull();
      for (const p of PLOTS) {
        const s = applyOccasion(p, k);
        expect(s).toHaveLength(12);
        expect(checkTags(s[0].text + s[11].text), `${p.slug} × ${k}`).toEqual([]);
      }
    }
    expect(occasionWord("rozhdestvo")!.тв).toBe("Рождеством");
    expect(occasionWord("staryj-novyj-god")!.дат).toBe("Старому Новому году");
  });
});

describe("дни рождения героев", () => {
  const heroes = [
    { id: "h1", userId: "u1", name: "Маша", birthDate: new Date("2019-11-19T00:00:00Z") },
    { id: "h2", userId: "u1", name: "Маша", birthDate: new Date("2019-11-19T00:00:00Z") }, // дубль героя из другой книги
    { id: "h3", userId: "u2", name: "Бублик", birthDate: "2021-12-20" },
    { id: "h4", userId: "u3", name: "Дед", birthDate: new Date("1950-01-10T00:00:00Z") },
  ];
  it("кабинет: ближайшие в пределах окна, по возрастанию, сколько исполнится", () => {
    const list = upcomingBirthdays(heroes, msk("2026-10-29"), 60);
    expect(list.map((b) => [b.name, b.daysLeft, b.turns])).toEqual([
      ["Маша", 21, 7],
      ["Бублик", 52, 5],
    ]);
    expect(fmtDay(list[0].deadline)).toBe("5 ноября");
    expect(upcomingBirthdays(heroes, msk("2026-10-29"), 366).at(-1)!.name).toBe("Дед");
  });
  it("триггер: ровно за месяц — 30 дней (окно 2 дня), один раз на героя в год", () => {
    expect(BIRTHDAY_REMINDER_DAYS).toBe(30);
    const at30 = birthdayReminders(heroes, msk("2026-10-20"));
    expect(at30.map((b) => b.subjectId)).toEqual(["hero-bday:u1:маша:2026"]);
    expect(birthdayReminders(heroes, msk("2026-10-22")).map((b) => b.name)).toEqual(["Маша"]); // 28 дней — ещё в окне
    expect(birthdayReminders(heroes, msk("2026-10-23"))).toEqual([]);
    expect(birthdayReminders(heroes, msk("2026-10-19"))).toEqual([]);
    expect(birthdayReminders(heroes, msk("2026-10-29"))).toEqual([]); // 21 день — старое правило больше не срабатывает
    expect(birthdayReminders([{ name: "Без аккаунта", birthDate: "2019-11-19" }], msk("2026-10-20"))).toEqual([]);
    // через границу года: Дед — 10 января, напоминание 11 декабря
    expect(birthdayReminders(heroes, msk("2026-12-11")).map((b) => b.subjectId)).toEqual(["hero-bday:u3:дед:2027"]);
  });
  it("правило в DEFAULT_RULES, только с согласием, не чаще раза в сутки", () => {
    const r = DEFAULT_RULES.find((x) => x.event === "hero_birthday")!;
    expect(r).toBeTruthy();
    expect(TRIGGER_EVENTS.hero_birthday).toMatch(/За месяц \(30 дней\)/);
    expect(r.name).toMatch(/через месяц/);
    expect(r.template).toMatch(/через месяц/i);
    expect(r.template).toMatch(/\{deadline\}/);
    const rule = { isMarketing: true };
    expect(canSendTrigger(rule, { marketingOk: true }, false)).toBe(true);
    expect(canSendTrigger(rule, { marketingOk: false }, false)).toBe(false); // нет согласия или отписался
    expect(canSendTrigger(rule, { marketingOk: true }, true)).toBe(false); // уже было сообщение за сутки
    expect(canSendTrigger(rule, { marketingOk: true, deletedAt: new Date() }, false)).toBe(false);
    expect(canSendTrigger(rule, null, false)).toBe(false);
  });
});
