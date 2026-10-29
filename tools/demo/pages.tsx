// Страницы, которые на сайте читают базу (книга, оформление, заказ, кабинет, вход), — та же разметка,
// что в src/app/**/page.tsx, но данные из хранилища демо (api.ts). Клиентские компоненты — настоящие.
import Link from "next/link";
import { BookFlow } from "../../src/components/book/BookFlow";
import { Checkout } from "../../src/components/book/Checkout";
import { PayBox } from "../../src/components/book/PayBox";
import { OrderTimeline } from "../../src/app/zakaz/OrderTimeline";
import { ThanksPanel } from "../../src/app/zakaz/ThanksPanel";
import { journeyLine } from "../../src/app/zakaz/journey";
import { nextOccasion } from "../../src/app/kabinet/occasion";
import { BookCabinet } from "../../src/app/kabinet/kniga/[id]/BookCabinet";
import { CopyField } from "../../src/app/kabinet/Forms";
import { LoginBox } from "../../src/app/vhod/LoginBox";
import { SideNav } from "../../src/components/SideNav";
import { AnswersV2, heroAge } from "../../src/lib/quiz";
import { dedicationText } from "../../src/lib/gen/text";
import { moodsFor } from "../../src/content/moods";
import { moodSwatch } from "../../src/lib/mood-swatch";
import { ruDate } from "../../src/lib/pricing";
import { METHOD_TITLES } from "../../src/lib/shipping";
import { declineName } from "../../src/lib/declension";
import { canAcceptPayments, DEFAULTS } from "../../src/lib/settings";
import { FORMATS } from "../../src/lib/catalog-defaults";
import { bookById, catalogForPricing, heroAccOf, journeyOf, markPaid, orderById, pageUrl, pdfPaidFor, S, SHIP_METHODS } from "./api";
import { NotFoundError, RedirectError } from "./router";

const needUser = (next: string) => {
  if (!S.user) throw new RedirectError(`/vhod?next=${next}`);
  return S.user;
};

// ───────── /kniga/[id] ─────────
export async function KnigaPage({ id }: { id: string }) {
  const b = bookById(id);
  if (!b) throw new NotFoundError();
  const a = AnswersV2.safeParse(b.params);
  const moods = a.success ? moodsFor(a.data.audience, heroAge(a.data)).map((m) => ({ id: m.id, title: m.title, oneLine: m.oneLine, swatch: moodSwatch(m) })) : [];
  return (
    <BookFlow
      bookId={id}
      photoEnabled={DEFAULTS.flags.photoUploadEnabled}
      printEnabled={DEFAULTS.flags.printEnabled}
      extras={a.success ? a.data.extras.map((e) => ({ role: e.role, name: e.name })) : []}
      dedication={a.success ? dedicationText(a.data) : ""}
      moods={moods}
      moodChangesPreview={DEFAULTS.limits.moodChangesPreview}
      audience={a.success ? a.data.audience : "CHILD"}
    />
  );
}

// ───────── /kniga/[id]/kupit ─────────
export async function KupitPage({ id, who, pechat }: { id: string; who?: string; pechat?: string }) {
  const b = bookById(id);
  if (!b) throw new NotFoundError();
  const user = needUser(`/kniga/${id}/kupit${who ? `?who=${who}` : pechat ? "?pechat=1" : ""}`);
  if (!["PREVIEW_READY", "FULL_QUEUED", "FULL_READY"].includes(b.status)) throw new RedirectError(`/kniga/${id}`);
  const { formats, addons } = catalogForPricing();
  const full = FORMATS.filter((f) => formats.some((x) => x.key === f.key));
  const addonInfo: Record<string, string> = {};
  return (
    <div className="wrap" style={{ padding: "24px var(--gutter) 80px" }}>
      <Checkout
        bookId={id}
        coverUrl={b.pages.includes(0) ? pageUrl(b, 0) : null}
        initialWho={who === "bookimi" || pechat ? "bookimi" : "self"}
        formats={full.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price, widthMm: f.w, heightMm: f.h, cover: f.cover, pages: 24 }))}
        addons={addons.map((a) => ({ key: a.key, kind: a.kind, title: a.title, description: addonInfo[a.key] ?? a.title, priceRub: a.priceRub, percentOff: a.percentOff, requiresPrint: a.requiresPrint }))}
        methods={SHIP_METHODS.map((m) => ({ key: m, title: METHOD_TITLES[m] }))}
        pickupAddress={null}
        voices={DEFAULTS.audio.voices}
        canPay={await canAcceptPayments()}
        printEnabled={DEFAULTS.flags.printEnabled}
        contact={{ name: user.name ?? "", phone: user.phone ?? "", email: user.email ?? "" }}
        pdfPaid={pdfPaidFor(id)}
      />
    </div>
  );
}

// ───────── /demo-pay/[id] — страница «оплатить» тестового QR ─────────
export async function DemoPay({ id }: { id: string }) {
  if (!orderById(id)) throw new NotFoundError();
  markPaid(id);
  throw new RedirectError(`/zakaz/${id}`);
}

// ───────── /zakaz/[id] ─────────
const NOTES: Record<string, [string, string]> = {
  sbp_qr: ["СБП по QR-коду", "Оплата в приложении банка за минуту, чек — автоматически"],
  transfer: ["Перевод по номеру телефона или карты", "Подтверждаем вручную, обычно до 2 часов в рабочее время"],
};

export async function ZakazPage({ id }: { id: string }) {
  needUser(`/zakaz/${id}`);
  const order = orderById(id);
  if (!order) throw new NotFoundError();
  const providers = (await canAcceptPayments()) ? ["sbp_qr", "transfer"] : [];
  const pending = order.status === "PENDING_PAYMENT" || order.status === "AWAITING_CONFIRMATION";
  const jo = journeyOf(order);
  const bookId = jo.bookId;
  const print = order.whoPrints === "bookimi";
  const fresh = order.paidAt && Date.now() - order.paidAt < 3 * 86400_000 && ["PAID", "IN_PRINT"].includes(order.status);
  const firstOrder = fresh ? S.orders.filter((o) => o.paidAt).length <= 1 : false;
  const ship = order.shipment;
  return (
    <div className="flow">
      <p className="small muted">Заказ {order.publicCode}</p>
      <h1>{pending ? "Оплата заказа" : order.status === "CANCELLED" ? "Заказ отменён" : order.status === "REFUNDED" ? "Деньги возвращены" : order.status === "DELIVERED" ? "Книга у вас" : "Спасибо за заказ"}</h1>

      {fresh && (
        <div style={{ marginBottom: 16 }}>
          <ThanksPanel heroAcc={jo.heroAcc} print={print} bookId={bookId} firstOrder={firstOrder} ready={Boolean(jo.bookReadyAt)} />
        </div>
      )}

      <div className="panel">
        <table className="tbl" style={{ border: 0 }}>
          <tbody>
            {order.items.map((i, k) => (
              <tr key={k}><td>{i.title.replace(/^Изготовление (персонализированной книги )?/, "").replace(/^на заказ: /, "")}</td><td style={{ textAlign: "right" }}>{i.priceRub.toLocaleString("ru-RU")} ₽</td></tr>
            ))}
            {order.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td style={{ textAlign: "right" }}>−{order.pdfCreditRub} ₽</td></tr>}
            {order.discountRub > 0 && <tr><td>Скидка</td><td style={{ textAlign: "right" }}>−{order.discountRub} ₽</td></tr>}
            {print && <tr><td>Доставка: {ship ? METHOD_TITLES[ship.method as keyof typeof METHOD_TITLES] : ""}</td><td style={{ textAlign: "right" }}>{order.shippingRub} ₽</td></tr>}
            <tr><td><b>Итого</b></td><td style={{ textAlign: "right" }}><b>{order.totalRub.toLocaleString("ru-RU")} ₽</b></td></tr>
          </tbody>
        </table>
      </div>

      {pending && (
        <div style={{ marginTop: 16 }}>
          <PayBox
            orderId={order.id}
            total={order.totalRub}
            initialStatus={order.status}
            demo={true}
            methods={providers.map((p) => ({ key: p, title: NOTES[p][0], note: NOTES[p][1] }))}
            thanks={{ heroAcc: jo.heroAcc, print, bookId }}
          />
          {order.status === "AWAITING_CONFIRMATION" && (
            <p className="muted-panel small demo-note" style={{ marginTop: 12 }}>
              Демо: подтвердите перевод сами — <Link href="/admin/perevody">Админка → Переводы → «Деньги пришли»</Link>. Эта страница обновится сама.
            </p>
          )}
        </div>
      )}

      {!pending && order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Как идёт заказ</h2>
          <OrderTimeline order={jo} />
          {print && ship && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Доставка: {METHOD_TITLES[ship.method as keyof typeof METHOD_TITLES] ?? ship.method}
              {order.readyDate && <> · печать к {ruDate(new Date(order.readyDate))}</>}
              {ship.etaDate && <> · у вас ориентировочно {ruDate(new Date(ship.etaDate))}</>}
            </p>
          )}
          {order.receipt && <p className="small">Чек: <a href="/demo-receipt">открыть</a> <span className="muted">(в демо — не фискальный)</span></p>}
          <div className="row" style={{ marginTop: 12 }}>
            {bookId && !fresh && <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${bookId}`}>Открыть книгу в кабинете</Link>}
            {order.status === "DELIVERED" && <Link className="btn btn--ghost btn--sm" href="/kabinet/otzyv">Рассказать, как вам книга</Link>}
          </div>
          {print && order.status !== "DELIVERED" && (
            <p className="muted-panel small demo-note" style={{ marginTop: 12 }}>
              Демо: двигайте заказ по этапам в <Link href={`/admin/zakazy/${order.id}`}>админке</Link> — путь заказа здесь обновится.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ───────── кабинет ─────────
const CAB_NAV = [
  { href: "/kabinet", label: "Мои книги" },
  { href: "/kabinet/zakazy", label: "Заказы" },
  { href: "/kabinet/geroi", label: "Мои герои" },
  { href: "/kabinet/drug", label: "Приведи друга" },
  { href: "/kabinet/uvedomleniya", label: "Уведомления" },
  { href: "/kabinet/dannye", label: "Мои данные" },
  { href: "/kabinet/podderzhka", label: "Поддержка" },
];
export async function KabinetLayout({ children, path }: { children: unknown; path: string }) {
  needUser(path);
  return (
    <div className="wrap cab">
      <SideNav items={CAB_NAV} />
      <div>{children}</div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Черновик", ""],
  TEXT_QUEUED: ["Сочиняется", "badge--gold"],
  TEXT_READY: ["Сказка готова — посмотрите", "badge--gold"],
  TEXT_APPROVED: ["Ждёт фото", "badge--gold"],
  PREVIEW_QUEUED: ["Рисуется превью", "badge--gold"],
  PREVIEW_READY: ["Превью готово", ""],
  FULL_QUEUED: ["Рисуется полная книга", "badge--gold"],
  FULL_READY: ["Готова", ""],
  FAILED: ["Ошибка — повторите", "badge--red"],
};
const OPEN_ORDER = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "PAID", "IN_PRINT", "PACKED", "SHIPPED"];
function firstName(s?: string | null) {
  const n = (s ?? "").trim().split(/\s+/)[0];
  return n && /^[\p{L}-]{2,}$/u.test(n) ? n : null;
}

export async function KabinetHome() {
  const user = S.user!;
  const books = [...S.books].sort((x, y) => y.createdAt - x.createdAt);
  const lastOrder = S.orders.find((o) => o.contactName);
  const name = firstName(user.name) ?? firstName(lastOrder?.contactName);
  const paidCount = books.filter((b) => b.paidFull).length;

  const bdays = new Map<string, { name: string; nameGen?: string; date: Date }>();
  const past: string[] = [];
  for (const b of books) {
    const h = b.params.hero;
    if (b.params.occasion?.key) past.push(b.params.occasion.key);
    const bd = h.birthDate ? new Date(h.birthDate) : null;
    if (h.name && bd && !isNaN(+bd) && !bdays.has(h.name)) {
      let gen = h.name;
      try {
        gen = declineName(h.name, "род", h.gender);
      } catch {}
      bdays.set(h.name, { name: h.name, nameGen: gen, date: bd });
    }
  }
  const hint = nextOccasion({ birthdays: [...bdays.values()], pastOccasions: past });

  const orderLine = new Map<string, string>();
  for (const o of S.orders.filter((x) => OPEN_ORDER.includes(x.status))) {
    if (orderLine.has(o.bookId)) continue;
    const line = journeyLine(journeyOf(o));
    if (line) orderLine.set(o.bookId, `/zakaz/${o.id}|${line}`);
  }
  const ref = DEFAULTS.referral;
  const link = "https://bookimi.ru/?ref=DEMO7K";

  return (
    <>
      <header className="cab-hello">
        <h1>{name ? `Здравствуйте, ${name}` : "Здравствуйте"}</h1>
        <p className="muted">
          {paidCount > 0
            ? "Рады, что вы с нами. Здесь живут ваши книги — их можно читать, скачивать и заказывать в печать."
            : books.length > 0
              ? "Ваши черновики сохранены — можно продолжить с того же места."
              : "Здесь появятся ваши книги. Первая начинается с короткой анкеты — без фото и регистрации."}
        </p>
      </header>

      {hint && (
        <aside className="cab-hint" aria-label="Ближайший повод">
          <span className="cab-hint__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7c-2-4-6-4-6-1.5S10 7 12 7zm0 0c2-4 6-4 6-1.5S14 7 12 7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <b>{hint.title}</b>
            <p>{hint.text}</p>
          </div>
          <Link className="btn btn--gold btn--sm" href={hint.href}>Выбрать сказку</Link>
        </aside>
      )}

      <h2 className="cab-h2">Мои книги</h2>
      {books.length === 0 ? (
        <div className="panel">
          <Link className="btn btn--primary" href="/sozdat">Создать первую книгу</Link>
        </div>
      ) : (
        <div className="shelf">
          {books.map((b) => {
            const url = b.pages.includes(0) ? pageUrl(b, 0) : null;
            const title = b.text?.title ?? "Сказка сочиняется";
            const [label, cls] = STATUS[b.status] ?? [b.status, ""];
            const ol = orderLine.get(b.id)?.split("|");
            const hero = b.params.hero.name;
            return (
              <article key={b.id} className="shelf__book">
                <Link href={b.paidFull ? `/kabinet/kniga/${b.id}` : `/kniga/${b.id}`} className="cover shelf__cover" aria-label={`Открыть «${title}»`}>
                  {url ? <img src={url} alt="" loading="lazy" /> : <span className="shelf__blank" aria-hidden="true" />}
                  {hero && <span className="cover__name shelf__hero">{hero}</span>}
                  <span className="cover__title">{title}</span>
                </Link>
                <span className={`badge ${cls}`}>{label}</span>
                {ol && (
                  <p className="shelf__line small">
                    {ol[1]} <Link href={ol[0]}>Заказ →</Link>
                  </p>
                )}
                <div className="row">
                  {b.paidFull ? (
                    <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${b.id}`}>Открыть</Link>
                  ) : (
                    <Link className="btn btn--primary btn--sm" href={b.status === "PREVIEW_READY" ? `/kniga/${b.id}/kupit` : `/kniga/${b.id}`}>
                      {b.status === "PREVIEW_READY" ? "Оформить" : "Продолжить"}
                    </Link>
                  )}
                  {b.paidFull && <Link className="btn btn--ghost btn--sm" href={`/kniga/${b.id}/kupit?pechat=1`}>В печать</Link>}
                </div>
              </article>
            );
          })}
          <Link href="/sozdat" className="shelf__add">
            <span aria-hidden="true">+</span>
            Новая книга
          </Link>
        </div>
      )}

      <section className="panel cab-ref" aria-labelledby="ref-h">
        <h2 id="ref-h" className="cab-h2" style={{ marginTop: 0 }}>Приведи друга</h2>
        <p>Друг получит −{ref.newbiePct}% на первую книгу, а вы — промокод −{ref.bonusPct}% за каждого друга, который оплатит заказ.</p>
        <CopyField label="Ваша ссылка" value={link} />
        <p className="small" style={{ margin: "8px 0 0" }}><Link href="/kabinet/drug">Мои приглашения и промокоды →</Link></p>
      </section>
    </>
  );
}

export async function KabinetBook({ id }: { id: string }) {
  const b = bookById(id);
  if (!b) throw new NotFoundError();
  if (!b.paidFull) {
    return (
      <div className="panel">
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Книга ещё не оплачена</h1>
        <Link className="btn btn--primary" href={`/kniga/${id}`}>Продолжить создание</Link>
      </div>
    );
  }
  const order = S.orders.find((o) => o.bookId === id && !["CANCELLED", "REFUNDED", "PENDING_PAYMENT"].includes(o.status));
  const jo = order ? journeyOf(order) : null;
  const bought = new Set(S.orders.filter((o) => o.bookId === id && o.paidAt).flatMap((o) => o.items.map((i) => i.refKey)));
  const files = b.status === "FULL_READY" ? ["pdf-screen", "pdf-a4", "pdf-print-210", "pdf-print-150", ...(bought.has("coloring") ? ["coloring"] : [])] : [];
  const pages = b.pages.map((i) => ({ index: i, text: i === 0 ? "" : b.text?.spreads[i - 1]?.text ?? "", url: pageUrl(b, i) }));
  return (
    <>
      {order && jo && (
        <details className="panel" open={order.status !== "DELIVERED"} style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Заказ {order.publicCode}: как идёт</summary>
          <OrderTimeline order={jo} compact />
          <p className="small" style={{ margin: "8px 0 0" }}><Link href={`/zakaz/${order.id}`}>Подробнее о заказе →</Link></p>
        </details>
      )}
      <BookCabinet id={id} title={b.text?.title ?? ""} status={b.status} progress={b.progress} redrawsLeft={b.redrawsLeft} pages={pages} files={files} audioUrl={null} selfRead={false} />
      <p className="small demo-note" style={{ marginTop: 16 }}>
        <Link href={`/kniga/${id}`}>Настроение иллюстраций — сменить для всей книги →</Link>
        {bought.has("audiobook") && <span className="muted"> · Аудиокнига на сайте — MP3 голосом диктора в плеере.</span>}
      </p>
    </>
  );
}

export async function KabinetOrders() {
  const list = S.orders;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказы</h1>
      {list.length === 0 ? (
        <p className="muted">Заказов пока нет.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Заказ</th><th>Сумма</th><th>Как идёт</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/zakaz/${o.id}`}><b>{o.publicCode}</b></Link><br /><small className="muted">{new Date(o.createdAt).toLocaleDateString("ru-RU")}</small></td>
                  <td>{o.totalRub.toLocaleString("ru-RU")} ₽</td>
                  <td className="small">{journeyLine(journeyOf(o)) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function KabinetStub({ title }: { title: string }) {
  return (
    <div className="panel">
      <h1 style={{ fontSize: "var(--fs-xl)" }}>{title}</h1>
      <p className="muted">В демо-стенде этот раздел кабинета не показываем — на сайте он работает с вашими данными.</p>
      <Link className="btn btn--ghost btn--sm" href="/kabinet">Мои книги</Link>
    </div>
  );
}

// ───────── /vhod ─────────
export async function VhodPage({ next }: { next?: string }) {
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  return (
    <div className="flow" style={{ maxWidth: 460 }}>
      <h1>Вход в личный кабинет</h1>
      <p className="muted">Ваши книги, заказы и чеки. Вход по коду — без пароля.</p>
      <div className="panel">
        <LoginBox next={safe} consentGiven={S.consent.pd ? true : undefined} />
      </div>
    </div>
  );
}

// ───────── заглушка для юридических и прочих страниц ─────────
export function StubPage({ path }: { path: string }) {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>Этой страницы в демо нет</h1>
        <p className="lead">На сайте здесь открывается «{path}». В демо-стенде показываем путь покупателя и админку.</p>
        <Link href="/" className="btn btn--primary">На главную</Link>
      </div>
    </section>
  );
}
