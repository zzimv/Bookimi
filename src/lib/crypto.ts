import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Секрет приложения. В продакшне обязателен (длинная случайная строка в .env).
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "1") {
    throw new Error("SESSION_SECRET не задан");
  }
  return s || "dev-secret-change-me";
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const hmac = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");
export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Хэш идентификатора (телефон, email, устройство) для лимитов — без хранения исходного значения. */
export const subjectHash = (v: string) => hmac(`subj:${v.trim().toLowerCase()}`).slice(0, 32);

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Подпись ссылки на файл: действует ttl секунд (по умолчанию 15 минут). */
export function signPath(key: string, ttl = 900) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = hmac(`${key}|${exp}`);
  return `/api/files?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

export function verifyPath(key: string, exp: string, sig: string) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now() / 1000) return false;
  return safeEqual(hmac(`${key}|${e}`), sig);
}

/** Подписанный токен с полезной нагрузкой (отписка, привязка Telegram). */
export function signToken(payload: string) {
  return `${Buffer.from(payload).toString("base64url")}.${hmac(`tok:${payload}`).slice(0, 22)}`;
}

export function readToken(t: string): string | null {
  const [p, s] = t.split(".");
  if (!p || !s) return null;
  const payload = Buffer.from(p, "base64url").toString();
  return safeEqual(hmac(`tok:${payload}`).slice(0, 22), s) ? payload : null;
}

/** Шифрование секретов в БД (пароль SMTP, ключ TOTP). */
export function encrypt(plain: string) {
  const key = createHash("sha256").update(secret()).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(v: string) {
  if (!v.startsWith("v1.")) return v;
  const [, iv, tag, data] = v.split(".");
  const key = createHash("sha256").update(secret()).digest();
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

// ── TOTP (RFC 6238) для 2FA администраторов ──
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function totpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function b32decode(s: string) {
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

export function totpAt(secretB32: string, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", b32decode(secretB32)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

export function totpVerify(secretB32: string, code: string) {
  const now = Date.now();
  return [-30_000, 0, 30_000].some((d) => totpAt(secretB32, now + d) === code.trim());
}
