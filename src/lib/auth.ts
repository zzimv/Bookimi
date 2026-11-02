import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { hmac, otpCode, sha256, token } from "./crypto";
import { hit, pickClientIp } from "./limits";
import { checkFirstName, FIRST_NAME_ERROR } from "./first-name";
export { FIRST_NAME_ERROR };

export const SESSION_COOKIE = "bk_session";
export const ANON_COOKIE = "bk_anon";
const SESSION_DAYS = 30;
/** Сессия сотрудника (владелец, оператор, маркетолог) живёт не дольше 12 часов. */
export const STAFF_SESSION_HOURS = 12;
export const isStaffRole = (role: Role | string | null | undefined) => role === "OWNER" || role === "OPERATOR" || role === "MARKETER";

export const isDemo = () => process.env.DEMO_MODE === "1";

export function normalizeTarget(raw: string): { kind: "email" | "phone"; value: string } | null {
  const v = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { kind: "email", value: v };
  const digits = v.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return { kind: "phone", value: `+7${digits.slice(1)}` };
  if (digits.length === 10 && digits.startsWith("9")) return { kind: "phone", value: `+7${digits}` };
  return null;
}

/**
 * IP покупателя. X-Forwarded-For дописывает каждый прокси справа, поэтому доверяем только последнему звену
 * (Caddy) — первые элементы присылает клиент и может подделать. TRUSTED_PROXIES — адреса прокси перед Caddy
 * (CDN, балансировщик; через запятую, допускается префикс «10.0.»), их пропускаем справа налево.
 */
export async function clientIp() {
  const h = await headers();
  return pickClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"), process.env.TRUSTED_PROXIES);
}

export async function anonId() {
  return (await cookies()).get(ANON_COOKIE)?.value ?? "no-anon";
}

/**
 * Отправка одноразового кода. В демо-режиме код возвращается для показа на экране.
 * Сбой почты/SMS — понятная ошибка покупателю (status 503), код аннулируется; исключение наружу не уходит.
 */
export async function requestOtp(raw: string): Promise<{ ok: true; demoCode?: string } | { ok: false; error: string; status?: number }> {
  const t = normalizeTarget(raw);
  if (!t) return { ok: false, error: "Проверьте email или телефон" };
  const ip = await clientIp();
  if (!(await hit(`otp:${t.value}`, "otp", 5)) || !(await hit(`otpip:${ip}`, "otp", 30))) {
    return { ok: false, error: "Слишком много попыток. Попробуйте завтра или напишите в поддержку." };
  }
  // admin-хост: код — только сотрудникам; остальным тот же ответ «отправили», но без письма (адреса не перебрать)
  if (await onAdminHost()) {
    const u = await db.user.findUnique({ where: t.kind === "email" ? { email: t.value } : { phone: t.value }, select: { role: true, deletedAt: true } });
    if (!u || u.deletedAt || !isStaffRole(u.role)) return { ok: true };
  }
  const code = otpCode();
  const row = await db.otpCode.create({
    data: { target: t.value, codeHash: sha256(`${t.value}:${code}`), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  const { sendOtp, maskContact } = await import("./notify");
  try {
    await sendOtp(t.kind, t.value, code);
  } catch (e) {
    // Код, который не дошёл, не должен работать; в журнал — без кода и с замаскированным адресом
    await db.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } }).catch(() => {});
    console.error("[otp] не отправлен:", maskContact(t.value), (e as Error).message);
    return {
      ok: false,
      status: 503,
      error: t.kind === "email" ? "Не получилось отправить письмо с кодом. Попробуйте ещё раз через минуту или напишите в поддержку." : "Не получилось отправить SMS с кодом. Попробуйте ещё раз через минуту или войдите по почте.",
    };
  }
  return isDemo() ? { ok: true, demoCode: code } : { ok: true };
}

/** «Как к вам обращаться»: до 40 символов — буквы, пробел, дефис (апостроф для «Д'Артаньян» не берём). Пусто — null. */
export function cleanFirstName(raw: string | null | undefined): string | null | false {
  // Та же проверка и нормализация, что в форме: «анна» → «Анна» (src/lib/first-name.ts → normalizeName)
  return checkFirstName(raw);
}

export async function verifyOtp(raw: string, code: string, opts: { referral?: string; device?: string; firstName?: string | null } = {}) {
  const t = normalizeTarget(raw);
  if (!t) return { ok: false as const, error: "Проверьте email или телефон" };
  const row = await db.otpCode.findFirst({
    where: { target: t.value, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false as const, error: "Код устарел. Запросите новый." };
  // admin-хост: вход только сотрудникам, новых аккаунтов здесь не создаём (код не тратим)
  if (await onAdminHost()) {
    const u = await db.user.findUnique({ where: t.kind === "email" ? { email: t.value } : { phone: t.value }, select: { role: true, deletedAt: true } });
    if (!u || u.deletedAt || !isStaffRole(u.role)) return { ok: false as const, error: "Вход на этом адресе — только для сотрудников" };
  }
  if (row.attempts >= 5) return { ok: false as const, error: "Слишком много попыток. Запросите новый код." };
  if (row.codeHash !== sha256(`${t.value}:${code.trim()}`)) {
    await db.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: "Неверный код" };
  }
  await db.otpCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  const where = t.kind === "email" ? { email: t.value } : { phone: t.value };
  let user = await db.user.findUnique({ where });
  if (!user) {
    const { attachReferral } = await import("./referral");
    user = await db.user.create({
      data: { ...where, referralCode: referralCodeFor(t.value), deviceHashes: opts.device ? [opts.device] : [], firstName: opts.firstName || null },
    });
    if (opts.referral) await attachReferral(user.id, opts.referral, opts.device);
  } else {
    const data: { deviceHashes?: { push: string }; firstName?: string } = {};
    if (opts.device && !user.deviceHashes.includes(opts.device)) data.deviceHashes = { push: opts.device };
    // Имя из формы входа — только если покупатель его указал (пустое поле не стирает сохранённое)
    if (opts.firstName && opts.firstName !== user.firstName) data.firstName = opts.firstName;
    if (Object.keys(data).length && !user.deletedAt) user = await db.user.update({ where: { id: user.id }, data });
  }
  if (user.deletedAt) return { ok: false as const, error: "Аккаунт удалён" };
  await createSession(user.id, user.role);
  // Черновики и книги, созданные до входа, привязываются к аккаунту
  const anon = await anonId();
  if (anon === "no-anon") return { ok: true as const, user }; // admin-хост и запросы без cookie: чужие «ничьи» книги не забираем
  await db.book.updateMany({ where: { anonId: anon, userId: null }, data: { userId: user.id } });
  await db.quizDraft.updateMany({ where: { anonId: anon, userId: null }, data: { userId: user.id } });
  // Герои книг и черновиков этого браузера — тоже в аккаунт («Мои герои», напоминания о дне рождения)
  await attachAnonHeroes(anon, user.id);
  return { ok: true as const, user };
}

function referralCodeFor(seed: string) {
  return hmac(`ref:${seed}:${Date.now()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 7).toUpperCase();
}

/** Срок сессии: покупатель — 30 дней, сотрудник — 12 часов (вход в админку заново с 2FA). */
export function sessionTtlSeconds(role?: Role | string | null) {
  return isStaffRole(role) ? STAFF_SESSION_HOURS * 3600 : SESSION_DAYS * 86400;
}

/** Сессия ещё действует: не истекла, аккаунт не удалён, у сотрудника — не старше 12 часов (даже если роль выдали позже). */
export function sessionAlive(s: { expiresAt: Date; createdAt: Date; user: { deletedAt: Date | null; role: Role | string } }, now = new Date()) {
  if (s.expiresAt < now || s.user.deletedAt) return false;
  if (isStaffRole(s.user.role) && now.getTime() - s.createdAt.getTime() > STAFF_SESSION_HOURS * 3600_000) return false;
  return true;
}

/** Запрос пришёл на admin-хост (admin.<DOMAIN>); разделение выключено (локально, демо) — false. */
export async function onAdminHost() {
  const { adminHosts, requestHost } = await import("./admin-host");
  const cfg = adminHosts();
  return !!cfg && requestHost(await headers()) === cfg.admin;
}

/**
 * Сессия после входа. Покупатель — cookie bk_session (основной домен, SameSite=Lax). Сотрудник на admin-хосте —
 * отдельная сессия scope=staff в cookie bk_staff: только этот хост (без Domain), SameSite=Strict, Secure, HttpOnly;
 * вход пишется в журнал с IP и устройством, новый IP/устройство — алерт владельцу. Сотрудник на основном домене —
 * обычная сессия покупателя (админку она не открывает). Без разделения хостов (локально, демо) сотрудник получает обе.
 */
export async function createSession(userId: string, role?: Role | string | null) {
  const { adminHosts, STAFF_COOKIE } = await import("./admin-host");
  const staff = isStaffRole(role);
  const split = !!adminHosts();
  const adminHost = await onAdminHost();
  if (adminHost && !staff) throw new Error("Вход на этом адресе — только для сотрудников");
  const h = await headers();
  const ip = await clientIp();
  const ua = (h.get("user-agent") ?? "").slice(0, 300);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  if (staff && (adminHost || !split)) {
    const raw = token();
    const ttl = STAFF_SESSION_HOURS * 3600;
    await db.session.create({ data: { userId, tokenHash: sha256(raw), csrfToken: token(16), scope: "staff", ip, userAgent: ua, expiresAt: new Date(Date.now() + ttl * 1000) } });
    jar.set(STAFF_COOKIE, raw, { httpOnly: true, secure: secure || adminHost, sameSite: "strict", path: "/", maxAge: ttl });
    await staffLoginAudit(userId, ip, ua);
    if (adminHost) return;
  }
  const raw = token();
  const ttl = sessionTtlSeconds(role);
  await db.session.create({
    data: { userId, tokenHash: sha256(raw), csrfToken: token(16), scope: "customer", ip, userAgent: ua, expiresAt: new Date(Date.now() + ttl * 1000) },
  });
  jar.set(SESSION_COOKIE, raw, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ttl });
}

/** Отпечаток устройства для журнала входов: браузер и система без версий мелких сборок. */
export function deviceLabel(ua: string) {
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "другая ОС";
  const br = /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "браузер";
  return `${br}, ${os}`;
}

/** Вход сотрудника: журнал (IP, устройство); IP или устройство впервые — алерт владельцу. */
export async function staffLoginAudit(userId: string, ip: string, ua: string) {
  const device = sha256(`ua:${ua}`).slice(0, 16);
  const prev = await db.auditLog.findMany({ where: { action: "admin.login", entityId: userId }, select: { details: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const seen = prev.map((p) => (p.details ?? {}) as { ip?: string; device?: string });
  const newIp = !seen.some((x) => x.ip === ip);
  const newDevice = !seen.some((x) => x.device === device);
  await db.auditLog.create({ data: { actorId: userId, action: "admin.login", entity: "user", entityId: userId, details: { ip, device, userAgent: ua, newIp, newDevice } } });
  if (newIp || newDevice) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    const { alertOwner } = await import("./notify");
    await alertOwner(
      `Вход в админку: ${newIp ? "новый IP" : ""}${newIp && newDevice ? " и " : ""}${newDevice ? "новое устройство" : ""}`,
      `${u?.email ?? userId} (${u?.role ?? "?"}) вошёл с IP ${ip}, ${deviceLabel(ua)}. Если это не сотрудник — завершите сессию в Админке → Команда и смените ему роль.`,
    ).catch(() => {});
  }
}

/** Сессия покупателя (cookie bk_session): сессия сотрудника сюда не подходит. */
export async function currentSession() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
  if (!s || s.scope !== "customer" || !sessionAlive(s)) return null;
  return s;
}

/**
 * Сессия сотрудника (cookie bk_staff, scope=staff): только она открывает админку. При разделении хостов —
 * только на admin-хосте (cookie туда и так приходит одна, проверка — на случай ошибки настройки прокси).
 */
export async function currentStaffSession() {
  const { STAFF_COOKIE, adminHosts } = await import("./admin-host");
  if (adminHosts() && !(await onAdminHost())) return null;
  const raw = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!raw) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
  if (!s || s.scope !== "staff" || !isStaffRole(s.user.role) || !sessionAlive(s)) return null;
  return s;
}

/** Сотрудник в этой сессии (для тестовых книг без лимитов покупателя — src/lib/staff.ts). */
export async function currentStaff() {
  const u = await currentUser();
  return u && isStaffRole(u.role) ? u : null;
}

export async function currentUser(): Promise<User | null> {
  return (await currentSession())?.user ?? null;
}

export async function logout() {
  const { STAFF_COOKIE } = await import("./admin-host");
  const jar = await cookies();
  for (const name of [SESSION_COOKIE, STAFF_COOKIE]) {
    const raw = jar.get(name)?.value;
    if (raw) await db.session.deleteMany({ where: { tokenHash: sha256(raw) } });
    jar.delete(name);
  }
}

// ── Роли администраторов ──
export const PERMS = {
  dashboard: ["OWNER", "MARKETER", "OPERATOR"],
  orders: ["OWNER", "OPERATOR"],
  transfers: ["OWNER", "OPERATOR"],
  print: ["OWNER", "OPERATOR"],
  support: ["OWNER", "OPERATOR"],
  triggers: ["OWNER", "MARKETER"],
  promo: ["OWNER", "MARKETER"],
  seo: ["OWNER", "MARKETER"],
  /** «Праздники»: смотрят все сотрудники, меняют владелец и маркетолог. */
  holidays: ["OWNER", "MARKETER", "OPERATOR"],
  holidaysEdit: ["OWNER", "MARKETER"],
  reviews: ["OWNER", "MARKETER", "OPERATOR"],
  catalog: ["OWNER"],
  /** Книги покупателей в админке (поддержка): тексты и иллюстрации, PDF. Маркетологу — нет (ПДн). */
  books: ["OWNER", "OPERATOR"],
  /** Исходные фото детей — только владелец (оператору хватает иллюстраций). */
  photos: ["OWNER"],
  settings: ["OWNER"],
  users: ["OWNER"],
  audit: ["OWNER"],
} satisfies Record<string, Role[]>;
export type Perm = keyof typeof PERMS;

export const can = (role: Role, perm: Perm) => (PERMS[perm] as Role[]).includes(role);
export const seesPersonalData = (role: Role) => role === "OWNER" || role === "OPERATOR";

/** Админка открывается только сессией сотрудника (bk_staff), сессия покупателя — никогда. */
export async function adminSession() {
  return currentStaffSession();
}

/** Страница кабинета: покупатель или переход ко входу (layout и page рендерятся параллельно — без «!»). */
export async function userOrLogin(next = "/kabinet") {
  const u = await currentUser();
  if (!u) redirect(`/vhod?next=${encodeURIComponent(next)}`);
  return u;
}

/**
 * Герои, созданные до входа (книги и черновики анонимной cookie), переходят в аккаунт: без этого «Мои герои» пусты,
 * а напоминание о дне рождения (triggers: hero.userId) не срабатывает. Чужих героев (с userId) не трогаем.
 */
export async function attachAnonHeroes(anon: string, userId: string) {
  const [books, drafts] = await Promise.all([
    db.book.findMany({ where: { anonId: anon, userId }, select: { id: true } }),
    db.quizDraft.findMany({ where: { anonId: anon, userId }, select: { id: true } }),
  ]);
  if (!books.length && !drafts.length) return 0;
  const r = await db.hero.updateMany({
    where: { userId: null, OR: [{ bookId: { in: books.map((b) => b.id) } }, { draftId: { in: drafts.map((d) => d.id) } }] },
    data: { userId },
  });
  return r.count;
}
