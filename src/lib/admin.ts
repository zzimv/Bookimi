import "server-only";
import { redirect } from "next/navigation";
import { adminSession, can, isDemo, type Perm } from "./auth";

/**
 * Доступ к разделу админки. Вход по коду + 2FA (TOTP). В демо-режиме 2FA можно не настраивать.
 * Роли: владелец / оператор / маркетолог (подрядчики по ГПХ), права — PERMS в auth.ts.
 */
export async function requireAdmin(perm: Perm) {
  const s = await adminSession();
  if (!s) redirect("/vhod?next=/admin");
  if (!s.mfaPassed && (s.user.totpEnabled || !isDemo())) redirect("/admin/2fa");
  if (!can(s.user.role, perm)) redirect("/admin?denied=1");
  return s.user;
}
