// «Ближайшие праздники» на сервере: список из настройки `holidays` (Setting, JSON), сроки печати и доставки
// из настроек, книги для карточек из каталога. Расчёты — в holidays-core.ts (чистые функции).
import { db, hasDatabase } from "./db";
import { cfg, getSetting, saveSetting } from "./settings";
import { getStories, type PublicStory } from "./catalog";
import { OCCASIONS, type AudienceKey } from "../content/profiles";
import {
  DEFAULT_LEAD,
  HOLIDAY_STORE,
  deadlineText,
  daysLeftText,
  fmtDay,
  mskToday,
  nearestHoliday,
  parseHoliday,
  upcomingHolidays,
  type Holiday,
  type HolidayCalc,
  type LeadTimes,
} from "./holidays-core";

export const HOLIDAYS_KEY = "holidays";
const SVOYA_IDEYA = "svoya-ideya";

/** Список праздников: из настройки; нет записи (или БД) — по умолчанию. Битые элементы пропускаются. */
export async function getHolidays(): Promise<Holiday[]> {
  const raw = await getSetting<unknown>(HOLIDAYS_KEY, null);
  if (!Array.isArray(raw)) return HOLIDAY_STORE.items;
  const out: Holiday[] = [];
  for (const x of raw) {
    const r = parseHoliday(x);
    if (r.ok && r.holiday.id) out.push(r.holiday);
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function saveHolidays(items: Holiday[]) {
  await saveSetting(HOLIDAYS_KEY, items);
}

/**
 * Сроки для «заказать до»: печать — верхняя граница срока типографии (PrintHouse.leadDaysMax, по умолчанию 5 раб. дней),
 * доставка — верхняя граница СДЭК до ПВЗ из настроек (если выключен — самого быстрого включённого способа), 7 дней.
 */
export async function getLeadTimes(): Promise<LeadTimes> {
  const ship = await cfg("shipping");
  let productionDays = DEFAULT_LEAD.productionDays;
  if (hasDatabase) {
    const ph = await db.printHouse.findFirst({ where: { isActive: true }, select: { leadDaysMax: true } }).catch(() => null);
    if (ph?.leadDaysMax) productionDays = ph.leadDaysMax;
  }
  const enabled: Record<string, boolean> = { cdek_pvz: ship.cdekPvz, cdek_courier: ship.cdekCourier, pochta: ship.pochta, yandex: ship.yandex };
  const upper = (k: string) => ship.fallbackDays?.[k]?.[1];
  let deliveryDays = enabled.cdek_pvz && upper("cdek_pvz") ? upper("cdek_pvz")! : DEFAULT_LEAD.deliveryDays;
  if (!enabled.cdek_pvz) {
    const xs = Object.keys(enabled).filter((k) => enabled[k] && upper(k)).map((k) => upper(k)!);
    if (xs.length) deliveryDays = Math.min(...xs);
  }
  return { productionDays, deliveryDays };
}

const AUDIENCE_SLUG: Record<AudienceKey, { slug: string; label: string }> = {
  CHILD: { slug: "detyam", label: "Детям" },
  TEEN: { slug: "podrostkam", label: "Подросткам" },
  ADULT: { slug: "vzroslym", label: "Взрослым" },
  PET: { slug: "pitomcam", label: "Питомцам" },
};

/** Близкий повод для подбора книг, если к самому поводу книг ещё нет (зимние праздники — новогодние книги). */
const RELATED: Record<string, string> = { rozhdestvo: "novyj-god", "staryj-novyj-god": "novyj-god" };

/** Книги к поводу: сначала написанные к нему (затем к близкому поводу), не больше двух на аудиторию. */
function pickForOccasion(stories: PublicStory[], key: string, n = 4) {
  const rel = RELATED[key];
  const rank = (s: PublicStory) => (s.occasions.includes(key) ? s.occasions.indexOf(key) : rel && s.occasions.includes(rel) ? 50 + s.occasions.indexOf(rel) : 100);
  const sorted = stories.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
  const out: PublicStory[] = [];
  const per: Record<string, number> = {};
  for (const s of sorted) {
    if ((per[s.audience] ?? 0) >= 2) continue;
    per[s.audience] = (per[s.audience] ?? 0) + 1;
    out.push(s);
    if (out.length === n) break;
  }
  return out;
}

/** По одной книге на аудиторию (дни рождения — детям, подросткам, взрослым, питомцам). */
function onePerAudience(stories: PublicStory[], key: string) {
  return (Object.keys(AUDIENCE_SLUG) as AudienceKey[])
    .map((a) => pickForOccasion(stories.filter((s) => s.audience === a), key, 1)[0])
    .filter(Boolean) as PublicStory[];
}

export interface HolidayCard {
  id: string;
  title: string;
  occasionKey: string;
  description: string;
  always: boolean;
  /** «31 декабря, четверг» или null для «всегда». */
  dateLabel: string | null;
  iso: string | null;
  daysLeft: number | null;
  daysLeftLabel: string | null;
  deadlineLine: string;
  printOk: boolean;
  books: PublicStory[];
  catalogHref: string;
  occasionHref: string | null;
  audiences: { label: string; href: string }[];
}

/** Карточки для /prazdniki (и демо): чистая сборка из расчёта и каталога. */
export function buildHolidayCards(calcs: HolidayCalc[], stories: PublicStory[], now: Date, lead: LeadTimes): HolidayCard[] {
  const list = stories.filter((s) => s.slug !== SVOYA_IDEYA);
  const known = new Set(OCCASIONS.map((o) => o.key));
  const ty = new Date(mskToday(now) * 86400_000).getUTCFullYear();
  return calcs.map((c) => {
    const h = c.holiday;
    const always = h.rule.kind === "always";
    const curated = h.bookSlugs.map((s) => list.find((x) => x.slug === s)).filter(Boolean) as PublicStory[];
    const books = curated.length ? curated.slice(0, 4) : always ? onePerAudience(list, h.occasionKey) : pickForOccasion(list, h.occasionKey);
    const isKnown = known.has(h.occasionKey);
    const audiences = always
      ? (Object.keys(AUDIENCE_SLUG) as AudienceKey[])
          .filter((a) => OCCASIONS.find((o) => o.key === h.occasionKey)?.audiences.includes(a) ?? true)
          .map((a) => ({ label: AUDIENCE_SLUG[a].label, href: `/skazki?povod=${h.occasionKey}&dlya=${AUDIENCE_SLUG[a].slug}` }))
      : [];
    const yearOf = c.date != null ? new Date(c.date * 86400_000).getUTCFullYear() : ty;
    return {
      id: h.id,
      title: h.title,
      occasionKey: h.occasionKey,
      description: h.description,
      always,
      dateLabel: c.date != null ? fmtDay(c.date, { year: yearOf !== ty, weekday: true }) : null,
      iso: c.date != null ? new Date(c.date * 86400_000).toISOString().slice(0, 10) : null,
      daysLeft: c.daysLeft,
      daysLeftLabel: c.daysLeft != null ? daysLeftText(c.daysLeft) : null,
      deadlineLine: deadlineText(c, now, lead),
      printOk: c.printOk,
      books,
      catalogHref: isKnown ? `/skazki?povod=${h.occasionKey}` : "/skazki",
      occasionHref: isKnown ? `/povod/${h.occasionKey}` : null,
      audiences,
    };
  });
}

export async function getHolidayCards(now = new Date()): Promise<HolidayCard[]> {
  const [items, lead, stories] = await Promise.all([getHolidays(), getLeadTimes(), getStories()]);
  return buildHolidayCards(upcomingHolidays(items, now, lead), stories, now, lead);
}

/** Ближайший праздник с датой — для кнопки на главной и полосы промо. */
export async function getNearestHoliday(now = new Date()) {
  const [items, lead] = await Promise.all([getHolidays(), getLeadTimes()]);
  const c = nearestHoliday(items, now, lead);
  return c ? { calc: c, lead } : null;
}
