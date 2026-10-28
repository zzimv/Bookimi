import { describe, expect, it } from "vitest";
import { journey, journeyLine } from "@/app/zakaz/journey";
import { nextOccasion } from "@/app/kabinet/occasion";
import { renderTemplate } from "@/lib/notify";

const base = { createdAt: new Date("2026-10-20T10:00:00+03:00"), paidAt: new Date("2026-10-20T10:05:00+03:00") };

describe("путь заказа", () => {
  it("печать: этапы и текущий шаг", () => {
    const j = journey({ ...base, status: "IN_PRINT", whoPrints: "bookimi", bookReadyAt: base.paidAt, readyDate: new Date("2026-10-27T12:00:00+03:00") });
    expect(j.stages.map((s) => s.key)).toEqual(["created", "paid", "ready", "print", "shipped", "delivered"]);
    expect(j.current).toBe(3);
    expect(j.stages.map((s) => s.state)).toEqual(["done", "done", "done", "current", "todo", "todo"]);
    expect(j.stages[3].message).toContain("печатаем бережно");
    expect(j.stages[3].message).toContain("27 октября");
    expect(j.stages.filter((s) => s.message)).toHaveLength(1);
  });

  it("оплачен, книга ещё рисуется — с именем героя", () => {
    const j = journey({ ...base, status: "PAID", whoPrints: "self", heroAcc: "Машу" });
    expect(j.stages).toHaveLength(3);
    expect(j.current).toBe(1);
    expect(j.stages[1].message).toContain("Мы уже рисуем книгу про Машу");
  });

  it("PDF готов — последний шаг подсвечен", () => {
    const j = journey({ ...base, status: "PAID", whoPrints: "self", bookReadyAt: base.paidAt });
    expect(j.current).toBe(2);
    expect(j.stages[2].state).toBe("current");
  });

  it("в пути: трек и срок", () => {
    const line = journeyLine({ ...base, status: "SHIPPED", whoPrints: "bookimi", bookReadyAt: base.paidAt, shipment: { method: "cdek_pvz", trackNumber: "1234567", etaDate: new Date("2026-11-02T12:00:00+03:00") } });
    expect(line).toBe("Едет к вам! Трек: 1234567. Ориентировочно — 2 ноября.");
  });

  it("доставлен и отменён", () => {
    expect(journeyLine({ ...base, status: "DELIVERED", whoPrints: "bookimi" })).toContain("подарила улыбку");
    expect(journey({ ...base, status: "CANCELLED", whoPrints: "bookimi" }).closed).toBe(true);
  });
});

describe("следующий повод", () => {
  it("конец октября — Новый год с дедлайном печати 20 декабря", () => {
    const h = nextOccasion({ now: new Date("2026-10-29T12:00:00+03:00") });
    expect(h?.key).toBe("novyj-god");
    expect(h?.text).toContain("до 20 декабря");
  });
  it("день рождения героя важнее, если раньше", () => {
    const h = nextOccasion({ now: new Date("2026-10-29T12:00:00+03:00"), birthdays: [{ name: "Маша", nameGen: "Маши", date: new Date("2019-11-20T00:00:00Z") }] });
    expect(h?.title).toBe("День рождения Маши");
    expect(h?.text).toContain("20 ноября");
  });
  it("после дедлайна печати — предлагаем PDF", () => {
    const h = nextOccasion({ now: new Date("2026-12-25T12:00:00+03:00") });
    expect(h?.text).toContain("PDF");
  });
  it("праздник из прошлых поводов покупателя", () => {
    const h = nextOccasion({ now: new Date("2027-02-01T12:00:00+03:00"), pastOccasions: ["8-marta"] });
    expect(h?.key).toBe("8-marta");
    expect(nextOccasion({ now: new Date("2027-02-01T12:00:00+03:00") })).toBeNull();
  });
});

describe("тексты уведомлений", () => {
  it("благодарим на каждом шаге", () => {
    expect(renderTemplate("payment_received", { code: "BK-1", orderId: "x", heroAcc: "Машу", whoPrints: "bookimi" }).b).toContain("Мы уже рисуем книгу про Машу");
    expect(renderTemplate("status", { code: "BK-1", orderId: "x", status: "IN_PRINT", ready: "5 ноября" }).b).toContain("печатаем бережно. Будет готова к 5 ноября.");
    expect(renderTemplate("track", { code: "BK-1", orderId: "x", track: "123", service: "cdek_pvz", eta: "8 ноября" }).b).toContain("Трек-номер: 123 (СДЭК). Ориентировочно — 8 ноября.");
    expect(renderTemplate("status", { code: "BK-1", orderId: "x", status: "DELIVERED" }).b).toContain("подарила улыбку");
    const t = renderTemplate("thanks_delivered", { title: "Сказка", coloring: "https://x/c" });
    expect(t.b).toContain("/kabinet/otzyv");
    expect(t.b).toContain("раскраска");
    expect(renderTemplate("thanks_delivered", { title: "Сказка" }).b).not.toContain("раскраска");
  });
  it("без восклицательного спама", () => {
    for (const st of ["IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"]) {
      const { s, b } = renderTemplate("status", { code: "BK-1", orderId: "x", status: st });
      expect((s + b).split("!").length - 1).toBeLessThanOrEqual(1);
    }
  });
});
