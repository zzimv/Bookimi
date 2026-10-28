import { describe, expect, it } from "vitest";
import { dailySeries, dayLabel, groupSum, mskDayKey, npdProgress, saleSource, topWithOther } from "@/lib/dashboard";
import { niceMax, ticks, fmtShort } from "@/components/charts/scale";

const now = new Date("2026-10-29T12:00:00+03:00");

describe("ряды по дням (МСК)", () => {
  it("день считается по Москве", () => {
    expect(mskDayKey(new Date("2026-10-28T22:30:00Z"))).toBe("2026-10-29"); // 01:30 МСК
    expect(mskDayKey(new Date("2026-10-28T20:59:00Z"))).toBe("2026-10-28");
  });

  it("плотный ряд: ровно N дней, пропуски — нули, последний — сегодня", () => {
    const s = dailySeries(
      [
        { at: new Date("2026-10-29T09:00:00+03:00"), value: 990 },
        { at: new Date("2026-10-29T10:00:00+03:00"), value: 2490 },
        { at: new Date("2026-10-27T23:30:00+03:00"), value: 100 },
        { at: new Date("2026-09-01T10:00:00+03:00"), value: 5000 }, // вне окна
      ],
      7,
      now,
    );
    expect(s).toHaveLength(7);
    expect(s[6]).toEqual({ day: "2026-10-29", value: 3480 });
    expect(s[4]).toEqual({ day: "2026-10-27", value: 100 });
    expect(s[0].day).toBe("2026-10-23");
    expect(s.reduce((a, b) => a + b.value, 0)).toBe(3580);
  });

  it("подпись дня", () => {
    expect(dayLabel("2026-10-05")).toBe("5 окт");
    expect(dayLabel("2026-05-31")).toBe("31 мая");
  });
});

describe("группировка", () => {
  const rows = [
    { s: "vk", r: 990 },
    { s: "vk", r: 2490 },
    { s: "tg", r: 3990 },
    { s: "ya", r: 100 },
  ];
  it("сумма и количество, по убыванию суммы", () => {
    expect(groupSum(rows, (x) => x.s, (x) => x.r)).toEqual([
      { key: "tg", n: 1, sum: 3990 },
      { key: "vk", n: 2, sum: 3480 },
      { key: "ya", n: 1, sum: 100 },
    ]);
  });
  it("хвост сворачивается в «Другое»", () => {
    const g = topWithOther(groupSum(rows, (x) => x.s, (x) => x.r), 2);
    expect(g).toEqual([
      { key: "tg", n: 1, sum: 3990 },
      { key: "Другое", n: 3, sum: 3580 },
    ]);
  });
});

describe("источник продажи", () => {
  it("промокод блогера важнее UTM", () => {
    expect(saleSource({ utm_source: "vk" }, { source: "blogger", blogger: "mama_blog", code: "MAMA10" })).toBe("блогер: mama_blog");
    expect(saleSource(null, { source: "blogger", blogger: null, code: "MAMA10" })).toBe("блогер: MAMA10");
  });
  it("UTM, затем «Приведи друга», затем прямые", () => {
    expect(saleSource({ utm_source: " VK " }, null)).toBe("vk");
    expect(saleSource({}, { source: "referral_bonus", blogger: null, code: "DRUG-1" })).toBe("приведи друга");
    expect(saleSource(null, null)).toBe("прямые и поиск");
    expect(saleSource({ utm_source: 5 }, { source: "manual", blogger: null, code: "X" })).toBe("прямые и поиск");
  });
});

describe("лимит НПД", () => {
  it("доля, уровень и прогноз на конец года", () => {
    const p = npdProgress(1_200_000, 2_400_000, new Date("2026-07-02T12:00:00+03:00"));
    expect(p.pct).toBe(50);
    expect(p.level).toBe("ok");
    expect(p.yearEnd).toBeGreaterThan(2_350_000);
    expect(p.yearEnd).toBeLessThan(2_450_000);
    expect(npdProgress(2_000_000, 2_400_000, now).level).toBe("warn");
    expect(npdProgress(2_300_000, 2_400_000, now).level).toBe("bad");
    expect(npdProgress(0, 2_400_000, now).yearEnd).toBe(0);
  });
});

describe("шкалы графиков", () => {
  it("красивый максимум и деления", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(1800)).toBe(2000);
    expect(niceMax(2300)).toBe(2500);
    expect(niceMax(3100)).toBe(5000);
    expect(ticks(2000, 4)).toEqual([0, 500, 1000, 1500, 2000]);
  });
  it("короткие подписи", () => {
    expect(fmtShort(950)).toBe("950");
    expect(fmtShort(25_000)).toBe("25 тыс.");
    expect(fmtShort(2_400_000, "₽")).toBe("2,4 млн ₽");
  });
});
