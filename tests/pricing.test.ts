import { describe, expect, it } from "vitest";
import { quote, addBusinessDays, type CatalogAddon, type CatalogFormat } from "@/lib/pricing";

const formats: CatalogFormat[] = [
  { key: "pdf", kind: "PDF", title: "PDF", priceRub: 990 },
  { key: "std-soft", kind: "PRINT", title: "Стандарт мягкая", priceRub: 2990 },
  { key: "std-hard", kind: "PRINT", title: "Стандарт твёрдая", priceRub: 3990 },
];
const addons: CatalogAddon[] = [
  { key: "poster", kind: "PHYSICAL", title: "Постер", priceRub: 590, percentOff: null, requiresPrint: true },
  { key: "audiobook", kind: "DIGITAL", title: "Аудио", priceRub: 390, percentOff: null, requiresPrint: false },
  { key: "second-copy", kind: "MODIFIER", title: "Второй экземпляр", priceRub: null, percentOff: 30, requiresPrint: true },
  { key: "urgent", kind: "MODIFIER", title: "Срочно", priceRub: 500, percentOff: null, requiresPrint: true },
];

describe("расчёт суммы", () => {
  it("PDF — 990 ₽, цифровой доп можно", () => {
    const q = quote({ whoPrints: "self", addons: ["audiobook"] }, formats, addons);
    expect(q.totalRub).toBe(990 + 390);
    expect(q.errors).toEqual([]);
  });
  it("физический доп без печати — ошибка", () => {
    const q = quote({ whoPrints: "self", addons: ["poster"] }, formats, addons);
    expect(q.errors.length).toBe(1);
  });
  it("печать: PDF уже оплачен — платится разница", () => {
    const q = quote({ whoPrints: "bookimi", formatKey: "std-hard", addons: [], pdfPaidRub: 990, shippingRub: 300, shippingMethod: "cdek_pvz" }, formats, addons);
    expect(q.pdfCreditRub).toBe(990);
    expect(q.totalRub).toBe(3990 - 990 + 300);
  });
  it("второй экземпляр −30% и бесплатная доставка от 2 книг", () => {
    const q = quote({ whoPrints: "bookimi", formatKey: "std-soft", addons: ["second-copy"], shippingRub: 300, shippingMethod: "cdek_pvz", freeShippingBooks: 2 }, formats, addons);
    expect(q.lines.find((l) => l.key === "second-copy")!.priceRub).toBe(2093);
    expect(q.shippingRub).toBe(0);
    expect(q.books).toBe(2);
  });
  it("скидки не суммируются: берётся большая", () => {
    const q = quote({ whoPrints: "self", addons: [], discountPct: 10, discountRub: 50 }, formats, addons);
    expect(q.discountRub).toBe(99);
  });
  it("скидка не трогает доставку", () => {
    const q = quote({ whoPrints: "bookimi", formatKey: "std-soft", addons: [], discountPct: 10, shippingRub: 300, shippingMethod: "cdek_courier" }, formats, addons);
    expect(q.totalRub).toBe(2990 - 299 + 300);
  });
  it("самовывоз — доставка 0 ₽", () => {
    const q = quote({ whoPrints: "bookimi", formatKey: "std-soft", addons: [], shippingRub: 500, shippingMethod: "pickup" }, formats, addons);
    expect(q.shippingRub).toBe(0);
  });
  it("рабочие дни пропускают выходные", () => {
    const fri = new Date("2026-10-30T12:00:00+03:00");
    expect(addBusinessDays(fri, 1).getDay()).toBe(1);
  });
});
