import { db, hasDatabase } from "./db";

// Все настройки, которые владелец меняет в кабинете администратора.
// Хранятся в таблице Setting (ключ → JSON); здесь — значения по умолчанию.

export interface Seller {
  fullName: string;
  inn: string;
  status: string;
  email: string;
  phone: string;
}

export const DEFAULTS = {
  seller: {
    fullName: "",
    inn: "",
    status: "плательщик налога на профессиональный доход",
    email: "",
    phone: "",
  } as Seller,
  tax: { regime: "npd" as "npd" | "ip", ipName: "", ogrnip: "", npdYearLimitRub: 2_400_000 },
  payments: {
    sbpQr: { enabled: false, provider: "demo" as "demo" | "generic", confirmMinutes: 60 },
    transfer: { enabled: false, phone: "", card: "", bank: "", holder: "", cancelHours: 24 },
    yookassa: { enabled: false },
  },
  shipping: {
    cdekPvz: true,
    cdekCourier: true,
    pochta: false,
    yandex: false,
    freeShippingBooks: 2,
    fallbackRub: { cdek_pvz: 290, cdek_courier: 490, pochta: 350, yandex: 450 } as Record<string, number>,
    fallbackDays: { cdek_pvz: [2, 7], cdek_courier: [2, 7], pochta: [7, 14], yandex: [1, 4] } as Record<string, [number, number]>,
  },
  limits: {
    dailySpendRub: 3000,
    previewsPerContact: 1,
    textsPerDevice: 3,
    rewrites: 2,
    freeRedraws: 3,
    redrawPriceRub: 99,
    photoTtlDays: 7,
    /** Сколько раз можно бесплатно сменить настроение превью до оплаты (перерисовка обложки и 2 разворотов). */
    moodChangesPreview: 2,
    /** Бесплатных сказок в сутки с одного IP (IPv4 — по подсети /24): защита от сброса cookie устройства. */
    textsPerIp: 10,
  },
  auth: {
    /** Телефон обязателен при входе (+7…); код приходит на почту. */
    phoneRequired: true,
    /** Вход по SMS-коду на телефон (нужен SMS_PROVIDER). Выключено — код только на почту, телефон — контакт. */
    smsLogin: false,
  },
  gpu: {
    mode: "on_demand" as "on_demand" | "schedule" | "always",
    idleMinutes: 10,
    scheduleFrom: "10:00",
    scheduleTo: "23:00",
    scheduleMonths: [11, 12] as number[],
    preemptible: true,
    hourlyRub: 300, // уточнить по прайсу Yandex Cloud
    startupMinutes: 8,
  },
  ai: {
    text: "demo" as "demo" | "yandexgpt",
    image: "demo" as "demo" | "qwen" | "kandinsky",
    tts: "demo" as "demo" | "speechkit" | "salutespeech",
    foreignImage: false,
  },
  alerts: { email: "", telegramChatId: "", spendPct: [80, 100] as number[], npdPct: [80, 95] as number[] },
  notifications: {
    smtpHost: "",
    smtpPort: 465,
    smtpUser: "",
    smtpPassword: "",
    smtpFrom: "БУКИМИ <hello@bookimi.ru>",
    telegram: true,
    max: true,
    whatsapp: false,
  },
  audio: {
    ttsPriceRub: 390,
    selfReadPriceRub: 490,
    selfReadEnabled: true,
    cloneEnabled: false,
    clonePriceRub: 990,
    voices: [
      { key: "alena", title: "Алёна — тёплый женский" },
      { key: "filipp", title: "Филипп — спокойный мужской" },
      { key: "jane", title: "Джейн — сказочный женский" },
    ],
  },
  referral: { newbiePct: 10, bonusPct: 10, delayDays: 14 },
  promoBar: { enabled: true, text: "Бесплатное превью книги за 5 минут — без регистрации" },
  /** Сезонная кнопка на главной и пункт меню. mode: auto — по дате (ноябрь–декабрь — Новый год…), manual — повод ниже, off — без сезона. */
  season: {
    mode: "auto" as "auto" | "manual" | "off",
    occasion: "novyj-god",
    /** Последний день заказа печатной книги к празднику (ГГГГ-ММ-ДД); пусто — посчитать (печать 5 раб. дней + доставка 7 дней). */
    printDeadline: "",
  },
  /** Подписка на главной «−300 ₽ на первый заказ». Блок виден, только если указан активный промокод. */
  newsletter: { promoCode: "", discountText: "−300 ₽ на первый заказ" },
  flags: { printEnabled: true, photoUploadEnabled: false, demoMode: false },
};

export type Settings = typeof DEFAULTS;
export type SettingKey = keyof Settings;

function merge<T>(base: T, over: unknown): T {
  if (over == null || typeof over !== "object" || Array.isArray(over)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)?.[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v) ? merge(b, v) : v;
  }
  return out as T;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!hasDatabase) return fallback;
  try {
    const row = await db.setting.findUnique({ where: { key } });
    return row ? merge(fallback, row.value) : fallback;
  } catch {
    return fallback;
  }
}

export async function getSettings(): Promise<Settings> {
  if (!hasDatabase) return DEFAULTS;
  try {
    const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
    const out = { ...DEFAULTS } as Record<string, unknown>;
    for (const r of rows) out[r.key] = merge((DEFAULTS as Record<string, unknown>)[r.key], r.value);
    return out as Settings;
  } catch {
    return DEFAULTS;
  }
}

export async function cfg<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return getSetting(key, DEFAULTS[key]);
}

export async function saveSetting(key: string, value: unknown) {
  await db.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
}

export const getSeller = () => cfg("seller");
export const getTaxRegime = async () => (await cfg("tax")).regime;
export const getPromoBar = () => cfg("promoBar");

/** Проверка ИНН физлица (12 цифр, контрольные суммы). */
export function innIsValid(inn: string) {
  if (!/^\d{12}$/.test(inn)) return false;
  const d = inn.split("").map(Number);
  const k = (w: number[]) => (w.reduce((s, x, i) => s + x * d[i], 0) % 11) % 10;
  return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
}

export function sellerIsComplete(s: Seller) {
  return s.fullName.trim().split(/\s+/).length >= 2 && innIsValid(s.inn.trim());
}

// Чек-лист «Готовность к продажам» для главной админки:
// что не заполнено и что из-за этого выключено.
export async function getReadiness() {
  const s = await getSettings();
  let pickup = false;
  let printHouse = false;
  if (hasDatabase) {
    try {
      const ph = await db.printHouse.findFirst({ where: { isActive: true } });
      printHouse = Boolean(ph?.email || ph?.apiUrl);
      pickup = Boolean(ph?.pickupAddress);
    } catch {}
  }
  const transferOk = s.payments.transfer.enabled && Boolean(s.payments.transfer.phone || s.payments.transfer.card);
  const paymentConfigured = s.payments.sbpQr.enabled || transferOk || s.payments.yookassa.enabled;
  const smtp = Boolean(s.notifications.smtpHost || process.env.SMTP_HOST);
  return [
    { key: "seller", ok: sellerIsComplete(s.seller), label: "Реквизиты продавца (ФИО, ИНН)", disabled: "Приём оплаты выключен", href: "/admin/nastrojki#seller" },
    { key: "payments", ok: paymentConfigured, label: "Способ оплаты (СБП-QR или перевод)", disabled: "Кнопка оплаты неактивна, превью работает", href: "/admin/nastrojki#payments" },
    { key: "photo", ok: s.flags.photoUploadEnabled, label: "Приём фото включён (после проверки согласий юристом)", disabled: "Иллюстрации только по описанию", href: "/admin/nastrojki#flags" },
    { key: "ai", ok: s.ai.text !== "demo" && s.ai.image !== "demo", label: "ИИ-провайдеры подключены", disabled: "Работает демо-генерация", href: "/admin/nastrojki#ai" },
    { key: "printHouse", ok: printHouse, label: "Типография: email или API", disabled: "Заказы в печать передаются вручную", href: "/admin/nastrojki#print" },
    { key: "pickup", ok: pickup, label: "Адрес самовывоза в типографии", disabled: "Вариант «Отправлю сам» скрыт", href: "/admin/nastrojki#print" },
    { key: "cdek", ok: Boolean(process.env.CDEK_CLIENT_ID), label: "Ключи СДЭК", disabled: "Доставка считается по тарифам из настроек", href: "/admin/nastrojki#shipping" },
    { key: "smtp", ok: smtp, label: "Почта для писем (SMTP)", disabled: "Письма пишутся в журнал, алерты — в Telegram", href: "/admin/nastrojki#notifications" },
    { key: "alerts", ok: Boolean(s.alerts.email), label: "Почта для алертов владельцу", disabled: "Алерты не отправляются на почту", href: "/admin/nastrojki#alerts" },
  ];
}

export async function canAcceptPayments() {
  const r = await getReadiness();
  return r.find((x) => x.key === "seller")!.ok && r.find((x) => x.key === "payments")!.ok;
}
