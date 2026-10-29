// «Сервер» демо-стенда в браузере: хранилище (localStorage «bookimi.demo.v1», фото — только в памяти вкладки)
// и API с теми же адресами и правилами, что src/app/api/** (перехват fetch). Текст — DemoTextProvider сайта,
// картинки — renderDemoSpread, сумма — quote(), путь заказа — journey(), настройки — DEFAULTS из settings.ts.
import { qrSvg } from "./qr";
import { AnswersV2, appearanceLine, extraGender, heroAge, type QuizAnswers } from "../../src/lib/quiz";
import { DemoTextProvider, personalize, plotForAnswers, type StoryText } from "../../src/lib/gen/text";
import { moodsFor } from "../../src/content/moods";
import { ART_STYLE_IDS } from "../../src/content/profiles";
import { HERO_KIND_BY_AUDIENCE, type DemoExtra, type DemoLook, type HeroKind } from "../../src/content/types";
import { extraDrawKind } from "../../src/content/art/index";
import { renderDemoSpread, watermark } from "../../src/content/art/render";
import { declineName, guessGender } from "../../src/lib/declension";
import { normalizePhone } from "../../src/content/answers";
import { etaDate, quote, ruDate, type CatalogAddon, type CatalogFormat } from "../../src/lib/pricing";
import { ADDONS, FORMATS } from "../../src/lib/catalog-defaults";
import { canAcceptPayments, DEFAULTS } from "../../src/lib/settings";
import type { ExtraV2T } from "../../src/content/answers";
import type { JourneyOrder } from "../../src/app/zakaz/journey";
import { cityLabel, findCity, normalizeCity, searchCities } from "../../src/lib/cities";
import { filterPvz, type Pvz } from "../../src/lib/pvz";
import { tableQuote } from "../../src/lib/ship-zones";
import { addToAddressBook, addressError, cleanAddress, pickPrefill, type DeliveryAddress, type SavedAddress } from "../../src/lib/delivery";

// ───────── хранилище ─────────
export interface DBook {
  id: string;
  createdAt: number;
  params: QuizAnswers;
  status: string;
  progress: number;
  error: string | null;
  text: StoryText | null;
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
}
export interface DOrder {
  id: string;
  publicCode: string;
  createdAt: number;
  whoPrints: "self" | "bookimi";
  bookId: string;
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
  user: { email: string; phone: string; name?: string; marketing: boolean } | null;
  consent: { pd: boolean; photo: boolean; marketing: boolean };
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
}

export const KEY = "bookimi.demo.v1";
/** Ключи сайта в браузере, которые демо тоже чистит при «Начать сначала». */
export const SITE_KEYS = ["bookimi.quiz.v2", "bookimi.quiz.v1", "bookimi.heroName"];

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
} catch {}
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {}
}
export function resetStore() {
  try {
    localStorage.removeItem(KEY);
    for (const k of SITE_KEYS) localStorage.removeItem(k);
  } catch {}
  for (const t of jobs.values()) clearTimeout(t);
  jobs.clear();
  photos.clear();
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
const BASE_LIMITS = { ...DEFAULTS.limits };

export function applySettings() {
  Object.assign(DEFAULTS.seller, { fullName: "Иванова Анна Сергеевна (демо)", inn: "770012345606", email: "hello@bookimi.demo", phone: "+7 900 000-00-00" });
  DEFAULTS.payments.sbpQr = { enabled: true, provider: "demo", confirmMinutes: 60 };
  DEFAULTS.payments.transfer = { enabled: true, phone: "+7 900 000-00-00", card: "", bank: "Демо-банк", holder: "Анна С. И. (демо)", cancelHours: 24 };
  DEFAULTS.flags.photoUploadEnabled = true;
  DEFAULTS.flags.demoMode = true;
  DEFAULTS.alerts.email = "owner@bookimi.demo";
  Object.assign(DEFAULTS.limits, BASE_LIMITS, S.limits);
  for (const f of FORMATS as unknown as { key: string; price: number }[]) f.price = S.prices[f.key] ?? BASE_PRICES[f.key];
  for (const a of ADDONS as unknown as { key: string; price: number | null }[]) if (a.price !== null) a.price = S.prices[a.key] ?? BASE_PRICES[a.key];
}
applySettings();

export function setPrices(p: Record<string, number>) {
  S.prices = p;
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
    hair: p.hair,
    hairstyle: p.hairstyle,
    longHair: /длинн|хвост|косич|кудр|пучок|коса/i.test(p.hairstyle ?? ""),
    skin: p.skin,
    glasses: p.glasses,
    freckles: p.freckles,
    beard: p.beard,
    species: a.pet.species,
    breed: a.pet.breed,
    furColor: a.pet.furColor,
  };
}
const EXTRA_AGE: Record<string, number> = { mom: 35, dad: 37, grandma: 68, grandpa: 70, owner: 34, colleague: 38 };
function extraLook(e: ExtraV2T, a: QuizAnswers): DemoLook {
  const g = extraGender(e, guessGender);
  const age = e.role === "partner" ? heroAge(a) : e.role === "child" || e.role === "grandchild" ? 7 : EXTRA_AGE[e.role];
  return { gender: g === "n" ? undefined : g, age, species: e.species, thing: e.what || (e.role === "toy" ? e.name : undefined), furColor: e.role === "pet" ? e.description : undefined };
}
const IDEA_THEME: Record<string, string> = { CHILD: "dragon", TEEN: "city-night", ADULT: "home", PET: "pet-home" };
function plotInfo(a: QuizAnswers) {
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
  const key = `${b.id}|${index}|${v}|${b.mood}|${full ? "full" : "wm"}|${b.text?.title ?? ""}`;
  return svgUrl(key, () => {
    const a = b.params;
    const kind = HERO_KIND_BY_AUDIENCE[a.audience];
    // Перерисовка в демо — другой ракурс того же разворота
    const idx = index === 0 ? 0 : ((index - 1 + v * 5) % 12) + 1;
    const extras: DemoExtra[] = a.extras.map((e) => ({ role: e.role === "custom" && e.what ? e.what : e.role, kind: extraDrawKind(e.role, kind), look: extraLook(e, a) }));
    let svg = renderDemoSpread({
      plot: plotInfo(a),
      spreadIndex: idx,
      wide: index > 0,
      artStyle: a.artStyle,
      mood: b.mood || null,
      hero: { ...heroLook(a), kind },
      extras,
      caption: "демо-иллюстрация · на сайте её рисует нейросеть",
      title: index === 0 ? b.text?.title : undefined,
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
    log(`Алерт владельцу: лимит расходов на генерацию исчерпан (${spentTodayRub()} ₽ из ${DEFAULTS.limits.dailySpendRub} ₽). Превью ждут в очереди.`);
    return;
  }
  b.error = null;
  b.progress = 5;
  jobs.set(b.id, setTimeout(tick, 250));
}

async function finishJob(b: DBook, kind: JobKind) {
  const a = AnswersV2.parse(b.params);
  if (kind === "text") {
    const r = await new DemoTextProvider().write(a, plotForAnswers(a), Math.max(0, 2 - b.rewritesLeft));
    b.text = personalize(r.raw, a);
    b.status = "TEXT_READY";
    b.progress = 100;
    S.costs.push({ at: Date.now(), rub: COST.text });
    event("text_ready");
    log(`Сказка сочинена: «${b.text.title}»`);
    return;
  }
  if (kind === "preview") {
    b.pages = b.pages.length ? b.pages : [0, 1, 2];
    b.status = "PREVIEW_READY";
    b.progress = 100;
    b.previewReadyAt = Date.now();
    S.costs.push({ at: Date.now(), rub: COST.image * b.pages.length });
    event("preview_ready");
    log(`Превью готово: обложка и 2 разворота · уведомление покупателю «Превью готово» (${S.user?.email ?? "—"})`);
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

async function readPhoto(file: File): Promise<{ url: string; w: number; h: number; bright: number }> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = src;
  });
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
  const k = Math.min(1, 640 / Math.max(img.width, img.height));
  const s = document.createElement("canvas");
  s.width = Math.round(img.width * k);
  s.height = Math.round(img.height * k);
  s.getContext("2d")!.drawImage(img, 0, 0, s.width, s.height);
  return { url: s.toDataURL("image/jpeg", 0.85), w: img.width, h: img.height, bright: sum / (d.length / 4) };
}

// ───────── оформление (как priceCheckout / createOrder в src/lib/orders.ts) ─────────
export function catalogForPricing(): { formats: CatalogFormat[]; addons: CatalogAddon[] } {
  const flags = DEFAULTS.flags;
  const audio = DEFAULTS.audio;
  return {
    formats: FORMATS.filter((f) => f.kind === "PDF" || flags.printEnabled).map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price })),
    addons: ADDONS.filter((a) => flags.printEnabled || !a.print)
      .filter((a) => a.key !== "audio-self" || audio.selfReadEnabled)
      .map((a) => ({
        key: a.key,
        kind: a.kind,
        title: a.title,
        priceRub: a.key === "audiobook" ? audio.ttsPriceRub : a.key === "audio-self" ? audio.selfReadPriceRub : a.price,
        percentOff: a.pct,
        requiresPrint: a.print,
      })),
  };
}
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
    profile: { name: S.user?.name, phone: S.user?.phone },
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
interface CheckoutInput {
  bookId: string;
  whoPrints: "self" | "bookimi";
  formatKey?: string;
  addons: string[];
  shipping?: { method: string; address: DeliveryAddress };
  promo?: string;
  contact: { name: string; phone?: string; email?: string };
  saveAddress?: boolean;
}
function priceCheckout(input: CheckoutInput) {
  const { formats, addons } = catalogForPricing();
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
    },
    formats,
    addons,
  );
  void books;
  const eta = input.whoPrints === "bookimi" ? etaDate(new Date(), 5, ship?.daysMax ?? 0, input.addons.includes("urgent")) : null;
  return { quote: q, promo: promo ? { code: promo.code } : null, newbieApplied: false, ship, eta: eta ? { ready: eta.ready, eta: eta.eta, readyText: ruDate(eta.ready), etaText: ruDate(eta.eta) } : null };
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
  log(`${o.publicCode}: оплачено ${o.totalRub.toLocaleString("ru-RU")} ₽${by ? ` (перевод подтвердил ${by})` : " по QR"} · чек «Мой налог» (демо, не фискальный) · уведомление «Оплата получена»`);
  const b = bookById(o.bookId);
  if (b) {
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
  log(`${o.publicCode}: статус — ${status}${track ? `, трек ${track}` : ""} · уведомление покупателю`);
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
    return ok({ ideas: await new DemoTextProvider().ideas(String(b0?.idea ?? ""), a.data) });
  }

  if (path === "/api/books" && method === "POST") {
    const parsed = AnswersV2.safeParse(b0?.answers);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Заполните обязательные шаги");
    const a = parsed.data;
    const plot = plotForAnswers(a);
    if (plot && plot.audience !== a.audience) return err("Этот сюжет для другой аудитории — выберите сюжет из списка");
    if (plot && a.extras.length < plot.extras.min) return err(plot.extras.note ?? `Для этого сюжета нужно добавить героев: не меньше ${plot.extras.min}`);
    if (plot && a.extras.length > plot.extras.max) a.extras = a.extras.slice(0, plot.extras.max);
    if (!ART_STYLE_IDS.some((x) => x.id === a.artStyle)) a.artStyle = plot?.artStyles[0] ?? "watercolor-air";
    if (a.mood && !moodsFor(a.audience, a.hero.age).some((m) => m.id === a.mood)) a.mood = "";
    if (!a.story.slug && !a.story.idea) return err("Выберите сюжет или опишите свою идею");
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
      withPhoto: false,
      paidFull: false,
      pages: [],
      variants: {},
    };
    S.books.push(book);
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
        mood: book.mood,
        moodChanges: { preview: book.moodChangesPreview, full: book.moodChangesFull },
        withPhoto: book.withPhoto,
        paid: book.paidFull,
        loggedIn: Boolean(S.user),
        consent: { pd: S.consent.pd, photo: S.consent.photo },
        pages: book.pages.map((i) => ({ index: i, text: i === 0 ? book.text?.title ?? "" : book.text?.spreads[i - 1]?.text ?? "", url: pageUrl(book, i, { full }) })),
        photos: photosOf(book.id).filter((p) => p.role === "main").map((p) => ({ id: p.id, url: p.url })),
      });
    }
    if (seg.length === 3 && method === "PATCH") {
      const spreads = (b0?.spreads ?? []) as { index: number; text: string }[];
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
    if (seg[3] === "photos") {
      if (method === "DELETE") {
        photos.set(book.id, photosOf(book.id).filter((p) => p.id !== q.get("photo")));
        return ok({ ok: true });
      }
      if (!DEFAULTS.flags.photoUploadEnabled) return err("Приём фото пока выключен — иллюстрации будут по описанию", 403);
      if (!S.consent.photo) return err("Сначала дайте согласие на обработку фото", 403);
      const fd = body as FormData;
      const file = fd?.get?.("file");
      const role = String(fd?.get?.("role") ?? "main");
      if (!(file instanceof File)) return err("Выберите файл");
      if (file.size > 15 * 1024 * 1024) return err("Файл больше 15 МБ");
      if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return err("Подойдёт JPG, PNG или WebP");
      const list = photosOf(book.id);
      if (list.filter((p) => p.role === role).length >= (role === "main" ? 3 : 1)) return err(role === "main" ? "Не больше 3 фото" : "Одно фото на героя");
      let ph: Awaited<ReturnType<typeof readPhoto>>;
      try {
        ph = await readPhoto(file);
      } catch {
        return err("Не получилось открыть фото. Попробуйте другой файл.");
      }
      const minSide = Math.min(ph.w, ph.h);
      const hints: string[] = [];
      if (minSide < 500) return err("Фото слишком маленькое. Нужно хотя бы 500 пикселей по короткой стороне.");
      if (minSide < 900) hints.push("Фото небольшое — лучше снять ближе.");
      if (ph.bright < 60) hints.push("Темновато — встаньте лицом к окну.");
      const id = uuid();
      photos.set(book.id, [...list, { id, url: ph.url, role }]);
      event("photo_upload");
      log(`Фото героя загружено (в демо — только в памяти вкладки; на сайте удаляется через ${DEFAULTS.limits.photoTtlDays} дней)`);
      commit();
      return ok({ id, hints });
    }
    if (seg[3] === "action" && method === "POST") return bookAction(book, b0 ?? {});
  }

  if (path === "/api/auth/request" && method === "POST") {
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
  if (path === "/api/auth/verify" && method === "POST") {
    const email = String(b0?.email ?? "").trim().toLowerCase();
    if (!b0?.consentPd && !S.consent.pd) return err("Отметьте согласие на обработку персональных данных");
    if (!S.otp || S.otp.email !== email || String(b0?.code) !== S.otp.code) return err("Неверный или устаревший код");
    const phone = (b0?.phone ? normalizePhone(String(b0.phone)) : null) ?? S.otp.phone ?? S.user?.phone ?? "";
    const same = S.user?.email === email;
    S.user = { email, phone: phone || (same ? S.user!.phone : ""), name: same ? S.user?.name : undefined, marketing: Boolean(b0?.marketing) || (same && S.user!.marketing) || false };
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
    return ok(priceCheckout(input));
  }
  if (path === "/api/checkout" && method === "POST") {
    if (!S.user) return err("Войдите по коду", 401);
    const input = b0 as unknown as CheckoutInput;
    const book = bookById(input.bookId);
    if (!book) return err("Не найдено", 404);
    if (input.whoPrints === "bookimi") {
      if (!input.shipping) return err("Выберите доставку");
      input.shipping.address = cleanAddress(input.shipping.method, input.shipping.address ?? { city: "" });
      const bad = addressError(input.shipping.method, input.shipping.address);
      if (bad) return err(bad);
      if (!input.contact.name || !input.contact.phone) return err("Укажите имя и телефон получателя");
      if (input.shipping.method === "cdek_pvz") {
        const a = input.shipping.address;
        const point = demoPvz(a.city, a.region).find((p) => p.code === a.pvzCode);
        if (!point) return err("Пункт выдачи не найден в этом городе — выберите его заново");
        a.pvzAddress = point.address;
      }
    }
    const priced = priceCheckout(input);
    if (priced.quote.errors.length) return err(priced.quote.errors.join("; "));
    const title = book.text?.title ?? "Персональная книга";
    const qq = priced.quote;
    const o: DOrder = {
      id: uuid(),
      publicCode: publicCode(),
      createdAt: Date.now(),
      whoPrints: input.whoPrints,
      bookId: book.id,
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
    };
    if (input.contact.name && S.user && !S.user.name) S.user.name = input.contact.name;
    if (input.whoPrints === "bookimi" && input.shipping && input.saveAddress !== false) {
      S.addresses = addToAddressBook(S.addresses, { ...input.shipping.address, id: uuid().slice(0, 12), savedAt: new Date().toISOString(), method: input.shipping.method, name: input.contact.name, phone: input.contact.phone ?? "" });
    }
    S.orders.unshift(o);
    log(`Заказ ${o.publicCode} оформлен: ${o.totalRub.toLocaleString("ru-RU")} ₽ (${o.whoPrints === "self" ? "PDF" : "печать"}${o.promo ? `, промокод ${o.promo}` : ""}) · уведомление «Заказ оформлен»`);
    commit();
    return ok({ orderId: o.id });
  }

  if (seg[1] === "orders" && seg[2]) {
    const o = orderById(seg[2]);
    if (!o) return err("Не найдено", 404);
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
    case "retry":
      if (book.status !== "FAILED") return err("Повтор не нужен");
      book.status = book.textApprovedAt ? (book.paidFull ? "FULL_QUEUED" : "PREVIEW_QUEUED") : "TEXT_QUEUED";
      startJob(book, book.textApprovedAt ? (book.paidFull ? "full" : "preview") : "text");
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
