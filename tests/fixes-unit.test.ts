// Регрессия по отчёту тестирования 30.10.2026 — чистые функции (без БД).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pickClientIp } from "@/lib/limits";
import { cleanFirstName, sessionAlive, sessionTtlSeconds } from "@/lib/auth";
import { looksLikeRecovery, recoveryCodes, recoveryHash } from "@/lib/crypto";
import { mfaFresh, safeAdminNext } from "@/lib/admin";
import { BulkTiers, parseTiers, validatePromo, validateSettings } from "@/lib/settings-validate";
import { DEFAULTS } from "@/lib/settings";
import { fill, bookWord, DEFAULT_RULES } from "@/lib/triggers";
import { pdfPaidShare } from "@/lib/orders";
import { maskContact, renderTemplate } from "@/lib/notify";
import { scrubNames } from "@/lib/account";
import { runBatch } from "@/worker/jobs";

describe("1. 2FA: коды восстановления, свежесть, сессии сотрудников", () => {
  it("10 разных кодов «xxxx-xxxx»; хэш не зависит от регистра и дефиса", () => {
    const c = recoveryCodes();
    expect(c).toHaveLength(10);
    expect(new Set(c).size).toBe(10);
    for (const x of c) expect(x).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(recoveryHash("u", c[0])).toBe(recoveryHash("u", c[0].toUpperCase().replace("-", "")));
    expect(recoveryHash("u", c[0])).not.toBe(recoveryHash("v", c[0]));
    expect(looksLikeRecovery(c[0])).toBe(true);
    expect(looksLikeRecovery("123456")).toBe(false);
  });
  it("свежий код — 10 минут; next — только пути админки", () => {
    const now = Date.now();
    expect(mfaFresh({ mfaPassed: true, mfaAt: new Date(now - 5 * 60_000) }, now)).toBe(true);
    expect(mfaFresh({ mfaPassed: true, mfaAt: new Date(now - 11 * 60_000) }, now)).toBe(false);
    expect(mfaFresh({ mfaPassed: false, mfaAt: new Date(now) }, now)).toBe(false);
    expect(safeAdminNext("http://evil.example/admin/x")).toBe("/admin/x");
    expect(safeAdminNext("https://bookimi.ru/kabinet")).toBe("/admin");
    expect(safeAdminNext("/admin/2fa?reauth=1")).toBe("/admin");
    expect(safeAdminNext("//evil.example")).toBe("/admin");
  });
  it("сессия сотрудника — 12 часов, покупателя — 30 дней", () => {
    expect(sessionTtlSeconds("OPERATOR")).toBe(12 * 3600);
    expect(sessionTtlSeconds("CUSTOMER")).toBe(30 * 86400);
    const old = { expiresAt: new Date(Date.now() + 86400_000), createdAt: new Date(Date.now() - 13 * 3600_000) };
    expect(sessionAlive({ ...old, user: { deletedAt: null, role: "OWNER" } })).toBe(false);
    expect(sessionAlive({ ...old, user: { deletedAt: null, role: "CUSTOMER" } })).toBe(true);
  });
});

describe("2, 15. уведомления: маска адресов, абсолютная ссылка на чек", () => {
  it("маска", () => {
    expect(maskContact("anna@mail.ru")).toBe("an***@mail.ru");
    expect(maskContact("+79991234567")).toBe("+7******67");
  });
  it("ссылка на демо-чек в письме — с доменом", () => {
    expect(renderTemplate("receipt", { code: "BK-1", url: "/chek/abc" }).b).toMatch(/https:\/\/[^ ]+\/chek\/abc/);
    expect(renderTemplate("receipt", { code: "BK-1", url: "https://lknpd.nalog.ru/x" }).b).toContain("https://lknpd.nalog.ru/x");
  });
});

describe("8. зачёт PDF — доля после скидки", () => {
  it("PDF 990 ₽ с промокодом −50% → 495 ₽; без скидки — 990", () => {
    expect(pdfPaidShare(990, { subtotalRub: 990, pdfCreditRub: 0, discountRub: 495 })).toBe(495);
    expect(pdfPaidShare(990, { subtotalRub: 990, pdfCreditRub: 0, discountRub: 0 })).toBe(990);
    // PDF + раскраска, скидка 128 ₽ распределяется пропорционально
    expect(pdfPaidShare(990, { subtotalRub: 1280, pdfCreditRub: 0, discountRub: 128 })).toBe(891);
  });
});

describe("9. проверка настроек и промокодов", () => {
  it("ИНН с контрольной суммой, лимиты ≥ 1 / ≥ 0, пустое поле — ошибка", () => {
    expect(validateSettings("seller", { ...DEFAULTS.seller, fullName: "Иванов Иван", inn: "123" })).toMatchObject({ ok: false });
    expect(validateSettings("seller", { ...DEFAULTS.seller, fullName: "Тестов Тест", inn: "770012345606" })).toMatchObject({ ok: true });
    expect(validateSettings("seller", { ...DEFAULTS.seller })).toMatchObject({ ok: true }); // ещё не заполнены — можно
    expect(validateSettings("limits", { ...DEFAULTS.limits, previewsPerContact: 0 })).toMatchObject({ ok: false });
    expect(validateSettings("limits", { ...DEFAULTS.limits, previewsPerContact: NaN })).toMatchObject({ ok: false });
    expect(validateSettings("limits", { ...DEFAULTS.limits, dailySpendRub: -5 })).toMatchObject({ ok: false });
    expect(validateSettings("limits", DEFAULTS.limits)).toMatchObject({ ok: true });
    expect(validateSettings("cartoon", { ...DEFAULTS.cartoon, minSec: 200 })).toMatchObject({ ok: false });
    expect(validateSettings("payments", { ...DEFAULTS.payments, transfer: { ...DEFAULTS.payments.transfer, cancelHours: 0 } })).toMatchObject({ ok: false });
    for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) expect(validateSettings(k, DEFAULTS[k]).ok, k).toBe(true);
  });
  it("скидки группы: «5:20, 15:30» — по возрастанию, 1–90%", () => {
    expect(parseTiers("5:20, 15:30; 25 — 35%")).toEqual([{ min: 5, pct: 20 }, { min: 15, pct: 30 }, { min: 25, pct: 35 }]);
    expect(BulkTiers.safeParse(parseTiers("5:20, 15:30")).success).toBe(true);
    expect(BulkTiers.safeParse(parseTiers("15:30, 5:20")).success).toBe(false);
    expect(BulkTiers.safeParse(parseTiers("5:95")).success).toBe(false);
    expect(BulkTiers.safeParse(parseTiers("пять:двадцать")).success).toBe(false);
    expect(BulkTiers.safeParse(parseTiers("")).success).toBe(true);
  });
  it("промокод: 1–90%, фиксированная ≤ цены, код, даты", () => {
    const now = new Date("2026-10-30T12:00:00+03:00");
    expect(validatePromo({ code: "SALE10", percentOff: 10 }, 5490, now)).toMatchObject({ ok: true, value: { code: "SALE10" } });
    expect(validatePromo({ code: "SALE", percentOff: 200 }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "SALE", percentOff: 0 }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "SALE", amountOffRub: 6000 }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "SALE", amountOffRub: 300, percentOff: 10 }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "С", percentOff: 10 }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "OLD", percentOff: 10, validTo: "2026-01-01" }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "BAD", percentOff: 10, validTo: "31.12.2026" }, 5490, now)).toMatchObject({ ok: false });
    expect(validatePromo({ code: "NY", percentOff: 10, validFrom: "2026-12-01", validTo: "2026-11-01" }, 5490, now)).toMatchObject({ ok: false });
  });
});

describe("10. триггерные письма: склонение и слово по аудитории", () => {
  const rule = (e: string) => DEFAULT_RULES.find((r) => r.event === e)!.template;
  it("«Сказка про Машу» для детей, «Книга про Ивана» для взрослых; старый текст правила тоже правится", () => {
    expect(fill(rule("text_abandoned"), { name: "Маша", gender: "girl", audience: "CHILD", link: "L" })).toMatch(/^Сказка про Машу уже ждёт/);
    expect(fill(rule("text_abandoned"), { name: "Иван", gender: "boy", audience: "ADULT", link: "L" })).toMatch(/^Книга про Ивана уже ждёт/);
    expect(fill("Сказка про {name} уже ждёт вас", { name: "Барсик", gender: "boy", audience: "PET" })).toBe("Книга про Барсика уже ждёт вас");
    expect(bookWord("TEEN")).toBe("книга");
  });
  it("«у Маши», «о Льве / об Ане», «главная героиня»", () => {
    const t = fill(rule("hero_birthday"), { name: "Маша", gender: "girl", date: "20 ноября", deadline: "6 ноября", link: "L" });
    expect(t).toContain("день рождения у Маши");
    expect(t).toContain("где Маша — главная героиня");
    expect(fill("{date} — день рождения у {name}. Книга, где {name} — главный герой", { name: "Лев", gender: "boy", date: "1 мая" })).toBe("1 мая — день рождения у Льва. Книга, где Лев — главный герой");
    expect(fill("Книга о {name}", { name: "Аня", gender: "girl" })).toBe("Книга об Ане");
    expect(fill("{name.дат} понравится", { name: "Маша", gender: "girl" })).toBe("Маше понравится");
  });
});

describe("12. воркер: пачка не теряет задачи", () => {
  it("ошибка одной задачи не прерывает остальные", async () => {
    const done: number[] = [];
    const errors = await runBatch([1, 2, 3], async (j) => {
      if (j === 1) throw new Error("лимит");
      done.push(j);
    });
    expect(done).toEqual([2, 3]);
    expect(errors).toHaveLength(1);
  });
});

describe("13. фото до 15 МБ", () => {
  it("лимит тела через middleware — 16 МБ", () => {
    expect(readFileSync("next.config.ts", "utf8")).toMatch(/middlewareClientMaxBodySize:\s*"16mb"/);
  });
});

describe("15. IP из X-Forwarded-For — последнее звено (Caddy)", () => {
  it("подделанные левые адреса игнорируются, доверенные прокси пропускаются", () => {
    expect(pickClientIp("1.1.1.1, 203.0.113.9")).toBe("203.0.113.9");
    expect(pickClientIp("1.1.1.1, 203.0.113.9, 10.0.0.5", null, "10.0.")).toBe("203.0.113.9");
    expect(pickClientIp(null, "198.51.100.1")).toBe("198.51.100.1");
    expect(pickClientIp("", null)).toBe("0.0.0.0");
  });
});

describe("16. «Как к вам обращаться»", () => {
  it("буквы, пробел, дефис; до 40 символов; пусто — null", () => {
    expect(cleanFirstName("  Анна  ")).toBe("Анна");
    expect(cleanFirstName("Анна-Мария")).toBe("Анна-Мария");
    expect(cleanFirstName("Mary Ann")).toBe("Mary Ann");
    expect(cleanFirstName("")).toBeNull();
    expect(cleanFirstName("<b>")).toBe(false);
    expect(cleanFirstName("Анна1")).toBe(false);
    expect(cleanFirstName("А".repeat(41))).toBe(false);
  });
});

describe("6. обезличивание текста", () => {
  it("имя и падежные формы → [имя]", () => {
    expect(scrubNames("Маше понравилось, Машу не узнать. Маша!", ["Маша"])).toBe("[имя] понравилось, [имя] не узнать. [имя]!");
    expect(scrubNames("Машина", ["Маша"])).toBe("Машина");
  });
});
