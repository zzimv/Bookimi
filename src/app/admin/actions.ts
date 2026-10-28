"use server";
// Действия кабинета администратора. Каждое — с проверкой роли и записью в журнал.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrderStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { currentSession } from "@/lib/auth";
import { audit, confirmTransfer, refundOrder, setStatus } from "@/lib/orders";
import { sendToPrint } from "@/lib/print";
import { attachManualReceipt } from "@/lib/npd";
import { DEFAULTS, cfg, saveSetting, type SettingKey } from "@/lib/settings";
import { enqueue, QUEUES } from "@/lib/queue";
import { encrypt, totpSecret, totpVerify } from "@/lib/crypto";
import { sendTestTrigger } from "@/lib/triggers";
import { pingIndexNow } from "@/lib/indexnow";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k) ?? 0);
const b = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";

// ── Заказы ──
export async function confirmTransferAction(f: FormData) {
  const u = await requireAdmin("transfers");
  await confirmTransfer(s(f, "orderId"), u.id);
  revalidatePath("/admin");
}

export async function sendToPrintAction(f: FormData) {
  const u = await requireAdmin("print");
  await sendToPrint(s(f, "orderId"), u.id);
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function setStatusAction(f: FormData) {
  const u = await requireAdmin("orders");
  await setStatus(s(f, "orderId"), s(f, "status") as OrderStatus, u.id, s(f, "track") || undefined);
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function refundAction(f: FormData) {
  const u = await requireAdmin("orders");
  await refundOrder(s(f, "orderId"), u.id, s(f, "reason") || "возврат");
  revalidatePath(`/admin/zakazy/${s(f, "orderId")}`);
}

export async function reprintAction(f: FormData) {
  const u = await requireAdmin("orders");
  const id = s(f, "orderId");
  await db.printJob.deleteMany({ where: { orderId: id } });
  await audit(u.id, "order.reprint", "order", id, { reason: s(f, "reason") });
  await sendToPrint(id, u.id);
  revalidatePath(`/admin/zakazy/${id}`);
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
  const u = await requireAdmin("catalog");
  await db.productFormat.update({ where: { id: s(f, "id") }, data: { priceRub: n(f, "priceRub"), isActive: b(f, "isActive"), title: s(f, "title") } });
  await audit(u.id, "catalog.format", "format", s(f, "id"), { price: n(f, "priceRub") });
  revalidatePath("/", "layout");
}

export async function addonAction(f: FormData) {
  const u = await requireAdmin("catalog");
  await db.addon.update({
    where: { id: s(f, "id") },
    data: { priceRub: f.get("priceRub") ? n(f, "priceRub") : null, percentOff: f.get("percentOff") ? n(f, "percentOff") : null, isActive: b(f, "isActive"), title: s(f, "title") },
  });
  await audit(u.id, "catalog.addon", "addon", s(f, "id"));
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
    await db.promoCode.create({
      data: {
        code: s(f, "code").toUpperCase(),
        percentOff: f.get("percentOff") ? n(f, "percentOff") : null,
        amountOffRub: f.get("amountOffRub") ? n(f, "amountOffRub") : null,
        maxUses: f.get("maxUses") ? n(f, "maxUses") : null,
        validTo: s(f, "validTo") ? new Date(s(f, "validTo")) : null,
        blogger: s(f, "blogger") || null,
        source: s(f, "blogger") ? "blogger" : "manual",
      },
    });
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
    if (typeof def === "number") set(path, Number(v));
    else if (Array.isArray(def)) set(path, v.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (typeof def[0] === "number" ? Number(x) : x)));
    else set(path, v);
  }
  // Чекбоксы: отсутствуют в форме, если выключены
  for (const name of String(f.get("__bools") ?? "").split(",").filter(Boolean)) set(name, f.get(`f.${name}`) === "on");
  return out;
}

export async function settingsAction(f: FormData) {
  const u = await requireAdmin("settings");
  const key = s(f, "__key") as SettingKey;
  if (!(key in DEFAULTS)) return;
  const current = (await cfg(key)) as Record<string, unknown>;
  const next = { ...current, ...parseSection(key, f) } as Record<string, unknown>;
  // Пароль SMTP шифруется; пустое поле — оставить прежний
  if (key === "notifications") {
    const pw = s(f, "f.smtpPassword");
    next.smtpPassword = pw ? encrypt(pw) : current.smtpPassword;
  }
  if (key === "seller" && typeof next.inn === "string") next.inn = next.inn.replace(/\D/g, "");
  await saveSetting(key, next);
  await audit(u.id, "settings.save", "setting", key, key === "notifications" ? { smtpHost: next.smtpHost } : undefined);
  revalidatePath("/", "layout");
}

export async function printHouseAction(f: FormData) {
  const u = await requireAdmin("settings");
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
  const u = await requireAdmin("users");
  const email = s(f, "email").toLowerCase();
  const role = s(f, "role") as Role;
  if (!["OWNER", "OPERATOR", "MARKETER", "CUSTOMER"].includes(role) || !email.includes("@")) return;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) await db.user.update({ where: { id: existing.id }, data: { role } });
  else await db.user.create({ data: { email, role, referralCode: `T${Date.now().toString(36).toUpperCase()}` } });
  await audit(u.id, "team.role", "user", email, { role });
  revalidatePath("/admin/komanda");
}

// ── 2FA ──
export async function totpSetupAction() {
  const sess = await currentSession();
  if (!sess || sess.user.role === "CUSTOMER") redirect("/vhod");
  const secret = totpSecret();
  await db.user.update({ where: { id: sess.user.id }, data: { totpSecret: encrypt(secret), totpEnabled: false } });
  redirect("/admin/2fa?setup=1");
}

export async function totpVerifyAction(f: FormData) {
  const sess = await currentSession();
  if (!sess || sess.user.role === "CUSTOMER" || !sess.user.totpSecret) redirect("/vhod");
  const { decrypt } = await import("@/lib/crypto");
  if (!totpVerify(decrypt(sess.user.totpSecret), s(f, "code"))) redirect("/admin/2fa?error=1");
  await db.user.update({ where: { id: sess.user.id }, data: { totpEnabled: true } });
  await db.session.update({ where: { id: sess.id }, data: { mfaPassed: true } });
  await audit(sess.user.id, "auth.2fa", "user", sess.user.id);
  redirect("/admin");
}
