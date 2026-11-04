// Проверка вёрстки на разных экранах (rev 18): npm run check:responsive
//
// Проходит демо-стенд (tools/demo/out/bookimi-demo.html — настоящие страницы и компоненты сайта) на телефонах,
// планшете, ноутбуках, большом мониторе и при масштабе 125 %: главная, каталог с чипсами возраста, аудитория, повод,
// праздники, страница книги, вся анкета (возраст → пол картинками → 6 героев → ряды внешности → спутники → повод →
// книга → стиль и настроение), превью книги (обложка, приветствие, фото и посвящение, развороты с текстом на картинке,
// кнопки правок, «Одна страница / Разворот»), вход по коду, оформление с окном допа, кабинет, админка.
// На каждом шаге ищет: горизонтальную прокрутку страницы, элементы за краем экрана, поля и кнопки под липкими панелями,
// наложения в шапке и панелях, мелкий текст и маленькие кнопки на телефоне, текст за пределами кнопок и страниц книги,
// разворот превью, который не помещается по высоте на ноутбуке, ряды картинок (вбок на телефоне, переносом на ноутбуке),
// положение живой обложки, окно допа за краем. Ошибки — код выхода 1.
//
//   node tools/responsive-check.mjs                    все экраны
//   node tools/responsive-check.mjs --only 375x812,1366x768
//   node tools/responsive-check.mjs --shots <папка>    + снимки каждого шага (<папка>/<экран>/NN-шаг.png)
//   node tools/responsive-check.mjs --build            сначала собрать демо
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = join(root, "tools/demo/out/bookimi-demo.html");
const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const SHOTS = opt("--shots");
const ONLY = opt("--only")?.split(",");
const PAR = Number(opt("--par") ?? 4);

export const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, phone: true },
  { name: "375x812", width: 375, height: 812, phone: true },
  { name: "390x844", width: 390, height: 844, phone: true },
  { name: "414x896", width: 414, height: 896, phone: true },
  { name: "768x1024", width: 768, height: 1024, tablet: true },
  { name: "1024x768", width: 1024, height: 768, tablet: true, fit: true },
  { name: "1280x720", width: 1280, height: 720, fit: true },
  { name: "1366x768", width: 1366, height: 768, fit: true },
  { name: "1440x900", width: 1440, height: 900, fit: true },
  { name: "1920x1080", width: 1920, height: 1080, fit: true },
  { name: "2560x1440", width: 2560, height: 1440, fit: true },
  // Браузерный масштаб 125 % на ноутбуке 1366×768: CSS-окно 1093×614 при плотности 1.25
  { name: "1366x768@125", width: 1093, height: 614, scale: 1.25, fit: true },
];

/** Playwright: глобальный пакет `playwright` или `playwright-core` проекта с установленным Chromium. */
function loadChromium() {
  const req = createRequire(import.meta.url);
  try {
    return { chromium: req("playwright").chromium, exe: undefined };
  } catch {}
  const { chromium } = req("playwright-core");
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  let exe;
  if (existsSync(base))
    for (const d of readdirSync(base).sort().reverse()) {
      const p = join(base, d, "chrome-linux64/chrome");
      if (d.startsWith("chromium-") && existsSync(p)) { exe = p; break; }
    }
  return { chromium, exe };
}

// ───────── проверки в странице ─────────
/* Выполняется в браузере. Возвращает список проблем этого шага. */
function inPageChecks(o) {
  const W = innerWidth, H = innerHeight;
  const out = [];
  const add = (kind, msg) => out.push({ kind, msg });
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const shut = el.closest("details:not([open])");
    if (shut && !el.closest("summary") && el !== shut) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const name = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    const c = [...el.classList].slice(0, 2).join(".");
    if (c) s += "." + c;
    const dk = [...el.attributes].find((a) => a.name.startsWith("data-") && a.name !== "data-k");
    if (dk) s += `[${dk.name}${dk.value && dk.value.length < 20 ? "=" + dk.value : ""}]`;
    const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return t ? `${s} «${t}»` : s;
  };
  // Предок, который сам прокручивается/обрезает по горизонтали — элемент за его краем не выходит за экран
  const clipped = (el) => {
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX) || s.position === "fixed") return e;
    }
    return null;
  };

  // 1. Горизонтальная прокрутка страницы
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > W + 1) add("overflow-x", `страница шире экрана: ${sw} > ${W}`);

  // 2. Элементы за краем экрана (без тех, что внутри прокручиваемых рядов)
  const all = [...document.querySelectorAll("body *")].filter((e) => !(e instanceof SVGElement && e.ownerSVGElement));
  let n = 0;
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right <= W + 1 && r.left >= -1) continue;
    if (clipped(el)) continue;
    if (!vis(el)) continue;
    if (getComputedStyle(el).position === "fixed" && el.closest(".sparkle")) continue;
    if (n++ < 4) add("off-screen", `${name(el)} за краем: ${Math.round(r.left)}…${Math.round(r.right)} при ширине ${W}`);
  }

  // 3. Текст вылезает из кнопки, чипса, карточки
  for (const el of document.querySelectorAll(".btn, .chip, .pic, .style-card, .mood, .age-card, .demo-limits, .demo-tabs a, .bk__views button, .nav a, .tabs a, .dedication-chip, .choice, .big-choice")) {
    if (!vis(el)) continue;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== "auto") add("text-cut", `${name(el)}: текст шире кнопки (${el.scrollWidth} > ${el.clientWidth})`);
  }

  // 4. Наложения внутри шапки, полосы демо, панели книги, нижней панели анкеты
  for (const sel of [".header__in", ".demo-bar__in", ".bk__bar", ".flow-nav .in", ".admin-top .wrap", ".hol__head"]) {
    for (const box of document.querySelectorAll(sel)) {
      const kids = [...box.children].filter(vis).map((k) => [k, k.getBoundingClientRect()]);
      for (let i = 0; i < kids.length; i++)
        for (let j = i + 1; j < kids.length; j++) {
          const [a, ra] = kids[i], [b, rb] = kids[j];
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 2 && oy > 2) add("overlap", `${sel}: ${name(a)} наезжает на ${name(b)}`);
        }
    }
  }

  // 5. Телефон: мелкий текст и маленькие кнопки
  if (o.phone) {
    const SMALL_OK = ".eyebrow, .home-hero__eyebrow, .bk-page, .bk-cover, .cover, .bookshelf, .badge, .soon-badge, .pic__cap, .steps-dots, .scene-dots, .flow-legal, .demo-rev, .chart, svg, .hhero__tag, .bk-sketch, .addon-thumb, .facecover, .spine, .quiz__preview, .kpi small, .tbl th, .footer__age, .sp-cap, .bk__where, .hol__date, .addon-card__zoom";
    let tiny = 0;
    for (const el of all) {
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
      if (!own || !vis(el) || el.closest(SMALL_OK)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      // Основной текст (абзацы, пункты, подписи полей) — от 14 px; служебные подписи — не меньше 12 px
      const body = /^(P|LI|TD|DD|LABEL|BLOCKQUOTE)$/.test(el.tagName) && !el.closest(".small, small, .muted.small, .hint, .names-hint");
      if (fs < 12 || (body && fs < 14)) {
        if (tiny++ < 4) add("tiny-text", `${name(el)}: ${fs}px`);
      }
    }
    let smallTap = 0;
    const taps = document.querySelectorAll("main button, main a.btn, main a.chip, main .chip, main [role=radio], main [role=tab], main select, main input:not([type=checkbox]):not([type=radio]):not([type=file]):not([hidden]), main textarea, main summary, .flow-nav button, .burger summary, .header a, .header__cab, .tabs a, .side a");
    for (const el of taps) {
      if (!vis(el) || el.closest(".bk-page, [data-full-book], .tbl, .bk-variants")) continue;
      const r = el.getBoundingClientRect();
      const inline = el.tagName === "A" && !el.className && getComputedStyle(el).display === "inline";
      if (inline || el.classList.contains("link-btn")) continue;
      // Маленькие подписи-ссылки в шапке (логотип крупный) пропускаем по высоте строки
      if (r.height < 40 || r.width < 40) {
        if (smallTap++ < 5) add("tap-target", `${name(el)}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
  }

  // 6. Картинки не растягивают колонку
  for (const img of document.querySelectorAll("main img")) {
    if (!vis(img) || clipped(img)) continue;
    const p = img.parentElement.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    if (r.width > p.width + 2 && !img.classList.contains("bk-art")) add("img-scale", `${name(img)} шире родителя: ${Math.round(r.width)} > ${Math.round(p.width)}`);
  }

  // 7. Текст на картинке разворота не выходит за страницу
  for (const t of document.querySelectorAll(".bk-text, .bk-welcome__title, .bk-ded__text, .bk-final__text, .bk-cover__title")) {
    if (!vis(t)) continue;
    const pg = t.closest(".bk-page, .bk-cover").getBoundingClientRect();
    const r = t.getBoundingClientRect();
    const inner = [...t.querySelectorAll("*")].concat(t).map((e) => e.getBoundingClientRect()).filter((x) => x.height > 0);
    const bottom = Math.max(...inner.map((x) => x.bottom), r.top + t.scrollHeight);
    if (bottom > pg.bottom + 1 || r.right > pg.right + 1 || t.scrollWidth > t.clientWidth + 2) add("book-text", `${name(t)}: текст за краем страницы книги (низ ${Math.round(bottom - pg.top)} из ${Math.round(pg.height)})`);
  }
  for (const pg of document.querySelectorAll(".bk-page--paper")) {
    if (!vis(pg)) continue;
    if (pg.scrollHeight > pg.clientHeight + 2) add("book-text", `${name(pg)}: содержимое не помещается в страницу (${pg.scrollHeight} > ${pg.clientHeight})`);
  }
  return out;
}

/* Поля и кнопки под липкими панелями: фокус на поле (браузер сам прокручивает к нему) → поле видно. */
function focusChecks() {
  const out = [];
  const els = [...document.querySelectorAll("main input:not([type=hidden]):not([hidden]):not([type=file]), main textarea, main select, main .btn, main [role=radio]")].filter((e) => {
    const r = e.getBoundingClientRect();
    const shut = e.closest("details:not([open])");
    return r.width > 4 && r.height > 4 && !(shut && !e.closest("summary")) && !e.closest("[hidden], .flow-nav, .sticky-cta, .cookie, .bk-page, .pic-row, .styles");
  });
  // Не больше 40 элементов: первые и последние на странице
  const pick = els.length > 40 ? [...els.slice(0, 20), ...els.slice(-20)] : els;
  for (const el of pick) {
    window.scrollTo(0, 0);
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    const cx = Math.min(innerWidth - 2, Math.max(1, r.left + Math.min(r.width / 2, 40)));
    for (const y of [r.top + Math.min(r.height / 2, 12), r.bottom - Math.min(r.height / 2, 6)]) {
      if (y < 0 || y > innerHeight) continue;
      const hit = document.elementFromPoint(cx, y);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
        const cover = hit.closest(".flow-nav, .sticky-cta, .header, .cookie, .demo-bar, .toast, .promo");
        if (cover) {
          const t = (el.getAttribute("name") || el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30);
          out.push({ kind: "covered", msg: `«${t}» при прокрутке к нему закрыт панелью ${cover.className.split(" ")[0]}` });
          break;
        }
      }
    }
  }
  window.scrollTo(0, 0);
  return out.slice(0, 6);
}

// ───────── проход по сайту ─────────
async function run(browser, vp, chromiumExe) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale ?? (vp.phone ? 2 : 1), isMobile: Boolean(vp.phone), hasTouch: Boolean(vp.phone), reducedMotion: "reduce" });
  // Обход вежливой плашки для автоматики (rev 19, src/lib/bot-notice.ts): Playwright выставляет navigator.webdriver,
  // а это наша собственная проверка — флаг localStorage["bookimi.qa"] = "1" (то же, что ?qa=1 в адресе)
  await ctx.addInitScript(() => { try { localStorage.setItem("bookimi.qa", "1"); } catch {} });
  const page = await ctx.newPage();
  const issues = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = pathToFileURL(demo).href;
  let step = 0;
  const dir = SHOTS ? join(SHOTS, vp.name) : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const wait = (ms) => page.waitForTimeout(ms);
  const settle = async () => {
    await wait(250);
    await page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 1500); }))));
  };

  async function check(label, extra = {}) {
    step++;
    await settle();
    const found = await page.evaluate(inPageChecks, { phone: Boolean(vp.phone) });
    if (!extra.noFocus) found.push(...(await page.evaluate(focusChecks)));
    if (extra.more) found.push(...(await extra.more()));
    for (const f of found) issues.push({ step: label, ...f });
    if (dir) {
      await page.evaluate(() => window.scrollTo(0, 0));
      if (extra.scrollTo) await page.locator(extra.scrollTo).first().evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {});
      await wait(120);
      await page.screenshot({ path: join(dir, `${String(step).padStart(2, "0")}-${label}.png`), fullPage: Boolean(extra.full) });
    }
  }
  const go = async (hash) => {
    await page.goto(`${base}#${hash}`);
    await page.waitForSelector("main, .admin-top", { timeout: 15000 });
    await wait(350);
  };

  try {
    await flow();
  } catch (e) {
    issues.push({ step: `шаг ${step}`, kind: "crash", msg: String(e?.message ?? e).split("\n").slice(0, 3).join(" ") });
  }
  for (const e of errors) issues.push({ step: "js", kind: "pageerror", msg: e });
  await ctx.close();
  return issues;

  async function flow() {
  // Витрина
  await go("/");
  await check("home", { full: true });
  // Шапка: на планшете — бургер, меню открывается и не уходит за край
  const burger = page.locator(".burger summary");
  if (await burger.isVisible().catch(() => false)) {
    // Шапка прилипла к верху (как после первой прокрутки; полоса демо над ней есть только в демо)
    await page.evaluate(() => window.scrollTo(0, document.querySelector(".header").getBoundingClientRect().top + scrollY));
    await burger.click();
    await check("burger", {
      noFocus: true,
      more: () => page.evaluate(() => {
        const m = document.querySelector(".burger__menu");
        const r = m?.getBoundingClientRect();
        return !r ? [{ kind: "burger", msg: "меню не открылось" }] : r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 ? [{ kind: "burger", msg: `меню за краем: ${Math.round(r.left)}…${Math.round(r.right)} × ${Math.round(r.bottom)}` }] : [];
      }),
    });
    await burger.click();
  }
  await go("/skazki");
  const ageChip = page.locator(".filters a.chip, .filters .chip").filter({ hasText: /5–7/ }).first();
  if (await ageChip.count()) { await ageChip.click(); await wait(400); }
  await check("catalog", { full: true, more: () => page.evaluate(gridChecks, { wide: vp.width >= 1440 }) });
  await go("/dlya/detyam");
  await check("audience", { full: true, more: () => page.evaluate(gridChecks, { wide: vp.width >= 1440 }) });
  await go("/povod/novyj-god");
  await check("occasion", { full: true });
  await go("/prazdniki");
  await check("holidays", { full: true });
  await go("/skazki/imya-i-zvyozdnyj-drakonchik");
  await check("product", { full: true });

  // Анкета
  await go("/sozdat?dlya=CHILD");
  await check("q-name");
  await page.fill("input[name=hero-name]", "Маша");
  await page.click("button[data-next]");
  await wait(500);
  await check("q-age", { more: () => page.evaluate(coverCheck, { phone: Boolean(vp.phone), wide: vp.width >= 900 }) });
  await page.click('[data-age="4-6"]');
  await wait(300);
  await check("q-gender", { scrollTo: "[data-age-gender] .gender-grid, .gender-grid" });
  await page.click('[data-gender-pic="girl"]');
  await wait(900);
  await check("q-chars", { scrollTo: ".char-grid", more: () => page.evaluate(coverCheck, { phone: Boolean(vp.phone), wide: vp.width >= 900 }) });
  await check("q-rows", { scrollTo: "[data-pic-row=hair], [data-pic-row]", more: () => page.evaluate(picRowCheck, { phone: Boolean(vp.phone) }) });
  await page.click("button[data-next]");
  await wait(500);
  await page.locator("[data-add-hero]").click().catch(() => {});
  await wait(500);
  await page.locator("input[name=extra-name-0]").fill("Оля").catch(() => {});
  await check("q-friends");
  await page.click("button[data-next]");
  await wait(500);
  await page.locator("[data-k=occasion] .chip").first().click().catch(() => {});
  await check("q-occasion");
  await page.click("button[data-next]");
  await wait(600);
  if (!(await page.locator(".choice-cards--books .choice[aria-pressed=true]").count())) await page.locator(".choice-cards--books .choice").first().click().catch(() => {});
  await check("q-book");
  await page.click("button[data-next]");
  await wait(600);
  await page.locator(".mood[data-mood=winter], .mood").last().click().catch(() => {});
  await check("q-details", { scrollTo: ".styles" });
  await check("q-details-end", { scrollTo: "textarea[name=dedication]", noFocus: true });
  await page.click("button[data-next]");
  await page.waitForSelector("[data-book-preview]", { timeout: 30000 });
  await wait(600);

  // Превью: кадры книги, кнопки правок, вид «Одна страница / Разворот»
  const fit = () => page.evaluate(fitCheck, { fit: Boolean(vp.fit) });
  await check("book-cover", { scrollTo: "[data-book-preview]", more: fit });
  const next = page.locator("[data-turn=next]");
  const frames = Number((await page.locator("[data-where]").innerText()).match(/из (\d+)/)?.[1] ?? 0);
  for (let i = 1; i < frames; i++) {
    await next.click();
    await wait(80);
    const kinds = await page.locator(".bk__book .bk-page").evaluateAll((els) => els.map((e) => e.dataset.page).join("+"));
    // Снимки: приветствие, фото/посвящение, первый и пятый развороты; проверки — на каждом кадре
    const shot = i === 1 || i === 2 || /story/.test(kinds) && (i === 3 || i === 7);
    if (shot) await check(`book-${i}-${kinds}`, { scrollTo: "[data-book-preview]", noFocus: true, more: fit });
    else {
      await settle();
      for (const f of await page.evaluate(inPageChecks, { phone: Boolean(vp.phone) })) if (f.kind === "book-text") issues.push({ step: `book-${i}`, ...f });
      for (const f of await fit()) issues.push({ step: `book-${i}`, ...f });
    }
  }
  const other = vp.phone ? "spread" : "single";
  await page.click(`[data-view=${other}]`);
  await wait(200);
  // С последней страницы — на несколько назад, к разворотам
  for (let i = 0; i < 4; i++) { await page.locator("[data-turn=prev]").click(); await wait(60); }
  await check(`book-view-${other}`, { scrollTo: "[data-book-preview]", noFocus: true, more: fit });
  await page.click(`[data-view=${vp.phone ? "single" : "spread"}]`);
  await page.locator("[data-tool=cover]").click();
  await wait(300);
  await check("book-panel-cover", { scrollTo: ".bk__tools" });
  await page.locator("[data-tool=cover]").click();

  // Одобрить текст → вход по коду (контакты) → превью с картинками → «Кто печатает книгу?»
  await page.getByRole("button", { name: "Всё нравится, дальше" }).click();
  await page.waitForSelector("input[name=email]", { timeout: 15000 });
  await wait(300);
  await page.fill("input[name=email]", "test@example.com");
  if (await page.locator("input[name=phone]").count()) await page.fill("input[name=phone]", "+7 912 345-67-89");
  if (await page.locator("input[name=first-name]").count()) await page.fill("input[name=first-name]", "Анна");
  for (const cb of await page.locator("input[name=consent-pd]:not(:checked)").all()) await cb.check().catch(() => {});
  await check("contacts");
  await page.locator("[data-book-preview] ~ * form .btn--primary, section form .btn--primary").first().click();
  await page.waitForSelector("[data-demo-code]", { timeout: 10000 });
  const code = await page.locator("[data-demo-code]").innerText();
  await page.fill("input[name=code]", code.trim());
  await page.locator("section form .btn--primary").first().click({ timeout: 2000 }).catch(() => {});
  await wait(800);
  const draw = page.getByRole("button", { name: /Нарисовать превью/ });
  await draw.waitFor({ timeout: 10000 });
  for (const cb of await page.locator("input[name=consent-pd]:not(:checked)").all()) await cb.check().catch(() => {});
  await draw.click();
  await page.waitForSelector("[data-mood-panel], .big-choice", { timeout: 60000 });
  await wait(800);
  for (let i = 0; i < 3; i++) { await next.click(); await wait(80); }
  await check("preview-spread", { scrollTo: "[data-book-preview]", noFocus: true, more: fit });
  await check("preview-print", { scrollTo: ".big-choice", noFocus: true });

  // Оформление и окно допа
  await page.locator(".big-choice").last().click();
  await page.waitForSelector(".buy, .addon-grid, form", { timeout: 15000 });
  await wait(800);
  await check("checkout", { full: true });
  const zoom = page.locator(".addon-card__pic").first();
  if (await zoom.count()) {
    await zoom.scrollIntoViewIfNeeded();
    await zoom.click();
    await wait(300);
    await check("modal", {
      noFocus: true,
      more: () => page.evaluate(() => {
        const m = document.querySelector(".modal__box");
        if (!m) return [{ kind: "modal", msg: "окно допа не открылось" }];
        const r = m.getBoundingClientRect();
        return r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1 ? [{ kind: "modal", msg: `окно за краем экрана: ${Math.round(r.top)}…${Math.round(r.bottom)} при высоте ${innerHeight}` }] : [];
      }),
    });
    await page.keyboard.press("Escape");
    await page.locator(".modal__close").click().catch(() => {});
  }

  await go("/kabinet");
  await check("kabinet", { full: true });
  await go("/admin/dashboard");
  await check("admin", { full: true, noFocus: true });
  await go("/admin/zakazy");
  await check("admin-orders", { noFocus: true });
  }
}

/* Сетки карточек: на широком экране нет одинокой карточки в последнем ряду при ≥4 колонках и гигантских промежутков. */
function gridChecks(o) {
  const out = [];
  for (const g of document.querySelectorAll("main .grid, main .occasions, main .reviews")) {
    const kids = [...g.children].filter((k) => k.getBoundingClientRect().height > 0);
    if (kids.length < 3) continue;
    const cols = getComputedStyle(g).gridTemplateColumns.split(" ").length;
    const r = g.getBoundingClientRect();
    if (o.wide && r.width > 1400) out.push({ kind: "grid-width", msg: `${g.className}: сетка ${Math.round(r.width)} px — шире удобного` });
    const gap = parseFloat(getComputedStyle(g).columnGap);
    if (gap > 64) out.push({ kind: "grid-gap", msg: `${g.className}: промежуток ${gap}px` });
    void cols;
  }
  return out;
}

/* Живая обложка: на компьютере — сбоку и целиком видна, на телефоне — компактно сверху, форма начинается в первом экране. */
function coverCheck(o) {
  const a = document.querySelector("[data-live-cover]");
  if (!a) return [];
  const r = a.getBoundingClientRect();
  const main = document.querySelector(".quiz__main").getBoundingClientRect();
  const out = [];
  if (o.wide) {
    if (!(r.left >= main.right - 1)) out.push({ kind: "live-cover", msg: "на широком экране обложка не сбоку от анкеты" });
    if (r.height > innerHeight) out.push({ kind: "live-cover", msg: `обложка выше экрана: ${Math.round(r.height)}` });
  } else {
    if (r.height > 150) out.push({ kind: "live-cover", msg: `на узком экране обложка занимает ${Math.round(r.height)} px` });
    const h = document.querySelector(".scene__head h1")?.getBoundingClientRect();
    if (h && h.top + scrollY > innerHeight * 0.75) out.push({ kind: "live-cover", msg: `заголовок шага опущен до ${Math.round(h.top + scrollY)} px` });
  }
  return out;
}

/* Ряды картинок внешности: на телефоне листаются вбок с подсказкой, на ноутбуке переносятся без прокрутки. */
function picRowCheck(o) {
  const out = [];
  const rows = [...document.querySelectorAll("[data-describe=pics] .pic-row")].filter((r) => r.getBoundingClientRect().height > 0);
  if (!rows.length) return [{ kind: "pic-rows", msg: "нет рядов картинок" }];
  const hint = document.querySelector(".pic-scroll-hint");
  const hintShown = hint && getComputedStyle(hint).display !== "none";
  const scrolls = rows.filter((r) => r.scrollWidth > r.clientWidth + 2);
  if (o.phone) {
    if (scrolls.length && !hintShown) out.push({ kind: "pic-rows", msg: "ряды листаются вбок, но подсказки нет" });
  } else if (scrolls.length) out.push({ kind: "pic-rows", msg: `${scrolls.length} рядов прокручиваются вбок на широком экране` });
  // Картинки в ряду одной высоты
  for (const r of rows) {
    const hs = new Set([...r.querySelectorAll(".pic")].map((p) => Math.round(p.getBoundingClientRect().height / 4)));
    if (hs.size > 2) out.push({ kind: "pic-rows", msg: `${r.closest("[data-pic-row]")?.dataset.picRow}: картинки разной высоты` });
  }
  return out.slice(0, 4);
}

/* Превью на ноутбуке и мониторе: разворот вместе с панелью и кнопками правок помещается в экран без прокрутки. */
function fitCheck(o) {
  const bar = document.querySelector(".bk__bar"), tools = document.querySelector(".bk__tools"), book = document.querySelector(".bk__book");
  if (!bar || !tools || !book) return [];
  const out = [];
  const head = document.querySelector(".header");
  const hh = head && getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().height : 0;
  const nav = document.querySelector(".flow-nav");
  const nh = nav && getComputedStyle(nav).position === "fixed" && nav.getBoundingClientRect().height > 0 ? nav.getBoundingClientRect().height : 0;
  const need = tools.getBoundingClientRect().bottom - bar.getBoundingClientRect().top;
  const room = innerHeight - hh - nh;
  if (o.fit && need > room + 1) out.push({ kind: "book-fit", msg: `книга с кнопками ${Math.round(need)} px, а места ${Math.round(room)} px` });
  const br = book.getBoundingClientRect();
  // Кнопки листания ‹ › — по бокам страницы, на середине её высоты
  for (const nb of document.querySelectorAll(".bk__nav:not(:disabled)")) {
    const r = nb.getBoundingClientRect();
    const mid = (r.top + r.bottom) / 2;
    if (Math.abs(mid - (br.top + br.bottom) / 2) > br.height * 0.2) out.push({ kind: "book-nav", msg: `${nb.dataset.turn}: кнопка листания не на середине страницы (${Math.round(mid - br.top)} из ${Math.round(br.height)})` });
  }
  if (br.width < 200) out.push({ kind: "book-fit", msg: `книга слишком мелкая: ${Math.round(br.width)} px` });
  return out;
}

// ───────── запуск ─────────
if (args.includes("--build") || !existsSync(demo)) execFileSync(process.execPath, [join(root, "tools/demo/build.mjs")], { stdio: "inherit" });
const { chromium, exe } = loadChromium();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const list = VIEWPORTS.filter((v) => !ONLY || ONLY.includes(v.name));
const results = new Map();
const queue = [...list];
await Promise.all(
  Array.from({ length: Math.min(PAR, list.length) }, async () => {
    while (queue.length) {
      const vp = queue.shift();
      const t0 = Date.now();
      try {
        results.set(vp.name, await run(browser, vp, exe));
      } catch (e) {
        results.set(vp.name, [{ step: "run", kind: "crash", msg: String(e?.message ?? e).split("\n")[0] }]);
      }
      console.log(`${vp.name}: ${results.get(vp.name).length ? results.get(vp.name).length + " проблем" : "ok"} (${Math.round((Date.now() - t0) / 1000)} с)`);
    }
  }),
);
await browser.close();

let total = 0;
for (const vp of list) {
  const is = results.get(vp.name) ?? [];
  if (!is.length) continue;
  console.log(`\n── ${vp.name}`);
  const seen = new Set();
  for (const i of is) {
    const k = `${i.kind}|${i.msg}`;
    if (seen.has(k)) continue;
    seen.add(k);
    total++;
    console.log(`  [${i.kind}] ${i.step}: ${i.msg}`);
  }
}
console.log(total ? `\nНайдено проблем: ${total}` : `\nВёрстка в порядке на ${list.length} экранах.`);
process.exit(total ? 1 : 0);
