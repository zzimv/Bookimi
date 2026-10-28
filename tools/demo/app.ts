// Демо-стенд БУКИМИ в одном HTML: тот же код расчёта, сказок, склонения и иллюстраций, что на сайте,
// но без сервера. Оплата понарошку, фото остаётся в браузере. Сборка: node tools/demo/build.mjs
import { quote, etaDate, ruDate, type CatalogAddon, type CatalogFormat } from "../../src/lib/pricing";
import { DemoTextProvider, personalize, dedicationText, type StoryText } from "../../src/lib/gen/text";
import { planFor } from "../../src/lib/story-plans";
import { demoSceneSvg, watermark, THEME_BY_STORY } from "../../src/lib/gen/demo-art";
import { STORIES, STYLES, FORMATS, ADDONS, FAQ } from "../../src/lib/catalog-defaults";
import { AGE_GROUPS, HAIR, HAIRSTYLE, CLOTHES, INTERESTS, OCCASION_CHIPS, EXTRA_ROLES, DEDICATIONS, Answers, type QuizAnswers } from "../../src/lib/quiz";
import { applyGender, fillNames } from "../../src/lib/declension";
import QRCode from "qrcode";

// ───────── состояние ─────────
type Screen =
  | "home" | "quiz" | "gen-text" | "text" | "consent" | "photo" | "login" | "gen-preview" | "preview"
  | "checkout" | "order" | "gen-full" | "book" | "admin";

interface Order {
  id: string; code: string; who: "self" | "bookimi"; lines: { title: string; priceRub: number }[];
  total: number; discount: number; shipping: number; credit: number;
  status: "PENDING_PAYMENT" | "AWAITING_CONFIRMATION" | "PAID" | "IN_PRINT" | "PACKED" | "SHIPPED" | "DELIVERED";
  method?: string; track?: string; ready?: string; eta?: string; createdAt: number; receipt?: boolean; contact: string;
}

interface State {
  screen: Screen;
  step: number;
  a: Omit<QuizAnswers, "hero"> & { hero: Partial<QuizAnswers["hero"]> };
  text: StoryText | null;
  rewrites: number;
  photoOk: boolean;
  pdOk: boolean;
  user: string | null;
  pendingCode: string | null;
  pendingEmail: string;
  previewsToday: number;
  textsToday: number;
  co: { who: "self" | "bookimi"; size: string; cover: "soft" | "hard"; addons: string[]; method: string; city: string; name: string; phone: string; promo: string; showAll: boolean };
  orders: Order[];
  currentOrder: string | null;
  paidFull: boolean;
  redraws: number;
  variants: Record<number, number>;
  prices: Record<string, number>;
  dailyLimit: number;
  spent: number;
  promos: { code: string; pct: number }[];
  log: string[];
  bookEdits: Record<number, string>;
}

const KEY = "bookimi.demo.v1";
const blank = (): State => ({
  screen: "home",
  step: 0,
  a: Answers.parse({ hero: { name: "-", gender: "boy" } }) as State["a"],
  text: null, rewrites: 2, photoOk: false, pdOk: false, user: null, pendingCode: null, pendingEmail: "",
  previewsToday: 0, textsToday: 0,
  co: { who: "bookimi", size: "std", cover: "hard", addons: [], method: "cdek_pvz", city: "", name: "", phone: "", promo: "", showAll: false },
  orders: [], currentOrder: null, paidFull: false, redraws: 3, variants: {},
  prices: Object.fromEntries([...FORMATS.map((f) => [f.key, f.price]), ...ADDONS.filter((a) => a.price).map((a) => [a.key, a.price!])]),
  dailyLimit: 3000, spent: 0, promos: [{ code: "SKAZKA10", pct: 10 }], log: [], bookEdits: {},
});

let S: State = blank();
S.a.hero = { name: "", nickname: "", gender: undefined, ageGroup: undefined, birthDate: "" };
let photo: string | null = null; // фото только в памяти вкладки
let photoHints: string[] = [];
let qrSvg = "";
let progress = 0;
let toast = "";

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (saved && saved.a) S = { ...S, ...saved, screen: ["gen-text", "gen-preview", "gen-full"].includes(saved.screen) ? "home" : saved.screen };
} catch {}
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
};

// ───────── утилиты ─────────
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
const heroNames = () => ({ name: S.a.hero.name || "Имя", nickname: S.a.hero.nickname || S.a.hero.name || "Имя", gender: S.a.hero.gender });
const say = (t: string) => fillNames(applyGender(t, S.a.hero.gender), heroNames());
const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const log = (msg: string) => { S.log.unshift(`${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — ${msg}`); S.log = S.log.slice(0, 40); };
function go(screen: Screen) { S.screen = screen; save(); render(); window.scrollTo({ top: 0 }); }
function flash(t: string) { toast = t; render(); setTimeout(() => { toast = ""; render(); }, 2600); }

function formats(): CatalogFormat[] {
  return FORMATS.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: S.prices[f.key] ?? f.price }));
}
function addons(): CatalogAddon[] {
  return ADDONS.map((a) => ({ key: a.key, kind: a.kind, title: a.title, priceRub: a.price ? S.prices[a.key] ?? a.price : null, percentOff: a.pct, requiresPrint: a.print }));
}

function art(index: number, wm: boolean, wide = index > 0) {
  const slug = S.a.story.slug || "imya-i-zvyozdnyj-drakonchik";
  const v = S.variants[index] ?? 0;
  let svg = demoSceneSvg({
    theme: THEME_BY_STORY[slug] ?? "dragon",
    index: index + v * 13,
    wide,
    hero: { hair: S.a.appearance.hair, gender: S.a.hero.gender, glasses: S.a.appearance.glasses, longHair: /длинн|хвост|косич|кудр/.test(S.a.appearance.hairstyle ?? "") },
    extras: S.a.extras.length,
    caption: "демо-иллюстрация: на сайте её рисует нейросеть по фото",
  });
  if (wm) svg = svg.replace("</svg>", `${watermark(wide ? 2048 : 1024, 1024)}</svg>`);
  return svgUri(svg);
}

function storyCover(slug: string) {
  return svgUri(demoSceneSvg({ theme: THEME_BY_STORY[slug] ?? "dragon", index: 0, hero: { hair: "русые" } }));
}

function quoteNow() {
  const promo = S.promos.find((p) => p.code === S.co.promo.trim().toUpperCase());
  const formatKey = `${S.co.size}-${S.co.cover}`;
  const ship = { cdek_pvz: 290, cdek_courier: 490, pochta: 350, pickup: 0 }[S.co.method] ?? 290;
  const pdfPaid = S.orders.some((o) => o.who === "self" && !["PENDING_PAYMENT", "AWAITING_CONFIRMATION"].includes(o.status)) ? S.prices.pdf : 0;
  const q = quote(
    { whoPrints: S.co.who, formatKey, addons: S.co.addons, shippingMethod: S.co.method, shippingRub: ship, pdfPaidRub: pdfPaid, discountPct: promo?.pct, freeShippingBooks: 2 },
    formats(),
    addons(),
  );
  const days = { cdek_pvz: 7, cdek_courier: 7, pochta: 14, pickup: 0 }[S.co.method] ?? 7;
  const eta = S.co.who === "bookimi" ? etaDate(new Date(), 5, days, S.co.addons.includes("urgent")) : null;
  return { q, promo, eta };
}

// ───────── квиз ─────────
const STEPS = ["Герой", "Внешность", "Увлечения", "Повод", "Сюжет", "Другие герои", "Стиль и посвящение"];
function chips(group: string, items: { key: string; label: string }[], selected: string[]) {
  return `<div class="chips">${items.map((i) => `<button type="button" class="chip" data-act="chip" data-group="${group}" data-key="${esc(i.key)}" aria-pressed="${selected.includes(i.key)}">${esc(i.label)}</button>`).join("")}</div>`;
}
const items = (xs: string[]) => xs.map((x) => ({ key: x, label: x }));

function quizStep() {
  const a = S.a;
  switch (S.step) {
    case 0:
      return `<h1>Кто главный герой?</h1>
        <div class="grid2">
          <label class="field"><span>Имя <span class="req">*</span></span><input class="input" id="q-name" maxlength="30" value="${esc(a.hero.name ?? "")}" placeholder="Например, Марк"></label>
          <label class="field"><span>Как ласково зовут дома</span><input class="input" id="q-nick" maxlength="30" value="${esc(a.hero.nickname ?? "")}" placeholder="Например, Марусик"><small>Так герой будет звучать в тёплых местах сказки</small></label>
        </div>
        <span class="label">Кто это? <span class="req">*</span></span>${chips("gender", [{ key: "boy", label: "Мальчик" }, { key: "girl", label: "Девочка" }], [a.hero.gender ?? ""])}
        <span class="label">Возраст <span class="req">*</span></span>${chips("age", AGE_GROUPS.map((g) => ({ key: g.key, label: g.label })), [a.hero.ageGroup ?? ""])}`;
    case 1:
      return `<h1>Как выглядит ${esc(say("{ГЕРОЙ.им}"))}?</h1>
        <p class="muted">Фото попросим позже — когда сказка понравится. Сейчас — описание: иллюстрации будут похожи даже без фото.</p>
        <span class="label">Цвет волос</span>${chips("hair", items(HAIR), [a.appearance.hair ?? ""])}
        <span class="label">Причёска</span>${chips("hairstyle", items(HAIRSTYLE), [a.appearance.hairstyle ?? ""])}
        ${chips("flags", [{ key: "glasses", label: "Очки" }, { key: "freckles", label: "Веснушки" }], [a.appearance.glasses ? "glasses" : "", a.appearance.freckles ? "freckles" : ""])}
        <span class="label">Любимая одежда</span>${chips("clothes", items(CLOTHES), [a.appearance.clothes ?? ""])}
        <label class="field"><span>Описать самому</span><textarea class="textarea" id="q-look" maxlength="300" placeholder="Например: большие голубые глаза, ямочки на щеках">${esc(a.appearance.custom ?? "")}</textarea></label>`;
    case 2:
      return `<h1>Что любит ${esc(say("{ГЕРОЙ.им}"))}?</h1><p class="muted">До трёх увлечений — они появятся в сказке.</p>
        ${chips("interests", INTERESTS.map((i) => ({ key: i.key, label: i.key })), a.interests)}
        <label class="field"><span>Своё увлечение</span><input class="input" id="q-int" maxlength="80" value="${esc(a.interestCustom ?? "")}" placeholder="Например, лего"></label>`;
    case 3:
      return `<h1>К какому поводу книга?</h1>${chips("occasion", OCCASION_CHIPS, [a.occasion.key])}
        ${a.occasion.key === "svoj" ? `<label class="field"><span>Свой повод</span><input class="input" id="q-occ" maxlength="120" value="${esc(a.occasion.custom ?? "")}"></label>` : ""}`;
    case 4:
      return `<h1>Выберите сюжет</h1><div class="choice-cards">${STORIES.map((s) => `
        <button type="button" class="choice" data-act="story" data-key="${s.slug}" aria-pressed="${a.story.slug === s.slug}">
          <img class="thumb" src="${storyCover(s.slug)}" alt="">
          <span><strong>${esc(say(s.title.replace("[Имя]", "{ГЕРОЙ.им}")))}</strong><span>${esc(s.tagline)}</span><span class="badge">${s.ageMin}–${s.ageMax} лет</span></span>
        </button>`).join("")}</div>`;
    case 5:
      return `<h1>Кто ещё будет в сказке?</h1><p class="muted">Необязательно. До трёх героев.</p>
        ${a.extras.map((e, i) => `<div class="extra">${chips(`role-${i}`, EXTRA_ROLES, [e.role])}
          <div class="grid2"><label class="field"><span>Имя или кличка</span><input class="input" data-extra="${i}" data-f="name" maxlength="30" value="${esc(e.name)}"></label>
          <label class="field"><span>Как выглядит</span><input class="input" data-extra="${i}" data-f="description" maxlength="200" value="${esc(e.description ?? "")}" placeholder="рыжий пёс с белым ухом"></label></div>
          <button type="button" class="link-btn" data-act="extra-del" data-key="${i}">Убрать</button></div>`).join("")}
        ${a.extras.length < 3 ? `<button type="button" class="btn btn--ghost btn--sm" data-act="extra-add">Добавить героя</button>` : ""}`;
    default:
      return `<h1>Стиль и посвящение</h1><span class="label">Стиль иллюстраций</span>
        <div class="choice-cards">${STYLES.filter((s) => s.active).map((s, i) => `
          <button type="button" class="choice" data-act="style" data-key="${s.key}" aria-pressed="${a.style === s.key}">
            <img class="thumb style-${s.key}" src="${storyCover(STORIES[i].slug)}" alt=""><span><strong>${esc(s.title)}</strong><span>${esc(s.description)}</span></span>
          </button>`).join("")}</div>
        <span class="label" style="margin-top:16px">Посвящение на первой странице</span>
        <div class="stack">${DEDICATIONS.map((d) => { const t = say(d); return `<button type="button" class="chip chip--wide" data-act="dedication" data-key="${esc(t)}" aria-pressed="${a.dedication === t}">${esc(t)}</button>`; }).join("")}</div>
        <label class="field"><span>Написать самому (до 300 знаков)</span><textarea class="textarea" id="q-ded" maxlength="300">${esc(a.dedication ?? "")}</textarea></label>`;
  }
}

function readQuizInputs() {
  const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
  const a = S.a;
  if (v("q-name") !== undefined) a.hero.name = v("q-name")!.replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "");
  if (v("q-nick") !== undefined) a.hero.nickname = v("q-nick")!;
  if (v("q-look") !== undefined) a.appearance.custom = v("q-look")!;
  if (v("q-int") !== undefined) a.interestCustom = v("q-int")!;
  if (v("q-occ") !== undefined) a.occasion.custom = v("q-occ")!;
  if (v("q-ded") !== undefined) a.dedication = v("q-ded")!;
  document.querySelectorAll<HTMLInputElement>("[data-extra]").forEach((el) => {
    const e = a.extras[Number(el.dataset.extra)];
    if (e) (e as Record<string, string>)[el.dataset.f!] = el.value;
  });
}

function quizError() {
  const a = S.a;
  if (S.step === 0) {
    if (!a.hero.name?.trim()) return "Как зовут героя?";
    if (!a.hero.gender) return "Выберите: мальчик или девочка";
    if (!a.hero.ageGroup) return "Укажите возраст";
  }
  if (S.step === 4 && !a.story.slug) return "Выберите сюжет";
  return "";
}

async function writeStory(variant: number) {
  const a = Answers.parse({ ...S.a, extras: S.a.extras.filter((e) => e.name.trim()) });
  const story = STORIES.find((s) => s.slug === a.story.slug)!;
  const r = await new DemoTextProvider().write(a, story.title, planFor(a.story.slug), variant);
  S.text = personalize(r.raw, a);
}

// ───────── экраны ─────────
function screenHome() {
  return `<section class="hero">
    <div>
      <h1 class="display">Сказка, в которой ваш ребёнок — главный герой</h1>
      <p class="lead">Ответьте на несколько вопросов — и сразу прочитаете сказку. Понравится — добавите фото и увидите обложку и первые развороты.</p>
      <label class="field" style="max-width:420px"><span>Как зовут ребёнка?</span><input class="input input--big" id="home-name" maxlength="20" value="${esc(S.a.hero.name ?? "")}" placeholder="Например, Варя"></label>
      <div class="row"><button class="btn btn--primary" data-act="start">Создать книгу бесплатно</button><button class="btn btn--ghost" data-act="to-admin">Открыть админку</button></div>
      <p class="small muted">Превью без регистрации и оплаты. Фото удаляется через 7 дней.</p>
    </div>
    <div class="hero__books" aria-hidden="true">
      ${STORIES.slice(0, 2).map((s) => `<figure class="cover"><img src="${storyCover(s.slug)}" alt=""><span class="cover__name">${esc(S.a.hero.name ?? "")}</span><span class="cover__title">${esc(s.title.replace("[Имя]", S.a.hero.name || "Ваш ребёнок"))}</span></figure>`).join("")}
    </div>
  </section>
  <section><h2>Сказки</h2><div class="grid">${STORIES.map((s) => `
    <article class="book"><figure class="cover"><img src="${storyCover(s.slug)}" alt=""><span class="cover__name">${esc(S.a.hero.name ?? "")}</span><span class="cover__title">${esc(s.title.replace("[Имя]", S.a.hero.name || "Ваш ребёнок"))}</span></figure>
      <h3>${esc(s.title.replace("[Имя]", "Ваш ребёнок"))}</h3><p class="small muted">${esc(s.tagline)}</p>
      <div class="book__meta"><span class="muted">Возраст ${s.ageMin}–${s.ageMax}</span><b>от ${rub(S.prices.pdf)}</b></div>
      <button class="btn btn--primary btn--sm" data-act="start-story" data-key="${s.slug}">Создать</button></article>`).join("")}</div></section>
  <section class="faq"><h2>Частые вопросы</h2>${FAQ.slice(0, 4).map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>`;
}

function screenQuiz() {
  return `<div class="flow">
    <div class="stepline"><span>Шаг ${S.step + 1} из ${STEPS.length}</span><span>${STEPS[S.step]}</span></div>
    <div class="progress"><i style="width:${Math.round(((S.step + 1) / STEPS.length) * 100)}%"></i></div>
    ${quizStep()}
    <p class="error" id="q-err" role="alert"></p>
    <div class="flow-nav"><div class="in">${S.step > 0 ? `<button class="btn btn--ghost" data-act="q-back">Назад</button>` : `<button class="btn btn--ghost" data-act="home">На главную</button>`}
    <button class="btn btn--primary" data-act="q-next">${S.step < STEPS.length - 1 ? "Дальше" : "Сочинить сказку"}</button></div></div>
  </div>`;
}

function generating(title: string, sub: string) {
  return `<div class="flow center"><div class="spinner"></div><h1>${title}</h1><p class="muted">${sub}</p><div class="progress" style="max-width:320px;margin-inline:auto"><i style="width:${progress}%"></i></div></div>`;
}

function screenText() {
  const t = S.text!;
  const ded = S.a.dedication ? dedicationText(Answers.parse(S.a)) : "";
  return `<div class="flow"><h1>${esc(t.title)}</h1>${ded ? `<p class="dedication">${esc(ded)}</p>` : ""}
    <p class="muted">Прочитайте сказку. Любой разворот можно поправить вручную — бесплатно. Имя склоняется автоматически.</p>
    ${t.spreads.map((s) => `<article class="spread"><header><span>Разворот ${s.index}</span><button class="link-btn" data-act="edit" data-key="${s.index}">Поправить</button></header>
      ${S.bookEdits[s.index] !== undefined ? `<textarea class="textarea" data-edit="${s.index}">${esc(S.bookEdits[s.index])}</textarea><div class="row"><button class="btn btn--primary btn--sm" data-act="edit-save" data-key="${s.index}">Сохранить</button></div>` : `<p>${esc(s.text)}</p>`}</article>`).join("")}
    <div class="flow-nav"><div class="in"><button class="btn btn--ghost" data-act="rewrite" ${S.rewrites <= 0 ? "disabled" : ""}>Переписать (${S.rewrites})</button><button class="btn btn--primary" data-act="approve">Всё нравится, дальше</button></div></div></div>`;
}

function screenConsent() {
  return `<div class="flow"><h1>Добавим фото?</h1><p>По фото иллюстрации получаются узнаваемыми. Без фото нарисуем по описанию.</p>
    <div class="panel"><p class="small">Перед загрузкой — два отдельных согласия. Фото используется только для иллюстраций, без идентификации личности, хранится в России и удаляется через 7 дней.</p>
      <label class="check"><input type="checkbox" id="c-pd" ${S.pdOk ? "checked" : ""}><span>Даю согласие на обработку персональных данных</span></label>
      <label class="check"><input type="checkbox" id="c-photo" ${S.photoOk ? "checked" : ""}><span>Даю согласие на обработку фото ребёнка как его законный представитель</span></label>
      <button class="btn btn--primary" data-act="consent">Перейти к загрузке фото</button><p class="error" id="c-err"></p></div>
    <p><button class="link-btn" data-act="no-photo">Без фото — нарисовать по описанию</button></p></div>`;
}

function screenPhoto() {
  return `<div class="flow"><h1>Фото героя</h1><p class="muted">Лицо крупно, хороший свет, без солнцезащитных очков и других людей в кадре. В демо фото не покидает ваш браузер.</p>
    ${photo ? `<div class="row"><img class="photo" src="${photo}" alt="Загруженное фото"><button class="link-btn" data-act="photo-del">Удалить</button></div>` : ""}
    ${!photo ? `<label class="drop"><input type="file" id="photo-file" accept="image/*" hidden><b>Выбрать фото</b><small class="muted">JPG, PNG или WebP</small></label>` : ""}
    ${photoHints.length ? `<ul class="small">${photoHints.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : photo ? `<p class="ok">Фото подходит.</p>` : ""}
    <div class="flow-nav"><div class="in"><button class="btn btn--ghost" data-act="back-consent">Назад</button><button class="btn btn--primary" data-act="to-login" ${photo ? "" : "disabled"}>Дальше</button></div></div></div>`;
}

function screenLogin() {
  if (S.user) {
    return `<div class="flow"><h1>Куда прислать превью?</h1><div class="panel"><p>Вы вошли как <b>${esc(S.user)}</b>.</p>
      <label class="check"><input type="checkbox" id="mk"><span>Хочу получать новости и скидки (согласие на рассылку). Отписка в один клик.</span></label>
      <button class="btn btn--primary" data-act="make-preview">Нарисовать превью</button><p class="error" id="l-err"></p></div></div>`;
  }
  return `<div class="flow"><h1>Куда прислать превью?</h1><p class="muted">Превью будет готово за 2–5 минут. Книга сохранится в личном кабинете.</p><div class="panel">
    ${!S.pendingCode ? `<label class="field"><span>Email или телефон</span><input class="input" id="l-email" value="${esc(S.pendingEmail)}" placeholder="anna@mail.ru"></label>
      <label class="check"><input type="checkbox" id="l-pd"><span>Даю согласие на обработку персональных данных и принимаю политику</span></label>
      <button class="btn btn--primary" data-act="otp">Получить код</button>`
    : `<label class="field"><span>Код из сообщения</span><input class="input" id="l-code" inputmode="numeric" maxlength="6"><small>Отправили на ${esc(S.pendingEmail)}</small></label>
      <p class="muted-panel small">Демо-режим: код — <b>${S.pendingCode}</b>. На сайте код приходит письмом или СМС.</p>
      <button class="btn btn--primary" data-act="verify">Войти</button>`}
    <p class="error" id="l-err"></p></div></div>`;
}

function spreadView(i: number, wm: boolean) {
  const s = S.text!.spreads[i - 1];
  return `<figure class="spread-view"><img src="${art(i, wm)}" alt="Разворот ${i}"><figcaption>${esc(S.bookEdits[i] ?? s.text)}</figcaption></figure>`;
}

function screenPreview() {
  return `<div class="flow"><h1>${esc(S.text!.title)}</h1>
    <div class="cover-wrap"><img class="cover-big" src="${art(0, true, false)}" alt="Обложка">${photo ? `<img class="ref" src="${photo}" alt="Фото-референс"><span class="ref-label">по этому фото</span>` : ""}</div>
    ${spreadView(1, true)}${spreadView(2, true)}
    <h2>Кто печатает книгу?</h2><div class="choice-cards">
      <button class="big-choice" data-act="who" data-key="self"><strong>Напечатаю сам</strong>PDF за ${rub(S.prices.pdf)}: для экрана, домашней печати на А4 и копицентра. Сразу после оплаты.</button>
      <button class="big-choice" data-act="who" data-key="bookimi"><strong>Напечатает БУКИМИ</strong>Книга 24 страницы в мягкой или твёрдой обложке, от ${rub(S.prices["mini-soft"])}. PDF — в подарок.</button>
    </div></div>`;
}

function screenCheckout() {
  const { q, promo, eta } = quoteNow();
  const co = S.co;
  const sizes = [["mini", "Мини 15×15 см", 50, 50], ["std", "Стандарт 21×21 см", 70, 70], ["album", "Альбом 28×21 см", 93, 70], ["big", "Большой 30×30 см", 100, 100]] as const;
  const av = addons().filter((a) => co.who === "bookimi" || !a.requiresPrint);
  const shown = co.showAll ? av : av.slice(0, 3);
  return `<div class="buy"><div>
    <h1>Кто печатает книгу?</h1>
    <div class="choice-cards"><button class="big-choice" data-act="who" data-key="self" aria-pressed="${co.who === "self"}"><strong>Напечатаю сам</strong>PDF — ${rub(S.prices.pdf)}, все форматы файла входят</button>
      <button class="big-choice" data-act="who" data-key="bookimi" aria-pressed="${co.who === "bookimi"}"><strong>Напечатает БУКИМИ</strong>Печатная книга, PDF в подарок</button></div>
    ${co.who === "self" ? `<div class="panel"><b>В PDF входят четыре файла</b><ul class="small"><li>Для экрана — чтение на телефоне и планшете</li><li>А4, домашняя печать — 2 страницы на листе</li><li>Копицентр 21×21 см — 300 dpi, вылеты 3 мм</li><li>Копицентр 15×15 см — мини-формат</li></ul></div>` : `
      <h2>Формат</h2><div class="formats">${sizes.map(([id, label, w, h]) => {
        const prices = formats().filter((f) => f.key.startsWith(id + "-")).map((f) => f.priceRub);
        return `<button class="format" data-act="size" data-key="${id}" aria-pressed="${co.size === id}"><span class="mock"><img src="${art(0, true, false)}" alt="" style="width:${w}px;height:${h}px"></span><b>${label}</b><span class="small muted">24 страницы · от ${rub(Math.min(...prices))}</span></button>`;
      }).join("")}</div>
      <span class="label">Обложка</span><div class="chips">${(["soft", "hard"] as const).map((c) => {
        const f = formats().find((x) => x.key === `${co.size}-${c}`);
        return `<button class="chip" data-act="cover" data-key="${c}" aria-pressed="${co.cover === c}" ${f ? "" : "disabled"}>${c === "soft" ? "Мягкая" : "Твёрдая (7БЦ)"} ${f ? `<small>${rub(f.priceRub)}</small>` : ""}</button>`;
      }).join("")}</div>`}
    <h2>Добавить к книге</h2><div class="choice-cards">${shown.map((a) => `<button class="choice" data-act="addon" data-key="${a.key}" aria-pressed="${co.addons.includes(a.key)}"><span><strong>${esc(a.title)}</strong><span>${a.percentOff ? `−${a.percentOff}% от цены книги` : `+${rub(a.priceRub ?? 0)}`}</span></span></button>`).join("")}</div>
    ${av.length > 3 ? `<button class="link-btn" data-act="addons-all">${co.showAll ? "Свернуть" : `Ещё ${av.length - 3}`}</button>` : ""}
    ${co.who === "bookimi" ? `<h2>Доставка</h2>${chips("method", [{ key: "cdek_pvz", label: "СДЭК — пункт выдачи" }, { key: "cdek_courier", label: "СДЭК — курьером" }, { key: "pochta", label: "Почта России" }, { key: "pickup", label: "Заберу сам в типографии" }], [co.method])}
      ${co.method === "pickup" ? `<p class="muted-panel small">Москва, ул. Типографская, 1 (демо-адрес). Дату готовности покажем в кабинете.</p>` : `<label class="field"><span>Город <span class="req">*</span></span><input class="input" id="co-city" value="${esc(co.city)}"></label>`}
      <div class="grid2"><label class="field"><span>Имя и фамилия <span class="req">*</span></span><input class="input" id="co-name" value="${esc(co.name)}"></label>
      <label class="field"><span>Телефон <span class="req">*</span></span><input class="input" id="co-phone" value="${esc(co.phone)}"></label></div>` : ""}
  </div>
  <aside class="summary panel"><h2>Ваш заказ</h2><table><tbody>
    ${q.lines.map((l) => `<tr><td>${esc(l.title)}</td><td>${rub(l.priceRub)}</td></tr>`).join("")}
    ${q.pdfCreditRub ? `<tr><td>Зачёт оплаченного PDF</td><td>−${rub(q.pdfCreditRub)}</td></tr>` : ""}
    ${q.discountRub ? `<tr><td>Скидка ${promo ? `(${promo.code})` : ""}</td><td>−${rub(q.discountRub)}</td></tr>` : ""}
    ${co.who === "bookimi" ? `<tr><td>Доставка${co.method !== "pickup" ? " (ориентир)" : ""}</td><td>${rub(q.shippingRub)}</td></tr>` : ""}
    <tr class="total"><td>Итого</td><td>${rub(q.totalRub)}</td></tr></tbody></table>
    ${eta ? `<p class="small">Изготовление — к ${ruDate(eta.ready)}.${co.method !== "pickup" ? ` Доставка — ориентировочно к <b>${ruDate(eta.eta)}</b>.` : ""}</p>` : ""}
    <label class="field"><span>Промокод</span><input class="input" id="co-promo" value="${esc(co.promo)}" placeholder="Попробуйте SKAZKA10"></label>
    ${co.promo && !promo ? `<small class="error">Промокод не подошёл</small>` : ""}
    ${q.errors.map((e) => `<p class="error">${esc(e)}</p>`).join("")}
    <button class="btn btn--primary btn--block" data-act="checkout" ${q.errors.length ? "disabled" : ""}>Перейти к оплате</button>
    <p class="error" id="co-err"></p>
    <p class="small muted">Книга делается для вашего ребёнка, поэтому возврат — только при браке: перепечатаем или вернём деньги.</p>
  </aside></div>`;
}

const FLOW = [["PAID", "Оплачен"], ["IN_PRINT", "В печати"], ["PACKED", "Упакован"], ["SHIPPED", "Передан в доставку"], ["DELIVERED", "Доставлен"]] as const;

function orderSummary(o: Order) {
  return `<div class="panel"><p class="small muted">Заказ ${o.code}</p><table class="tbl"><tbody>${o.lines.map((l) => `<tr><td>${esc(l.title)}</td><td class="num">${rub(l.priceRub)}</td></tr>`).join("")}
    ${o.credit ? `<tr><td>Зачёт PDF</td><td class="num">−${rub(o.credit)}</td></tr>` : ""}${o.discount ? `<tr><td>Скидка</td><td class="num">−${rub(o.discount)}</td></tr>` : ""}
    ${o.who === "bookimi" ? `<tr><td>Доставка</td><td class="num">${rub(o.shipping)}</td></tr>` : ""}<tr><td><b>Итого</b></td><td class="num"><b>${rub(o.total)}</b></td></tr></tbody></table></div>`;
}

function screenOrder() {
  const o = S.orders.find((x) => x.id === S.currentOrder)!;
  if (o.status === "PENDING_PAYMENT") {
    return `<div class="flow"><h1>Оплата заказа</h1>${orderSummary(o)}
      ${!o.method ? `<div class="panel"><h2>Как удобнее оплатить?</h2><div class="choice-cards">
        <button class="big-choice" data-act="pay" data-key="sbp_qr"><strong>СБП по QR-коду</strong>Оплата в приложении банка за минуту, чек — автоматически</button>
        <button class="big-choice" data-act="pay" data-key="transfer"><strong>Перевод по номеру телефона</strong>Подтверждаем вручную, обычно до 2 часов</button></div></div>`
      : o.method === "sbp_qr" ? `<div class="panel"><h2>Оплата по QR-коду через СБП</h2><p>Отсканируйте код в приложении банка. Сумма — ${rub(o.total)}.</p><div class="qr">${qrSvg}</div>
        <p class="center"><button class="btn btn--gold" data-act="demo-pay">Оплатить (демо)</button></p></div>`
      : `<div class="panel"><h2>Перевод по реквизитам</h2><table class="tbl"><tbody><tr><td>По номеру телефона (СБП)</td><td><b>+7 900 000-00-00</b></td></tr><tr><td>Сумма</td><td><b>${rub(o.total)}</b></td></tr><tr><td>Комментарий к переводу</td><td><b>${o.code}</b></td></tr></tbody></table>
        <p class="small">Укажите код заказа в комментарии — так мы быстро найдём перевод.</p><button class="btn btn--primary" data-act="claim">Я оплатил(а)</button></div>`}</div>`;
  }
  if (o.status === "AWAITING_CONFIRMATION") {
    return `<div class="flow"><h1>Проверяем перевод</h1>${orderSummary(o)}<div class="panel"><p>Как только деньги поступят, подтвердим оплату и начнём делать книгу. Обычно до 2 часов в рабочее время.</p>
      <p class="muted-panel small">В демо подтвердите перевод сами: <button class="link-btn" data-act="to-admin">откройте админку → Переводы</button>.</p></div></div>`;
  }
  const idx = FLOW.findIndex(([k]) => k === o.status);
  return `<div class="flow"><h1>Спасибо за заказ!</h1>${orderSummary(o)}<div class="panel">
    ${o.who === "bookimi" ? `<ol class="timeline">${FLOW.map(([k, l], i) => `<li class="${i <= idx ? "done" : ""}">${l}</li>`).join("")}</ol>
      <p>Дата готовности: <b>${o.ready}</b> · доставка ориентировочно к <b>${o.eta}</b></p>${o.track ? `<p>Трек-номер: <b>${esc(o.track)}</b></p>` : ""}` : `<p>PDF во всех форматах — в личном кабинете.</p>`}
    ${o.receipt ? `<p class="small">Чек «Мой налог»: сформирован (в демо — образец).</p>` : ""}
    <button class="btn btn--primary" data-act="to-book">Открыть книгу в кабинете</button></div></div>`;
}

function screenBook() {
  const o = S.orders.find((x) => x.id === S.currentOrder);
  return `<div class="flow"><h1>${esc(S.text!.title)}</h1>
    <div class="panel"><b>Файлы</b><div class="row" style="margin-top:8px">${["PDF для экрана", "PDF для домашней печати (А4)", "PDF для копицентра 21×21", "PDF для копицентра 15×15"].map((t) => `<button class="btn btn--ghost btn--sm" data-act="pdf-note">${t}</button>`).join("")}</div>
      ${o?.lines.some((l) => /Аудио/.test(l.title)) ? `<p class="small">Аудиокнига: на сайте — MP3 голосом диктора в плеере.</p>` : ""}
      <div class="row" style="margin-top:8px"><button class="btn btn--primary btn--sm" data-act="reprint">Заказать печать (PDF зачтём)</button></div></div>
    <h2>Читалка</h2><p class="small muted">Текст можно править бесплатно. Перерисовать иллюстрацию бесплатно — ещё ${S.redraws} раз(а).</p>
    <div class="reader"><figure class="spread-view"><img src="${art(0, false, false)}" alt="Обложка"></figure>
    ${S.text!.spreads.map((s) => `${spreadView(s.index, false).replace("</figure>", `<div class="row small"><button class="link-btn" data-act="redraw" data-key="${s.index}" ${S.redraws <= 0 ? "disabled" : ""}>Перерисовать</button></div></figure>`)}`).join("")}</div></div>`;
}

function screenAdmin() {
  const paid = S.orders.filter((o) => !["PENDING_PAYMENT", "AWAITING_CONFIRMATION"].includes(o.status));
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const transfers = S.orders.filter((o) => o.status === "AWAITING_CONFIRMATION");
  const checklist = [
    ["Реквизиты продавца (ФИО, ИНН)", true, ""], ["Способ оплаты (СБП-QR или перевод)", true, ""], ["Приём фото включён", true, ""],
    ["ИИ-провайдеры подключены", false, "Работает демо-генерация"], ["Типография: email или API", true, ""], ["Ключи СДЭК", false, "Доставка считается по тарифам из настроек"],
    ["Почта для писем (SMTP)", false, "Письма пишутся в журнал"],
  ] as const;
  return `<div class="admin">
    <h1>Админка</h1><p class="muted">Здесь видно всё, что вы сделали как покупатель в этом окне.</p>
    <section class="panel"><h2>Готовность к продажам</h2><ul class="checklist">${checklist.map(([l, ok, d]) => `<li class="${ok ? "is-ok" : ""}"><span class="dot"></span><span><b>${l}</b>${ok ? "" : ` — <span class="muted">${d}</span>`}</span></li>`).join("")}</ul></section>
    <div class="kpis"><div class="kpi"><small>Выручка</small><b>${rub(revenue)}</b></div><div class="kpi"><small>Заказы</small><b>${paid.length}</b></div>
      <div class="kpi"><small>Средний чек</small><b>${rub(paid.length ? Math.round(revenue / paid.length) : 0)}</b></div><div class="kpi"><small>Переводы на проверке</small><b>${transfers.length}</b></div>
      <div class="kpi"><small>Лимит НПД</small><b>${((revenue / 2_400_000) * 100).toFixed(2)}%</b><small>${rub(revenue)} из 2 400 000 ₽</small></div>
      <div class="kpi"><small>Генерация сегодня</small><b>${rub(S.spent)}</b><small>из ${rub(S.dailyLimit)}</small></div></div>
    <section class="panel"><h2>Заказы</h2>${S.orders.length === 0 ? `<p class="muted">Заказов пока нет — оформите книгу во вкладке «Покупатель».</p>` : `
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Заказ</th><th>Кто печатает</th><th>Сумма</th><th>Статус</th><th>Действие</th></tr></thead><tbody>
      ${S.orders.map((o) => `<tr><td><b>${o.code}</b><br><small class="muted">${esc(o.contact)}</small></td><td>${o.who === "self" ? "PDF" : "БУКИМИ"}</td><td class="num">${rub(o.total)}</td>
        <td><span class="badge ${o.status === "AWAITING_CONFIRMATION" ? "badge--gold" : ""}">${({ PENDING_PAYMENT: "ждёт оплаты", AWAITING_CONFIRMATION: "перевод: проверить", PAID: "оплачен", IN_PRINT: "в печати", PACKED: "упакован", SHIPPED: "передан в доставку", DELIVERED: "доставлен" } as Record<string, string>)[o.status]}</span>${o.track ? `<br><small>трек ${esc(o.track)}</small>` : ""}</td>
        <td>${o.status === "AWAITING_CONFIRMATION" ? `<button class="btn btn--primary btn--sm" data-act="confirm" data-key="${o.id}">Деньги пришли</button>`
          : o.who === "bookimi" && !["PENDING_PAYMENT", "DELIVERED"].includes(o.status) ? `<div class="row"><input class="input input--sm" id="track-${o.id}" placeholder="трек" value="${esc(o.track ?? "")}"><button class="btn btn--ghost btn--sm" data-act="advance" data-key="${o.id}">Следующий статус</button></div>` : "—"}</td></tr>`).join("")}
      </tbody></table></div>`}</section>
    <section class="panel"><h2>Цены и лимиты</h2><p class="small muted">Измените цену — она сразу применится при оформлении.</p>
      <div class="grid3">${FORMATS.map((f) => `<label class="field"><span>${esc(f.title)}</span><input class="input" type="number" min="0" data-price="${f.key}" value="${S.prices[f.key]}"></label>`).join("")}
      <label class="field"><span>Лимит расходов на генерацию в сутки, ₽</span><input class="input" type="number" id="lim" value="${S.dailyLimit}"></label></div>
      <button class="btn btn--primary btn--sm" data-act="save-prices">Сохранить</button></section>
    <section class="panel"><h2>Промокоды</h2><div class="row">${S.promos.map((p) => `<span class="badge">${esc(p.code)} −${p.pct}%</span>`).join("")}</div>
      <div class="row" style="margin-top:10px"><input class="input input--sm" id="pc-code" placeholder="КОД"><input class="input input--sm" id="pc-pct" type="number" placeholder="%"><button class="btn btn--ghost btn--sm" data-act="add-promo">Создать</button></div></section>
    <section class="panel"><h2>Журнал</h2>${S.log.length ? `<ul class="small log">${S.log.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="muted small">Пока пусто.</p>`}</section>
  </div>`;
}

// ───────── рендер ─────────
function render() {
  const customer = S.screen !== "admin";
  const body =
    S.screen === "home" ? screenHome()
    : S.screen === "quiz" ? screenQuiz()
    : S.screen === "gen-text" ? generating("Сочиняем сказку", "Обычно это занимает меньше минуты.")
    : S.screen === "text" ? screenText()
    : S.screen === "consent" ? screenConsent()
    : S.screen === "photo" ? screenPhoto()
    : S.screen === "login" ? screenLogin()
    : S.screen === "gen-preview" ? generating("Рисуем обложку и первые развороты", "На сайте — 2–5 минут. Можно закрыть страницу: пришлём ссылку.")
    : S.screen === "preview" ? screenPreview()
    : S.screen === "checkout" ? screenCheckout()
    : S.screen === "order" ? screenOrder()
    : S.screen === "gen-full" ? generating("Рисуем всю книгу", "Остальные развороты, PDF во всех форматах, аудио.")
    : S.screen === "book" ? screenBook()
    : screenAdmin();
  $("#app").innerHTML = `
    <div class="demo-bar"><div class="wrap">Демо-стенд: всё работает прямо здесь. Оплата понарошку, фото не покидает браузер, письма не отправляются.</div></div>
    <header class="top"><div class="wrap top__in"><button class="logo" data-act="home">букими<span>.</span></button>
      <nav class="tabs"><button data-act="home" aria-pressed="${customer}">Покупатель</button><button data-act="to-admin" aria-pressed="${!customer}">Админка</button></nav>
      </div></header>
    <main class="wrap main">${body}<p class="reset"><button class="link-btn" data-act="reset">Начать демо сначала</button></p></main>
    ${toast ? `<div class="toast" role="status">${esc(toast)}</div>` : ""}`;
  const err = sessionStorage.getItem("err");
  if (err) {
    const el = document.querySelector(".error[id]") as HTMLElement | null;
    if (el) el.textContent = err;
    sessionStorage.removeItem("err");
  }
}

function showError(id: string, msg: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function runProgress(next: () => void, ms: number) {
  progress = 5;
  render();
  const t0 = Date.now();
  const timer = setInterval(() => {
    progress = Math.min(100, Math.round(((Date.now() - t0) / ms) * 100));
    const bar = document.querySelector(".progress i") as HTMLElement | null;
    if (bar) bar.style.width = progress + "%";
    if (progress >= 100) { clearInterval(timer); next(); }
  }, 120);
}

// ───────── действия ─────────
document.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
  if (!el) return;
  const act = el.dataset.act!;
  const key = el.dataset.key ?? "";
  if (S.screen === "quiz") readQuizInputs();
  const a = S.a;
  switch (act) {
    case "home": return go("home");
    case "to-admin": return go("admin");
    case "reset":
      try { localStorage.removeItem(KEY); } catch {}
      S = blank(); S.a.hero = { name: "", nickname: "", gender: undefined, ageGroup: undefined, birthDate: "" }; photo = null; photoHints = []; return go("home");
    case "start":
    case "start-story": {
      const n = (document.getElementById("home-name") as HTMLInputElement | null)?.value;
      if (n) a.hero.name = n;
      if (key) a.story.slug = key;
      S.step = 0;
      return go("quiz");
    }
    case "chip": {
      const g = el.dataset.group!;
      if (g === "gender") a.hero.gender = key as "boy";
      else if (g === "age") a.hero.ageGroup = key as "4-5";
      else if (g === "hair") a.appearance.hair = a.appearance.hair === key ? "" : key;
      else if (g === "hairstyle") a.appearance.hairstyle = a.appearance.hairstyle === key ? "" : key;
      else if (g === "clothes") a.appearance.clothes = a.appearance.clothes === key ? "" : key;
      else if (g === "flags") (a.appearance as Record<string, unknown>)[key] = !(a.appearance as Record<string, unknown>)[key];
      else if (g === "interests") a.interests = a.interests.includes(key) ? a.interests.filter((x) => x !== key) : a.interests.length < 3 ? [...a.interests, key] : a.interests;
      else if (g === "occasion") a.occasion = { key, custom: a.occasion.custom };
      else if (g.startsWith("role-")) a.extras[Number(g.slice(5))].role = key;
      else if (g === "method") S.co.method = key;
      save();
      return render();
    }
    case "story": a.story = { slug: key, idea: "" }; save(); return render();
    case "style": a.style = key; save(); return render();
    case "dedication": a.dedication = key; save(); return render();
    case "extra-add": a.extras.push({ role: "pet", name: "", description: "" }); return render();
    case "extra-del": a.extras.splice(Number(key), 1); return render();
    case "q-back": S.step--; return go("quiz");
    case "q-next": {
      const er = quizError();
      if (er) return showError("q-err", er);
      if (S.step < STEPS.length - 1) { S.step++; return go("quiz"); }
      if (S.textsToday >= 3) return showError("q-err", "Сегодня можно сочинить не больше 3 сказок. Возвращайтесь завтра — черновик сохранится.");
      S.textsToday++;
      S.screen = "gen-text";
      return runProgress(async () => { await writeStory(0); S.rewrites = 2; S.bookEdits = {}; log(`сказка сочинена для «${a.hero.name}»`); go("text"); }, 1400);
    }
    case "rewrite":
      if (S.rewrites <= 0) return;
      S.rewrites--; S.screen = "gen-text";
      return runProgress(async () => { await writeStory(2 - S.rewrites); S.bookEdits = {}; go("text"); }, 1000);
    case "edit": S.bookEdits[Number(key)] = S.bookEdits[Number(key)] ?? S.text!.spreads[Number(key) - 1].text; return render();
    case "edit-save": {
      const t = (document.querySelector(`[data-edit="${key}"]`) as HTMLTextAreaElement).value.trim();
      if (t) S.text!.spreads[Number(key) - 1].text = t;
      delete S.bookEdits[Number(key)];
      save();
      return flash("Правка сохранена");
    }
    case "approve": return go("consent");
    case "consent": {
      S.pdOk = (document.getElementById("c-pd") as HTMLInputElement).checked;
      S.photoOk = (document.getElementById("c-photo") as HTMLInputElement).checked;
      if (!S.pdOk || !S.photoOk) return showError("c-err", "Отметьте оба согласия — без них фото загружать нельзя.");
      log("получены согласия: ПДн и фото ребёнка");
      return go("photo");
    }
    case "no-photo": photo = null; return go("login");
    case "back-consent": return go("consent");
    case "photo-del": photo = null; photoHints = []; return render();
    case "to-login": return go("login");
    case "otp": {
      const email = (document.getElementById("l-email") as HTMLInputElement).value.trim();
      const pd = (document.getElementById("l-pd") as HTMLInputElement).checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && !/^\+?\d[\d\s()-]{9,}$/.test(email)) return showError("l-err", "Проверьте email или телефон");
      if (!pd) return showError("l-err", "Нужно согласие на обработку персональных данных");
      S.pendingEmail = email;
      S.pendingCode = String(Math.floor(100000 + Math.random() * 899999));
      return render();
    }
    case "verify": {
      const code = (document.getElementById("l-code") as HTMLInputElement).value.trim();
      if (code !== S.pendingCode) return showError("l-err", "Неверный код");
      S.user = S.pendingEmail; S.pendingCode = null;
      log(`вход по коду: ${S.user}`);
      save();
      return render();
    }
    case "make-preview": {
      if (S.previewsToday >= 1) return showError("l-err", "Сегодня превью уже было. Новое можно сделать завтра — или оформите эту книгу без ожидания.");
      if (S.spent >= S.dailyLimit) return showError("l-err", "Сейчас много заказов — превью встало в очередь. Пришлём ссылку.");
      S.previewsToday++;
      S.spent += 20;
      S.screen = "gen-preview";
      return runProgress(() => { log("превью готово: обложка + 2 разворота"); go("preview"); }, 2600);
    }
    case "who": S.co.who = key as "self"; return go("checkout");
    case "size": S.co.size = key; if (!formats().some((f) => f.key === `${key}-${S.co.cover}`)) S.co.cover = "hard"; save(); return render();
    case "cover": S.co.cover = key as "soft"; save(); return render();
    case "addon": S.co.addons = S.co.addons.includes(key) ? S.co.addons.filter((x) => x !== key) : [...S.co.addons, key]; save(); return render();
    case "addons-all": S.co.showAll = !S.co.showAll; return render();
    case "checkout": {
      const { q, eta } = quoteNow();
      if (S.co.who === "bookimi") {
        if (S.co.method !== "pickup" && !S.co.city.trim()) return showError("co-err", "Укажите город");
        if (!S.co.name.trim() || !S.co.phone.trim()) return showError("co-err", "Укажите имя и телефон получателя");
      }
      const o: Order = {
        id: crypto.randomUUID(),
        code: "BK-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        who: S.co.who,
        lines: q.lines.map((l) => ({ title: l.title, priceRub: l.priceRub })),
        total: q.totalRub, discount: q.discountRub, shipping: q.shippingRub, credit: q.pdfCreditRub,
        status: "PENDING_PAYMENT", createdAt: Date.now(),
        ready: eta ? ruDate(eta.ready) : undefined, eta: eta ? ruDate(eta.eta) : undefined,
        contact: S.co.name || S.user || "",
      };
      S.orders.unshift(o);
      S.currentOrder = o.id;
      log(`заказ ${o.code} оформлен на ${rub(o.total)}`);
      return go("order");
    }
    case "pay": {
      const o = S.orders.find((x) => x.id === S.currentOrder)!;
      o.method = key;
      if (key === "sbp_qr") qrSvg = await QRCode.toString(`DEMO-SBP:${o.code}:${o.total}`, { type: "svg", margin: 1, width: 220 });
      save();
      return render();
    }
    case "demo-pay": return paid(S.currentOrder!);
    case "claim": {
      const o = S.orders.find((x) => x.id === S.currentOrder)!;
      o.status = "AWAITING_CONFIRMATION";
      log(`${o.code}: покупатель нажал «Я оплатил(а)»`);
      save();
      return render();
    }
    case "confirm": { log("оператор подтвердил перевод"); paid(key, true); return; }
    case "advance": {
      const o = S.orders.find((x) => x.id === key)!;
      const tr = (document.getElementById(`track-${key}`) as HTMLInputElement | null)?.value.trim();
      const i = FLOW.findIndex(([k]) => k === o.status);
      const next = FLOW[Math.min(FLOW.length - 1, i + 1)][0];
      if (next === "SHIPPED" && !tr) return flash("Укажите трек-номер перед передачей в доставку");
      o.status = next as Order["status"];
      if (tr) o.track = tr;
      log(`${o.code}: статус — ${FLOW.find(([k]) => k === next)![1].toLowerCase()}`);
      save();
      return render();
    }
    case "to-book": return go("book");
    case "redraw": if (S.redraws > 0) { S.redraws--; S.variants[Number(key)] = (S.variants[Number(key)] ?? 0) + 1; save(); flash("Иллюстрация перерисована"); } return;
    case "reprint": S.co.who = "bookimi"; return go("checkout");
    case "pdf-note": return flash("На сайте файл скачивается сразу. В демо PDF не собирается — он делается на сервере.");
    case "save-prices": {
      document.querySelectorAll<HTMLInputElement>("[data-price]").forEach((i) => (S.prices[i.dataset.price!] = Math.max(0, Number(i.value) || 0)));
      S.dailyLimit = Number((document.getElementById("lim") as HTMLInputElement).value) || 3000;
      log("цены и лимиты изменены");
      save();
      return flash("Сохранено: новые цены уже в оформлении");
    }
    case "add-promo": {
      const code = (document.getElementById("pc-code") as HTMLInputElement).value.trim().toUpperCase();
      const pct = Number((document.getElementById("pc-pct") as HTMLInputElement).value);
      if (!code || !(pct > 0 && pct < 100)) return flash("Укажите код и скидку от 1 до 99%");
      S.promos.push({ code, pct });
      log(`промокод ${code} −${pct}%`);
      save();
      return render();
    }
  }
});

function paid(id: string, byOperator = false) {
  const o = S.orders.find((x) => x.id === id)!;
  o.status = "PAID";
  o.receipt = true;
  log(`${o.code}: оплачено ${rub(o.total)}, чек НПД сформирован`);
  S.paidFull = true;
  S.spent += 60;
  if (byOperator) { save(); return render(); }
  S.screen = "gen-full";
  runProgress(() => {
    if (o.who === "bookimi") { o.status = "IN_PRINT"; log(`${o.code}: файлы отправлены в типографию`); }
    go("order");
  }, 2400);
}

document.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === "home-name") {
    S.a.hero.name = t.value.replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "").slice(0, 20);
    document.querySelectorAll(".cover__name").forEach((n) => (n.textContent = S.a.hero.name ?? ""));
    save();
  }
  if (t.id === "co-city") S.co.city = t.value;
  if (t.id === "co-name") S.co.name = t.value;
  if (t.id === "co-phone") S.co.phone = t.value;
  if (t.id === "co-promo") { S.co.promo = t.value.toUpperCase(); }
  if (t.id.startsWith("co-")) save();
});
document.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === "co-promo") render();
  if (t.id === "photo-file" && t.files?.[0]) {
    const f = t.files[0];
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Проверка качества, как на сайте: размер и яркость
        photoHints = [];
        const min = Math.min(img.width, img.height);
        if (min < 500) photoHints.push("Фото маленькое — нужно хотя бы 500 пикселей по короткой стороне.");
        else if (min < 900) photoHints.push("Фото небольшое — лучше снять ближе.");
        const c = document.createElement("canvas");
        c.width = 64; c.height = 64;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 64, 64);
        const d = ctx.getImageData(0, 0, 64, 64).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (sum / (d.length / 4) < 60) photoHints.push("Темновато — встаньте лицом к окну.");
        const s = document.createElement("canvas");
        const k = Math.min(1, 600 / Math.max(img.width, img.height));
        s.width = img.width * k; s.height = img.height * k;
        s.getContext("2d")!.drawImage(img, 0, 0, s.width, s.height);
        photo = s.toDataURL("image/jpeg", 0.85);
        log("загружено фото героя (в демо — только в браузере)");
        render();
      };
      img.src = r.result as string;
    };
    r.readAsDataURL(f);
  }
});

if (S.screen === "order" && S.currentOrder) {
  const o = S.orders.find((x) => x.id === S.currentOrder);
  if (o?.method === "sbp_qr") QRCode.toString(`DEMO-SBP:${o.code}:${o.total}`, { type: "svg", margin: 1, width: 220 }).then((s) => { qrSvg = s; render(); });
}
if (["text", "preview", "book", "order", "checkout"].includes(S.screen) && !S.text) S.screen = "home";
render();
