import "server-only";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import type { z, ZodTypeAny } from "zod";
import { db } from "./db";
import { anonId, clientIp, currentUser } from "./auth";
import { rateLimit } from "./limits";
import { alertOwner } from "./notify";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S> | null> {
  try {
    const r = schema.safeParse(await req.json());
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Ограничение частоты: превышение — 429 и запись о подозрительной активности. */
export async function throttle(key: string, max: number, windowMs: number) {
  const ip = await clientIp();
  if (rateLimit(`${key}:${ip}`, max, windowMs)) return null;
  if (rateLimit(`alert:${key}:${ip}`, 1, 3600_000)) {
    await db.auditLog.create({ data: { action: "security.ratelimit", entity: "ip", details: { key, ip } } }).catch(() => {});
    if (rateLimit(`alert-tg:${key}`, 1, 600_000)) alertOwner("Подозрительная активность", `Превышен лимит «${key}» с IP ${ip}`).catch(() => {});
  }
  return err("Слишком много запросов. Попробуйте через минуту.", 429);
}

/** Книга доступна её автору: по аккаунту или по анонимному идентификатору браузера. */
export async function ownBook(bookId: string) {
  if (!/^[0-9a-f-]{36}$/.test(bookId)) return null;
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) return null;
  if (book.userId && user?.id === book.userId) return { book, user };
  if (!book.userId && book.anonId === anon) return { book, user };
  if (user && user.role !== "CUSTOMER") return { book, user, admin: true };
  return null;
}

export async function deviceKey() {
  const anon = await anonId();
  const ua = (await headers()).get("user-agent") ?? "";
  return `${anon}|${ua.slice(0, 60)}`;
}

export async function utmCookie(): Promise<Record<string, string> | undefined> {
  const raw = (await cookies()).get("bk_utm")?.value;
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Яндекс SmartCaptcha. Без серверного ключа проверка пропускается (видно в чек-листе админки). */
export async function verifyCaptcha(token?: string) {
  const secret = process.env.YANDEX_SMARTCAPTCHA_SERVER_KEY;
  if (!secret) return true;
  if (!token) return false;
  const ip = await clientIp();
  const r = await fetch(`https://smartcaptcha.yandexcloud.net/validate?secret=${secret}&token=${encodeURIComponent(token)}&ip=${ip}`).catch(() => null);
  if (!r) return true; // сервис недоступен — не блокируем покупателя, лимиты всё равно действуют
  const j = (await r.json()) as { status: string };
  return j.status === "ok";
}
