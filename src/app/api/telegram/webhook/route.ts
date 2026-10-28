import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readToken, safeEqual } from "@/lib/crypto";
import { sendTelegram } from "@/lib/notify";

// Привязка Telegram: в кабинете кнопка открывает t.me/<бот>?start=<подписанный токен>.
// Бот получает /start <токен> и сохраняет chat_id как канал уведомлений покупателя.
// Вебхук регистрируется с secret_token = TELEGRAM_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!secret || !safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const upd = (await req.json().catch(() => null)) as { message?: { chat: { id: number }; text?: string } } | null;
  const text = upd?.message?.text ?? "";
  const chatId = String(upd?.message?.chat.id ?? "");
  const m = text.match(/^\/start\s+(\S+)/);
  if (m && chatId) {
    const payload = readToken(m[1]);
    if (payload?.startsWith("tg:")) {
      const userId = payload.slice(3);
      await db.notificationPref.upsert({
        where: { userId_channel: { userId, channel: "telegram" } },
        update: { address: chatId, isActive: true },
        create: { userId, channel: "telegram", address: chatId },
      });
      await sendTelegram(chatId, "Готово! Сюда будут приходить новости о вашей книге и заказе. Отключить — в личном кабинете.");
    } else if (text === "/stop") {
      await db.notificationPref.updateMany({ where: { channel: "telegram", address: chatId }, data: { isActive: false } });
    }
  }
  return NextResponse.json({ ok: true });
}
