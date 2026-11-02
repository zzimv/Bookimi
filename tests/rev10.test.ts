// Демо rev 10: бонусы за отзыв, «изменить заказ» до печати, вход через внешние аккаунты.
import { describe, expect, it } from "vitest";
import { applyBonus, bonusBalance, bonusWord, maxBonusSpend, reviewBonusAllowed, reviewCredit, BONUS_DEFAULTS } from "@/lib/bonuses";
import { canChangeOrder, CHANGE_LOCKED_TEXT, describeChange } from "@/lib/order-change";
import { authorizeUrl, enabledOAuth, exchangeCode, normalizeProfile, oauthProvider, ruPhone } from "@/lib/oauth";
import { DEFAULTS } from "@/lib/settings";

const DAY = 86400_000;

describe("бонусы за отзыв", () => {
  it("по умолчанию: 300 бонусов, не больше 30 % заказа, сгорают через 180 дней", () => {
    expect(DEFAULTS.bonus).toMatchObject({ enabled: true, reviewRub: 300, maxSharePct: 30, expiryDays: 180 });
  });
  it("начисление только после «получен» и один раз на заказ", () => {
    expect(reviewBonusAllowed({ status: "SHIPPED" }, [], "o1", BONUS_DEFAULTS).ok).toBe(false);
    expect(reviewBonusAllowed({ status: "DELIVERED" }, [], "o1", BONUS_DEFAULTS)).toEqual({ ok: true, rub: 300 });
    const credited = [reviewCredit("o1", BONUS_DEFAULTS, 0)];
    expect(reviewBonusAllowed({ status: "DELIVERED" }, credited, "o1", BONUS_DEFAULTS).ok).toBe(false);
    expect(reviewBonusAllowed({ status: "DELIVERED" }, credited, "o2", BONUS_DEFAULTS).ok).toBe(true);
  });
  it("остаток: списания гасят то, что сгорит раньше; сгоревшее не считается", () => {
    const e = [reviewCredit("a", BONUS_DEFAULTS, 0), reviewCredit("b", BONUS_DEFAULTS, 100 * DAY), { kind: "spend", amountRub: -200, createdAt: 120 * DAY }];
    expect(bonusBalance(e, 130 * DAY).balance).toBe(400);
    // Первые 300 сгорают на 180-й день: от них осталось 100
    expect(bonusBalance(e, 181 * DAY).balance).toBe(300);
    expect(bonusBalance(e, 130 * DAY).nextExpiry).toEqual({ rub: 100, at: 180 * DAY });
    expect(bonusBalance(e, 400 * DAY).balance).toBe(0);
  });
  it("отклонённый отзыв: бонусы списываются обратно", () => {
    const e = [reviewCredit("a", BONUS_DEFAULTS, 0), { kind: "revoke", amountRub: -300, createdAt: DAY, orderId: "a" }];
    expect(bonusBalance(e, 2 * DAY).balance).toBe(0);
  });
  it("списать при оформлении — не больше 30 % заказа и не больше остатка", () => {
    expect(maxBonusSpend(3990, 300, BONUS_DEFAULTS)).toBe(300);
    expect(maxBonusSpend(990, 300, BONUS_DEFAULTS)).toBe(297);
    expect(applyBonus(990, 300, BONUS_DEFAULTS, true)).toEqual({ bonusRub: 297, totalRub: 693 });
    expect(applyBonus(990, 300, BONUS_DEFAULTS, false)).toEqual({ bonusRub: 0, totalRub: 990 });
    expect(applyBonus(990, 300, { enabled: false, maxSharePct: 30 }, true).bonusRub).toBe(0);
  });
  it("склонение", () => {
    expect([1, 2, 5, 11, 21, 300].map(bonusWord)).toEqual(["1 бонус", "2 бонуса", "5 бонусов", "11 бонусов", "21 бонус", "300 бонусов"]);
  });
});

describe("изменить заказ — только до оплаты", () => {
  it("до оплаты можно всё; после оплаты — «Заказ оплачен — изменения через поддержку»", () => {
    expect(canChangeOrder({ status: "PENDING_PAYMENT", whoPrints: "bookimi" }).ok).toBe(true);
    expect(canChangeOrder({ status: "PAID", whoPrints: "bookimi", paidAt: new Date() })).toEqual({ ok: false, reason: CHANGE_LOCKED_TEXT });
    expect(CHANGE_LOCKED_TEXT).toBe("Заказ оплачен — изменения через поддержку");
    for (const st of ["IN_PRINT", "SHIPPED", "DELIVERED"]) expect(canChangeOrder({ status: st, whoPrints: "bookimi" }).ok).toBe(false);
    expect(canChangeOrder({ status: "AWAITING_CONFIRMATION", whoPrints: "bookimi" }).ok).toBe(false);
    expect(canChangeOrder({ status: "PENDING_PAYMENT", whoPrints: "self" }).ok).toBe(false);
  });
  it("что изменилось — строками", () => {
    const lines = describeChange(
      { formatKey: "std-hard", addons: ["poster"], method: "cdek_pvz", address: { city: "Казань", pvzAddress: "ул. Мира, 1" }, contactName: "Анна Петрова" },
      { formatKey: "big-hard", addons: ["stickers"], method: "cdek_courier", address: { city: "Казань", street: "ул. Ленина, 5", flat: "12" }, contactName: "Анна Петрова" },
      { "std-hard": "Стандарт", "big-hard": "Большой", poster: "Постер", stickers: "Наклейки" },
    );
    expect(lines).toEqual(["Формат: Стандарт → Большой", "Добавлено: Наклейки", "Убрано: Постер", "Доставка: cdek_pvz → cdek_courier", "Адрес: Казань, ул. Мира, 1 → Казань, ул. Ленина, 5, 12"]);
  });
});

describe("вход через VK ID, Яндекс ID, Mail.ru, Google", () => {
  it("по умолчанию выключено; включается парой ключей; российские — первыми", () => {
    expect(enabledOAuth({})).toEqual([]);
    const env = { OAUTH_GOOGLE_CLIENT_ID: "g", OAUTH_GOOGLE_CLIENT_SECRET: "s", OAUTH_YANDEX_CLIENT_ID: "y", OAUTH_YANDEX_CLIENT_SECRET: "s", OAUTH_VKID_CLIENT_ID: "v" };
    expect(enabledOAuth(env).map((p) => p.key)).toEqual(["yandex", "google"]);
    expect(enabledOAuth({ ...env, OAUTH_DISABLED: "1" })).toEqual([]);
  });
  it("ссылка авторизации: state, PKCE, redirect", () => {
    const u = new URL(authorizeUrl(oauthProvider("yandex")!, { clientId: "cid", redirectUri: "https://bookimi.ru/api/auth/oauth/yandex/callback", state: "st", codeChallenge: "ch" }));
    expect(u.origin + u.pathname).toBe("https://oauth.yandex.ru/authorize");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ response_type: "code", client_id: "cid", state: "st", code_challenge: "ch", code_challenge_method: "S256" });
    expect(new URL(authorizeUrl(oauthProvider("mailru")!, { clientId: "c", redirectUri: "r", state: "s", codeChallenge: "x" })).searchParams.get("code_challenge")).toBeNull();
  });
  it("профили провайдеров → почта, телефон +7, имя", () => {
    expect(normalizeProfile("yandex", { id: "1", default_email: "Anna@Ya.ru", first_name: "Анна", default_phone: { number: "+7 912 345-67-89" } })).toEqual({ provider: "yandex", providerUserId: "1", email: "anna@ya.ru", phone: "+79123456789", firstName: "Анна" });
    expect(normalizeProfile("vkid", { user: { user_id: 7, email: "a@vk.com", phone: "79123456789", first_name: "Аня" } })?.phone).toBe("+79123456789");
    expect(normalizeProfile("google", { sub: "g1", email: "a@gmail.com", email_verified: false })?.email).toBeNull();
    expect(normalizeProfile("mailru", {})).toBeNull();
    expect(ruPhone("+1 202 555 0100")).toBeNull();
  });
  it("обмен кода — через переданный fetch, без сети", async () => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify(String(url).includes("token") ? { access_token: "t" } : { id: "5", default_email: "x@ya.ru" }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = await exchangeCode(oauthProvider("yandex")!, { clientId: "c", clientSecret: "s", code: "k", redirectUri: "r", codeVerifier: "v" }, f);
    expect(p?.email).toBe("x@ya.ru");
    expect(calls).toEqual(["https://oauth.yandex.ru/token", "https://login.yandex.ru/info?format=json"]);
  });
});

describe("«Оживление книги» — пока скоро", () => {
  it("cartoon.enabled выключен по умолчанию", () => {
    expect(DEFAULTS.cartoon.enabled).toBe(false);
  });
});
