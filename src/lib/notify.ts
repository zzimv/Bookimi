// Уведомления: email, Telegram, MAX (WhatsApp — за флагом). Канал выбирает покупатель.
// О заказе — всем; маркетинговые — только с согласием, не чаще раза в сутки, с отпиской в один клик.
// Без настроенного SMTP письма пишутся в журнал (видно в админке), алерты владельцу — в Telegram.
import { db } from "./db";
import { decrypt, signToken } from "./crypto";
import { cfg } from "./settings";
import { declineName } from "./declension";

const site = () => `https://${process.env.DOMAIN ?? "bookimi.ru"}`;
/** Абсолютная ссылка для писем: относительные пути сайта (/chek/…, /zakaz/…) — с доменом. */
export const absUrl = (u: string | number | undefined) => {
  const v = String(u ?? "");
  return v.startsWith("/") ? `${site()}${v}` : v;
};

/** Адрес в журнал без ПДн: «an***@mail.ru», «+7******67». */
export function maskContact(v: string) {
  const t = v.trim();
  const at = t.indexOf("@");
  if (at > 0) return `${t.slice(0, Math.min(2, at))}***${t.slice(at)}`;
  const d = t.replace(/\D/g, "");
  return d.length >= 4 ? `+${d[0]}******${d.slice(-2)}` : "***";
}

/** Секреты (коды входа) в журнал не пишем: заменяем на точки. */
const hideSecrets = (text: string, secrets: string[]) => secrets.reduce((t, x) => (x ? t.split(x).join("••••••") : t), text);

async function logOutbox(channel: string, to: string, subject: string, text: string, secrets: string[] = []) {
  await db.auditLog.create({ data: { action: `outbox.${channel}`, entity: "notification", details: { to, subject: hideSecrets(subject, secrets), text: hideSecrets(text, secrets).slice(0, 2000) } } });
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1") console.error(`[outbox:${channel}] → ${maskContact(to)}: ${hideSecrets(subject, secrets)}`);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string, opts: { secrets?: string[] } = {}) {
  const n = await cfg("notifications");
  const host = n.smtpHost || process.env.SMTP_HOST;
  if (!host) return logOutbox("email", to, subject, text, opts.secrets);
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

async function sendSms(phone: string, text: string, secrets: string[] = []) {
  const p = process.env.SMS_PROVIDER;
  const key = process.env.SMS_API_KEY;
  if (!p || !key) return logOutbox("sms", phone, "код входа", text, secrets);
  if (p === "smsru") {
    await fetch(`https://sms.ru/sms/send?api_id=${key}&to=${encodeURIComponent(phone)}&msg=${encodeURIComponent(text)}&json=1`);
  } else {
    const [login, psw] = key.split(":");
    await fetch(`https://smsc.ru/sys/send.php?login=${login}&psw=${psw}&phones=${encodeURIComponent(phone)}&mes=${encodeURIComponent(text)}&sender=${process.env.SMS_SENDER ?? ""}&charset=utf-8`);
  }
}

export async function sendOtp(kind: "email" | "phone", target: string, code: string) {
  const text = `Код для входа в БУКИМИ: ${code}. Никому его не сообщайте.`;
  if (kind === "email") return sendEmail(target, `Код входа: ${code}`, `${text}\n\nЕсли вы не запрашивали код, просто проигнорируйте письмо.`, undefined, { secrets: [code] });
  return sendSms(target, text, [code]);
}

export const unsubscribeUrl = (userId: string) => `${site()}/otpiska?t=${signToken(`unsub:${userId}`)}`;

export type Template =
  | "preview_ready"
  | "book_ready"
  | "cartoon_ready"
  | "order_created"
  | "payment_received"
  | "transfer_waiting"
  | "receipt"
  | "status"
  | "track"
  | "refund"
  | "referral_bonus"
  | "thanks_delivered"
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

const SERVICE_RU: Record<string, string> = {
  pickup: "самовывоз",
  cdek_pvz: "СДЭК",
  cdek_courier: "СДЭК, курьер",
  pochta: "Почта России",
  yandex: "Яндекс Доставка",
};

type Data = Record<string, string | number | undefined>;
const about = (d: Data) => (d.heroAcc ? ` про ${d.heroAcc}` : "");
const orderLink = (d: Data) => `${site()}/zakaz/${d.orderId}`;

/**
 * Тексты сообщений. Тон: тепло и просто, без восклицательного спама. Благодарим на каждом шаге пути заказа:
 * оформлен → оплачен → книга готова → в типографии → в пути → получена (+3 дня — спасибо, отзыв, подарок).
 */
export function renderTemplate(t: Template, d: Data): { s: string; b: string } {
  switch (t) {
    case "preview_ready":
      return { s: "Превью вашей книги готово", b: `Обложка и первые развороты книги «${d.title}» готовы. Посмотреть: ${site()}/kniga/${d.bookId}` };
    case "book_ready":
      return {
        s: `Книга «${d.title}» готова`,
        b: `Книга готова: PDF, читалка${d.audio ? " и аудио" : ""} уже ждут в личном кабинете: ${site()}/kabinet\n\nНадеемся, чтение вслух получится тёплым. Спасибо, что вы с нами.`,
      };
    case "cartoon_ready":
      return {
        s: `Мультфильм «${d.title}» готов`,
        b: `Мультфильм по книге «${d.title}»${d.own ? " — вашим голосом —" : ""} готов: смотрите, скачивайте и делитесь ссылкой в личном кабинете: ${site()}/kabinet/kniga/${d.bookId}\n\nПриятного просмотра всей семьёй.`,
      };
    case "order_created":
      return { s: `Заказ ${d.code} оформлен`, b: `Спасибо, что выбрали БУКИМИ. Сумма к оплате — ${d.total} ₽. Оплатить и следить за заказом: ${orderLink(d)}` };
    case "payment_received":
      return {
        s: `Спасибо! Заказ ${d.code} оплачен`,
        b:
          `Спасибо, что выбрали нас. Мы уже рисуем книгу${about(d)} — обычно это меньше часа. ` +
          (d.whoPrints === "bookimi" ? "Потом проверим макет, передадим его в типографию и пришлём трек-номер. " : "Как только она будет готова, пришлём ссылку. ") +
          `Следить за заказом: ${orderLink(d)}`,
      };
    case "transfer_waiting":
      return { s: `Спасибо! Проверяем перевод по заказу ${d.code}`, b: `Мы получили отметку об оплате. Подтверждение обычно занимает до 2 часов в рабочее время — сразу после него начнём рисовать.` };
    case "receipt":
      return { s: `Чек по заказу ${d.code}`, b: `Чек сформирован в «Мой налог»: ${absUrl(d.url)}` };
    case "status":
      switch (String(d.status)) {
        case "IN_PRINT":
          return { s: `Книга у типографии — заказ ${d.code}`, b: `Передали книгу в типографию — печатаем бережно.${d.ready ? ` Будет готова к ${d.ready}.` : ""} Следить за заказом: ${orderLink(d)}` };
        case "PACKED":
          return { s: `Заказ ${d.code} напечатан`, b: `Книга напечатана и упакована — скоро передадим её в доставку. ${orderLink(d)}` };
        case "SHIPPED":
          return { s: `Заказ ${d.code} едет к вам`, b: `Передали книгу в доставку. Трек-номер пришлём, как только он появится.${d.eta ? ` Ориентировочно — ${d.eta}.` : ""} ${orderLink(d)}` };
        case "DELIVERED":
          return {
            s: `Книга у вас — спасибо`,
            b: `Заказ ${d.code} доставлен. Надеемся, книга подарила улыбку. Если с печатью что-то не так — напишите нам, перепечатаем: ${site()}/kabinet/podderzhka`,
          };
        default:
          return { s: `Заказ ${d.code}: ${STATUS_RU[String(d.status)] ?? d.status}`, b: `Статус заказа ${d.code}: ${STATUS_RU[String(d.status)] ?? d.status}. ${orderLink(d)}` };
      }
    case "track":
      return {
        s: `Едет к вам: заказ ${d.code}`,
        b: `Книга в пути. Трек-номер: ${d.track}${d.service ? ` (${SERVICE_RU[String(d.service)] ?? d.service})` : ""}.${d.eta ? ` Ориентировочно — ${d.eta}.` : ""} Следить за заказом: ${orderLink(d)}`,
      };
    case "refund":
      return { s: `Возврат по заказу ${d.code}`, b: `Мы вернули ${d.amount} ₽. Чек аннулирован.` };
    case "referral_bonus":
      return { s: "Вам подарок за друга", b: `Друг оплатил заказ по вашей ссылке. Ваш промокод на −${d.pct}%: ${d.code}` };
    case "thanks_delivered":
      return {
        s: "Спасибо, что выбрали БУКИМИ",
        b:
          `Надеемся, книга «${d.title}» уже прочитана не один раз. Нам очень важно знать, как она вам — ` +
          `расскажите в паре слов: ${site()}/kabinet/otzyv\nОтзыв помогает другим родителям решиться, а нам — делать книги лучше.` +
          (d.coloring ? `\n\nНебольшой подарок от нас — раскраска по иллюстрациям вашей книги: ${d.coloring}` : ""),
      };
    case "marketing":
      return { s: String(d.subject ?? "БУКИМИ"), b: String(d.text ?? "") };
  }
}

/**
 * Сообщение покупателю во все выбранные им каналы.
 * opts.marketing — всё сообщение рекламное (только с согласием, с отпиской).
 * opts.promo — рекламный «хвост» к сервисному сообщению (промокод на следующую книгу): добавляется только
 * при согласии на рассылку и только в каналы, где покупатель её не отключил; тогда же добавляется отписка.
 */
export async function notifyUser(userId: string, t: Template, data: Record<string, string | number | undefined>, opts: { marketing?: boolean; promo?: string } = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { notifyPrefs: true } });
  if (!user || user.deletedAt) return;
  if (opts.marketing && !user.marketingOk) return;
  const n = await cfg("notifications");
  const { s, b: body } = renderTemplate(t, data);
  const unsub = `\n\nОтписаться от рассылки: ${unsubscribeUrl(user.id)}`;
  const footer = opts.marketing ? unsub : "";
  // Рекламный хвост: только с согласием на рассылку и в каналах, где рассылка не отключена
  const withPromo = (channelMarketing: boolean) => (opts.promo && user.marketingOk && channelMarketing ? `${body}\n\n${opts.promo}${opts.marketing ? "" : unsub}` : body);
  const prefs = user.notifyPrefs.filter((p) => p.isActive && (!opts.marketing || p.marketing));
  let sent = false;
  let lastError: Error | null = null;
  for (const p of prefs) {
    const b = withPromo(p.marketing);
    try {
      if (p.channel === "telegram" && n.telegram) await sendTelegram(p.address, `${s}\n\n${b}${footer}`);
      else if (p.channel === "max" && n.max) await sendMax(p.address, `${s}\n\n${b}${footer}`);
      else if (p.channel === "email") await sendEmail(p.address, s, b + footer);
      else continue;
      sent = true;
    } catch (e) {
      lastError = e as Error;
      console.error("[notify]", p.channel, (e as Error).message);
    }
  }
  // Канал недоступен или не выбран — email; не ушло никуда — исключение (notifySafe поставит повтор)
  if (!sent && user.email) await sendEmail(user.email, s, withPromo(true) + footer);
  else if (!sent && lastError) throw lastError;
}

/**
 * Уведомление, которое никогда не ломает вызывающий код (оплату, оформление, возврат): сбой отправки —
 * в очередь повторов `send-notification` (до 6 попыток с нарастающей паузой). Если и очередь недоступна — в журнал.
 */
export async function notifySafe(userId: string, t: Template, data: Record<string, string | number | undefined>, opts: { marketing?: boolean; promo?: string } = {}) {
  try {
    await notifyUser(userId, t, data, opts);
    return true;
  } catch (e) {
    console.error("[notify] не отправлено, в очередь повторов:", t, (e as Error).message);
    try {
      const { enqueue, QUEUES } = await import("./queue");
      await enqueue(QUEUES.sendNotification, { userId, t, data, opts }, { retryLimit: 6, retryDelay: 60, retryBackoff: true });
    } catch (q) {
      console.error("[notify] очередь недоступна:", (q as Error).message);
      await db.auditLog.create({ data: { action: "notify.failed", entity: "user", entityId: userId, details: { template: t, error: (e as Error).message.slice(0, 200) } } }).catch(() => {});
    }
    return false;
  }
}

/** Имя героя книги заказа в винительном падеже («про Машу») — для тёплых сообщений. Ошибки не мешают отправке. */
export async function orderHeroAcc(orderId: string): Promise<string | undefined> {
  try {
    const item = await db.orderItem.findFirst({ where: { orderId, bookId: { not: null } }, select: { book: { select: { params: true } } } });
    const h = (item?.book?.params as { hero?: { name?: string; gender?: string } } | null)?.hero;
    return h?.name ? declineName(h.name, "вин", h.gender) : undefined;
  } catch {
    return undefined;
  }
}

/** Алерт владельцу: на почту из настроек + в Telegram-чат. */
export async function alertOwner(subject: string, text: string) {
  const a = await cfg("alerts").catch(() => ({ telegramChatId: "", email: "" }));
  const chat = a.telegramChatId || process.env.TELEGRAM_ALERT_CHAT_ID || "";
  const tasks: Promise<unknown>[] = [];
  if (a.email) tasks.push(sendEmail(a.email, `[БУКИМИ] ${subject}`, text));
  if (chat || !a.email) tasks.push(sendTelegram(chat, `⚠️ ${subject}\n${text}`));
  await Promise.allSettled(tasks);
}
