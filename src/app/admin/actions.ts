"use server";
// Действия кабинета администратора. Каждое — с проверкой роли и записью в журнал.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrderStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { mfaFresh, requireAdmin, safeAdminNext, totpAttempt } from "@/lib/admin";
import { clientIp, currentSession, isStaffRole } from "@/lib/auth";
import { audit, confirmTransfer, refundOrder, setStatus, STATUS_FLOW } from "@/lib/orders";
import { sendToPrint } from "@/lib/print";
import { attachManualReceipt } from "@/lib/npd";
import { DEFAULTS, cfg, saveSetting, type SettingKey } from "@/lib/settings";
import { enqueue, QUEUES } from "@/lib/queue";
import { decrypt, encrypt, looksLikeRecovery, recoveryCodes, recoveryHash, totpSecret, totpVerify } from "@/lib/crypto";
import { sendTestTrigger } from "@/lib/triggers";
import { pingIndexNow } from "@/lib/indexnow";
import { optNum, parseTiers, validatePromo, validateSettings } from "@/lib/settings-validate";
import { validateAddonForm } from "@/lib/addons-core";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k) ?? 0);
const b = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

/** Ошибка проверки — обратно на страницу с понятным текстом (страница показывает ?error=). */
function fail(path: string, error: string, anchor = ""): never {
  redirect(`${path}?error=${encodeURIComponent(error)}${anchor ? `#${anchor}` : ""}`);
}

/** Разделы настроек, которые меняют деньги и реквизиты: нужен свежий код 2FA. */
const SENSITIVE_SETTINGS: SettingKey[] = ["seller", "tax", "payments", "notifications", "audio", "cartoon", "bulk", "referral", "alerts"];

// ── Заказы ──
export async function confirmTransferAction(f: FormData) {
  const u = await requireAdmin("transfers", { fresh: true });
  await confirmTransfer(s(f, "orderId"), u.id);
  revalidatePath("/admin");
}

export async function sendToPrintAction(f: FormData) {
  const u = await requireAdmin("print");
  const id = s(f, "orderId");
  let error = "";
  try {
    await sendToPrint(id, u.id);
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath(`/admin/zakazy/${id}`);
  if (error) fail(`/admin/zakazy/${id}`, error);
}

export async function setStatusAction(f: FormData) {
  const u = await requireAdmin("orders");
  const status = s(f, "status") as OrderStatus;
  // Вручную — только шаги после оплаты (PAID → … → DELIVERED); оплату и возврат меняют свои действия
  if (!STATUS_FLOW.includes(status)) fail(`/admin/zakazy/${s(f, "orderId")}`, "Такой статус вручную не ставится");
  const cur = await db.order.findUnique({ where: { id: s(f, "orderId") }, select: { status: true } });
  if (!cur || !STATUS_FLOW.includes(cur.status)) fail(`/admin/zakazy/${s(f, "orderId")}`, "Статус меняется только у оплаченного заказа");
  await setStatus(s(f, "orderId"), status, u.id, s(f, "track") || undefined);
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function refundAction(f: FormData) {
  const u = await requireAdmin("orders", { fresh: true });
  const id = s(f, "orderId");
  const r = await refundOrder(id, u.id, s(f, "reason") || "возврат");
  revalidatePath(`/admin/zakazy/${id}`);
  if (!r.ok) fail(`/admin/zakazy/${id}`, r.error);
}

export async function reprintAction(f: FormData) {
  const u = await requireAdmin("orders");
  const id = s(f, "orderId");
  const { printFilesReady } = await import("@/lib/print");
  const ready = await printFilesReady(id, { reprint: true });
  if (!ready.ok) fail(`/admin/zakazy/${id}`, ready.error);
  await db.printJob.deleteMany({ where: { orderId: id } });
  await audit(u.id, "order.reprint", "order", id, { reason: s(f, "reason") });
  let error = "";
  try {
    await sendToPrint(id, u.id, { reprint: true });
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath(`/admin/zakazy/${id}`);
  if (error) fail(`/admin/zakazy/${id}`, error);
}

export async function attachReceiptAction(f: FormData) {
  const u = await requireAdmin("orders");
  const url = s(f, "url");
  if (!/^https:\/\/lknpd\.nalog\.ru\//.test(url) && !/^https:\/\//.test(url)) return;
  await attachManualReceipt(s(f, "orderId"), url);
  await audit(u.id, "receipt.attach", "order", s(f, "orderId"));
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function regenerateAction(f: FormData) {
  const u = await requireAdmin("orders");
  const bookId = s(f, "bookId");
  const index = n(f, "index");
  await enqueue(QUEUES.redraw, { bookId, index });
  await audit(u.id, "book.regenerate", "book", bookId, { index });
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function ticketAction(f: FormData) {
  const u = await requireAdmin("support");
  await db.supportTicket.update({ where: { id: s(f, "id") }, data: { status: s(f, "status") || "answered", answer: s(f, "answer") || undefined } });
  await audit(u.id, "support.update", "ticket", s(f, "id"));
  revalidatePath("/admin/podderzhka");
}

// ── Каталог ──
export async function storyAction(f: FormData) {
  const u = await requireAdmin("catalog");
  const id = s(f, "id");
  await db.story.update({
    where: { id },
    data: {
      title: s(f, "title"),
      tagline: s(f, "tagline"),
      description: s(f, "description"),
      ageMin: n(f, "ageMin"),
      ageMax: n(f, "ageMax"),
      sortOrder: n(f, "sortOrder"),
      isActive: b(f, "isActive"),
      textTemplate: s(f, "textTemplate"),
      coverUrl: s(f, "coverUrl") || null,
    },
  });
  await audit(u.id, "catalog.story", "story", id);
  revalidatePath("/", "layout");
}

export async function formatAction(f: FormData) {
  const u = await requireAdmin("catalog", { fresh: true });
  const price = optNum(f.get("priceRub"));
  if (price == null || !Number.isInteger(price) || price < 1 || price > 1_000_000) fail("/admin/katalog", "Цена формата: целое число рублей от 1");
  if (!s(f, "title")) fail("/admin/katalog", "Название формата не может быть пустым");
  await db.productFormat.update({ where: { id: s(f, "id") }, data: { priceRub: price, isActive: b(f, "isActive"), title: s(f, "title") } });
  await audit(u.id, "catalog.format", "format", s(f, "id"), { price: n(f, "priceRub") });
  revalidatePath("/", "layout");
}

export async function addonAction(f: FormData) {
  const u = await requireAdmin("catalog", { fresh: true });
  const id = s(f, "id");
  const row = await db.addon.findUnique({ where: { id } });
  if (!row) fail("/admin/katalog", "Доп не найден");
  const related = await db.addon.findMany({ where: { key: { in: ["cartoon", "cartoon-own-voice"] } }, select: { key: true, audiences: true } });
  const v = validateAddonForm(
    {
      title: s(f, "title"),
      description: s(f, "description"),
      priceRub: optNum(f.get("priceRub")),
      percentOff: optNum(f.get("percentOff")),
      audiences: f.getAll("audiences").map(String),
      supplier: s(f, "supplier") || row.supplier,
      isActive: b(f, "isActive"),
    },
    row,
    { cartoon: related.find((r) => r.key === "cartoon")?.audiences, ownVoice: related.find((r) => r.key === "cartoon-own-voice")?.audiences },
  );
  if (!v.ok) fail("/admin/katalog", `«${row.title}»: ${v.error}`, `addon-${row.key}`);
  const d = v.value;
  await db.addon.update({
    where: { id },
    data: { priceRub: d.priceRub, percentOff: d.percentOff, isActive: d.isActive, title: d.title, description: d.description, audiences: d.audiences, supplier: d.supplier },
  });
  await audit(u.id, "catalog.addon", "addon", id, { audiences: d.audiences, supplier: d.supplier });
  revalidatePath("/admin/katalog");
}

export async function styleAction(f: FormData) {
  const u = await requireAdmin("catalog");
  await db.illustrationStyle.update({ where: { id: s(f, "id") }, data: { isActive: b(f, "isActive"), title: s(f, "title"), description: s(f, "description") } });
  await audit(u.id, "catalog.style", "style", s(f, "id"));
  revalidatePath("/admin/katalog");
}

// ── Промокоды, отзывы, триггеры ──
export async function promoAction(f: FormData) {
  const u = await requireAdmin("promo");
  const id = s(f, "id");
  if (id) {
    await db.promoCode.update({ where: { id }, data: { isActive: b(f, "isActive") } });
  } else {
    const maxPrice = (await db.productFormat.aggregate({ where: { isActive: true }, _max: { priceRub: true } }))._max.priceRub ?? 990;
    const v = validatePromo(
      { code: s(f, "code"), percentOff: optNum(f.get("percentOff")), amountOffRub: optNum(f.get("amountOffRub")), maxUses: optNum(f.get("maxUses")), validFrom: s(f, "validFrom") || null, validTo: s(f, "validTo") || null, blogger: s(f, "blogger") },
      maxPrice,
    );
    if (!v.ok) fail("/admin/promokody", v.error);
    if (await db.promoCode.findUnique({ where: { code: v.value.code } })) fail("/admin/promokody", `Промокод ${v.value.code} уже есть — придумайте другой код`);
    let dup = false;
    try {
      await db.promoCode.create({
        data: { ...v.value, validFrom: v.value.validFrom ?? undefined, source: v.value.blogger ? "blogger" : "manual" },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
      dup = true;
    }
    if (dup) fail("/admin/promokody", `Промокод ${v.value.code} уже есть — придумайте другой код`);
  }
  await audit(u.id, "promo.save", "promo", id || s(f, "code"));
  revalidatePath("/admin/promokody");
}

export async function reviewAction(f: FormData) {
  const u = await requireAdmin("reviews");
  await db.review.update({ where: { id: s(f, "id") }, data: { status: s(f, "status") } });
  await audit(u.id, "review.moderate", "review", s(f, "id"), { status: s(f, "status") });
  revalidatePath("/", "layout");
}

export async function triggerAction(f: FormData) {
  const u = await requireAdmin("triggers");
  const id = s(f, "id");
  const data = {
    name: s(f, "name"),
    event: s(f, "event"),
    delayMinutes: n(f, "delayMinutes"),
    template: s(f, "template"),
    promoPercent: f.get("promoPercent") ? n(f, "promoPercent") : null,
    controlPct: n(f, "controlPct"),
    isActive: b(f, "isActive"),
    isMarketing: true,
  };
  if (id) await db.triggerRule.update({ where: { id }, data });
  else await db.triggerRule.create({ data: { ...data, condition: {}, channel: "preferred" } });
  await audit(u.id, "trigger.save", "trigger", id || data.name);
  revalidatePath("/admin/triggery");
}

export async function triggerTestAction(f: FormData) {
  const u = await requireAdmin("triggers");
  await sendTestTrigger(s(f, "id"), u.id);
  revalidatePath("/admin/triggery");
}

// ── SEO и блог ──
export async function seoAction(f: FormData) {
  const u = await requireAdmin("seo");
  const kind = s(f, "kind");
  const data = { seoTitle: s(f, "seoTitle") || null, seoDescription: s(f, "seoDescription") || null };
  if (kind === "story") await db.story.update({ where: { id: s(f, "id") }, data });
  else await db.occasion.update({ where: { id: s(f, "id") }, data: { ...data, h1: s(f, "h1"), intro: s(f, "intro") } });
  await audit(u.id, "seo.save", kind, s(f, "id"));
  const row = kind === "story" ? await db.story.findUnique({ where: { id: s(f, "id") } }) : await db.occasion.findUnique({ where: { id: s(f, "id") } });
  if (row) await pingIndexNow([`/${kind === "story" ? "skazki" : "povod"}/${row.slug}`]);
  revalidatePath("/", "layout");
}

export async function blogAction(f: FormData) {
  const u = await requireAdmin("seo");
  const id = s(f, "id");
  const data = {
    slug: s(f, "slug"),
    title: s(f, "title"),
    description: s(f, "description"),
    body: s(f, "body"),
    publishedAt: b(f, "published") ? new Date() : null,
  };
  if (id) await db.blogPost.update({ where: { id }, data });
  else await db.blogPost.create({ data });
  await audit(u.id, "blog.save", "post", data.slug);
  if (data.publishedAt) await pingIndexNow([`/blog/${data.slug}`, "/blog"]);
  revalidatePath("/blog", "layout");
}

// ── Настройки ──
function parseSection(key: SettingKey, f: FormData) {
  const base = structuredClone(DEFAULTS[key]) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const set = (path: string, v: unknown) => {
    const parts = path.split(".");
    let o = out;
    for (const p of parts.slice(0, -1)) o = (o[p] ??= {}) as Record<string, unknown>;
    o[parts.at(-1)!] = v;
  };
  const get = (path: string) => path.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], base);
  for (const [name, raw] of f.entries()) {
    if (!name.startsWith("f.")) continue;
    const path = name.slice(2);
    const def = get(path);
    const v = String(raw);
    if (typeof def === "number") set(path, v.trim() === "" ? NaN : Number(v.replace(",", ".")));
    else if (Array.isArray(def) && def[0] && typeof def[0] === "object") set(path, parseTiers(v));
    else if (Array.isArray(def)) set(path, v.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (typeof def[0] === "number" ? Number(x) : x)));
    else set(path, v);
  }
  // Чекбоксы: отсутствуют в форме, если выключены
  for (const name of String(f.get("__bools") ?? "").split(",").filter(Boolean)) set(name, f.get(`f.${name}`) === "on");
  return out;
}

export async function settingsAction(f: FormData) {
  const key = s(f, "__key") as SettingKey;
  if (!(key in DEFAULTS)) return;
  // Реквизиты, способы оплаты, цены — только со свежим кодом 2FA
  const u = await requireAdmin("settings", { fresh: SENSITIVE_SETTINGS.includes(key) });
  const current = (await cfg(key)) as Record<string, unknown>;
  const next = { ...current, ...parseSection(key, f) } as Record<string, unknown>;
  // Пароль SMTP шифруется; пустое поле — оставить прежний
  if (key === "notifications") {
    const pw = s(f, "f.smtpPassword");
    next.smtpPassword = pw ? encrypt(pw) : current.smtpPassword;
  }
  if (key === "seller" && typeof next.inn === "string") next.inn = next.inn.replace(/\D/g, "");
  if (key === "payments") {
    const t = next.transfer as Record<string, unknown> | undefined;
    if (t && typeof t.card === "string") t.card = t.card.replace(/\s/g, "");
  }
  const v = validateSettings(key, next);
  if (!v.ok) redirect(`/admin/nastrojki?sec=${key}&error=${encodeURIComponent(v.error)}#${key}`);
  await saveSetting(key, v.value);
  await audit(u.id, "settings.save", "setting", key, key === "notifications" ? { smtpHost: next.smtpHost } : undefined);
  revalidatePath("/", "layout");
  redirect(`/admin/nastrojki?saved=${key}#${key}`);
}

export async function printHouseAction(f: FormData) {
  const u = await requireAdmin("settings", { fresh: true });
  const id = s(f, "id");
  let costs: Record<string, number> = {};
  for (const line of s(f, "costs").split("\n")) {
    const [k, v] = line.split(/[:=]/).map((x) => x.trim());
    if (k && v && !isNaN(Number(v))) costs[k] = Number(v);
  }
  const data = {
    name: s(f, "name"),
    contacts: s(f, "contacts") || null,
    email: s(f, "email") || null,
    apiUrl: s(f, "apiUrl") || null,
    pickupAddress: s(f, "pickupAddress") || null,
    leadDaysMin: n(f, "leadDaysMin") || 3,
    leadDaysMax: n(f, "leadDaysMax") || 5,
    costs,
    isActive: b(f, "isActive"),
  };
  if (data.isActive) await db.printHouse.updateMany({ data: { isActive: false } });
  if (id) await db.printHouse.update({ where: { id }, data });
  else await db.printHouse.create({ data });
  await audit(u.id, "settings.printHouse", "printHouse", id || data.name);
  revalidatePath("/admin/nastrojki");
}

export async function legalAction(f: FormData) {
  const u = await requireAdmin("settings");
  const key = s(f, "key");
  const markdown = s(f, "markdown");
  await saveSetting(`legal.${key}`, markdown ? { markdown, version: new Date().toISOString().slice(0, 10) } : null);
  await audit(u.id, "legal.save", "legal", key);
  revalidatePath("/", "layout");
}

// ── Команда (подрядчики по ГПХ) ──
export async function teamAction(f: FormData) {
  const u = await requireAdmin("users", { fresh: true });
  const email = s(f, "email").toLowerCase();
  const role = s(f, "role") as Role;
  if (!["OWNER", "OPERATOR", "MARKETER", "CUSTOMER"].includes(role) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("/admin/komanda", "Проверьте email и роль");
  if (email === u.email && role !== "OWNER") fail("/admin/komanda", "Нельзя снять роль владельца с самого себя");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) await db.user.update({ where: { id: existing.id }, data: { role } });
  else await db.user.create({ data: { email, role, referralCode: `T${Date.now().toString(36).toUpperCase()}` } });
  // Смена роли — все сессии этого человека завершаются (новая роль — новый вход с 2FA)
  if (existing && existing.role !== role) await db.session.deleteMany({ where: { userId: existing.id } });
  await audit(u.id, "team.role", "user", email, { role });
  revalidatePath("/admin/komanda");
}

// ── 2FA ──
/**
 * Новый ключ 2FA — только пока 2FA не включена. Включена, а сессия без второго фактора (вход только по коду
 * с почты) — это попытка обхода: на страницу ввода кода. Сменить ключ — через коды восстановления/владельца.
 */
export async function totpSetupAction() {
  const sess = await currentSession();
  if (!sess || !isStaffRole(sess.user.role)) redirect("/vhod");
  if (sess.user.totpEnabled) {
    if (!sess.mfaPassed) await audit(sess.user.id, "security.2fa_setup_blocked", "user", sess.user.id, { ip: await clientIp() });
    redirect("/admin/2fa");
  }
  const secret = totpSecret();
  // Условно: только если 2FA так и не включили (параллельный запрос не перезапишет включённый ключ)
  await db.user.updateMany({ where: { id: sess.user.id, totpEnabled: false }, data: { totpSecret: encrypt(secret) } });
  redirect("/admin/2fa?setup=1");
}

/**
 * Проверка кода: TOTP из приложения или одноразовый код восстановления. Не больше 5 неверных за 15 минут на
 * сотрудника и на IP; на пятой — блокировка, сессия завершается, владельцу — алерт.
 * При настройке — включает 2FA и выдаёт 10 кодов восстановления (показываются один раз).
 */
export async function totpVerifyAction(f: FormData) {
  const sess = await currentSession();
  if (!sess || !isStaffRole(sess.user.role) || !sess.user.totpSecret) redirect("/vhod");
  const reauth = s(f, "reauth") === "1";
  const next = safeAdminNext(s(f, "next"));
  const back = `/admin/2fa?${reauth ? `reauth=1&next=${encodeURIComponent(next)}&` : ""}`;
  const ip = await clientIp();
  const user = sess.user;
  const setup = !user.totpEnabled;
  const code = s(f, "code");
  let usedRecovery = false;
  // Проверка — под блокировкой сотрудника и IP: параллельные запросы идут по одному, после 5-й неудачи код не проверяется
  const r = await totpAttempt(user.id, user.email, ip, async (tx) => {
    if (totpVerify(decrypt(user.totpSecret!), code)) return true;
    if (setup || !looksLikeRecovery(code)) return false;
    const h = recoveryHash(user.id, code);
    // Атомарно: код сгорает при первом использовании
    const n = await tx.$executeRaw`UPDATE "User" SET "totpRecovery" = array_remove("totpRecovery", ${h}) WHERE "id" = ${user.id}::uuid AND ${h} = ANY("totpRecovery")`;
    return (usedRecovery = n === 1);
  });
  if (!r.ok) {
    if (r.justLocked) {
      await db.session.deleteMany({ where: { id: sess.id } });
      redirect("/vhod?next=/admin&locked=1");
    }
    redirect(`${back}${r.locked ? "locked=1" : "error=1"}`);
  }
  const now = new Date();
  if (setup) {
    const codes = recoveryCodes(10);
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpRecovery: codes.map((c) => recoveryHash(user.id, c)) } });
    await db.session.update({ where: { id: sess.id }, data: { mfaPassed: true, mfaAt: now, recoveryShow: encrypt(codes.join(" ")) } });
    await audit(user.id, "auth.2fa_enabled", "user", user.id);
    redirect("/admin/2fa?codes=1");
  }
  await db.session.update({ where: { id: sess.id }, data: { mfaPassed: true, mfaAt: now } });
  await audit(user.id, reauth ? "auth.2fa_reauth" : "auth.2fa", "user", user.id, usedRecovery ? { recovery: true } : undefined);
  if (usedRecovery) {
    const left = (await db.user.findUnique({ where: { id: user.id }, select: { totpRecovery: true } }))?.totpRecovery.length ?? 0;
    const { alertOwner } = await import("@/lib/notify");
    await alertOwner("Вход по коду восстановления 2FA", `Сотрудник ${user.email ?? user.id} вошёл по коду восстановления (IP ${ip}). Осталось кодов: ${left}.`).catch(() => {});
  }
  redirect(reauth ? next : "/admin");
}

/** «Я сохранил(а) коды» — коды восстановления больше не показываются. */
export async function recoveryAckAction() {
  const sess = await currentSession();
  if (!sess) redirect("/vhod");
  await db.session.update({ where: { id: sess.id }, data: { recoveryShow: null } });
  redirect("/admin");
}

/** Новые коды восстановления (старые перестают действовать) — со свежим кодом 2FA. */
export async function recoveryRegenerateAction() {
  const sess = await currentSession();
  if (!sess || !isStaffRole(sess.user.role) || !sess.user.totpEnabled) redirect("/admin");
  if (!mfaFresh(sess)) redirect(`/admin/2fa?reauth=1&next=${encodeURIComponent("/admin/2fa?regen=1")}`);
  const codes = recoveryCodes(10);
  await db.user.update({ where: { id: sess.user.id }, data: { totpRecovery: codes.map((c) => recoveryHash(sess.user.id, c)) } });
  await db.session.update({ where: { id: sess.id }, data: { recoveryShow: encrypt(codes.join(" ")) } });
  await audit(sess.user.id, "auth.2fa_recovery_regenerated", "user", sess.user.id);
  redirect("/admin/2fa?codes=1");
}
