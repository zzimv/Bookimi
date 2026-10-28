// Уведомления: email, Telegram, MAX (WhatsApp — за флагом). Канал выбирает покупатель.
// О заказе — всем; маркетинговые — только с согласием, не чаще раза в сутки, с отпиской в один клик.
// Без настроенного SMTP письма пишутся в журнал (видно в админке), алерты владельцу — в Telegram.
import { db } from "./db";
import { decrypt, signToken } from "./crypto";
import { cfg } from "./settings";

const site = () => `https://${process.env.DOMAIN ?? "bookimi.ru"}`;

async function logOutbox(channel: string, to: string, subject: string, text: string) {
  await db.auditLog.create({ data: { action: `outbox.${channel}`, entity: "notification", details: { to, subject, text: text.slice(0, 2000) } } });
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1") console.error(`[outbox:${channel}] → ${to}: ${subject}`);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const n = await cfg("notifications");
  const host = n.smtpHost || process.env.SMTP_HOST;
  if (!host) return logOutbox("email", to, subject, text);
  const nodemailer = await import("nodemailer");
  const t = nodemailer.createTransport({
    host,
    port: Number(n.smtpHost ? n.smtpPort : process.env.SMTP_PORT ?? 465),
    secure: Number(n.smtpHost ? n.smtpPort : process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: n.smtpUser || process.env.SMTP_USER, pass: n.smtpPassword ? decrypt(n.smtpPassword) : process.env.SMTP_PASSWORD },
  });
  await t.sendMail({ from: n.smtpFrom || process.env.SMTP_FROM, to, subject, text, html });
}

export async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return logOutbox("telegram", chatId || "—", text.slice(0, 60), text);
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

export async function sendMax(chatId: string, text: string) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token || !chatId) return logOutbox("max", chatId || "—", text.slice(0, 60), text);
  await fetch(`https://botapi.max.ru/messages?access_token=${encodeURIComponent(token)}&chat_id=${encodeURIComponent(chatId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

async function sendSms(phone: string, text: string) {
  const p = process.env.SMS_PROVIDER;
  const key = process.env.SMS_API_KEY;
  if (!p || !key) return logOutbox("sms", phone, "код входа", text);
  if (p === "smsru") {
    await fetch(`https://sms.ru/sms/send?api_id=${key}&to=${encodeURIComponent(phone)}&msg=${encodeURIComponent(text)}&json=1`);
  } else {
    const [login, psw] = key.split(":");
    await fetch(`https://smsc.ru/sys/send.php?login=${login}&psw=${psw}&phones=${encodeURIComponent(phone)}&mes=${encodeURIComponent(text)}&sender=${process.env.SMS_SENDER ?? ""}&charset=utf-8`);
  }
}

export async function sendOtp(kind: "email" | "phone", target: string, code: string) {
  const text = `Код для входа в БУКИМИ: ${code}. Никому его не сообщайте.`;
  if (kind === "email") return sendEmail(target, `Код входа: ${code}`, `${text}\n\nЕсли вы не запрашивали код, просто проигнорируйте письмо.`);
  return sendSms(target, text);
}

export const unsubscribeUrl = (userId: string) => `${site()}/otpiska?t=${signToken(`unsub:${userId}`)}`;

export type Template =
  | "preview_ready"
  | "book_ready"
  | "order_created"
  | "payment_received"
  | "transfer_waiting"
  | "receipt"
  | "status"
  | "track"
  | "refund"
  | "referral_bonus"
  | "marketing";

const STATUS_RU: Record<string, string> = {
  PAID: "оплачен",
  IN_PRINT: "в печати",
  PACKED: "упакован",
  SHIPPED: "передан в доставку",
  DELIVERED: "доставлен",
  CANCELLED: "отменён",
  REFUNDED: "возвращён",
};

function render(t: Template, d: Record<string, string | number | undefined>) {
  switch (t) {
    case "preview_ready":
      return { s: "Превью вашей книги готово", b: `Обложка и первые развороты книги «${d.title}» готовы. Посмотреть: ${site()}/kniga/${d.bookId}` };
    case "book_ready":
      return { s: "Ваша книга готова", b: `Полная книга «${d.title}» готова: PDF, читалка${d.audio ? " и аудио" : ""} — в личном кабинете: ${site()}/kabinet` };
    case "order_created":
      return { s: `Заказ ${d.code} оформлен`, b: `Сумма: ${d.total} ₽. Оплатить: ${site()}/zakaz/${d.orderId}` };
    case "payment_received":
      return { s: `Оплата заказа ${d.code} получена`, b: `Спасибо! Заказ ${d.code} оплачен. Следить за ним: ${site()}/zakaz/${d.orderId}` };
    case "transfer_waiting":
      return { s: `Проверяем перевод по заказу ${d.code}`, b: `Мы получили отметку об оплате. Подтверждение обычно занимает до 2 часов в рабочее время.` };
    case "receipt":
      return { s: `Чек по заказу ${d.code}`, b: `Чек сформирован в «Мой налог»: ${d.url}` };
    case "status":
      return { s: `Заказ ${d.code}: ${STATUS_RU[String(d.status)] ?? d.status}`, b: `Статус заказа ${d.code}: ${STATUS_RU[String(d.status)] ?? d.status}. ${site()}/zakaz/${d.orderId}` };
    case "track":
      return { s: `Заказ ${d.code} в пути`, b: `Трек-номер: ${d.track} (${d.service}). Ориентировочно доставим к ${d.eta}.` };
    case "refund":
      return { s: `Возврат по заказу ${d.code}`, b: `Мы вернули ${d.amount} ₽. Чек аннулирован.` };
    case "referral_bonus":
      return { s: "Вам подарок за друга", b: `Друг оплатил заказ по вашей ссылке. Ваш промокод на −${d.pct}%: ${d.code}` };
    case "marketing":
      return { s: String(d.subject ?? "БУКИМИ"), b: String(d.text ?? "") };
  }
}

/** Сообщение покупателю во все выбранные им каналы. */
export async function notifyUser(userId: string, t: Template, data: Record<string, string | number | undefined>, opts: { marketing?: boolean } = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { notifyPrefs: true } });
  if (!user || user.deletedAt) return;
  if (opts.marketing && !user.marketingOk) return;
  const n = await cfg("notifications");
  const { s, b } = render(t, data);
  const footer = opts.marketing ? `\n\nОтписаться: ${unsubscribeUrl(user.id)}` : "";
  const prefs = user.notifyPrefs.filter((p) => p.isActive && (!opts.marketing || p.marketing));
  let sent = false;
  for (const p of prefs) {
    try {
      if (p.channel === "telegram" && n.telegram) await sendTelegram(p.address, `${s}\n\n${b}${footer}`);
      else if (p.channel === "max" && n.max) await sendMax(p.address, `${s}\n\n${b}${footer}`);
      else if (p.channel === "email") await sendEmail(p.address, s, b + footer);
      else continue;
      sent = true;
    } catch (e) {
      console.error("[notify]", p.channel, (e as Error).message);
    }
  }
  // Канал недоступен или не выбран — email
  if (!sent && user.email) await sendEmail(user.email, s, b + footer);
}

/** Алерт владельцу: на почту из настроек + в Telegram-чат. */
export async function alertOwner(subject: string, text: string) {
  const a = await cfg("alerts");
  const chat = a.telegramChatId || process.env.TELEGRAM_ALERT_CHAT_ID || "";
  const tasks: Promise<unknown>[] = [];
  if (a.email) tasks.push(sendEmail(a.email, `[БУКИМИ] ${subject}`, text));
  if (chat || !a.email) tasks.push(sendTelegram(chat, `⚠️ ${subject}\n${text}`));
  await Promise.allSettled(tasks);
}
