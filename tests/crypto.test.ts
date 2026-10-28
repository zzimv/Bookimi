import { describe, expect, it } from "vitest";
import { decrypt, encrypt, readToken, signPath, signToken, totpAt, totpSecret, totpVerify, verifyPath } from "@/lib/crypto";
import { npdForecast } from "@/lib/npd";

describe("подписанные ссылки (15 минут)", () => {
  it("действующая ссылка проходит", () => {
    const u = new URL("http://x" + signPath("books/a.pdf"));
    expect(verifyPath(u.searchParams.get("key")!, u.searchParams.get("exp")!, u.searchParams.get("sig")!)).toBe(true);
  });
  it("подделанная — нет", () => {
    const u = new URL("http://x" + signPath("books/a.pdf"));
    expect(verifyPath("books/b.pdf", u.searchParams.get("exp")!, u.searchParams.get("sig")!)).toBe(false);
  });
  it("просроченная — нет", () => {
    const u = new URL("http://x" + signPath("books/a.pdf", -1));
    expect(verifyPath("books/a.pdf", u.searchParams.get("exp")!, u.searchParams.get("sig")!)).toBe(false);
  });
});

describe("секреты и 2FA", () => {
  it("шифрование", () => expect(decrypt(encrypt("пароль"))).toBe("пароль"));
  it("токены отписки", () => {
    expect(readToken(signToken("unsub:1"))).toBe("unsub:1");
    expect(readToken(signToken("unsub:1").replace(/.$/, "x"))).toBeNull();
  });
  it("TOTP", () => {
    const s = totpSecret();
    expect(totpVerify(s, totpAt(s))).toBe(true);
    expect(totpVerify(s, "000000") && totpAt(s) !== "000000").toBe(false);
  });
});

describe("лимит НПД", () => {
  it("прогноз даты достижения", () => {
    const now = new Date("2026-07-02T12:00:00+03:00");
    const d = npdForecast(1_500_000, 2_400_000, now); // ≈ 8,2 тыс. ₽ в день → лимит в октябре
    expect(d && d.getMonth()).toBe(9);
    expect(npdForecast(100_000, 2_400_000, now)).toBeNull(); // в этом году не достигнет
  });
});
