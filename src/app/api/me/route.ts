import { z } from "zod";
import "@/lib/zod-ru";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { body, err, json } from "@/lib/api";
import { zRecipientName } from "@/lib/names";
import { cleanFirstName, currentUser, FIRST_NAME_ERROR, logout } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";
import { deleteFile } from "@/lib/storage";
import { DOC_VERSION } from "@/lib/legal";
import { parseAddressBook } from "@/lib/delivery";

// «Мои данные» (152-ФЗ): выгрузка (вместе с адресной книгой savedAddresses), отзыв согласий, адреса доставки, удаление.
export async function GET() {
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  const { exportUserData } = await import("@/lib/account");
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="bookimi-my-data.json"' },
  });
}

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prefs"), channel: z.enum(["email", "telegram", "max"]), active: z.boolean(), marketing: z.boolean().optional() }),
  z.object({ action: z.literal("revoke"), type: z.enum(["MARKETING", "CHILD_PHOTO", "ANALYTICS_COOKIES"]) }),
  z.object({ action: z.literal("delete"), confirm: z.literal("УДАЛИТЬ") }),
  z.object({ action: z.literal("maxChat"), chatId: z.string().trim().min(3).max(40) }),
  z.object({
    action: z.literal("address"),
    id: z.string().max(40),
    patch: z.object({
      name: zRecipientName(80).optional(),
      phone: z.string().trim().max(20).optional(),
      street: z.string().trim().max(160).optional(),
      flat: z.string().trim().max(20).optional(),
      comment: z.string().trim().max(200).optional(),
      postalCode: z.string().trim().max(10).optional(),
    }),
  }),
  z.object({ action: z.literal("addressDelete"), id: z.string().max(40) }),
  /** «Как к вам обращаться»: пусто — удалить имя. */
  z.object({ action: z.literal("name"), firstName: z.string().max(80) }),
]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  if (b.action === "name") {
    const firstName = cleanFirstName(b.firstName);
    if (firstName === false) return err(FIRST_NAME_ERROR);
    await db.user.update({ where: { id: user.id }, data: { firstName } });
    return json({ ok: true, firstName });
  }
  if (b.action === "prefs") {
    const address = b.channel === "email" ? user.email ?? "" : undefined;
    const existing = await db.notificationPref.findUnique({ where: { userId_channel: { userId: user.id, channel: b.channel } } });
    if (!existing && !address) return err(b.channel === "telegram" ? "Сначала подключите Telegram кнопкой" : "Укажите адрес канала");
    await db.notificationPref.upsert({
      where: { userId_channel: { userId: user.id, channel: b.channel } },
      update: { isActive: b.active, marketing: b.marketing ?? existing?.marketing ?? false },
      create: { userId: user.id, channel: b.channel, address: address!, isActive: b.active, marketing: b.marketing ?? false },
    });
    if (b.marketing) await db.user.update({ where: { id: user.id }, data: { marketingOk: true } });
    return json({ ok: true });
  }
  if (b.action === "maxChat") {
    await db.notificationPref.upsert({
      where: { userId_channel: { userId: user.id, channel: "max" } },
      update: { address: b.chatId, isActive: true },
      create: { userId: user.id, channel: "max", address: b.chatId },
    });
    return json({ ok: true });
  }
  if (b.action === "address" || b.action === "addressDelete") {
    const list = parseAddressBook(user.savedAddresses) ?? [];
    if (!list.some((a) => a.id === b.id)) return err("Адрес не найден", 404);
    if (b.action === "address" && b.patch.postalCode && !/^\d{6}$/.test(b.patch.postalCode)) return err("Индекс — 6 цифр");
    // [] (а не NULL): покупатель сам всё удалил — прошлые заказы больше не подставляются
    const next = b.action === "addressDelete" ? list.filter((a) => a.id !== b.id) : list.map((a) => (a.id === b.id ? { ...a, ...b.patch } : a));
    await db.user.update({ where: { id: user.id }, data: { savedAddresses: next as object[] } });
    return json({ ok: true });
  }
  if (b.action === "revoke") {
    await db.consent.create({ data: { userId: user.id, type: b.type, docVersion: DOC_VERSION, granted: false } });
    if (b.type === "MARKETING") {
      await db.user.update({ where: { id: user.id }, data: { marketingOk: false } });
      await db.notificationPref.updateMany({ where: { userId: user.id }, data: { marketing: false } });
    }
    if (b.type === "CHILD_PHOTO") {
      const photos = await db.photo.findMany({ where: { hero: { userId: user.id }, deletedAt: null } });
      for (const p of photos) {
        await deleteFile("photos", p.storageKey).catch(() => {});
        await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
      }
    }
    return json({ ok: true });
  }
  // Удаление (152-ФЗ): книги, файлы, фото, голос, журнал писем, коды входа — удаляются; тикеты и отзывы —
  // обезличиваются; заказы и чеки остаются для налогового учёта без контактов (src/lib/account.ts)
  const r = await deleteAccount(user.id);
  if (!r.ok) return err(r.error, 409);
  await logout();
  return json({ ok: true });
}
