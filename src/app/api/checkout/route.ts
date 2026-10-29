import { body, err, json, throttle, ownBook, utmCookie } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { createOrder } from "@/lib/orders";
import { Checkout } from "@/lib/checkout-schema";
import { notifySafe } from "@/lib/notify";
import { db } from "@/lib/db";
import { addressError, cleanAddress } from "@/lib/delivery";
import { cdekCityCode, cdekPoints, hasCdek } from "@/lib/shipping";
import { normalizePhone } from "@/lib/quiz";

export async function POST(req: Request) {
  const t = await throttle("checkout", 10, 60_000);
  if (t) return t;
  const user = await currentUser();
  if (!user) return err("Войдите по коду", 401);
  const b = await body(req, Checkout);
  if (!b) return err("Проверьте данные заказа");
  const own = await ownBook(b.bookId);
  if (!own || own.book.userId !== user.id) return err("Не найдено", 404);
  if (b.addonsOnly && (!own.book.paidFull || b.whoPrints !== "self")) return err("Докупить можно к уже оплаченной книге");
  if (b.whoPrints === "bookimi") {
    if (!b.shipping) return err("Выберите доставку");
    const addr = cleanAddress(b.shipping.method, b.shipping.address);
    const bad = addressError(b.shipping.method, addr, { pvzListAvailable: hasCdek() });
    if (bad) return err(bad);
    if (!b.contact.name || !b.contact.phone) return err("Укажите имя и телефон получателя");
    // Телефон получателя — для курьера и типографии: только мобильный, приводим к +7XXXXXXXXXX
    const phone = normalizePhone(b.contact.phone);
    if (!phone) return err("Телефон получателя: мобильный номер +7 9XX XXX-XX-XX");
    b.contact.phone = phone;
    if (b.contact.name.length < 2 || /[<>{}\[\]\\/@]|https?:/i.test(b.contact.name)) return err("Имя получателя: только имя и фамилия, без ссылок и спецсимволов");
    // Пункт выдачи сверяем со списком СДЭК и берём его адрес оттуда (не со слов браузера)
    if (b.shipping.method === "cdek_pvz" && hasCdek()) {
      try {
        const code = addr.cityCode ?? (await cdekCityCode(addr.city, addr.region));
        const point = code ? (await cdekPoints(code)).find((p) => p.code === addr.pvzCode) : null;
        if (!point) return err("Пункт выдачи не найден в этом городе — выберите его заново");
        addr.cityCode = code ?? undefined;
        addr.pvzAddress = point.address;
      } catch (e) {
        console.error("[checkout] pvz", (e as Error).message); // СДЭК недоступен — оператор сверит пункт вручную
      }
    }
    b.shipping.address = addr;
  }
  // Без печати телефон необязателен: неверный — не сохраняем
  if (b.whoPrints !== "bookimi" && b.contact.phone) b.contact.phone = normalizePhone(b.contact.phone) ?? undefined;
  // UTM блогера → его промокод автоматически
  const utm = await utmCookie();
  let promo = b.promo;
  if (!promo && utm?.utm_source) {
    const p = await db.promoCode.findFirst({ where: { blogger: utm.utm_source, isActive: true } });
    if (p) promo = p.code;
  }
  try {
    if (b.voice && b.addons.includes("audiobook")) await db.book.update({ where: { id: b.bookId }, data: { audioVoice: b.voice } });
    const order = await createOrder(user.id, { ...b, promo, utm, contact: { ...b.contact, email: b.contact.email || user.email || undefined } });
    await notifySafe(user.id, "order_created", { code: order.publicCode, total: order.totalRub, orderId: order.id });
    return json({ orderId: order.id });
  } catch (e) {
    return err((e as Error).message);
  }
}
