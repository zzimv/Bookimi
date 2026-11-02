// Демо-стенд БУКИМИ в одном HTML: настоящие страницы и компоненты сайта (витрина, анкета, путь книги,
// оформление, оплата, путь заказа, кабинет, графики админки) работают в браузере без сервера.
// Адреса — как на сайте, в hash: #/skazki/<книга>, #/sozdat, #/kniga/<id>, #/zakaz/<id>, #/kabinet, #/admin.
// Сборка: node tools/demo/build.mjs → tools/demo/out/bookimi-demo.html
import { createRoot, setAttrHook, setScheduler, setServerErrorHandler } from "react";
import { GET as obrazec } from "../../src/app/obrazec/route";
import { PromoBar, Header, Footer } from "../../src/components/Layout";
import HomePage from "../../src/app/page";
import CatalogPage from "../../src/app/skazki/page";
import BookPage from "../../src/app/skazki/[slug]/page";
import AudiencePage from "../../src/app/dlya/[audience]/page";
import OccasionsPage from "../../src/app/povody/page";
import OccasionPage from "../../src/app/povod/[slug]/page";
import SozdatPage from "../../src/app/sozdat/page";
import PrazdnikiPage from "../../src/app/prazdniki/page";
import VozrastPage from "../../src/app/vozrast/[slug]/page";
import { AdminHolidays, DemoGeroi, resetHolidays } from "./holidays";
import NotFound from "../../src/app/not-found";
import { exportData, installApi, onAccountDeleted, onStoreChange, resetLimits, resetStore, resumeJobs, S, setDemoFlags, svgUrl } from "./api";
import { DemoMult } from "./cartoon";
import { DemoPay, KabinetBook, KabinetDannye, KabinetHome, KabinetLayout, KabinetOrders, KabinetOtzyv, KabinetStub, KnigaDemo, KupitPage, StubPage, VhodPage, ZakazPage } from "./pages";
import { AdminCatalog, AdminDashboard, AdminHome, AdminJournal, AdminLayout, AdminOrder, AdminOrders, AdminPromos, AdminReviews, AdminSettings, AdminTransfers } from "./admin";
import { bindRouter, currentPath, currentQuery, currentUrl, demoHref, NotFoundError, push, RedirectError } from "./router";
import { DEFAULTS } from "../../src/lib/settings";
import { normalizeName } from "../../src/lib/declension";

// Демо показывает и пробные стили картинок (значок «пробный»); на сайте они скрыты до настройки art.showTrialStyles
DEFAULTS.art.showTrialStyles = true;

// ───────── картинки-образцы /obrazec — тем же кодом, что маршрут сайта ─────────
function sampleSrc(url: string) {
  return svgUrl(`obrazec${url}`, () => {
    const R = globalThis.Response;
    let body = "";
    // Маршрут сайта отвечает new Response(svg) — забираем строку синхронно
    (globalThis as { Response: unknown }).Response = function (b: string) {
      body = b;
    };
    try {
      obrazec({ url: `https://demo.bookimi${url}` } as Request);
    } finally {
      globalThis.Response = R;
    }
    return body;
  });
}
setAttrHook((tag, name, v) => {
  if (name === "src" && v.startsWith("/obrazec")) return sampleSrc(v);
  if (name === "href" && tag === "a") return demoHref(v);
  return v;
});

// ───────── тосты ─────────
let toast = "";
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function say(t: string) {
  toast = t;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast = "";
    root.schedule();
  }, 3600);
  root.schedule();
}

// ───────── маршруты ─────────
const LEGAL = /^\/(oferta|politika|soglasie|vozvrat|cookies|kontakty|blog|otpiska|chek|demo-receipt|api\/books\/[^/]+\/download)/;
const CAB_TITLES: Record<string, string> = { geroi: "Мои герои", drug: "Приведи друга", uvedomleniya: "Уведомления", dannye: "Мои данные", podderzhka: "Поддержка", otzyv: "Отзыв о книге" };

function page(path: string, q: Record<string, string>) {
  const p = path.split("/").filter(Boolean);
  const sp = Promise.resolve(q);
  const params = <T,>(x: T) => Promise.resolve(x);
  if (p.length === 0) return <HomePage />;
  switch (p[0]) {
    case "skazki":
      return p[1] ? <BookPage params={params({ slug: p[1] })} /> : <CatalogPage searchParams={sp} />;
    case "dlya":
      return <AudiencePage params={params({ audience: p[1] ?? "" })} />;
    case "povody":
      return <OccasionsPage />;
    case "vozrast":
      return <VozrastPage params={params({ slug: p[1] ?? "" })} />;
    case "prazdniki":
      return <PrazdnikiPage />;
    case "povod":
      return <OccasionPage params={params({ slug: p[1] ?? "" })} />;
    case "sozdat":
      return <SozdatPage searchParams={sp} />;
    case "kniga":
      return p[2] === "kupit" ? <KupitPage id={p[1]} who={q.who} pechat={q.pechat} bulk={q["dlya-vseh"]} izmenit={q.izmenit} chto={q.chto} /> : <KnigaDemo id={p[1]} />;
    case "demo-pay":
      return <DemoPay id={p[1]} />;
    case "zakaz":
      return <ZakazPage id={p[1]} />;
    case "vhod":
      return <VhodPage next={q.next} />;
    case "kabinet":
      return (
        <KabinetLayout path={path}>
          {!p[1] ? <KabinetHome /> : p[1] === "kniga" ? (p[3] === "mult" ? <DemoMult id={p[2]} /> : <KabinetBook id={p[2]} />) : p[1] === "zakazy" ? <KabinetOrders /> : p[1] === "geroi" ? <DemoGeroi /> : p[1] === "dannye" ? <KabinetDannye /> : p[1] === "otzyv" ? <KabinetOtzyv zakaz={q.zakaz} /> : <KabinetStub title={CAB_TITLES[p[1]] ?? "Кабинет"} />}
        </KabinetLayout>
      );
  }
  if (LEGAL.test(path)) return <StubPage path={path} />;
  return <NotFound />;
}

function adminPage(p: string[]) {
  switch (p[1]) {
    case undefined:
      return <AdminHome />;
    case "dashboard":
      return <AdminDashboard />;
    case "zakazy":
      return p[2] ? <AdminOrder id={p[2]} /> : <AdminOrders />;
    case "perevody":
      return <AdminTransfers />;
    case "promokody":
      return <AdminPromos />;
    case "katalog":
      return <AdminCatalog />;
    case "nastrojki":
      return <AdminSettings />;
    case "prazdniki":
      return <AdminHolidays />;
    case "zhurnal":
      return <AdminJournal />;
    case "otzyvy":
      return <AdminReviews />;
  }
  return <NotFound />;
}

setServerErrorHandler((e) => {
  if (e instanceof RedirectError) {
    queueMicrotask(() => push(e.url));
    return null;
  }
  if (e instanceof NotFoundError) return <NotFound />;
  console.error(e);
  return (
    <div className="flow">
      <h1>Что-то пошло не так</h1>
      <p className="muted">{String((e as Error)?.message ?? e)}</p>
    </div>
  );
});

function ThemeQuick() {
  const t = document.documentElement.dataset.theme || "auto";
  const set = (v: string) => {
    document.documentElement.dataset.theme = v;
    try {
      if (v === "auto") localStorage.removeItem("bk_theme");
      else localStorage.setItem("bk_theme", v);
    } catch {}
    root.schedule();
  };
  return (
    <div className="demo-theme" role="group" aria-label="Тема">
      {[
        ["auto", "Авто", "◐"],
        ["light", "Светлая", "☀"],
        ["dark", "Тёмная", "☾"],
      ].map(([k, l, i]) => (
        <button key={k} type="button" aria-pressed={t === k} aria-label={`Тема: ${l.toLowerCase()}`} title={l} data-theme-set={k} onClick={() => set(k)}>
          <span className="demo-theme__icon" aria-hidden="true">{i}</span>
          <span className="demo-theme__label">{l}</span>
        </button>
      ))}
    </div>
  );
}

function View() {
  const path = currentPath();
  const q = currentQuery();
  const p = path.split("/").filter(Boolean);
  const admin = p[0] === "admin";
  return (
    <>
      <div className="demo-bar">
        <div className="wrap demo-bar__in">
          <span className="demo-bar__text">
            <b>Демо-стенд <span className="demo-rev">rev 11</span>.</b> <span className="demo-bar__long">Всё работает в этом окне: оплата понарошку, фото не покидает браузер, письма не отправляются. На сайте админка — только на admin.&lt;домен&gt; и только через VPN.</span>
          </span>
          <nav className="demo-tabs" aria-label="Демо">
            <a href="#/" aria-current={!admin ? "page" : undefined}>Сайт</a>
            <a href="#/admin" aria-current={admin ? "page" : undefined}>Админка</a>
          </nav>
          <ThemeQuick />
          <button type="button" className="demo-limits" data-demo="admin-mode" aria-pressed={Boolean(S.adminMode)} title="Режим админа: на превью — кнопка «Показать всю книгу»" onClick={() => { setDemoFlags({ adminMode: !S.adminMode }); say(S.adminMode ? "Режим админа включён: на превью есть «Показать всю книгу»" : "Режим админа выключен"); }}><span className="demo-limits__long">Режим админа</span><span className="demo-limits__short" aria-hidden="true">Админ</span></button>
          <ResetButton where="bar" />
          <button type="button" className="demo-limits" data-demo="reset-limits" title="Лимиты демо: по 999 сказок, превью, перерисовок в сутки" aria-label="Сбросить лимиты" onClick={() => { resetLimits(); say("Лимиты сброшены: по 999 сказок, превью, «Переписать», перерисовок и смен настроения"); }}><span className="demo-limits__long">Сбросить лимиты</span><span className="demo-limits__short" aria-hidden="true">Лимиты ↺</span></button>
        </div>
      </div>
      {admin ? (
        <AdminLayout>{adminPage(p)}</AdminLayout>
      ) : (
        <>
          <PromoBar />
          <Header />
          <main>{page(path, q)}</main>
          <Footer />
        </>
      )}
      <div className="demo-reset">
        <div className="wrap">
          <ResetButton where="bottom" />
          <p className="small muted">Сотрёт книги, заказы, вход, бонусы, черновик анкеты и настройки демо в этом браузере (тема остаётся).</p>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}

// «Начать заново»: подтверждение прямо на странице — confirm() в окне превью (iframe) браузер может молча
// заблокировать, и тогда сброс не происходил вовсе (жалоба владелицы, rev 10).
let asking: "" | "bar" | "bottom" = "";
function ResetButton({ where }: { where: "bar" | "bottom" }) {
  if (asking === where)
    return (
      <span className={`demo-confirm demo-confirm--${where}`} role="group" aria-label="Начать демо сначала?">
        <span>Стереть всё и начать заново?</span>
        <button type="button" className="demo-limits demo-confirm__yes" data-demo="reset-yes" onClick={() => { asking = ""; reset(); }}>Да, сначала</button>
        <button type="button" className="demo-limits" data-demo="reset-no" onClick={() => { asking = ""; root.schedule(); }}>Отмена</button>
      </span>
    );
  return where === "bar" ? (
    <button type="button" className="demo-limits demo-restart" data-demo="reset-bar" title="Стереть книги, заказы, вход и настройки демо" onClick={() => { asking = "bar"; root.schedule(); }}><span className="demo-limits__long">Начать заново</span><span className="demo-limits__short" aria-hidden="true">Заново ↺</span></button>
  ) : (
    <button type="button" className="btn btn--ghost" data-demo="reset" onClick={() => { asking = "bottom"; root.schedule(); }}>Начать демо сначала</button>
  );
}
function reset() {
  resetStore();
  afterReset();
}
// «Удалить аккаунт» в «Моих данных» — то же, что «Начать демо сначала», без вопроса (стирает API)
onAccountDeleted(() => setTimeout(afterReset, 0));
function afterReset() {
  resetHolidays();
  window.scrollTo({ top: 0 });
  document.documentElement.style.setProperty("--hero-name", '""');
  document.documentElement.classList.remove("has-name");
  root.reset();
  if (currentUrl() === "/") root.refresh();
  else location.hash = "/";
  window.scrollTo({ top: 0 });
  say("Демо начато сначала");
}

// ───────── запуск ─────────
const container = document.getElementById("app")!;
const root = createRoot(container, () => <View />);
setScheduler(root.schedule);
bindRouter({ refresh: () => root.refresh() });
installApi();
onStoreChange(() => root.refresh());

let lastPath = currentPath();
window.addEventListener("hashchange", () => {
  const path = currentPath();
  // Новый адрес — как переход в Next: серверные компоненты заново, клиентские — с нуля
  root.reset();
  root.refresh();
  if (path !== lastPath) window.scrollTo({ top: 0 });
  lastPath = path;
});

// Ссылки, которых в демо нет: скачивание PDF, чек, тексты согласий (открывались бы в новой вкладке)
document.addEventListener(
  "click",
  (e) => {
    const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (/^#[a-z]/i.test(href)) {
      // Якорь на странице («Как это работает» → #kak): адреса демо живут в hash — прокручиваем сами
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } else if (href === "#/api/me") {
      // «Скачать мои данные»: JSON из хранилища демо — как выгрузка /api/me на сайте
      e.preventDefault();
      const url = URL.createObjectURL(new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" }));
      const dl = Object.assign(document.createElement("a"), { href: url, download: "bookimi-my-data.json" });
      document.body.appendChild(dl);
      dl.click();
      dl.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      say("Файл bookimi-my-data.json скачан");
    } else if (/^#\/api\/books\/[^/]+\/download/.test(href)) {
      e.preventDefault();
      say("На сайте файл скачивается сразу. В демо PDF не собирается — его делает сервер.");
    } else if (href === "#/demo-receipt") {
      e.preventDefault();
      say("Чек «Мой налог» в демо — образец без фискальных данных.");
    } else if (a.target === "_blank" && href.startsWith("#/")) {
      e.preventDefault();
      say(`Текст документа на сайте — по адресу ${href.slice(1)}. В демо его не показываем.`);
    }
  },
  true,
);

// Имя на обложках (NamePreview пишет в localStorage) — применить при загрузке, как на сайте
try {
  const n = normalizeName((localStorage.getItem("bookimi.heroName") ?? "").replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "").slice(0, 20));
  if (n) {
    document.documentElement.style.setProperty("--hero-name", `"${n}"`);
    document.documentElement.classList.add("has-name");
  }
} catch {}

resumeJobs();
root.render().catch((e) => {
  console.error(e);
  container.innerHTML = `<p style="padding:24px">Не удалось запустить демо: ${String(e?.message ?? e)}</p>`;
});
