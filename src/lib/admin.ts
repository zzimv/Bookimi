import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Session, User } from "@prisma/client";
import { adminSession, can, clientIp, isDemo, type Perm } from "./auth";
import { db } from "./db";

/** Свежесть подтверждения 2FA для чувствительных действий (возвраты, реквизиты, цены, роли, подтверждение оплаты). */
export const FRESH_MFA_MINUTES = 10;
/** Попытки кода 2FA: не больше 5 за 15 минут на сотрудника и на IP. */
export const TOTP_MAX_FAILS = 5;
export const TOTP_WINDOW_MINUTES = 15;

/** Нужен ли второй фактор этой сессии: в рабочем режиме — всегда; в демо — только если сотрудник его включил. */
export const mfaRequired = (user: Pick<User, "totpEnabled">) => user.totpEnabled || !isDemo();

/** Подтверждение кодом было не раньше FRESH_MFA_MINUTES назад. */
export function mfaFresh(s: Pick<Session, "mfaPassed" | "mfaAt">, now = Date.now()) {
  return s.mfaPassed && !!s.mfaAt && now - s.mfaAt.getTime() <= FRESH_MFA_MINUTES * 60_000;
}

/** Куда вернуться после повторного ввода кода: только пути админки. */
export function safeAdminNext(raw: string | null | undefined) {
  if (!raw) return "/admin";
  try {
    const u = new URL(raw, "http://x");
    return u.pathname.startsWith("/admin") && !u.pathname.startsWith("/admin/2fa") ? `${u.pathname}${u.search}` : "/admin";
  } catch {
    return "/admin";
  }
}

/**
 * Доступ к разделу админки. Вход по коду + 2FA (TOTP). В демо-режиме 2FA можно не настраивать.
 * Роли: владелец / оператор / маркетолог (подрядчики по ГПХ), права — PERMS в auth.ts.
 * fresh: чувствительное действие — нужен код 2FA, введённый не раньше 10 минут назад; иначе — на страницу
 * подтверждения и обратно (действие нужно повторить).
 */
export async function requireAdmin(perm: Perm, opts: { fresh?: boolean } = {}) {
  const s = await adminSession();
  if (!s) redirect("/vhod?next=/admin");
  if (!s.mfaPassed && mfaRequired(s.user)) redirect("/admin/2fa");
  if (!can(s.user.role, perm)) redirect("/admin?denied=1");
  if (opts.fresh && mfaRequired(s.user) && !mfaFresh(s)) {
    const ref = (await headers()).get("referer");
    redirect(`/admin/2fa?reauth=1&next=${encodeURIComponent(safeAdminNext(ref))}`);
  }
  return s.user;
}

/** Сколько неудачных попыток кода 2FA за последние 15 минут: у сотрудника и с этого IP. */
export async function totpFailures(userId: string, ip: string) {
  const since = new Date(Date.now() - TOTP_WINDOW_MINUTES * 60_000);
  const [byUser, byIp] = await Promise.all([
    db.auditLog.count({ where: { action: "auth.2fa_fail", entityId: userId, createdAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "auth.2fa_fail", createdAt: { gte: since }, details: { path: ["ip"], equals: ip } } }),
  ]);
  return { byUser, byIp, blocked: byUser >= TOTP_MAX_FAILS || byIp >= TOTP_MAX_FAILS };
}

/** Записать неудачную попытку. Возвращает true, если лимит только что исчерпан (блокировка + алерт владельцу). */
export async function recordTotpFailure(userId: string, email: string | null, ipArg?: string) {
  const ip = ipArg ?? (await clientIp());
  await db.auditLog.create({ data: { actorId: userId, action: "auth.2fa_fail", entity: "user", entityId: userId, details: { ip } } });
  const f = await totpFailures(userId, ip);
  const justLocked = f.byUser === TOTP_MAX_FAILS || f.byIp === TOTP_MAX_FAILS;
  if (justLocked) {
    await db.auditLog.create({ data: { actorId: userId, action: "auth.2fa_locked", entity: "user", entityId: userId, details: { ip, byUser: f.byUser, byIp: f.byIp } } });
    const { alertOwner } = await import("./notify");
    await alertOwner(
      "Подбор кода 2FA в админку",
      `${TOTP_MAX_FAILS} неверных кодов 2FA за ${TOTP_WINDOW_MINUTES} минут: сотрудник ${email ?? userId}, IP ${ip}. Вход заблокирован на ${TOTP_WINDOW_MINUTES} минут, сессия завершена. Если это не сотрудник — смените ему роль в «Команде».`,
    ).catch(() => {});
  }
  return { ...f, justLocked };
}

/** Для API админки: сотрудник с правом perm и пройденной 2FA — иначе null (ответ 404, без редиректа). */
export async function adminApi(perm: Perm) {
  const s = await adminSession();
  if (!s || (!s.mfaPassed && mfaRequired(s.user)) || !can(s.user.role, perm)) return null;
  return s.user;
}
