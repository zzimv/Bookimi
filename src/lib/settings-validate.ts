// Проверка настроек и промокодов из админки (серверные действия). Без БД — чистые функции, покрыты тестами.
// Ошибка — понятный текст для владельца; при ошибке ничего не сохраняется.
import { z } from "zod";
import "./zod-ru";
import { innIsValid, type Settings, type SettingKey } from "./settings";
import { normalizePhone } from "../content/answers";

type Res<T> = { ok: true; value: T } | { ok: false; error: string };

const num = (label: string, min: number, max: number, int = true) => {
  let s = z.number({ invalid_type_error: `${label}: укажите число`, required_error: `${label}: укажите число` });
  if (int) s = s.int(`${label}: целое число`);
  return s.min(min, `${label}: не меньше ${min.toLocaleString("ru-RU")}`).max(max, `${label}: не больше ${max.toLocaleString("ru-RU")}`);
};
const price = (label: string) => num(label, 0, 1_000_000);
const pctList = (label: string) => z.array(num(label, 1, 100)).max(10, `${label}: не больше 10 порогов`);
const emailOrEmpty = (label: string) => z.string().trim().max(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), `${label}: проверьте адрес почты`);
const dateOrEmpty = (label: string) => z.string().trim().refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(`${v}T00:00:00Z`))), `${label}: дата в формате ГГГГ-ММ-ДД`);
const time = (label: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label}: время в формате ЧЧ:ММ`);

/** Скидки «для каждого в группе»: от N книг — P%. Пороги по возрастанию, скидка не уменьшается. */
export const BulkTiers = z
  .array(z.object({ min: num("Порог, книг", 2, 500), pct: num("Скидка порога, %", 1, 90) }))
  .max(6, "Не больше 6 порогов")
  .superRefine((tiers, ctx) => {
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].min <= tiers[i - 1].min) ctx.addIssue({ code: "custom", message: "Пороги — по возрастанию числа книг (например, 5:20, 15:30, 25:35)" });
      if (tiers[i].pct < tiers[i - 1].pct) ctx.addIssue({ code: "custom", message: "Скидка не может уменьшаться с ростом числа книг" });
    }
  });

/** «5:20, 15:30» → [{min:5,pct:20},…]; мусор → NaN (его отклонит проверка). */
export function parseTiers(raw: string): { min: number; pct: number }[] {
  return raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const m = x.match(/^(\d+)\s*(?:\+|книг\S*)?\s*[:=—–-]\s*(\d+)\s*%?$/i);
      return m ? { min: Number(m[1]), pct: Number(m[2]) } : { min: NaN, pct: NaN };
    });
}
export const formatTiers = (t: { min: number; pct: number }[]) => t.map((x) => `${x.min}:${x.pct}`).join(", ");

const SCHEMAS: Partial<Record<SettingKey, z.ZodTypeAny>> = {
  seller: z
    .object({
      fullName: z.string().trim().max(120, "ФИО: не длиннее 120 символов"),
      inn: z.string().trim().refine((v) => !v || innIsValid(v), "ИНН: 12 цифр с верными контрольными цифрами (проверьте по справке «Мой налог»)"),
      status: z.string().trim().max(200),
      email: emailOrEmpty("Email для покупателей"),
      phone: z.string().trim().refine((v) => !v || normalizePhone(v) !== null || /^\+?\d[\d\s()-]{6,}$/.test(v), "Телефон: проверьте номер"),
    })
    .passthrough()
    .refine((s) => !s.inn || s.fullName.split(/\s+/).filter(Boolean).length >= 2, "ФИО: фамилия и имя полностью"),
  tax: z
    .object({
      regime: z.enum(["npd", "ip"], { errorMap: () => ({ message: "Режим: НПД или ИП" }) }),
      vatCode: num("Ставка НДС в чеке (код ЮKassa)", 1, 12).optional(),
      taxSystemCode: num("Система налогообложения (код ЮKassa)", 0, 6).optional(),
      ogrnip: z.string().trim().refine((v) => !v || /^\d{15}$/.test(v), "ОГРНИП: 15 цифр"),
      npdYearLimitRub: num("Лимит дохода НПД", 1, 100_000_000),
    })
    .passthrough(),
  payments: z
    .object({
      transfer: z
        .object({
          phone: z.string().trim().refine((v) => !v || normalizePhone(v) !== null, "Телефон для перевода: мобильный +7 9XX XXX-XX-XX"),
          card: z.string().trim().refine((v) => !v || /^\d{16,19}$/.test(v.replace(/\s/g, "")), "Номер карты: 16–19 цифр"),
          cancelHours: num("Отмена неоплаченного перевода", 1, 168),
        })
        .passthrough(),
    })
    .passthrough(),
  limits: z
    .object({
      dailySpendRub: num("Расходы на подготовку книг в сутки", 0, 1_000_000),
      staffDailySpendRub: num("Расходы сотрудников в сутки", 0, 1_000_000),
      previewsPerContact: num("Превью в сутки на контакт", 1, 100),
      textsPerDevice: num("Сказок в сутки с устройства", 1, 100),
      textsPerIp: num("Сказок в сутки с одной сети", 1, 10_000),
      rewrites: num("Переписать сказку", 0, 10),
      freeRedraws: num("Бесплатных перерисовок", 0, 50),
      redrawPriceRub: price("Цена перерисовки"),
      photoTtlDays: num("Хранить фото, дней", 1, 30),
      photoTtlNoBookHours: num("Фото без книги, часов", 1, 168),
      moodChangesPreview: num("Смен настроения до оплаты", 0, 10),
    })
    .passthrough(),
  bulk: z.object({ previewCopies: num("Книг до оплаты", 1, 10), tiers: BulkTiers }).passthrough(),
  gpu: z
    .object({
      idleMinutes: num("Выключать после простоя", 1, 1440),
      scheduleFrom: time("Пик: с"),
      scheduleTo: time("Пик: до"),
      scheduleMonths: z.array(num("Месяц пика", 1, 12)).max(12),
      hourlyRub: price("Цена часа GPU"),
      startupMinutes: num("Запуск GPU, минут", 0, 120),
    })
    .passthrough(),
  audio: z.object({ ttsPriceRub: price("Озвучка диктором"), selfReadPriceRub: price("«Читаю сам»"), clonePriceRub: price("Клон голоса") }).passthrough(),
  cartoon: z
    .object({
      priceRub: price("Мультфильм"),
      ownVoiceRub: price("«Своим голосом»"),
      targetSec: num("Длительность", 30, 600),
      minSec: num("Не короче", 10, 600),
      maxSec: num("Не длиннее", 10, 900),
      verticalHeight: z.union([z.literal(1280), z.literal(1920)], { errorMap: () => ({ message: "Вертикаль: 1280 или 1920" }) }),
      musicVolume: num("Громкость музыки", 0, 2, false),
      freeRerenders: num("Бесплатных пересборок", 0, 20),
      ownVoiceBuilds: num("Сборок своим голосом", 0, 50),
      shareDays: num("Ссылка «Поделиться», дней", 1, 365),
      voicePurgeDays: num("Удалять записи голоса через", 1, 365),
    })
    .passthrough()
    .refine((c) => c.minSec <= c.targetSec && c.targetSec <= c.maxSec, "Длительность: «не короче» ≤ длительность ≤ «не длиннее»"),
  shipping: z
    .object({ freeShippingBooks: num("Бесплатная доставка от, книг", 0, 1000), fallbackRub: z.record(price("Тариф доставки")) })
    .passthrough(),
  notifications: z.object({ smtpPort: num("Порт SMTP", 1, 65535), smtpFrom: z.string().trim().max(200) }).passthrough(),
  alerts: z.object({ email: emailOrEmpty("Почта для алертов"), spendPct: pctList("Порог расходов, %"), npdPct: pctList("Порог НПД, %") }).passthrough(),
  bonus: z.object({ reviewRub: num("Бонусов за отзыв", 0, 5000), maxSharePct: num("Оплата бонусами, % заказа", 0, 100), expiryDays: num("Бонусы сгорают через, дней", 1, 3650) }).passthrough(),
  referral: z.object({ newbiePct: num("Скидка новичку", 0, 90), bonusPct: num("Бонус приглашающему", 0, 90), delayDays: num("Бонус через, дней", 0, 365) }).passthrough(),
  season: z.object({ mode: z.enum(["auto", "manual", "off"]), printDeadline: dateOrEmpty("Последний день заказа") }).passthrough(),
  promoBar: z.object({ text: z.string().trim().max(200, "Текст полосы: не длиннее 200 символов") }).passthrough(),
};

/** Проверить раздел настроек перед сохранением. */
export function validateSettings<K extends SettingKey>(key: K, value: unknown): Res<Settings[K]> {
  const schema = SCHEMAS[key];
  if (!schema) return { ok: true, value: value as Settings[K] };
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data as Settings[K] };
  return { ok: false, error: r.error.issues[0]?.message ?? "Проверьте значения" };
}

export interface PromoInput {
  code: string;
  percentOff?: number | null;
  amountOffRub?: number | null;
  maxUses?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  blogger?: string | null;
}

/**
 * Новый промокод: код 3–30 символов (латиница, цифры, дефис), ровно одна скидка — 1–90% или фиксированная
 * не больше maxPriceRub (самый дорогой формат), лимит использований ≥ 1, срок действия — в будущем.
 */
export function validatePromo(p: PromoInput, maxPriceRub: number, now = new Date()): Res<{ code: string; percentOff: number | null; amountOffRub: number | null; maxUses: number | null; validFrom: Date | null; validTo: Date | null; blogger: string | null }> {
  const code = p.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(code)) return { ok: false, error: "Код: 3–30 символов — латинские буквы, цифры и дефис" };
  const pct = p.percentOff ?? null;
  const amt = p.amountOffRub ?? null;
  if ((pct == null) === (amt == null)) return { ok: false, error: "Укажите скидку: процент или сумму в рублях (что-то одно)" };
  if (pct != null && (!Number.isInteger(pct) || pct < 1 || pct > 90)) return { ok: false, error: "Скидка в процентах: от 1 до 90" };
  if (amt != null && (!Number.isInteger(amt) || amt < 1 || amt > maxPriceRub)) return { ok: false, error: `Скидка в рублях: от 1 до ${maxPriceRub.toLocaleString("ru-RU")} ₽ (не больше цены книги)` };
  const maxUses = p.maxUses ?? null;
  if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) return { ok: false, error: "Лимит использований: целое число от 1" };
  const date = (v: string | null | undefined, end: boolean) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    const d = new Date(`${v}T${end ? "23:59:59" : "00:00:00"}+03:00`);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const validFrom = date(p.validFrom, false);
  const validTo = date(p.validTo, true);
  if (validFrom === undefined || validTo === undefined) return { ok: false, error: "Даты — в формате ГГГГ-ММ-ДД" };
  if (validTo && validTo < now) return { ok: false, error: "Срок действия уже прошёл — выберите дату в будущем" };
  if (validFrom && validTo && validTo < validFrom) return { ok: false, error: "Дата окончания раньше даты начала" };
  const blogger = (p.blogger ?? "").trim().slice(0, 80) || null;
  return { ok: true, value: { code, percentOff: pct, amountOffRub: amt, maxUses, validFrom, validTo, blogger } };
}

/** Число из поля формы: пусто — null, мусор — NaN (отклонит проверка). */
export const optNum = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s.replace(",", "."));
};

// ── Разбор формы настроек (f.<путь>) без загрязнения прототипов ──
/** Ключи, которые нельзя принимать из формы и из БД: `f.__proto__.x` иначе меняет Object.prototype всего процесса. */
export const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Путь из формы: только «слова» через точку, без служебных ключей. */
export function safePath(path: string): string[] | null {
  const parts = path.split(".");
  if (!parts.length || parts.length > 6) return null;
  for (const p of parts) if (!/^[A-Za-z0-9_-]{1,60}$/.test(p) || FORBIDDEN_KEYS.has(p)) return null;
  return parts;
}

/** Записать значение по пути в объект без прототипа; служебный ключ — отказ (false). */
export function safeSet(out: Record<string, unknown>, path: string, v: unknown): boolean {
  const parts = safePath(path);
  if (!parts) return false;
  let o = out;
  for (const p of parts.slice(0, -1)) {
    const next = Object.prototype.hasOwnProperty.call(o, p) ? o[p] : undefined;
    if (next && typeof next === "object" && !Array.isArray(next)) o = next as Record<string, unknown>;
    else o = (o[p] = Object.create(null)) as Record<string, unknown>;
  }
  o[parts.at(-1)!] = v;
  return true;
}

/** Прочитать значение по пути (только собственные свойства). */
export function safeGet(base: unknown, path: string): unknown {
  const parts = safePath(path);
  if (!parts) return undefined;
  let o: unknown = base;
  for (const p of parts) {
    if (!o || typeof o !== "object" || !Object.prototype.hasOwnProperty.call(o, p)) return undefined;
    o = (o as Record<string, unknown>)[p];
  }
  return o;
}

/** Копия без служебных ключей на любом уровне (значение из БД или из формы). */
export function stripForbidden<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripForbidden) as T;
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!FORBIDDEN_KEYS.has(k)) out[k] = stripForbidden(x);
  return out as T;
}

/**
 * Раздел настроек из формы: поля `f.<путь>` по типам значений по умолчанию, чекбоксы — из `__bools`.
 * Пути со служебными ключами (`__proto__`, `constructor`, `prototype`) и неизвестными символами пропускаются.
 */
export function parseSettingsForm(defaults: unknown, f: { entries(): Iterable<[string, unknown]>; get(k: string): unknown }): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null);
  for (const [name, raw] of f.entries()) {
    if (!name.startsWith("f.")) continue;
    const path = name.slice(2);
    if (!safePath(path)) continue;
    const def = safeGet(defaults, path);
    const v = String(raw);
    if (typeof def === "number") safeSet(out, path, v.trim() === "" ? NaN : Number(v.replace(",", ".")));
    else if (Array.isArray(def) && def[0] && typeof def[0] === "object") safeSet(out, path, parseTiers(v));
    else if (Array.isArray(def)) safeSet(out, path, v.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (typeof def[0] === "number" ? Number(x) : x)));
    else safeSet(out, path, v);
  }
  // Чекбоксы: отсутствуют в форме, если выключены
  for (const name of String(f.get("__bools") ?? "").split(",").filter(Boolean)) safeSet(out, name, f.get(`f.${name}`) === "on");
  // Обычный объект (дальше — spread и zod), без служебных ключей
  return stripForbidden({ ...out });
}
