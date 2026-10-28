import "server-only";
import { db, hasDatabase } from "./db";

export interface Seller {
  fullName: string;
  inn: string;
  status: string;
  email: string;
  phone: string;
}

const EMPTY_SELLER: Seller = {
  fullName: "",
  inn: "",
  status: "плательщик налога на профессиональный доход",
  email: "",
  phone: "",
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!hasDatabase) return fallback;
  try {
    const row = await db.setting.findUnique({ where: { key } });
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export const getSeller = () => getSetting<Seller>("seller", EMPTY_SELLER);
export const getTaxRegime = () => getSetting<"npd" | "ip">("tax.regime", "npd");
export const getPromoBar = () =>
  getSetting("promoBar", { enabled: true, text: "Бесплатное превью книги за 5 минут — без регистрации" });

export function sellerIsComplete(s: Seller) {
  return s.fullName.trim().length > 3 && /^\d{12}$/.test(s.inn.trim());
}

// Чек-лист «Готовность к продажам» для главной админки:
// что не заполнено и что из-за этого выключено.
export async function getReadiness() {
  const seller = await getSeller();
  const payments = await getSetting("payments", {
    sbpQr: { enabled: false },
    transfer: { enabled: false, phone: "", card: "" },
  } as { sbpQr: { enabled: boolean }; transfer: { enabled: boolean; phone: string; card: string } });
  const smtp = Boolean(process.env.SMTP_HOST);
  let pickup = false;
  if (hasDatabase) {
    try {
      const ph = await db.printHouse.findFirst({ where: { isActive: true } });
      pickup = Boolean(ph?.pickupAddress);
    } catch {}
  }
  const paymentConfigured = payments.sbpQr.enabled || (payments.transfer.enabled && Boolean(payments.transfer.phone || payments.transfer.card));

  return [
    { key: "seller", ok: sellerIsComplete(seller), label: "Реквизиты продавца (ФИО, ИНН)", disabled: "Приём оплаты выключен" },
    { key: "payments", ok: paymentConfigured, label: "Способ оплаты (СБП-QR или перевод)", disabled: "Кнопка оплаты неактивна, превью работает" },
    { key: "pickup", ok: pickup, label: "Адрес самовывоза в типографии", disabled: "Вариант «Отправлю сам» скрыт" },
    { key: "smtp", ok: smtp, label: "SMTP для писем", disabled: "Письма пишутся в лог, уведомления — в Telegram и MAX" },
  ];
}

export async function canAcceptPayments() {
  const r = await getReadiness();
  return r.find((x) => x.key === "seller")!.ok && r.find((x) => x.key === "payments")!.ok;
}
