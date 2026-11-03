// «Сервер» демо-стенда в браузере: хранилище (localStorage «bookimi.demo.v1», фото — только в памяти вкладки)
// и API с теми же адресами и правилами, что src/app/api/** (перехват fetch). Текст — DemoTextProvider сайта,
// картинки — renderDemoSpread, сумма — quote(), путь заказа — journey(), настройки — DEFAULTS из settings.ts.
import { liveMoodId } from "../../src/content/moods";
import { qrSvg } from "./qr";
import { AnswersV2, appearanceLine, extraGender, heroAge, heroHairAndClothes, type QuizAnswers } from "../../src/lib/quiz";
import { DemoTextProvider, personalize, plotForAnswers, type StoryText } from "../../src/lib/gen/text";
import { moodsFor } from "../../src/content/moods";
import { ART_STYLE_IDS, DEFAULT_ART_STYLE } from "../../src/content/profiles";
import { HERO_KIND_BY_AUDIENCE, type DemoExtra, type DemoLook, type HeroKind } from "../../src/content/types";
import { extraDrawKind } from "../../src/content/art/index";
import { extraDemoLook } from "../../src/lib/gen/extras";
import { OUTFIT_COLORS } from "../../src/content/art/shared";
import { renderDemoSpread, watermark } from "../../src/content/art/render";
import { declineName, guessGender } from "../../src/lib/declension";
import { normalizePhone } from "../../src/content/answers";
import { soonAudiences, soonCreateError } from "../../src/lib/shelf";
import { etaDate, quote, ruDate, type CatalogAddon, type CatalogFormat } from "../../src/lib/pricing";
import { ADDONS, FORMATS } from "../../src/lib/catalog-defaults";
import { addonFits, audienceOfParams } from "../../src/lib/addons-core";
import { canAcceptPayments, DEFAULTS } from "../../src/lib/settings";
import type { ExtraV2T } from "../../src/content/answers";
import type { JourneyOrder } from "../../src/app/zakaz/journey";
import { cityLabel, findCity, normalizeCity, searchCities } from "../../src/lib/cities";
import { filterPvz, type Pvz } from "../../src/lib/pvz";
import { tableQuote } from "../../src/lib/ship-zones";
import { addToAddressBook, addressError, cleanAddress, pickPrefill, type DeliveryAddress, type SavedAddress } from "../../src/lib/delivery";
import { detectFaces, judgePhoto, laplacianVariance, mainFaces, meanStd, portraitCrop, sniffImage, suggestFur, suggestHair, type Box, type Px } from "../../src/lib/photo-check";
import { bulkCopyAnswers, bulkPct, bulkQuote, DEFAULT_BULK_DEDICATION, groupChildren } from "../../src/lib/bulk";
import { crowdLooks } from "../../src/content/art/render";
import { groupMembersMax, groupSpreadIndexes } from "../../src/content/registry";
import { dedicationText, groupOf } from "../../src/lib/gen/text";
import { cartoonScript, type Cue } from "../../src/lib/gen/cartoon-script";
import { plainSpread } from "../../src/lib/spread-markup";
import { checkFirstName, FIRST_NAME_ERROR } from "../../src/lib/first-name";
import { layoutOf } from "../../src/lib/book-layout";
import { applyLayoutEdit, editLocked, LayoutEdit, NAME_AFTER_PAY } from "../../src/lib/book-edit";
import { fullNameError, normalizeName } from "../../src/lib/names";
import { applyBonus, bonusBalance, reviewBonusAllowed, reviewCredit, type BonusEntryLike } from "../../src/lib/bonuses";
import { canChangeOrder, describeChange, type OrderShape } from "../../src/lib/order-change";

// ───────── хранилище ─────────
export interface DBook {
  id: string;
  createdAt: number;
  params: QuizAnswers;
  status: string;
  progress: number;
  error: string | null;
  text: StoryText | null;
  /** Текст с метками имени — для «Изменить имя» в превью (rev 13). */
  textRaw?: StoryText | null;
  rewritesLeft: number;
  redrawsLeft: number;
  mood: string;
  moodChangesPreview: number;
  moodChangesFull: number;
  withPhoto: boolean;
  paidFull: boolean;
  pages: number[];
  variants: Record<number, number>;
  textApprovedAt?: number;
  previewReadyAt?: number;
  fullReadyAt?: number;
  /** Копия заказа «для каждого в группе»: id главной книги и номер ребёнка. */
  parentId?: string;
  bulkIndex?: number;
}
export interface DOrder {
  id: string;
  publicCode: string;
  createdAt: number;
  whoPrints: "self" | "bookimi";
  bookId: string;
  /** «Для каждого в группе»: все книги заказа (главная — первой). */
  bookIds?: string[];
  items: { kind: string; refKey: string; title: string; priceRub: number }[];
  subtotalRub: number;
  discountRub: number;
  pdfCreditRub: number;
  shippingRub: number;
  totalRub: number;
  promo?: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  readyDate?: number;
  shipment?: { method: string; address: DeliveryAddress & { noPrefill?: boolean }; etaDate?: number; trackNumber?: string };
  status: string;
  paidAt?: number;
  payMethod?: string;
  receipt?: boolean;
  /** Заказ только с цифровыми допами к готовой книге (мультфильм из кабинета) — книгу не перерисовываем. */
  addonsOnly?: boolean;
  /** Выбор покупателя при оформлении — для «Изменить заказ» (rev 10). */
  input?: CheckoutInput;
  /** Оплачено бонусами, ₽. */
  bonusRub?: number;
  /** История изменений до оплаты: что поменялось и новая сумма. */
  changes?: { at: number; lines: string[]; totalRub: number }[];
}
export interface DPromo {
  code: string;
  percentOff: number | null;
  amountOffRub: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  source: string;
  blogger?: string;
}
export interface Store {
  v: 3;
  user: { email: string; phone: string; name?: string; firstName?: string; marketing: boolean } | null;
  consent: { pd: boolean; photo: boolean; marketing: boolean; group?: boolean };
  books: DBook[];
  orders: DOrder[];
  counters: Record<string, number>;
  prices: Record<string, number>;
  limits: Partial<typeof DEFAULTS.limits>;
  promos: DPromo[];
  log: { at: number; text: string }[];
  costs: { at: number; rub: number }[];
  events: { at: number; name: string }[];
  otp: { email: string; phone: string; code: string } | null;
  /** Адресная книга доставки (как User.savedAddresses): null — ещё не заводилась. */
  addresses?: SavedAddress[] | null;
  /** Мультфильм по книге: согласие на голос и режим озвучки (диктор / свой голос). Записи голоса — только в памяти вкладки. */
  cartoons?: Record<string, { consent: boolean; mode: "auto" | "own" }>;
  /** «Скоро» (storefront.soon) из админки демо; нет — как на сайте по умолчанию. */
  soon?: typeof DEFAULTS.storefront.soon;
  /** Бонусы: журнал начислений и списаний (src/lib/bonuses.ts). */
  bonus?: (BonusEntryLike & { note?: string })[];
  /** Отзывы покупателя (модерация — в админке демо). */
  reviews?: { id: string; orderId: string; rating: number; text: string; authorName: string; status: "pending" | "approved" | "rejected"; at: number }[];
  /** Режим админа демо: кнопка «Показать всю книгу (для админа)» на превью. */
  adminMode?: boolean;
  /** Настройки из админки демо: «Оживление книги» продаётся (по умолчанию — «скоро»), бонусы. */
  cartoonEnabled?: boolean;
  bonusCfg?: Partial<typeof DEFAULTS.bonus>;
  /** rev 19: цена «Другой обложки» из админки демо (нет — 100 ₽). */
  coverPriceRub?: number;
}

export const KEY = "bookimi.demo.v1";
/** Ключи сайта в браузере, которые демо тоже чистит при «Начать сначала». */
export const SITE_KEYS = ["bookimi.quiz.v3", "bookimi.quiz.v2", "bookimi.quiz.v1", "bookimi.heroName"];
/** Ключи браузера, которые «Начать демо сначала» не трогает: выбранная тема. */
export const KEEP_KEYS = ["bk_theme"];

const blank = (): Store => ({
  v: 3,
  user: null,
  consent: { pd: false, photo: false, marketing: false },
  books: [],
  orders: [],
  counters: {},
  prices: {},
  limits: {},
  promos: [{ code: "SKAZKA10", percentOff: 10, amountOffRub: null, maxUses: null, usedCount: 0, isActive: true, source: "manual" }],
  log: [],
  costs: [],
  events: [],
  otp: null,
});

export let S: Store = blank();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (saved?.v === 3) S = { ...blank(), ...saved };
  // rev 11: «скоро» для подростков, взрослых и питомцев — новые значения по умолчанию; старые отметки админки демо (rev ≤ 10) сбрасываем
  if (S.soon && !(S as { soonRev?: number }).soonRev) S.soon = undefined;
} catch {}
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
}
export function resetStore() {
  // Всё, что демо и компоненты сайта хранят в браузере: localStorage (кроме темы), sessionStorage, cookie баннера
  try {
    localStorage.removeItem(KEY);
    for (const k of SITE_KEYS) localStorage.removeItem(k);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && !KEEP_KEYS.includes(k)) localStorage.removeItem(k);
    }
  } catch {}
  try {
    sessionStorage.clear();
  } catch {}
  try {
    for (const c of document.cookie.split(";")) {
      const n = c.split("=")[0].trim();
      if (n) document.cookie = `${n}=; Max-Age=0; Path=/`;
    }
  } catch {}
  for (const t of jobs.values()) clearTimeout(t);
  jobs.clear();
  photos.clear();
  drafts.clear();
  voices.clear();
  S = blank();
  applySettings();
}

let onChange: () => void = () => {};
export function onStoreChange(fn: () => void) {
  onChange = fn;
}
function commit() {
  save();
  onChange();
}

/** Журнал админки: действия покупателя, уведомления, алерты владельцу. */
export function log(text: string) {
  S.log.unshift({ at: Date.now(), text });
  S.log = S.log.slice(0, 80);
}
const event = (name: string) => S.events.push({ at: Date.now(), name });

// ───────── настройки (как после scripts/seed-demo.ts) ─────────
const BASE_PRICES = Object.fromEntries([...FORMATS.map((f) => [f.key, f.price]), ...ADDONS.filter((a) => a.price).map((a) => [a.key, a.price as number])]);
// Демо для тестирования: тексты, превью, «Переписать», перерисовки и смены настроения — по 999 (сброс — «Сбросить лимиты»)
const BASE_LIMITS = { ...DEFAULTS.limits, textsPerDevice: 999, textsPerIp: 999, previewsPerContact: 999, rewrites: 999, freeRedraws: 999, moodChangesPreview: 999 };

const BASE_SOON = structuredClone(DEFAULTS.storefront.soon);
const BASE_BONUS = structuredClone(DEFAULTS.bonus);

export function applySettings() {
  Object.assign(DEFAULTS.seller, { fullName: "Иванова Анна Сергеевна (демо)", inn: "770012345606", email: "hello@bookimi.demo", phone: "+7 900 000-00-00" });
  DEFAULTS.payments.sbpQr = { enabled: true, provider: "demo", confirmMinutes: 60 };
  DEFAULTS.payments.transfer = { enabled: true, phone: "+7 900 000-00-00", card: "", bank: "Демо-банк", holder: "Анна С. И. (демо)", cancelHours: 24 };
  DEFAULTS.flags.photoUploadEnabled = true;
  DEFAULTS.flags.demoMode = true;
  DEFAULTS.alerts.email = "owner@bookimi.demo";
  Object.assign(DEFAULTS.limits, BASE_LIMITS, S.limits);
  DEFAULTS.storefront.soon = structuredClone(S.soon ?? BASE_SOON);
  // rev 10: «Оживление книги» — «скоро», пока не включат в админке демо; вход по SMS — показываем вкладку «Телефон»
  DEFAULTS.cartoon.enabled = Boolean(S.cartoonEnabled);
  DEFAULTS.auth.smsLogin = true;
  Object.assign(DEFAULTS.bonus, BASE_BONUS, S.bonusCfg ?? {});
  DEFAULTS.bookOptions.coverPriceRub = S.coverPriceRub ?? 100;
  for (const f of FORMATS as unknown as { key: string; price: number }[]) f.price = S.prices[f.key] ?? BASE_PRICES[f.key];
  for (const a of ADDONS as unknown as { key: string; price: number | null }[]) if (a.price !== null) a.price = S.prices[a.key] ?? BASE_PRICES[a.key];
}
applySettings();

export function setPrices(p: Record<string, number>) {
  S.prices = p;
  applySettings();
  commit();
}
/** Админка демо → «Оживление книги» продаётся или «скоро»; бонусы за отзыв; режим админа. */
export function setDemoFlags(p: { cartoonEnabled?: boolean; adminMode?: boolean; bonusCfg?: Partial<typeof DEFAULTS.bonus>; coverPriceRub?: number }) {
  if (p.coverPriceRub !== undefined) S.coverPriceRub = Math.max(0, Math.round(p.coverPriceRub));
  if (p.cartoonEnabled !== undefined) S.cartoonEnabled = p.cartoonEnabled;
  if (p.adminMode !== undefined) S.adminMode = p.adminMode;
  if (p.bonusCfg) S.bonusCfg = { ...S.bonusCfg, ...p.bonusCfg };
  applySettings();
  commit();
}
/** Админка демо → «Скоро»: аудитории и книги полки. */
export function setSoon(soon: typeof DEFAULTS.storefront.soon | undefined) {
  S.soon = soon;
  (S as { soonRev?: number }).soonRev = 11;
  applySettings();
  commit();
}
export function setLimits(l: Partial<typeof DEFAULTS.limits>) {
  S.limits = l;
  applySettings();
  // Поднятый лимит расходов выпускает превью из очереди
  for (const b of S.books) if (b.status === "PREVIEW_QUEUED" && b.error === "limit") startJob(b, "preview");
  commit();
}

/** «Сбросить лимиты»: настройки лимитов — демо по умолчанию, счётчики за сегодня — с нуля, у книг — снова полные лимиты. */
export function resetLimits() {
  S.limits = {};
  applySettings();
  S.counters = {};
  const l = DEFAULTS.limits;
  for (const b of S.books) {
    b.rewritesLeft = l.rewrites;
    b.redrawsLeft = l.freeRedraws;
    b.moodChangesPreview = 0;
    b.moodChangesFull = 0;
    if (b.status === "PREVIEW_QUEUED" && b.error === "limit") startJob(b, "preview");
  }
  log(`Лимиты сброшены: сказок, превью, «Переписать», перерисовок и смен настроения — по ${l.textsPerDevice} в сутки`);
  commit();
}

// ───────── утилиты ─────────
const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === "x" ? 0 : 8)).toString(16));
export const mskDay = (d = new Date()) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
function hit(subject: string, kind: string, max: number) {
  const k = `${mskDay()}:${kind}:${subject}`;
  if ((S.counters[k] ?? 0) >= max) return false;
  S.counters[k] = (S.counters[k] ?? 0) + 1;
  return true;
}
export const spentTodayRub = () => Math.round(S.costs.filter((c) => mskDay(new Date(c.at)) === mskDay()).reduce((s, c) => s + c.rub, 0));
/** Оценка стоимости генерации для графиков (на сайте — по токенам и минутам GPU). */
const COST = { text: 0.6, image: 3.5 };

type R = { status: number; json: unknown };
const ok = (json: unknown): R => ({ status: 200, json });
const err = (error: string, status = 400): R => ({ status, json: { error } });

export const bookById = (id: string) => S.books.find((b) => b.id === id) ?? null;
export const orderById = (id: string) => S.orders.find((o) => o.id === id) ?? null;

// ───────── картинки книги (как DemoImageProvider + savePage) ─────────
// Внешность для демо-рисовальщика — как heroLook/extraLook/plotInfo в src/lib/gen/pipeline.ts (модуль серверный)
function heroLook(a: QuizAnswers): DemoLook {
  const p = a.appearance;
  return {
    gender: a.hero.gender,
    age: heroAge(a),
    // Выбор картинками (rev 14): глаза, улыбка, румянец, цвет одежды
    eyes: p.eyes || undefined,
    smile: p.smile || undefined,
    blush: p.blush || undefined,
    outfit: OUTFIT_COLORS[p.outfitColor ?? ""],
    hair: p.hair,
    // Причёска и вид одежды ребёнка — из набора своего пола (rev 15), на всю книгу и PDF
    ...heroHairAndClothes(a),
    longHair: a.audience === "CHILD" ? undefined : /длинн|хвост|косич|кудр|пучок|коса/i.test(p.hairstyle ?? ""),
    skin: p.skin,
    glasses: p.glasses,
    freckles: p.freckles,
    beard: p.beard,
    species: a.pet.species,
    breed: a.pet.breed,
    furColor: a.pet.furColor,
  };
}
// Доп. герой — та же extraDemoLook, что на сайте: мама ≠ папа ≠ бабушка ≠ дедушка, кошка — кошка (rev 14)
function extraLook(e: ExtraV2T, a: QuizAnswers): DemoLook {
  return extraDemoLook(e, { heroAge: heroAge(a), partnerAge: heroAge(a) });
}
const IDEA_THEME: Record<string, string> = { CHILD: "dragon", TEEN: "city-night", ADULT: "home", PET: "pet-home" };
export function plotInfo(a: QuizAnswers) {
  const plot = plotForAnswers(a);
  const heroKind: HeroKind = HERO_KIND_BY_AUDIENCE[a.audience];
  return plot ? { slug: plot.slug, theme: plot.theme, heroKind: plot.heroKind } : { slug: "svoya-ideya", theme: IDEA_THEME[a.audience] ?? "meadow", heroKind };
}

const blobs = new Map<string, string>();
export function svgUrl(key: string, make: () => string) {
  let u = blobs.get(key);
  if (!u) {
    u = URL.createObjectURL(new Blob([make()], { type: "image/svg+xml" }));
    blobs.set(key, u);
  }
  return u;
}

export function pageUrl(b: DBook, index: number, opts: { full?: boolean } = {}) {
  const full = opts.full ?? (b.paidFull && b.status === "FULL_READY");
  const v = b.variants[index] ?? 0;
  const key = `${b.id}|${index}|${v}|${b.mood}|${full ? "full" : "wm"}`;
  return svgUrl(key, () => {
    const a = b.params;
    const kind = HERO_KIND_BY_AUDIENCE[a.audience];
    // Перерисовка в демо — другой ракурс того же разворота
    const idx = index === 0 ? 0 : ((index - 1 + v * 5) % 12) + 1;
    const extras: DemoExtra[] = a.extras.map((e) => ({ role: e.role === "custom" && e.what ? e.what : e.role, kind: extraDrawKind(e.role, kind), look: extraLook(e, a) }));
    // Группа — как drawPages в pipeline.ts: толпа на разворотах {GROUP}, «общая фотография» там, где {ПЕРЕКЛИЧКА}
    const plot = plotForAnswers(a);
    const g = groupOf(a, plot);
    const crowdOn = plot?.group && idx > 0 && g.members.length + g.adults.length > 0 && groupSpreadIndexes(plot).includes(idx);
    let svg = renderDemoSpread({
      plot: plotInfo(a),
      spreadIndex: idx,
      wide: index > 0,
      artStyle: a.artStyle,
      mood: b.mood || null,
      hero: { ...heroLook(a), kind },
      extras,
      caption: "демо-иллюстрация · на сайте рисуем по фото в выбранном стиле",
      // Название на картинку не рисуем: обложку подписывает вёрстка книги (BookPreview, PDF) — как на сайте
      title: undefined,
      ...(crowdOn ? { crowd: crowdLooks(g.members, g.adults, { kind: plot!.audience === "TEEN" ? "teen" : "child", age: heroAge(a) }), crowdLayout: plot!.spreads[idx - 1]?.text.includes("{ПЕРЕКЛИЧКА}") ? ("photo" as const) : ("around" as const) } : {}),
    });
    if (!full) svg = svg.replace(/<\/svg>\s*$/, `${watermark(index === 0 ? 1024 : 2048, 1024)}</svg>`);
    return svg;
  });
}

// ───────── генерация (очередь) ─────────
const jobs = new Map<string, ReturnType<typeof setTimeout>>();
type JobKind = "text" | "preview" | "full";
const JOB_MS: Record<JobKind, number> = { text: 1600, preview: 2600, full: 3200 };

function startJob(b: DBook, kind: JobKind) {
  clearTimeout(jobs.get(b.id));
  const t0 = Date.now();
  const total = JOB_MS[kind];
  const tick = () => {
    const book = bookById(b.id);
    if (!book) return;
    const p = Math.min(99, Math.round(((Date.now() - t0) / total) * 100));
    book.progress = Math.max(book.progress, p);
    if (Date.now() - t0 < total) {
      jobs.set(b.id, setTimeout(tick, 250));
      return;
    }
    jobs.delete(b.id);
    finishJob(book, kind).then(commit, (e) => {
      book.status = "FAILED";
      book.error = String(e?.message ?? e);
      commit();
    });
  };
  if (kind === "preview" && !b.paidFull && spentTodayRub() >= DEFAULTS.limits.dailySpendRub) {
    b.error = "limit";
    log(`Алерт владельцу: лимит расходов на подготовку книг исчерпан (${spentTodayRub()} ₽ из ${DEFAULTS.limits.dailySpendRub} ₽). Превью ждут в очереди.`);
    return;
  }
  b.error = null;
  b.progress = 5;
  jobs.set(b.id, setTimeout(tick, 250));
}

async function finishJob(b: DBook, kind: JobKind) {
  const a = AnswersV2.parse(b.params);
  if (kind === "text" || (kind === "full" && !b.text)) {
    const r = await new DemoTextProvider().write(a, plotForAnswers(a), Math.max(0, 2 - b.rewritesLeft));
    b.textRaw = r.raw;
    b.text = personalize(r.raw, a);
    if (kind === "full") return finishJob(b, "full");
    b.status = b.parentId ? "TEXT_APPROVED" : "TEXT_READY";
    // Копия «для каждого»: главная книга уже с превью — рисуем превью и копии
    if (b.parentId && bookById(b.parentId)?.previewReadyAt && (b.bulkIndex ?? 99) < DEFAULTS.bulk.previewCopies) {
      b.status = "PREVIEW_QUEUED";
      startJob(b, "preview");
    }
    b.progress = 100;
    S.costs.push({ at: Date.now(), rub: COST.text });
    event("text_ready");
    log(`Сказка сочинена: «${b.text.title}»`);
    return;
  }
  if (kind === "preview") {
    // Демо-рисовальщик мгновенный: в превью — все страницы (с водяным знаком), без «нарисуем после оплаты» (rev 14).
    // На сайте превью — обложка и 2 разворота, остальные страницы до оплаты — эскизы (sketchUrls).
    b.pages = Array.from({ length: 13 }, (_, i) => i);
    b.status = "PREVIEW_READY";
    b.progress = 100;
    b.previewReadyAt = Date.now();
    S.costs.push({ at: Date.now(), rub: COST.image * 3 });
    event("preview_ready");
    if (b.parentId) return;
    log(`Превью готово: вся книга (в демо картинки мгновенные; на сайте — обложка и 2 разворота) · уведомление покупателю «Превью готово» (${S.user?.email ?? "—"})`);
    for (const c of copiesOf(b.id).slice(0, DEFAULTS.bulk.previewCopies - 1))
      if (c.status === "TEXT_APPROVED") {
        c.status = "PREVIEW_QUEUED";
        startJob(c, "preview");
      }
    return;
  }
  const had = b.pages.length;
  b.pages = Array.from({ length: 13 }, (_, i) => i);
  b.status = "FULL_READY";
  b.progress = 100;
  b.fullReadyAt ??= Date.now();
  S.costs.push({ at: Date.now(), rub: COST.image * Math.max(1, 13 - (had === 13 ? 0 : had)) });
  log(`Книга готова: «${b.text?.title}» — PDF для экрана, А4, копицентра 21×21 и 15×15 (в демо PDF не собирается)`);
}

/** После перезагрузки страницы: продолжить то, что было в очереди. */
export function resumeJobs() {
  for (const b of S.books) {
    if (b.status === "TEXT_QUEUED") startJob(b, "text");
    else if (b.status === "PREVIEW_QUEUED") startJob(b, "preview");
    else if (b.status === "FULL_QUEUED") startJob(b, "full");
  }
}

// ───────── фото (только в памяти) ─────────
const photos = new Map<string, { id: string; url: string; role: string }[]>();
export const photosOf = (bookId: string) => photos.get(bookId) ?? [];

// Фото анкеты — как /api/draft/photos и src/lib/photo-process.ts, но в браузере (canvas): тип по байтам, поворот по EXIF
// (браузер применяет его сам), лица, резкость, свет, портрет «голова и плечи». Только в памяти вкладки.
interface DraftPhoto { view: PhotoViewD; orig: HTMLCanvasElement; meta: { kind: "human" | "pet"; faces: Box[]; width: number; height: number } }
type PhotoViewD = { id: string; slot: string; url: string; originalUrl: string | null; faces: Box[]; chosen: number; verdict: string; hints: string[]; codes: string[]; hair?: string; fur?: string };
const drafts = new Map<string, DraftPhoto>();
const canvas = (w: number, h: number) => Object.assign(document.createElement("canvas"), { width: w, height: h });
function pxOf(c: HTMLCanvasElement, x = 0, y = 0, w = c.width, h = c.height, tw = w, th = h): Px {
  const t = canvas(tw, th);
  const ctx = t.getContext("2d")!;
  ctx.drawImage(c, x, y, w, h, 0, 0, tw, th);
  return { data: ctx.getImageData(0, 0, tw, th).data, width: tw, height: th, channels: 4 };
}
function photoMetrics(orig: HTMLCanvasElement, face: Box | null) {
  const f = face ?? { x: 0.2, y: 0.15, w: 0.6, h: 0.6 };
  const W = orig.width, H = orig.height;
  const px = pxOf(orig, f.x * W, f.y * H, Math.max(8, f.w * W), Math.max(8, f.h * H), 256, 256);
  const gray = new Float32Array(256 * 256);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px.data[i * 4] + 0.587 * px.data[i * 4 + 1] + 0.114 * px.data[i * 4 + 2];
  const { mean, std } = meanStd(gray);
  return { sharpness: Math.round(laplacianVariance(gray, 256, 256)), brightness: Math.round(mean), contrast: Math.round(std) };
}
function portraitUrl(orig: HTMLCanvasElement, face: Box | null, kind: "human" | "pet") {
  const c = portraitCrop(face, orig.width, orig.height, kind);
  const t = canvas(512, 512);
  const ctx = t.getContext("2d")!;
  ctx.filter = "contrast(1.05) saturate(1.04)";
  ctx.drawImage(orig, c.left, c.top, c.side, c.side, 0, 0, 512, 512);
  return t.toDataURL("image/jpeg", 0.88);
}
async function processDraftPhoto(file: File, slot: string, kind: "human" | "pet", adult: boolean): Promise<PhotoViewD> {
  if (!sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()))) throw new Error("Подойдёт фото JPG, PNG, WebP или HEIC");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Не получилось открыть фото. Попробуйте другой файл.");
  }
  const k = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
  const orig = canvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  orig.getContext("2d")!.drawImage(bmp, 0, 0, orig.width, orig.height);
  const sk = 160 / Math.max(orig.width, orig.height);
  const small = pxOf(orig, 0, 0, orig.width, orig.height, Math.round(orig.width * sk), Math.round(orig.height * sk));
  const { list, others } = kind === "human" ? mainFaces(detectFaces(small)) : { list: [], others: 0 };
  const main = list[0] ?? null;
  const facePx = main ? Math.round(Math.min(main.w * bmp.width, main.h * bmp.height)) : 0;
  const m = photoMetrics(orig, main);
  const v = judgePhoto({ kind, width: bmp.width, height: bmp.height, faces: list.length, otherFaces: others, facePx, ...m });
  if (v.verdict === "reject") throw new Error(v.hints[0]);
  const id = uuid();
  const faces = list.map(({ x, y, w, h }) => ({ x, y, w, h }));
  const view: PhotoViewD = {
    id, slot, ...v, faces, chosen: 0,
    url: portraitUrl(orig, main, kind),
    originalUrl: faces.length > 1 ? orig.toDataURL("image/jpeg", 0.8) : null,
    hair: main ? suggestHair(small, main, adult) : undefined,
    fur: kind === "pet" ? suggestFur(small) : undefined,
  };
  drafts.set(id, { view, orig, meta: { kind, faces, width: bmp.width, height: bmp.height } });
  return view;
}

// ───────── оформление (как priceCheckout / createOrder в src/lib/orders.ts) ─────────
/** Как catalogForPricing в src/lib/orders.ts: с аудиторией книги — только её допы (src/lib/addons-core.ts). */
export function catalogForPricing(audience?: string): { formats: CatalogFormat[]; addons: CatalogAddon[] } {
  const flags = DEFAULTS.flags;
  const audio = DEFAULTS.audio;
  return {
    formats: FORMATS.filter((f) => f.kind === "PDF" || flags.printEnabled).map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price })),
    addons: ADDONS.filter((a) => a.active && addonFits(a, audience))
      .filter((a) => flags.printEnabled || !a.print)
      .filter((a) => DEFAULTS.cartoon.enabled || !a.key.startsWith("cartoon"))
      .filter((a) => a.key !== "audio-self" || audio.selfReadEnabled)
      .map((a) => ({
        key: a.key,
        kind: a.kind,
        title: a.title,
        description: a.description,
        priceRub: a.key === "audiobook" ? audio.ttsPriceRub : a.key === "audio-self" ? audio.selfReadPriceRub : a.price,
        percentOff: a.pct,
        requiresPrint: a.print,
        audiences: [...a.audiences],
        supplier: a.supplier,
      })),
  };
}
/** Аудитория демо-книги (анкета). */
export const bookAudience = (b: { params: unknown }) => audienceOfParams(b.params);
export const SHIP_METHODS = (["cdek_pvz", "cdek_courier", "pochta", "yandex"] as const).filter((m) => ({ cdek_pvz: DEFAULTS.shipping.cdekPvz, cdek_courier: DEFAULTS.shipping.cdekCourier, pochta: DEFAULTS.shipping.pochta, yandex: DEFAULTS.shipping.yandex })[m]);
function shipQuote(method: string, to: Partial<DeliveryAddress> = {}) {
  const s = DEFAULTS.shipping;
  if (method === "pickup") return { priceRub: 0, daysMin: 0, daysMax: 0, source: "table" };
  // Как shipQuote без ключей СДЭК: тариф из настроек + пояс по удалённости города (src/lib/ship-zones.ts)
  return { ...tableQuote(s.fallbackRub[method] ?? 0, s.fallbackDays[method] ?? [2, 7], { city: to.city, region: to.region }, { zones: s.distanceMarkup }), source: "table" };
}

// ───────── география: подсказки городов (офлайн-список сайта) и демо-пункты выдачи ─────────
const STREETS = ["ул. Ленина", "ул. Мира", "ул. Советская", "ул. Гагарина", "ул. Кирова", "ул. Пушкина", "ул. Садовая", "ул. Молодёжная", "ул. Центральная", "ул. Октябрьская", "пр-т Победы", "ул. Комсомольская", "ул. Лесная", "ул. Школьная", "ул. Чехова", "ул. Строителей", "б-р Космонавтов", "ул. Королёва", "ул. Горького", "ул. Набережная", "ул. Первомайская", "ул. Островского", "ул. Маяковского", "ул. Свободы"];
const METRO: Record<string, string[]> = {
  "Москва": ["Сокол", "Тверская", "Китай-город", "Профсоюзная", "Бауманская", "Медведково", "Выхино", "Филёвский парк"],
  "Санкт-Петербург": ["Невский проспект", "Площадь Восстания", "Петроградская", "Купчино", "Московская", "Девяткино"],
  "Новосибирск": ["Площадь Ленина", "Речной вокзал", "Заельцовская"],
  "Екатеринбург": ["Площадь 1905 года", "Уралмаш", "Геологическая"],
  "Казань": ["Кремлёвская", "Козья слобода", "Проспект Победы"],
  "Нижний Новгород": ["Горьковская", "Московская", "Буревестник"],
  "Самара": ["Российская", "Гагаринская", "Юнгородок"],
};
const WORK = ["Пн–Пт 10:00–20:00, Сб–Вс 10:00–18:00", "Ежедневно 09:00–21:00", "Пн–Сб 10:00–19:00", "Ежедневно 10:00–22:00"];
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
/** Демо-пункты выдачи города: детерминированно по городу (тот же город — те же пункты), с пометкой «демо-пункт». */
export function demoPvz(city: string, region?: string): Pvz[] {
  const c = findCity(city, region);
  if (!c) return [];
  const rnd = seeded(`${normalizeCity(c.name)}|${c.region}`);
  const n = Math.max(3, Math.min(24, Math.round(Math.sqrt(c.population) / 60)));
  const metro = METRO[c.name];
  const tag = Math.floor(rnd() * 900 + 100);
  return Array.from({ length: n }, (_, i) => {
    const post = i % 4 === 3;
    const house = `${1 + Math.floor(rnd() * 120)}${rnd() < 0.2 ? `к${1 + Math.floor(rnd() * 3)}` : ""}`;
    return {
      code: `DEMO-${tag}-${String(i + 1).padStart(2, "0")}`,
      name: `демо-пункт №${i + 1}`,
      address: `${STREETS[Math.floor(rnd() * STREETS.length)]}, ${house}`,
      workTime: post ? "Круглосуточно" : WORK[Math.floor(rnd() * WORK.length)],
      metro: metro ? metro[Math.floor(rnd() * metro.length)] : null,
      type: post ? "POSTAMAT" : "PVZ",
      lat: +(c.lat + (rnd() - 0.5) * 0.06).toFixed(6),
      lon: +(c.lon + (rnd() - 0.5) * 0.1).toFixed(6),
      demo: true,
    } as Pvz;
  }).sort((a, b) => a.address.localeCompare(b.address, "ru"));
}

/** Подстановка в оформление — те же правила, что на сайте (pickPrefill): адресная книга → прошлый заказ → профиль. */
export function demoPrefill(methods: string[]) {
  const last = S.orders.find((o) => o.shipment);
  return pickPrefill({
    saved: S.addresses ?? null,
    lastOrder: last ? { contactName: last.contactName, contactPhone: last.contactPhone, shipment: { method: last.shipment!.method, address: last.shipment!.address } } : null,
    profile: { name: S.user?.name || S.user?.firstName, phone: S.user?.phone },
    methods,
  });
}
export function findPromo(code?: string) {
  if (!code) return null;
  const p = S.promos.find((x) => x.code === code.trim().toUpperCase());
  if (!p || !p.isActive || (p.maxUses != null && p.usedCount >= p.maxUses)) return null;
  return p;
}
export function pdfPaidFor(bookId: string) {
  return S.orders
    .filter((o) => o.bookId === bookId && o.paidAt && !["REFUNDED", "CANCELLED"].includes(o.status))
    .flatMap((o) => o.items)
    .filter((i) => i.kind === "format" && i.refKey === "pdf")
    .reduce((s, i) => s + i.priceRub, 0);
}
// ───────── бонусы (src/lib/bonuses.ts) ─────────
/** Остаток бонусов сейчас. */
export const bonusNow = () => bonusBalance(S.bonus ?? []).balance;
export const bonusInfo = () => ({ ...bonusBalance(S.bonus ?? []), settings: { ...DEFAULTS.bonus } });
export const reviewOf = (orderId: string) => (S.reviews ?? []).find((r) => r.orderId === orderId && r.status !== "rejected") ?? null;
/** Получен и без отзыва — просим отзыв (баннер кабинета и «Спасибо» на странице заказа). */
export const ordersAwaitingReview = () => S.orders.filter((o) => o.status === "DELIVERED" && !(S.reviews ?? []).some((r) => r.orderId === o.id));
function addBonus(e: BonusEntryLike & { note?: string }) {
  S.bonus = [...(S.bonus ?? []), e];
}
/** Модерация отзыва в админке демо: отклонён как спам — бонусы за него списываются обратно. */
export function moderateReview(id: string, status: "approved" | "rejected") {
  const r = (S.reviews ?? []).find((x) => x.id === id);
  if (!r) return;
  r.status = status;
  const credited = (S.bonus ?? []).some((e) => e.kind === "review" && e.orderId === r.orderId);
  const revoked = (S.bonus ?? []).some((e) => e.kind === "revoke" && e.orderId === r.orderId);
  if (status === "rejected" && credited && !revoked) {
    addBonus({ kind: "revoke", amountRub: -DEFAULTS.bonus.reviewRub, orderId: r.orderId, createdAt: Date.now(), note: "отзыв отклонён" });
    log(`Отзыв отклонён (спам) — ${DEFAULTS.bonus.reviewRub} бонусов списаны обратно`);
  } else log(`Отзыв ${status === "approved" ? "опубликован" : "отклонён"}`);
  commit();
}

interface CheckoutInput {
  bookId: string;
  whoPrints: "self" | "bookimi";
  formatKey?: string;
  addons: string[];
  shipping?: { method: string; address: DeliveryAddress };
  promo?: string;
  contact: { name: string; phone?: string; email?: string };
  saveAddress?: boolean;
  bulk?: boolean;
  addonsOnly?: boolean;
  useBonus?: boolean;
  changeOrderId?: string;
}
/** Допы книги из оплаченных заказов (как paidAddonKeys в src/lib/orders.ts). */
export function paidAddonKeys(bookId: string) {
  return [...new Set(S.orders.filter((o) => o.bookId === bookId && o.paidAt && !["REFUNDED", "CANCELLED"].includes(o.status)).flatMap((o) => o.items).filter((i) => i.kind === "addon").map((i) => i.refKey))];
}
function priceCheckout(input: CheckoutInput) {
  const book = bookById(input.bookId);
  const audience = book ? bookAudience(book) : undefined;
  const { formats, addons } = catalogForPricing(audience);
  const books = input.whoPrints === "bookimi" ? 1 + (input.addons.includes("second-copy") ? 1 : 0) : 0;
  const ship = input.whoPrints === "bookimi" && input.shipping ? shipQuote(input.shipping.method, input.shipping.address) : null;
  const promo = findPromo(input.promo);
  const q = quote(
    {
      whoPrints: input.whoPrints,
      formatKey: input.formatKey,
      addons: input.addons,
      shippingMethod: input.shipping?.method,
      shippingRub: ship?.priceRub ?? 0,
      pdfPaidRub: input.whoPrints === "bookimi" ? pdfPaidFor(input.bookId) : 0,
      discountPct: promo?.percentOff ?? 0,
      discountRub: promo?.amountOffRub ?? 0,
      freeShippingBooks: DEFAULTS.shipping.freeShippingBooks,
      audience,
      addonsOnly: input.addonsOnly,
      paidAddons: paidAddonKeys(input.bookId),
      cartoonPaid: book ? cartoonOf(book).bought : false,
      // rev 19: «Другая обложка» — по вёрстке книги, цена из настроек
      coverVariant: book ? layoutOf(book.params).coverVariant : 0,
      coverPriceRub: DEFAULTS.bookOptions.coverPriceRub,
    },
    formats,
    addons,
  );
  void books;
  const eta = input.whoPrints === "bookimi" ? etaDate(new Date(), 5, ship?.daysMax ?? 0, input.addons.includes("urgent")) : null;
  // Бонусы: при изменении заказа — те же, что списали при оформлении (не больше новой доли); иначе — по галочке
  const changing = input.changeOrderId ? orderById(input.changeOrderId) : null;
  const balance = changing ? changing.bonusRub ?? 0 : bonusNow();
  const b = applyBonus(q.totalRub, balance, DEFAULTS.bonus, changing ? (changing.bonusRub ?? 0) > 0 : input.useBonus);
  const bonusMax = applyBonus(q.totalRub, balance, DEFAULTS.bonus, true).bonusRub;
  return { quote: q, promo: promo ? { code: promo.code } : null, newbieApplied: false, ship, eta: eta ? { ready: eta.ready, eta: eta.eta, readyText: ruDate(eta.ready), etaText: ruDate(eta.eta) } : null, bonusRub: b.bonusRub, bonusMax };
}
const publicCode = () => `BK-${Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")}`;

/** Оплата прошла (QR или подтверждение оператором) — как markPaid в src/lib/orders.ts. */
export function markPaid(orderId: string, by?: string) {
  const o = orderById(orderId);
  if (!o || !["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED"].includes(o.status)) return o;
  o.status = "PAID";
  o.paidAt = Date.now();
  o.receipt = true;
  if (o.promo) {
    const p = S.promos.find((x) => x.code === o.promo);
    if (p) p.usedCount++;
  }
  event("pay");
  if (o.addonsOnly) {
    log(`${o.publicCode}: оплачено ${o.totalRub.toLocaleString("ru-RU")} ₽ — ${o.items.map((i) => i.title.replace(/^Изготовление на заказ: /, "")).join(", ")} · чек «Мой налог» (демо)`);
    commit();
    return o;
  }
  log(`${o.publicCode}: оплачено ${o.totalRub.toLocaleString("ru-RU")} ₽${by ? ` (перевод подтвердил ${by})` : " по QR"} · чек «Мой налог» (демо, не фискальный) · уведомление «Оплата получена»`);
  for (const id of o.bookIds ?? [o.bookId]) {
    const b = bookById(id);
    if (!b) continue;
    b.paidFull = true;
    b.status = "FULL_QUEUED";
    b.progress = 0;
    startJob(b, "full");
  }
  commit();
  return o;
}

export function confirmTransfer(orderId: string) {
  return markPaid(orderId, "оператор");
}

export const STATUS_FLOW = ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"];
export function setStatus(orderId: string, status: string, track?: string) {
  const o = orderById(orderId);
  if (!o) return;
  o.status = status;
  if (track && o.shipment) o.shipment.trackNumber = track;
  if (status === "DELIVERED") event("delivered");
  log(`${o.publicCode}: статус — ${status}${track ? `, трек ${track}` : ""} · уведомление покупателю${status === "DELIVERED" && DEFAULTS.bonus.enabled ? ` с просьбой об отзыве (+${DEFAULTS.bonus.reviewRub} бонусов)` : ""}`);
  commit();
}

export function addPromo(p: Omit<DPromo, "usedCount" | "isActive" | "source"> & { source?: string }) {
  S.promos.push({ ...p, usedCount: 0, isActive: true, source: p.source ?? "manual" });
  log(`Промокод ${p.code} создан`);
  commit();
}
export function togglePromo(code: string) {
  const p = S.promos.find((x) => x.code === code);
  if (p) p.isActive = !p.isActive;
  commit();
}

export function heroAccOf(b: DBook | null) {
  const h = b?.params.hero;
  if (!h?.name) return null;
  try {
    return declineName(h.name, "вин", h.gender);
  } catch {
    return h.name;
  }
}
export function journeyOf(o: DOrder): JourneyOrder & { bookId: string; heroName?: string } {
  const b = bookById(o.bookId);
  return {
    status: o.status,
    whoPrints: o.whoPrints,
    createdAt: new Date(o.createdAt),
    paidAt: o.paidAt ? new Date(o.paidAt) : null,
    readyDate: o.readyDate ? new Date(o.readyDate) : null,
    bookReadyAt: b?.status === "FULL_READY" ? new Date(b.fullReadyAt ?? o.paidAt ?? o.createdAt) : null,
    heroAcc: heroAccOf(b),
    heroName: b?.params.hero.name,
    shipment: o.shipment ? { method: o.shipment.method, etaDate: o.shipment.etaDate ? new Date(o.shipment.etaDate) : null, trackNumber: o.shipment.trackNumber ?? null } : null,
    bookId: o.bookId,
  };
}

// ───────── «Книга для каждого в группе» (как src/lib/bulk-server.ts) ─────────
export const copiesOf = (id: string) => S.books.filter((b) => b.parentId === id).sort((x, y) => (x.bulkIndex ?? 0) - (y.bulkIndex ?? 0));
function makeCopies(parent: DBook, dedication = DEFAULT_BULK_DEDICATION) {
  const a = AnswersV2.parse(parent.params);
  (a.group?.members ?? []).forEach((_, j) => {
    const i = j + 1;
    const c: DBook = { ...parent, id: uuid(), createdAt: Date.now() + i, params: bulkCopyAnswers(a, i, dedication), parentId: parent.id, bulkIndex: i, status: "DRAFT", progress: 0, text: null, pages: [], variants: {}, withPhoto: false, paidFull: false, previewReadyAt: undefined, textApprovedAt: undefined };
    S.books.push(c);
    if (i < DEFAULTS.bulk.previewCopies) {
      c.status = "TEXT_QUEUED";
      startJob(c, "text");
    }
  });
  log(`Заказ «для каждого»: ${1 + (a.group?.members.length ?? 0)} книг, тексты первых — сразу, остальные — после оплаты`);
}
const COPY_STATUS: Record<string, string> = { DRAFT: "сочиним после оплаты", TEXT_QUEUED: "сочиняем текст", TEXT_APPROVED: "текст готов", TEXT_READY: "текст готов", PREVIEW_QUEUED: "рисуем превью", PREVIEW_READY: "превью готово", FULL_QUEUED: "рисуем книгу", FULL_READY: "книга готова" };
export function bulkState(parent: DBook) {
  const a = AnswersV2.parse(parent.params);
  const copies = copiesOf(parent.id);
  return {
    available: Boolean(plotForAnswers(a)?.group && a.group?.members.length),
    created: copies.length > 0,
    count: groupChildren(a).length,
    dedication: copies[0]?.params.dedication ?? DEFAULT_BULK_DEDICATION,
    tiers: DEFAULTS.bulk.tiers,
    previewCopies: DEFAULTS.bulk.previewCopies,
    copies: [parent, ...copies].map((b) => ({ id: b.id, name: b.params.hero.name, status: b.status, statusText: COPY_STATUS[b.status] ?? b.status, title: b.text?.title ?? null, dedication: b.parentId ? dedicationText(b.params) : null, cover: b.pages.includes(0) ? pageUrl(b, 0) : null })),
  };
}
function priceBulk(input: CheckoutInput) {
  const { formats } = catalogForPricing();
  const parent = bookById(input.bookId)!;
  const heroes = groupChildren(AnswersV2.parse(parent.params)).map((c) => c.name);
  const ship = input.whoPrints === "bookimi" && input.shipping ? shipQuote(input.shipping.method, input.shipping.address) : null;
  const promo = findPromo(input.promo);
  const qq = bulkQuote({ whoPrints: input.whoPrints, formatKey: input.formatKey, heroes, shippingMethod: input.shipping?.method, shippingRub: ship?.priceRub ?? 0, discountPct: promo?.percentOff ?? 0, discountRub: promo?.amountOffRub ?? 0, freeShippingBooks: DEFAULTS.shipping.freeShippingBooks, tiers: DEFAULTS.bulk.tiers }, formats);
  void bulkPct;
  const eta = input.whoPrints === "bookimi" ? etaDate(new Date(), 5, ship?.daysMax ?? 0) : null;
  return { quote: qq, promo: promo && !qq.bulkApplied ? { code: promo.code } : null, newbieApplied: false, ship, eta: eta ? { ready: eta.ready, eta: eta.eta, readyText: ruDate(eta.ready), etaText: ruDate(eta.eta) } : null };
}

/** Получатель и доставка — как схема Checkout на сайте (zRecipientName, адрес, пункт СДЭК). */
function checkDelivery(input: CheckoutInput): R | null {
  input.contact = { ...input.contact, name: normalizeName(input.contact?.name ?? "") };
  if (input.whoPrints !== "bookimi") return null;
  if (!input.shipping) return err("Выберите доставку");
  input.shipping.address = cleanAddress(input.shipping.method, input.shipping.address ?? { city: "" });
  const bad = addressError(input.shipping.method, input.shipping.address);
  if (bad) return err(bad);
  const badName = fullNameError(input.contact.name);
  if (badName) return err(badName);
  if (!input.contact.phone) return err("Укажите телефон получателя");
  if (input.shipping.method === "cdek_pvz") {
    const a = input.shipping.address;
    const point = demoPvz(a.city, a.region).find((p) => p.code === a.pvzCode);
    if (!point) return err("Пункт выдачи не найден в этом городе — выберите его заново");
    a.pvzAddress = point.address;
  }
  return null;
}

const shapeOf = (i: CheckoutInput | undefined, o: DOrder): OrderShape => ({
  formatKey: i?.formatKey ?? o.items.find((x) => x.kind === "format")?.refKey,
  addons: i?.addons ?? o.items.filter((x) => x.kind === "addon").map((x) => x.refKey),
  method: i?.shipping?.method ?? o.shipment?.method,
  address: i?.shipping?.address ?? o.shipment?.address,
  contactName: i?.contact?.name ?? o.contactName,
  contactPhone: i?.contact?.phone ?? o.contactPhone,
});
const TITLES = () => ({ ...Object.fromEntries([...FORMATS.map((f) => [f.key, f.title]), ...ADDONS.map((a) => [a.key, a.title.split(":")[0]])]), cdek_pvz: "СДЭК до пункта", cdek_courier: "курьер СДЭК", pochta: "Почта России", yandex: "Яндекс Доставка" });

/** «Изменить заказ» (src/lib/order-change.ts): только до оплаты — пересчёт и новая сумма к оплате. */
function changeOrder(o: DOrder, input: CheckoutInput): R {
  const can = canChangeOrder(o);
  if (!can.ok) return err(can.reason, 409);
  input = { ...input, bookId: o.bookId, whoPrints: "bookimi", changeOrderId: o.id, bulk: undefined, addonsOnly: undefined };
  const invalid = checkDelivery(input);
  if (invalid) return invalid;
  const priced = priceCheckout(input);
  if (priced.quote.errors.length) return err(priced.quote.errors.join("; "));
  const qq = priced.quote;
  const bonusRub = priced.bonusRub ?? 0;
  const lines = describeChange(shapeOf(o.input, o), shapeOf(input, o), TITLES());
  if (!lines.length) return ok({ ok: true, unchanged: true });
  const title = bookById(o.bookId)?.text?.title ?? "Персональная книга";
  o.items = qq.lines.map((l) => ({ kind: l.kind, refKey: l.key, title: l.kind === "format" ? `Изготовление персонализированной книги «${title}» на заказ: ${l.title}` : `Изготовление на заказ: ${l.title}`, priceRub: l.priceRub }));
  Object.assign(o, { subtotalRub: qq.subtotalRub, discountRub: qq.discountRub, pdfCreditRub: qq.pdfCreditRub, shippingRub: qq.shippingRub, totalRub: qq.totalRub - bonusRub, contactName: input.contact.name, contactPhone: input.contact.phone ?? o.contactPhone, input: structuredClone({ ...input, changeOrderId: undefined }) });
  if (bonusRub < (o.bonusRub ?? 0)) {
    // Сумма уменьшилась и бонусов в неё входит меньше — лишние бонусы возвращаем на счёт
    const back = (o.bonusRub ?? 0) - bonusRub;
    addBonus({ kind: "return", amountRub: back, orderId: `${o.id}:${Date.now()}`, createdAt: Date.now(), expiresAt: Date.now() + DEFAULTS.bonus.expiryDays * 86400_000, note: `изменение ${o.publicCode}` });
    o.bonusRub = bonusRub;
  }
  if (input.shipping) o.shipment = { ...o.shipment, method: input.shipping.method, address: input.shipping.address, etaDate: priced.eta?.eta.getTime() };
  if (priced.eta) o.readyDate = priced.eta.ready.getTime();
  o.changes = [...(o.changes ?? []), { at: Date.now(), lines, totalRub: o.totalRub }];
  log(`${o.publicCode}: заказ изменён до оплаты — ${lines.join("; ")} · новая сумма ${o.totalRub.toLocaleString("ru-RU")} ₽`);
  commit();
  return ok({ ok: true, lines, totalRub: o.totalRub });
}

// ───────── API ─────────
async function handle(method: string, path: string, q: URLSearchParams, body: unknown): Promise<R> {
  const seg = path.split("/").filter(Boolean); // api, books, id, action
  const b0 = body as Record<string, unknown> | undefined;

  if (path === "/api/continue") {
    const book = [...S.books].reverse().find((x) => ["TEXT_READY", "TEXT_APPROVED", "PREVIEW_QUEUED", "PREVIEW_READY"].includes(x.status) && !x.paidFull);
    return ok({ book: book ? { id: book.id, status: book.status, title: book.text?.title ?? "Ваша сказка" } : null });
  }

  if (path === "/api/ideas" && method === "POST") {
    const a = AnswersV2.safeParse((b0 as { answers?: unknown })?.answers);
    if (!a.success) return err("Заполните анкету");
    if (soonAudiences(DEFAULTS.storefront.soon).includes(a.data.audience)) return err(soonCreateError(a.data.audience), 403);
    return ok({ ideas: await new DemoTextProvider().ideas(String(b0?.idea ?? ""), a.data) });
  }

  if (path === "/api/draft/consent") {
    if (method === "POST") {
      if (b0?.photo && !b0?.pd && !S.consent.pd) return err("Отметьте согласие на обработку персональных данных");
      if (b0?.pd && !S.consent.pd) log("Согласие на обработку персональных данных — дано (перед первым фото)");
      if (b0?.photo && !S.consent.photo) log("Согласие на обработку фото — дано");
      if (b0?.group && !S.consent.group) log("Подтверждено согласие родителей на фото детей группы");
      S.consent = { ...S.consent, pd: S.consent.pd || Boolean(b0?.pd), photo: S.consent.photo || Boolean(b0?.photo), group: S.consent.group || Boolean(b0?.group) };
      commit();
    }
    return ok({ pd: S.consent.pd, photo: S.consent.photo, group: Boolean(S.consent.group) });
  }
  if (path === "/api/draft/photos") {
    if (method === "GET") return ok({ photos: (q.get("ids") ?? "").split(",").map((id) => drafts.get(id)?.view).filter(Boolean) });
    if (method === "DELETE") {
      drafts.delete(q.get("photo") ?? "");
      return ok({ ok: true });
    }
    if (method === "PATCH") {
      const d = drafts.get(String(b0?.id));
      const face = d?.meta.faces[Number(b0?.face)];
      if (!d || !face) return err("Фото не найдено", 404);
      const m = photoMetrics(d.orig, face);
      const v = judgePhoto({ kind: d.meta.kind, width: d.meta.width, height: d.meta.height, faces: 1, otherFaces: 0, facePx: Math.round(Math.min(face.w * d.meta.width, face.h * d.meta.height)), ...m });
      d.view = { ...d.view, ...v, verdict: v.verdict === "reject" ? "warn" : v.verdict, chosen: Number(b0?.face), url: portraitUrl(d.orig, face, d.meta.kind) };
      return ok(d.view);
    }
    if (!S.consent.photo || !S.consent.pd) return err("Сначала дайте согласие на обработку фото", 403);
    const fd = body as FormData;
    const file = fd?.get?.("file");
    const slot = String(fd?.get?.("slot") ?? "main");
    if (slot === "member" && !S.consent.group) return err("Подтвердите, что родители детей согласны на фото", 403);
    if (!(file instanceof File)) return err("Выберите файл");
    if (file.size > 15 * 1024 * 1024) return err("Файл больше 15 МБ");
    try {
      const v = await processDraftPhoto(file, slot, fd.get("kind") === "pet" ? "pet" : "human", fd.get("adult") === "1");
      event("photo_upload");
      log(`Фото обработано (${v.verdict}${v.codes.length ? `: ${v.codes.join(", ")}` : ""}) — в демо только в памяти вкладки; на сайте без книги удаляется через ${DEFAULTS.limits.photoTtlNoBookHours} ч, с книгой — через ${DEFAULTS.limits.photoTtlDays} дней`);
      commit();
      return ok(v);
    } catch (e) {
      return err((e as Error).message);
    }
  }

  if (path === "/api/books" && method === "POST") {
    const parsed = AnswersV2.safeParse(b0?.answers);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Заполните обязательные шаги");
    const a = parsed.data;
    // Аудитория «скоро» (storefront.soon) — как /api/books на сайте: книгу не создаём
    if (soonAudiences(DEFAULTS.storefront.soon).includes(a.audience)) return err(soonCreateError(a.audience), 403);
    const plot = plotForAnswers(a);
    if (plot && plot.audience !== a.audience) return err("Этот сюжет для другой аудитории — выберите сюжет из списка");
    if (plot && a.extras.length < plot.extras.min) return err(plot.extras.note ?? `Для этого сюжета нужно добавить героев: не меньше ${plot.extras.min}`);
    if (plot && a.extras.length > plot.extras.max) a.extras = a.extras.slice(0, plot.extras.max);
    // rev 17: только живые стили (скрытые — archived — не принимаются)
    if (!ART_STYLE_IDS.some((x) => x.id === a.artStyle && x.status !== "archived")) a.artStyle = plot?.artStyles[0] ?? DEFAULT_ART_STYLE;
    if (a.mood && !moodsFor(a.audience, a.hero.age).some((m) => m.id === a.mood)) a.mood = "";
    if (!a.story.slug && !a.story.idea) return err("Выберите сюжет или опишите свою идею");
    if (!plot?.group) a.group = undefined;
    else if (a.group) a.group = { members: a.group.members.slice(0, groupMembersMax(plot)), adults: a.group.adults.slice(0, plot.group.includeAdults?.max ?? 0) };
    const limits = DEFAULTS.limits;
    if (!hit("device", "text", limits.textsPerDevice)) return err(`Сегодня можно сочинить не больше ${limits.textsPerDevice} сказок. Возвращайтесь завтра — черновик сохранится.`, 429);
    const book: DBook = {
      id: uuid(),
      createdAt: Date.now(),
      params: a,
      status: "TEXT_QUEUED",
      progress: 0,
      error: null,
      text: null,
      rewritesLeft: limits.rewrites,
      redrawsLeft: limits.freeRedraws,
      mood: a.mood || "",
      moodChangesPreview: 0,
      moodChangesFull: 0,
      withPhoto: (a.hero.photoIds ?? []).some((id) => drafts.has(id)),
      paidFull: false,
      pages: [],
      variants: {},
    };
    S.books.push(book);
    // Фото с шага «Герои» — к книге (в демо — в памяти вкладки)
    photos.set(book.id, (a.hero.photoIds ?? []).map((id) => drafts.get(id)?.view).filter(Boolean).map((v) => ({ id: v!.id, url: v!.url, role: "main" })));
    if (b0?.bulk && plot?.group && a.group?.members.length) makeCopies(book);
    event("quiz_step");
    log(`Анкета: ${a.hero.name} (${a.audience}), ${plot ? `«${plot.title.replace("[Имя]", a.hero.name)}»` : "своя история"}, повод — ${a.occasion.key}${appearanceLine(a) ? `, внешность: ${appearanceLine(a)}` : ""}`);
    startJob(book, "text");
    commit();
    return ok({ bookId: book.id });
  }

  if (seg[1] === "books" && seg[2]) {
    const book = bookById(seg[2]);
    if (!book) return err("Не найдено", 404);
    if (seg.length === 3 && method === "GET") {
      const full = book.paidFull && book.status === "FULL_READY";
      return ok({
        id: book.id,
        status: book.status,
        progress: book.progress,
        error: book.error,
        text: book.text,
        rewritesLeft: book.rewritesLeft,
        redrawsLeft: book.redrawsLeft,
        mood: liveMoodId(book.mood),
        moodChanges: { preview: book.moodChangesPreview, full: book.moodChangesFull },
        withPhoto: book.withPhoto,
        paid: book.paidFull,
        loggedIn: Boolean(S.user),
        consent: { pd: S.consent.pd, photo: S.consent.photo, group: Boolean(S.consent.group) },
        pages: book.pages.map((i) => ({ index: i, text: i === 0 ? book.text?.title ?? "" : book.text?.spreads[i - 1]?.text ?? "", url: pageUrl(book, i, { full }) })),
        photos: photosOf(book.id).map((p) => ({ id: p.id, role: p.role, url: p.url })),
        hero: { name: book.params.hero.name, gender: book.params.hero.gender },
        dedication: dedicationText(AnswersV2.parse(book.params)),
        layout: layoutOf(book.params),
        coverPriceRub: DEFAULTS.bookOptions.coverPriceRub,
      });
    }
    if (seg.length === 3 && method === "PATCH") {
      const spreads = (b0?.spreads ?? []) as { index: number; text: string }[];
      // rev 19: оплаченная книга не правится — как на сервере (src/lib/book-edit.ts)
      if (editLocked(book, "text")) return err(editLocked(book, "text")!, 409);
      if (!book.text) return err("Текст ещё не готов");
      for (const s of spreads) {
        const t = String(s.text ?? "").trim();
        if (!t || t.length > 600) return err("Некорректный текст");
        const sp = book.text.spreads.find((x) => x.index === s.index);
        if (sp) sp.text = t;
      }
      if (book.paidFull) log("Правка текста — PDF пересобраны (в демо PDF не собирается)");
      commit();
      return ok({ ok: true });
    }
    if (seg[3] === "voice") return ok({ pages: [] });
    if (seg[3] === "bulk") {
      if (method === "POST") {
        const ded = b0?.dedication !== undefined ? String(b0.dedication).slice(0, 300) : undefined;
        if (!copiesOf(book.id).length) makeCopies(book, ded);
        else if (ded !== undefined) for (const c of copiesOf(book.id)) c.params = { ...c.params, dedication: ded };
        commit();
      }
      return ok(bulkState(book));
    }
    if (seg[3] === "photos") {
      if (method === "DELETE") {
        photos.set(book.id, photosOf(book.id).filter((p) => p.id !== q.get("photo")));
        return ok({ ok: true });
      }
      // Фото для страницы «Фото и посвящение» (rev 13): как есть, без обработки, одно; только в памяти вкладки
      const fd = body as FormData;
      if (fd?.get?.("role") !== "keepsake") return err("Фото героя загружаются в анкете, на шаге «Герои»", 410);
      if (book.paidFull) return err(editLocked(book, "photo")!, 409);
      if (!S.consent.photo || !S.consent.pd) return err("Сначала дайте согласие на обработку фото", 403);
      const file = fd.get("file");
      if (!(file instanceof File)) return err("Выберите файл");
      if (file.size > 15 * 1024 * 1024) return err("Файл больше 15 МБ");
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return err("Подойдёт JPG, PNG или WebP");
      for (const old of photosOf(book.id).filter((p) => p.role === "keepsake")) URL.revokeObjectURL(old.url);
      const id = uuid();
      photos.set(book.id, [...photosOf(book.id).filter((p) => p.role !== "keepsake"), { id, url: URL.createObjectURL(file), role: "keepsake" }]);
      log(`Фото для страницы «Фото и посвящение» — как есть, в рамке; в демо только в памяти вкладки, на сайте удаляется через ${DEFAULTS.limits.photoTtlDays} дней`);
      commit();
      return ok({ id, hints: [] });
    }
    if (seg[3] === "action" && method === "POST") return bookAction(book, b0 ?? {});
  }

  if (path === "/api/me") {
    if (!S.user) return err("Войдите", 401);
    if (method === "GET") return ok(exportData());
    const act = String(b0?.action ?? "");
    if (act === "name") {
      const n = checkFirstName(b0?.firstName as string | undefined);
      if (n === false) return err(FIRST_NAME_ERROR);
      S.user.firstName = n || undefined;
      log(n ? `«Как к вам обращаться»: ${n}` : "«Как к вам обращаться» — очищено");
      commit();
      return ok({ ok: true });
    }
    if (act === "address" || act === "addressDelete") {
      const list = S.addresses ?? [];
      const i = list.findIndex((a) => a.id === b0?.id);
      if (i < 0) return err("Адрес не найден", 404);
      if (act === "addressDelete") list.splice(i, 1);
      else {
        const patch = (b0?.patch ?? {}) as Record<string, string>;
        const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ["name", "phone", "street", "flat", "comment", "postalCode"].includes(k)).map(([k, v]) => [k, String(v ?? "").trim().slice(0, 200)]));
        if (clean.phone && !normalizePhone(clean.phone)) return err("Проверьте телефон: +7 9XX XXX-XX-XX");
        if (clean.name !== undefined) clean.name = normalizeName(clean.name);
        list[i] = { ...list[i], ...clean };
      }
      S.addresses = list;
      log(act === "addressDelete" ? "Адрес доставки удалён («Мои данные»)" : "Адрес доставки изменён («Мои данные»)");
      commit();
      return ok({ ok: true });
    }
    if (act === "revoke") {
      if (b0?.type === "MARKETING") S.consent.marketing = false;
      if (b0?.type === "CHILD_PHOTO") {
        S.consent.photo = false;
        photos.clear();
        drafts.clear();
      }
      log(`Согласие отозвано: ${b0?.type}`);
      commit();
      return ok({ ok: true });
    }
    if (act === "delete") {
      if (b0?.confirm !== "УДАЛИТЬ") return err("Напишите УДАЛИТЬ");
      resetStore();
      afterDelete();
      return ok({ ok: true });
    }
    return err("Некорректный запрос");
  }

  if (seg[1] === "books" && seg[2] && seg[3] === "cartoon") {
    const book = bookById(seg[2]);
    if (!book) return err("Не найдено", 404);
    return cartoonApi(book, method, seg[4], q, body);
  }

  // ───── вход через внешние аккаунты (демо: имитация, без сети) и вкладка «Телефон» ─────
  if (path === "/api/auth/providers") {
    return ok({ oauth: DEMO_OAUTH.map((p) => ({ ...p, demo: true })), smsLogin: DEFAULTS.auth.smsLogin });
  }
  if (path === "/api/auth/oauth-demo" && method === "POST") {
    const p = DEMO_OAUTH.find((x) => x.key === b0?.provider);
    if (!p) return err("Неизвестный сервис входа");
    const email = `anna.demo@${p.domain}`;
    const same = S.user?.email === email;
    S.user = { email, phone: same ? S.user!.phone : "", firstName: same ? S.user!.firstName ?? "Анна" : "Анна", name: same ? S.user!.name : undefined, marketing: same ? S.user!.marketing : false };
    log(`Вход через ${p.title} (демо): ${email} — телефон и «Как к вам обращаться» спросим одним шагом`);
    commit();
    return ok({ ok: true, email, firstName: S.user.firstName, needs: { phone: DEFAULTS.auth.phoneRequired && !S.user.phone, consent: !S.consent.pd } });
  }
  if (path === "/api/auth/complete" && method === "POST") {
    if (!S.user) return err("Войдите", 401);
    let phone = "";
    if (b0?.phone) {
      phone = normalizePhone(String(b0.phone)) ?? "";
      if (!phone) return err("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    } else if (DEFAULTS.auth.phoneRequired && !S.user.phone) return err("Укажите мобильный телефон — он нужен для связи по заказу");
    const fn = checkFirstName(b0?.firstName as string | undefined);
    if (fn === false) return err(FIRST_NAME_ERROR);
    if (!S.consent.pd) {
      if (!b0?.consentPd) return err("Отметьте согласие на обработку персональных данных");
      S.consent.pd = true;
    }
    if (phone) S.user.phone = phone;
    if (fn) S.user.firstName = fn;
    log(`Профиль дополнен после входа через внешний аккаунт${phone ? `: ${phone}` : ""}${fn ? `, «${fn}»` : ""}`);
    commit();
    return ok({ ok: true, role: "CUSTOMER" });
  }
  if (path === "/api/me/bonuses") {
    if (!S.user) return err("Войдите", 401);
    return ok(bonusInfo());
  }
  if (path === "/api/reviews" && method === "POST") {
    if (!S.user) return err("Войдите", 401);
    const text = String(b0?.text ?? "").trim();
    const authorName = String(b0?.authorName ?? "").trim();
    if (text.length < 10 || authorName.length < 2) return err("Заполните отзыв");
    const paidOrders = S.orders.filter((o) => o.paidAt && !["CANCELLED", "REFUNDED"].includes(o.status));
    if (!paidOrders.length) return err("Отзыв можно оставить после покупки", 403);
    const reviewed = new Set((S.reviews ?? []).map((r) => r.orderId));
    const o = b0?.orderId ? paidOrders.find((x) => x.id === b0.orderId) : paidOrders.find((x) => !reviewed.has(x.id) && x.status === "DELIVERED") ?? paidOrders.find((x) => !reviewed.has(x.id));
    if (!o || reviewed.has(o.id)) return err("Спасибо! Отзыв на этот заказ уже есть", 409);
    const r = { id: uuid(), orderId: o.id, rating: Number(b0?.rating ?? 5), text, authorName: normalizeName(authorName), status: "pending" as const, at: Date.now() };
    S.reviews = [...(S.reviews ?? []), r];
    // Бонусы — сразу (решение rev 10), если заказ получен и за него ещё не начисляли; отклонят как спам — спишем
    const can = reviewBonusAllowed(o, S.bonus ?? [], o.id, DEFAULTS.bonus);
    if (can.ok) addBonus({ ...reviewCredit(o.id, DEFAULTS.bonus), note: `отзыв о заказе ${o.publicCode}` });
    log(`Отзыв о заказе ${o.publicCode} — на модерации${can.ok ? ` · +${can.rub} бонусов покупателю` : ""}`);
    commit();
    return ok({ ok: true, bonusRub: can.ok ? can.rub : 0 });
  }

  if (path === "/api/auth/request" && method === "POST") {
    if (b0?.target && !b0?.email) {
      // Вкладка «Телефон»: код по SMS (в демо — на экране)
      const phone = normalizePhone(String(b0.target)) ?? "";
      if (!phone) return err("Укажите мобильный номер: +7 9XX XXX-XX-XX");
      if (!hit(phone, "otp", 10)) return err("Слишком много попыток. Попробуйте через час.", 429);
      S.otp = { email: "", phone, code: String(Math.floor(100000 + Math.random() * 900000)) };
      log(`Код входа по SMS для ${phone} — показан на экране (демо)`);
      commit();
      return ok({ ok: true, demoCode: S.otp.code, needsConsent: !S.consent.pd });
    }
    const email = String(b0?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err("Проверьте адрес почты");
    let phone = "";
    if (b0?.phone) {
      phone = normalizePhone(String(b0.phone)) ?? "";
      if (!phone) return err("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    }
    const known = S.user && S.user.email === email && S.user.phone;
    if (DEFAULTS.auth.phoneRequired && !phone && !known) return err("Укажите мобильный телефон — он нужен для связи по заказу");
    if (!hit(email, "otp", 10)) return err("Слишком много попыток. Попробуйте через час.", 429);
    S.otp = { email, phone, code: String(Math.floor(100000 + Math.random() * 900000)) };
    log(`Код входа для ${email} — показан на экране (демо-режим; на сайте приходит письмом)`);
    commit();
    return ok({ ok: true, demoCode: S.otp.code, needsConsent: !S.consent.pd });
  }
  if (path === "/api/auth/verify" && method === "POST" && b0?.target && !b0?.email) {
    const phone = normalizePhone(String(b0.target)) ?? "";
    if (!b0?.consentPd && !S.consent.pd) return err("Отметьте согласие на обработку персональных данных");
    if (!S.otp || S.otp.phone !== phone || S.otp.email || String(b0?.code) !== S.otp.code) return err("Неверный или устаревший код");
    const fn = checkFirstName(b0?.firstName as string | undefined);
    if (fn === false) return err(FIRST_NAME_ERROR);
    const same = S.user?.phone === phone;
    S.user = { email: same ? S.user!.email : "", phone, firstName: fn || (same ? S.user!.firstName : undefined), name: same ? S.user!.name : undefined, marketing: Boolean(b0?.marketing) };
    if (b0?.consentPd) S.consent.pd = true;
    S.otp = null;
    log(`Вход по SMS-коду: ${phone}`);
    commit();
    return ok({ ok: true, role: "CUSTOMER" });
  }
  if (path === "/api/auth/verify" && method === "POST") {
    const email = String(b0?.email ?? "").trim().toLowerCase();
    if (!b0?.consentPd && !S.consent.pd) return err("Отметьте согласие на обработку персональных данных");
    if (!S.otp || S.otp.email !== email || String(b0?.code) !== S.otp.code) return err("Неверный или устаревший код");
    const phone = (b0?.phone ? normalizePhone(String(b0.phone)) : null) ?? S.otp.phone ?? S.user?.phone ?? "";
    const same = S.user?.email === email;
    // «Как к вам обращаться» (необязательно) — как User.firstName на сайте: приветствие и получатель при оформлении
    const fn = checkFirstName(b0?.firstName as string | undefined);
    if (fn === false) return err(FIRST_NAME_ERROR);
    const firstName = fn || (same ? S.user?.firstName : undefined);
    S.user = { email, phone: phone || (same ? S.user!.phone : ""), name: same ? S.user?.name : undefined, firstName, marketing: Boolean(b0?.marketing) || (same && S.user!.marketing) || false };
    if (b0?.consentPd && !S.consent.pd) S.consent.pd = true;
    if (b0?.marketing) S.consent.marketing = true;
    S.otp = null;
    log(`Вход по коду: ${email}${phone ? `, ${phone}` : ""}${b0?.marketing ? " · согласие на рассылку" : ""}`);
    commit();
    return ok({ ok: true, role: "CUSTOMER" });
  }
  if (path === "/api/auth/logout") {
    S.user = null;
    commit();
    return ok({ ok: true });
  }

  if (path === "/api/geo/cities") {
    return ok({ cities: searchCities(q.get("q") ?? "", 10).map((c) => ({ name: c.name, region: c.region, code: c.cdekCode, lat: c.lat, lon: c.lon, label: cityLabel(c) })), source: "offline" });
  }
  if (path === "/api/geo/pvz") {
    const all = demoPvz(q.get("city") ?? "", q.get("region") || undefined);
    const found = filterPvz(all, q.get("q") ?? "");
    return ok({ points: found.slice(0, 30), total: found.length, source: "demo", cityCode: null });
  }
  if (path === "/api/checkout/quote" && method === "POST") {
    const input = b0 as unknown as CheckoutInput;
    if (!bookById(input.bookId)) return err("Не найдено", 404);
    return ok(input.bulk ? priceBulk(input) : priceCheckout(input));
  }
  if (path === "/api/checkout" && method === "POST") {
    if (!S.user) return err("Войдите по коду", 401);
    const input = b0 as unknown as CheckoutInput;
    const book = bookById(input.bookId);
    if (!book) return err("Не найдено", 404);
    const invalid = checkDelivery(input);
    if (invalid) return invalid;
    if (input.addonsOnly && (!book.paidFull || input.whoPrints !== "self")) return err("Докупить можно к уже оплаченной книге");
    const priced = input.bulk ? priceBulk(input) : priceCheckout(input);
    if (priced.quote.errors.length) return err(priced.quote.errors.join("; "));
    if (input.bulk && !copiesOf(book.id).length) makeCopies(book);
    const bookIds = input.bulk ? [book.id, ...copiesOf(book.id).map((c) => c.id)] : undefined;
    const title = book.text?.title ?? "Персональная книга";
    const qq = priced.quote;
    const o: DOrder = {
      id: uuid(),
      publicCode: publicCode(),
      createdAt: Date.now(),
      whoPrints: input.whoPrints,
      bookId: book.id,
      bookIds,
      items: qq.lines.map((l) => ({ kind: l.kind, refKey: l.key, title: l.kind === "format" ? `Изготовление персонализированной книги «${title}» на заказ: ${l.title}` : `Изготовление на заказ: ${l.title}`, priceRub: l.priceRub })),
      subtotalRub: qq.subtotalRub,
      discountRub: qq.discountRub,
      pdfCreditRub: qq.pdfCreditRub,
      shippingRub: qq.shippingRub,
      totalRub: qq.totalRub,
      promo: priced.promo?.code,
      contactName: input.contact.name,
      contactPhone: input.contact.phone ?? S.user.phone,
      contactEmail: input.contact.email || S.user.email,
      readyDate: priced.eta ? priced.eta.ready.getTime() : undefined,
      shipment:
        input.whoPrints === "bookimi" && input.shipping
          ? { method: input.shipping.method, address: { ...input.shipping.address, ...(input.saveAddress === false ? { noPrefill: true } : {}) }, etaDate: priced.eta?.eta.getTime() }
          : undefined,
      status: "PENDING_PAYMENT",
      addonsOnly: input.addonsOnly || undefined,
      input: input.bulk || input.addonsOnly ? undefined : structuredClone({ ...input, changeOrderId: undefined }),
      bonusRub: (priced as { bonusRub?: number }).bonusRub || undefined,
    };
    if (o.bonusRub) {
      o.totalRub -= o.bonusRub;
      addBonus({ kind: "spend", amountRub: -o.bonusRub, orderId: o.id, createdAt: Date.now(), note: `заказ ${o.publicCode}` });
    }
    if (input.contact.name && S.user && !S.user.name) S.user.name = input.contact.name;
    if (input.whoPrints === "bookimi" && input.shipping && input.saveAddress !== false) {
      S.addresses = addToAddressBook(S.addresses, { ...input.shipping.address, id: uuid().slice(0, 12), savedAt: new Date().toISOString(), method: input.shipping.method, name: input.contact.name, phone: input.contact.phone ?? "" });
    }
    S.orders.unshift(o);
    log(`Заказ ${o.publicCode} оформлен: ${o.totalRub.toLocaleString("ru-RU")} ₽ (${o.whoPrints === "self" ? "PDF" : "печать"}${o.promo ? `, промокод ${o.promo}` : ""}${o.bonusRub ? `, бонусами ${o.bonusRub} ₽` : ""}) · уведомление «Заказ оформлен»`);
    commit();
    return ok({ orderId: o.id });
  }

  if (seg[1] === "orders" && seg[2]) {
    const o = orderById(seg[2]);
    if (!o) return err("Не найдено", 404);
    if (seg[3] === "change" && method === "POST") {
      if (!S.user) return err("Войдите по коду", 401);
      return changeOrder(o, b0 as unknown as CheckoutInput);
    }
    if (method === "GET") return ok({ status: o.status });
    if (b0?.action === "pay") {
      if (!(await canAcceptPayments())) return err("Приём оплаты пока выключен");
      if (o.status !== "PENDING_PAYMENT") return err("Заказ не ожидает оплаты");
      o.payMethod = String(b0.method);
      commit();
      if (b0.method === "sbp_qr") {
        const qr = qrSvg(`DEMO-SBP:${o.publicCode}:${o.totalRub}`);
        return ok({ view: { type: "qr", qrSvg: qr, payUrl: `/demo-pay/${o.id}`, expiresAt: new Date(Date.now() + 3600_000).toISOString(), demo: true } });
      }
      if (b0.method === "transfer") {
        const t = DEFAULTS.payments.transfer;
        return ok({ view: { type: "transfer", phone: t.phone, card: t.card, bank: t.bank, holder: t.holder, code: o.publicCode, amountRub: o.totalRub, expiresAt: new Date(Date.now() + t.cancelHours * 3600_000).toISOString() } });
      }
      return err("Способ оплаты недоступен");
    }
    if (b0?.action === "claim") {
      if (o.status !== "PENDING_PAYMENT") return err("Заказ не ожидает оплаты");
      o.status = "AWAITING_CONFIRMATION";
      log(`Алерт владельцу: перевод на подтверждении — ${o.publicCode}, ${o.totalRub.toLocaleString("ru-RU")} ₽. Проверьте поступление и подтвердите в админке.`);
      commit();
      return ok({ ok: true });
    }
  }
  return err("В демо-стенде этот запрос не работает", 404);
}

function bookAction(book: DBook, b: Record<string, unknown>): R {
  const limits = DEFAULTS.limits;
  // rev 19: оплаченная книга не правится — как на сервере (src/lib/book-edit.ts)
  const locked = editLocked(book, String(b.action ?? ""));
  if (locked) return err(locked, 409);
  switch (b.action) {
    case "rewrite":
      if (book.rewritesLeft <= 0) return err("Сказку можно переписать не больше двух раз. Поправьте текст вручную.");
      if (!["TEXT_READY", "TEXT_APPROVED"].includes(book.status)) return err("Сейчас переписать нельзя");
      book.rewritesLeft--;
      book.status = "TEXT_QUEUED";
      book.progress = 0;
      startJob(book, "text");
      commit();
      return ok({ ok: true });
    case "approve":
      if (book.status !== "TEXT_READY" && book.status !== "TEXT_APPROVED") return err("Текст ещё не готов");
      book.status = "TEXT_APPROVED";
      book.textApprovedAt = Date.now();
      event("text_approved");
      commit();
      return ok({ ok: true });
    case "consent":
      if (!S.consent.pd) log("Согласие на обработку персональных данных — дано (шаг фото)");
      S.consent.pd = true;
      if (b.photo && !S.consent.photo) {
        S.consent.photo = true;
        log("Согласие на обработку фото — дано");
      }
      commit();
      return ok({ ok: true });
    case "preview": {
      if (!S.user) return err("Войдите по коду, чтобы мы прислали превью", 401);
      if (DEFAULTS.auth.phoneRequired && !S.user.phone) return err("Укажите телефон при входе — он нужен для связи по заказу", 401);
      if (book.status !== "TEXT_APPROVED" && book.status !== "FAILED") return err("Сначала подтвердите текст сказки");
      if (!S.consent.pd) {
        if (!b.pd) return err("Отметьте согласие на обработку персональных данных");
        S.consent.pd = true;
      }
      if (b.withPhoto && photosOf(book.id).filter((p) => p.role === "main").length === 0) return err("Загрузите хотя бы одно фото или выберите «по описанию»");
      if (!hit(S.user.email, "preview", limits.previewsPerContact)) return err("Сегодня превью уже было. Новое можно сделать завтра — или купите эту книгу без ожидания.", 429);
      book.withPhoto = Boolean(b.withPhoto);
      book.status = "PREVIEW_QUEUED";
      book.progress = 0;
      startJob(book, "preview");
      commit();
      return ok({ ok: true });
    }
    case "redraw": {
      if (!book.paidFull) return err("Перерисовка доступна после покупки");
      if (book.redrawsLeft <= 0) return err(`Бесплатные перерисовки закончились. Следующая — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
      const i = Number(b.index);
      book.redrawsLeft--;
      setTimeout(() => {
        book.variants[i] = (book.variants[i] ?? 0) + 1;
        S.costs.push({ at: Date.now(), rub: COST.image });
        log(`Перерисована иллюстрация ${i === 0 ? "обложки" : `разворота ${i}`}`);
        commit();
      }, 700);
      commit();
      return ok({ ok: true, redrawsLeft: book.redrawsLeft });
    }
    case "mood": {
      const a = book.params;
      const moodId = b.mood === "as-drawn" ? "" : String(b.mood ?? "");
      if (moodId && !moodsFor(a.audience, heroAge(a)).some((m) => m.id === moodId)) return err("Такого настроения нет");
      if ((book.mood ?? "") === moodId) return ok({ ok: true, unchanged: true });
      if (["DRAFT", "TEXT_QUEUED", "TEXT_READY", "TEXT_APPROVED"].includes(book.status)) {
        book.mood = moodId;
        commit();
        return ok({ ok: true });
      }
      if (!book.paidFull) {
        if (book.status !== "PREVIEW_READY") return err("Подождите, пока превью дорисуется");
        if (book.moodChangesPreview >= limits.moodChangesPreview) return err(`До оплаты настроение можно сменить ${limits.moodChangesPreview} раза. После покупки — ещё раз бесплатно для всей книги.`, 429);
        if (spentTodayRub() >= limits.dailySpendRub) return err("Сейчас много заказов — попробуйте сменить настроение чуть позже", 429);
        book.mood = moodId;
        book.moodChangesPreview++;
        book.status = "PREVIEW_QUEUED";
        book.progress = 0;
        startJob(book, "preview");
      } else {
        if (book.status !== "FULL_READY") return err("Подождите, пока книга будет готова");
        const free = book.moodChangesFull === 0;
        if (!free && book.redrawsLeft <= 0) return err(`Бесплатные перерисовки закончились. Смена настроения — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
        book.mood = moodId;
        book.moodChangesFull++;
        if (!free) book.redrawsLeft--;
        book.status = "FULL_QUEUED";
        book.progress = 0;
        startJob(book, "full");
      }
      log(`Смена настроения: ${moodId || "как задумал художник"}`);
      commit();
      return ok({ ok: true });
    }
    case "layout": {
      // Правки в превью (rev 13): имя, обложка, автор, фото, посвящение — та же логика, что на сайте (src/lib/book-edit.ts)
      const e = LayoutEdit.safeParse(b);
      if (!e.success) return err(e.error.issues[0]?.message ?? "Некорректный запрос");
      const a = AnswersV2.parse(book.params);
      if (e.data.name !== undefined && book.paidFull && e.data.name.trim().toLowerCase() !== a.hero.name.toLowerCase()) return err(NAME_AFTER_PAY, 409);
      if (e.data.photoId && !photosOf(book.id).some((p) => p.id === e.data.photoId)) return err("Фото не найдено — загрузите ещё раз", 404);
      const r = applyLayoutEdit(a, e.data);
      if (!r.ok) return err(r.error);
      if (r.nameChanged) {
        if (!["TEXT_READY", "TEXT_APPROVED", "PREVIEW_READY"].includes(book.status)) return err("Подождите, пока книга будет готова, — потом имя можно поменять");
        if (book.textRaw) book.text = personalize(book.textRaw, r.answers);
        log(`Имя в книге: ${a.hero.name} → ${r.answers.hero.name} (текст и обложка — заново с правильными окончаниями)`);
      }
      book.params = r.answers;
      if (book.paidFull) log("Правка вёрстки — PDF пересобраны (в демо PDF не собирается)");
      commit();
      return ok({ ok: true });
    }
    case "retry":
      if (book.status !== "FAILED") return err("Повтор не нужен");
      book.status = book.textApprovedAt ? (book.paidFull ? "FULL_QUEUED" : "PREVIEW_QUEUED") : "TEXT_QUEUED";
      startJob(book, book.textApprovedAt ? (book.paidFull ? "full" : "preview") : "text");
      commit();
      return ok({ ok: true });
  }
  return err("Некорректный запрос");
}

/** Кнопки входа демо (на сайте — src/lib/oauth.ts, включаются ключами в окружении). */
const DEMO_OAUTH = [
  { key: "vkid", title: "VK ID", short: "VK", color: "#0077ff", domain: "vk.com" },
  { key: "yandex", title: "Яндекс ID", short: "Я", color: "#fc3f1d", domain: "yandex.ru" },
  { key: "mailru", title: "Mail.ru", short: "@", color: "#005ff9", domain: "mail.ru" },
  { key: "google", title: "Google", short: "G", color: "#ffffff", domain: "gmail.com" },
];

// ───────── «Мои данные»: выгрузка ─────────
export function exportData() {
  return {
    exportedAt: new Date().toISOString(),
    note: "Демо-стенд: данные этого окна браузера (на сайте — всё, что хранится о вас на сервере).",
    user: S.user,
    consents: S.consent,
    savedAddresses: S.addresses ?? [],
    books: S.books.map((b) => ({ id: b.id, createdAt: new Date(b.createdAt).toISOString(), status: b.status, hero: b.params.hero.name, title: b.text?.title ?? null, text: b.text?.spreads.map((s) => s.text) ?? [] })),
    orders: S.orders.map((o) => ({ publicCode: o.publicCode, status: o.status, totalRub: o.totalRub, createdAt: new Date(o.createdAt).toISOString(), contactName: o.contactName, contactPhone: o.contactPhone, contactEmail: o.contactEmail, shipment: o.shipment ?? null })),
  };
}
let afterDelete: () => void = () => {};
/** Удаление аккаунта в демо = «Начать демо сначала» без вопроса (тема и праздники — в app.tsx). */
export function onAccountDeleted(fn: () => void) {
  afterDelete = fn;
}

// ───────── «Мультфильм по книге» (как /api/books/[id]/cartoon и cartoon/voice) ─────────
// Ролик в демо не рендерится: плеер в кабинете (tools/demo/cartoon.tsx) показывает мультфильм прямо в браузере —
// canvas по разворотам книги + озвучка голосом браузера или вашими записями.
const voices = new Map<string, Map<number, { url: string; sec: number }>>();
export const voiceOf = (bookId: string) => voices.get(bookId) ?? new Map<number, { url: string; sec: number }>();
export function cartoonOf(b: DBook) {
  const paid = S.orders.filter((o) => (o.bookId === b.id || o.bookIds?.includes(b.id)) && o.paidAt && !["REFUNDED", "CANCELLED"].includes(o.status)).flatMap((o) => o.items.map((i) => i.refKey));
  const st = S.cartoons?.[b.id] ?? { consent: false, mode: "auto" as const };
  return { bought: paid.includes("cartoon"), ownVoice: paid.includes("cartoon-own-voice"), ...st };
}
/** Сценарий мультфильма — та же функция, что на сайте (14 реплик, ~2 минуты); подписи комикса — без скобок. */
export function scriptOf(b: DBook): Cue[] {
  if (!b.text) return [];
  return cartoonScript({ title: b.text.title, spreads: b.text.spreads.map((s) => ({ index: s.index, text: plainSpread(s.text) })), dedication: dedicationText(b.params) }).cues;
}
function setCartoon(b: DBook, patch: Partial<{ consent: boolean; mode: "auto" | "own" }>) {
  S.cartoons = { ...(S.cartoons ?? {}), [b.id]: { consent: false, mode: "auto", ...S.cartoons?.[b.id], ...patch } };
}
const recordedOf = (b: DBook) => Object.fromEntries([...voiceOf(b.id)].map(([n, v]) => [String(n), { sec: v.sec, warnings: [] as string[] }]));
async function audioSec(blob: Blob) {
  try {
    const ctx = new AudioContext();
    const a = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close().catch(() => {});
    return Math.round(a.duration * 10) / 10;
  } catch {
    return Math.round((blob.size / 16000) * 10) / 10; // ~128 кбит/с
  }
}
async function cartoonApi(b: DBook, method: string, sub: string | undefined, q: URLSearchParams, body: unknown): Promise<R> {
  const c = cartoonOf(b);
  const cfg = DEFAULTS.cartoon;
  const b0 = body as Record<string, unknown> | undefined;
  if (sub === "voice") {
    if (!c.ownVoice) return err("Сначала добавьте «Озвучить своим голосом»", 403);
    const map = voices.get(b.id) ?? new Map();
    voices.set(b.id, map);
    if (method === "GET") {
      const v = map.get(Number(q.get("n")));
      return v ? ok({ url: v.url }) : err("Записи нет", 404);
    }
    if (method === "DELETE") {
      map.delete(Number(q.get("n")));
      return ok({ recorded: recordedOf(b) });
    }
    if (!c.consent) return err("Отметьте согласие на обработку голоса", 403);
    const fd = body as FormData;
    const file = fd?.get?.("file");
    const cue = String(fd?.get?.("cue") ?? "");
    if (!(file instanceof Blob)) return err("Нет записи");
    if (cue === "all") return err("В демо одна общая запись не режется на реплики — запишите по репликам кнопками «Записать».");
    const sec = await audioSec(file);
    if (sec < 0.5) return err("Запись слишком короткая — попробуйте ещё раз");
    const old = map.get(Number(cue));
    if (old) URL.revokeObjectURL(old.url);
    map.set(Number(cue), { url: URL.createObjectURL(file), sec });
    const total = [...map.values()].reduce((s, v) => s + v.sec, 0);
    return ok({ recorded: recordedOf(b), overLimit: total > 180 });
  }
  if (method === "GET") {
    // Купленный мультфильм показывает плеер демо (cartoon.tsx) — панель сайта скрываем, чтобы не было двух блоков
    return ok({
      enabled: !c.bought && cfg.enabled,
      status: "NONE",
      progress: 0,
      error: null,
      voiceMode: c.mode,
      voice: null,
      subtitles: true,
      ownVoicePaid: c.ownVoice,
      rerendersLeft: 1,
      ownBuildsLeft: 3,
      durationSec: null,
      bought: { cartoon: false, ownVoice: c.ownVoice },
      share: null,
      urls: { video: null, poster: null, vertical: null },
      prices: { cartoon: cfg.priceRub, ownVoice: cfg.ownVoiceRub },
      voices: DEFAULTS.audio.voices,
    });
  }
  switch (b0?.action) {
    case "buy": {
      if (!S.user) return err("Войдите по коду", 401);
      if (b.status !== "FULL_READY" || !b.paidFull) return err("Мультфильм собирается по готовой книге — сначала купите книгу");
      const keys = [...(c.bought ? [] : ["cartoon"]), ...(b0.ownVoice && !c.ownVoice ? ["cartoon-own-voice"] : [])];
      if (!keys.length) return err("Уже куплено");
      const items = keys.map((k) => ({ kind: "addon", refKey: k, title: `Изготовление на заказ: ${ADDONS.find((a) => a.key === k)?.title ?? k}`, priceRub: k === "cartoon" ? cfg.priceRub : cfg.ownVoiceRub }));
      const total = items.reduce((x, i) => x + i.priceRub, 0);
      const o: DOrder = { id: uuid(), publicCode: publicCode(), createdAt: Date.now(), whoPrints: "self", bookId: b.id, items, subtotalRub: total, discountRub: 0, pdfCreditRub: 0, shippingRub: 0, totalRub: total, contactName: S.user.name ?? S.user.firstName ?? "", contactPhone: S.user.phone, contactEmail: S.user.email, status: "PENDING_PAYMENT", addonsOnly: true };
      S.orders.unshift(o);
      log(`Заказ ${o.publicCode}: ${keys.includes("cartoon") ? "мультфильм по книге" : "мультфильм своим голосом"} — ${total.toLocaleString("ru-RU")} ₽`);
      commit();
      return ok({ orderId: o.id });
    }
    case "consent":
      setCartoon(b, { consent: Boolean(b0.granted) });
      if (!b0.granted) voices.delete(b.id);
      log(b0.granted ? "Согласие на обработку голоса — дано" : "Согласие на голос отозвано, записи удалены");
      commit();
      return ok({ ok: true });
    case "deleteVoice":
      voices.delete(b.id);
      setCartoon(b, { mode: "auto" });
      commit();
      return ok({ ok: true });
    case "submitOwn": {
      const cues = scriptOf(b);
      if (cues.some((x) => !voiceOf(b.id).has(x.n))) return err("Запишите все реплики");
      setCartoon(b, { mode: "own" });
      log("Мультфильм своим голосом собран (в демо — играет в браузере)");
      commit();
      return ok({ ok: true });
    }
    case "settings":
      if (b0.voiceMode === "auto") setCartoon(b, { mode: "auto" });
      commit();
      return ok({ ok: true });
  }
  return err("Некорректный запрос");
}

// ───────── перехват fetch ─────────
export function installApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("/api/")) return real(input, init);
    const u = new URL(url, "https://demo.bookimi");
    let body: unknown;
    if (init?.body instanceof FormData) body = init.body;
    else if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = undefined;
      }
    }
    await new Promise((r) => setTimeout(r, 90)); // как будто сеть
    let r: R;
    try {
      r = await handle((init?.method ?? "GET").toUpperCase(), u.pathname, u.searchParams, body);
    } catch (e) {
      console.error(e);
      r = err("Что-то пошло не так. Попробуйте ещё раз.", 500);
    }
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "Content-Type": "application/json" } });
  };
}
