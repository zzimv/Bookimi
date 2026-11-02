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
import { CopyField, DataActions, NameForm } from "../../src/app/kabinet/Forms";
import { AddressBook } from "../../src/app/kabinet/dannye/AddressBook";
import { CartoonPlayer } from "./cartoon";
import { LoginBox } from "../../src/app/vhod/LoginBox";
import { SideNav } from "../../src/components/SideNav";
import { AnswersV2, coverSampleUrl, heroAge, sketchUrls } from "../../src/lib/quiz";
import { sampleSrc } from "./sample";
import { dedicationText } from "../../src/lib/gen/text";
import { moodsFor } from "../../src/content/moods";
import { moodSwatch } from "../../src/lib/mood-swatch";
import { ruDate } from "../../src/lib/pricing";
import { METHOD_TITLES } from "../../src/lib/shipping";
import { declineName, normalizeName } from "../../src/lib/declension";
import { canAcceptPayments, DEFAULTS } from "../../src/lib/settings";
import { FORMATS } from "../../src/lib/catalog-defaults";
import { bonusInfo, bookAudience, bookById, bulkState, cartoonOf, catalogForPricing, demoPrefill, heroAccOf, journeyOf, markPaid, orderById, ordersAwaitingReview, pageUrl, pdfPaidFor, reviewOf, S, SHIP_METHODS } from "./api";
import { DemoFullBook } from "./fullbook";
import { canChangeOrder, CHANGE_LOCKED_TEXT, SUPPORT_HREF } from "../../src/lib/order-change";
import { bonusWord } from "../../src/lib/bonuses";
import { ReviewForm } from "../../src/app/kabinet/Forms";
import { NotFoundError, RedirectError } from "./router";
import { HeroBirthdays } from "../../src/app/kabinet/Birthdays";
import { demoBirthdays } from "./holidays";
import { greetName, greeting } from "../../src/lib/first-name";

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
      coverSample={a.success ? coverSampleUrl(a.data) : undefined}
      // Эскизы — сразу blob-ссылки (как атрибуты src): превью меряет тон картинки через new Image()
      sketches={a.success ? sketchUrls(a.data).map(sampleSrc) : undefined}
      bulkAvailable={!b.parentId && bulkState(b).available}
    />
  );
}

/** /kniga/[id] в демо: путь книги сайта + для режима админа — «Показать всю книгу (для админа)». */
export async function KnigaDemo({ id }: { id: string }) {
  const b = bookById(id);
  return (
    <>
      {await KnigaPage({ id })}
      {b && S.adminMode && b.text && <DemoFullBook book={b} />}
    </>
  );
}

// ───────── /kniga/[id]/kupit ─────────
export async function KupitPage({ id, who, pechat, bulk, izmenit, chto }: { id: string; who?: string; pechat?: string; bulk?: string; izmenit?: string; chto?: string }) {
  const b = bookById(id);
  if (!b) throw new NotFoundError();
  const user = needUser(`/kniga/${id}/kupit${izmenit ? `?izmenit=${izmenit}${chto ? `&chto=${chto}` : ""}` : who ? `?who=${who}` : pechat ? "?pechat=1" : ""}`);
  // «Изменить заказ» / «Изменить адрес доставки»: тот же экран оформления с выбором из заказа
  const eo = izmenit ? orderById(izmenit) : null;
  if (izmenit && (!eo || !canChangeOrder(eo).ok)) throw new RedirectError(`/zakaz/${izmenit}`);
  const ei = eo?.input;
  if (!["PREVIEW_READY", "FULL_QUEUED", "FULL_READY"].includes(b.status)) throw new RedirectError(`/kniga/${id}`);
  const { formats, addons } = catalogForPricing(bookAudience(b));
  const full = FORMATS.filter((f) => formats.some((x) => x.key === f.key));
  const addonInfo: Record<string, string> = {};
  const bs = b.parentId ? null : bulkState(b);
  return (
    <div className="wrap" style={{ padding: "24px var(--gutter) 80px" }}>
      <Checkout
        bookId={id}
        coverUrl={b.pages.includes(0) ? pageUrl(b, 0) : null}
        initialWho={who === "bookimi" || pechat ? "bookimi" : "self"}
        formats={full.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.price, widthMm: f.w, heightMm: f.h, cover: f.cover, pages: 24 }))}
        addons={addons.map((a) => ({ key: a.key, kind: a.kind, title: a.title, description: addonInfo[a.key] ?? a.description ?? "", priceRub: a.priceRub, percentOff: a.percentOff, requiresPrint: a.requiresPrint }))}
        methods={SHIP_METHODS.map((m) => ({ key: m, title: METHOD_TITLES[m] }))}
        pickupAddress={null}
        voices={DEFAULTS.audio.voices}
        canPay={await canAcceptPayments()}
        printEnabled={DEFAULTS.flags.printEnabled}
        contact={{ name: user.name ?? "", phone: user.phone ?? "", email: user.email ?? "" }}
        pdfPaid={pdfPaidFor(id)}
        prefill={demoPrefill([...SHIP_METHODS])}
        bulk={!eo && bs?.available ? { ...bs, initialOn: bulk === "1" } : null}
        audience={AnswersV2.safeParse(b.params).data?.audience ?? "CHILD"}
        previewUrls={b.pages.filter((i) => i > 0).map((i) => pageUrl(b, i))}
        heroName={normalizeName(b.params.hero.name ?? "")}
        bookTitle={b.text?.title ?? ""}
        cartoonSoon={!DEFAULTS.cartoon.enabled}
        bonus={eo ? null : { balance: bonusInfo().balance, maxSharePct: DEFAULTS.bonus.maxSharePct }}
        edit={
          eo
            ? {
                orderId: eo.id,
                publicCode: eo.publicCode,
                formatKey: ei?.formatKey ?? eo.items.find((i) => i.kind === "format")?.refKey,
                addons: ei?.addons ?? eo.items.filter((i) => i.kind === "addon").map((i) => i.refKey),
                method: ei?.shipping?.method ?? eo.shipment?.method,
                address: (ei?.shipping?.address ?? eo.shipment?.address) as never,
                contact: { name: eo.contactName, phone: eo.contactPhone },
                promo: eo.promo,
                useBonus: (eo.bonusRub ?? 0) > 0,
                focus: chto === "dostavka" ? "delivery" : undefined,
              }
            : null
        }
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
            {order.items.length > 3 && new Set(order.items.map((i) => `${i.refKey}|${i.priceRub}`)).size === 1 ? (
              <tr><td>{order.items.length} книг — «для каждого в группе»</td><td style={{ textAlign: "right" }}>{(order.items.length * order.items[0].priceRub).toLocaleString("ru-RU")} ₽</td></tr>
            ) : order.items.map((i, k) => (
              <tr key={k}><td>{i.title.replace(/^Изготовление (персонализированной книги )?/, "").replace(/^на заказ: /, "")}</td><td style={{ textAlign: "right" }}>{i.priceRub.toLocaleString("ru-RU")} ₽</td></tr>
            ))}
            {order.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td style={{ textAlign: "right" }}>−{order.pdfCreditRub} ₽</td></tr>}
            {order.discountRub > 0 && <tr><td>Скидка</td><td style={{ textAlign: "right" }}>−{order.discountRub} ₽</td></tr>}
            {print && <tr><td>Доставка: {ship ? METHOD_TITLES[ship.method as keyof typeof METHOD_TITLES] : ""}</td><td style={{ textAlign: "right" }}>{order.shippingRub} ₽</td></tr>}
            {(order.bonusRub ?? 0) > 0 && <tr data-bonus-line><td>Оплачено бонусами</td><td style={{ textAlign: "right" }}>−{order.bonusRub} ₽</td></tr>}
            <tr><td><b>Итого</b></td><td style={{ textAlign: "right" }}><b>{order.totalRub.toLocaleString("ru-RU")} ₽</b></td></tr>
          </tbody>
        </table>
      </div>

      {print && <OrderChangeBox order={order} />}

      {(order.bookIds?.length ?? 0) > 1 && (
        <div className="panel" style={{ marginTop: 16 }} data-order-copies>
          <details open={order.bookIds!.length <= 6}>
          <summary><b>Книги заказа — {order.bookIds!.length}</b> <span className="small muted">в каждой свой главный герой · статус каждой</span></summary>
          <ol className="bulk-copies bulk-copies--list">
            {bulkState(bookById(order.bookId)!).copies.map((c) => (
              <li key={c.id}>
                <span className="bulk-copies__ph" aria-hidden="true">{c.name.slice(0, 1)}</span>
                <span><b>{c.name}</b><small className="muted">{c.statusText}</small></span>
              </li>
            ))}
          </ol>
          </details>
        </div>
      )}

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

      {order.status === "DELIVERED" && !reviewOf(order.id) && <ReviewAsk orderId={order.id} />}

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
            {order.status === "DELIVERED" && reviewOf(order.id) && <span className="small muted">Спасибо за отзыв!</span>}
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

/** Просьба об отзыве после получения: «+300 бонусов» (rev 10). */
function ReviewAsk({ orderId, compact }: { orderId: string; compact?: boolean }) {
  const r = DEFAULTS.bonus;
  return (
    <aside className="review-ask" data-review-ask={orderId} style={{ marginTop: 16 }}>
      <span className="review-ask__icon" aria-hidden="true">★</span>
      <div>
        <b>{compact ? "Книга у вас — как она вам?" : "Как вам книга? Расскажите — это займёт минуту"}</b>
        <p className="small" style={{ margin: "4px 0 0" }}>{r.enabled ? <>За отзыв начислим <b>{bonusWord(r.reviewRub)}</b> — спишете при следующем заказе (1 бонус = 1 ₽).</> : "Нам важна каждая деталь."}</p>
      </div>
      <Link className="btn btn--gold btn--sm" href={`/kabinet/otzyv?zakaz=${orderId}`}>Оставить отзыв</Link>
    </aside>
  );
}

/** «Изменить заказ» и «Изменить адрес доставки» — пока заказ не оплачен (как на макете владелицы); после оплаты —
 * «Заказ оплачен — изменения через поддержку». */
function OrderChangeBox({ order }: { order: NonNullable<ReturnType<typeof orderById>> }) {
  const can = canChangeOrder(order);
  const hist = order.changes ?? [];
  const locked = Boolean(order.paidAt) && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status);
  if (!can.ok && !locked) return null;
  return (
    <section className="panel order-change" style={{ marginTop: 16 }} data-order-change={can.ok ? "open" : "locked"}>
      {can.ok ? (
        <>
          <div className="row">
            <Link className="btn btn--ghost btn--sm" data-change="contents" href={`/kniga/${order.bookId}/kupit?izmenit=${order.id}`}>Изменить заказ</Link>
            <Link className="btn btn--ghost btn--sm" data-change="delivery" href={`/kniga/${order.bookId}/kupit?izmenit=${order.id}&chto=dostavka`}>Изменить адрес доставки</Link>
          </div>
          <p className="small muted" style={{ margin: "8px 0 0" }}>До оплаты можно поменять всё — формат, допы, доставку и получателя; сумма пересчитается.</p>
          {hist.length > 0 && (
            <ul className="order-change__hist small">
              {hist.map((c, i) => (
                <li key={i}><span className="muted">{new Date(c.at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}:</span> {c.lines.join("; ")} · сумма {c.totalRub.toLocaleString("ru-RU")} ₽</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="small order-change__lock" data-change-locked style={{ margin: 0 }}>
          <span aria-hidden="true">🔒</span> {CHANGE_LOCKED_TEXT.replace(/поддержку$/, "")}<Link href={SUPPORT_HREF}>поддержку</Link>
        </p>
      )}
    </section>
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
export async function KabinetHome() {
  const user = S.user!;
  const books = [...S.books].sort((x, y) => y.createdAt - x.createdAt);
  const name = greetName(user.firstName);
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
      bdays.set(h.name, { name: normalizeName(h.name), nameGen: gen, date: bd });
    }
  }
  const hint = nextOccasion({ birthdays: [...bdays.values()], pastOccasions: past });
  const birthdays = await demoBirthdays(60);

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
        <h1>{greeting(name)}</h1>
        <p className="muted">
          {paidCount > 0
            ? "Рады, что вы с нами. Здесь живут ваши книги — их можно читать, скачивать и заказывать в печать."
            : books.length > 0
              ? "Ваши черновики сохранены — можно продолжить с того же места."
              : "Здесь появятся ваши книги. Первая начинается с короткой анкеты — без фото и регистрации."}
        </p>
      </header>

      {ordersAwaitingReview().slice(0, 1).map((o) => <ReviewAsk key={o.id} orderId={o.id} compact />)}
      <BonusCard />

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

      <HeroBirthdays list={birthdays} hrefFor={() => "/sozdat?povod=den-rozhdeniya"} />

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
            const hero = normalizeName(b.params.hero.name ?? "");
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

/** Бонусный счёт в кабинете: остаток, ближайшее сгорание, история. */
function BonusCard() {
  const info = bonusInfo();
  const list = S.bonus ?? [];
  if (!list.length && !info.balance) return null;
  return (
    <section className="panel cab-bonus" data-bonus-balance={info.balance} aria-labelledby="bonus-h">
      <div className="cab-bonus__top">
        <h2 id="bonus-h" className="cab-h2" style={{ margin: 0 }}>Бонусы: {info.balance.toLocaleString("ru-RU")} ₽</h2>
        <span className="small muted">1 бонус = 1 ₽ · оплатить можно до {info.settings.maxSharePct}% заказа</span>
      </div>
      {info.nextExpiry && <p className="small" style={{ margin: "6px 0 0" }}>{bonusWord(info.nextExpiry.rub)} сгорят {new Date(info.nextExpiry.at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>}
      <details className="small" style={{ marginTop: 6 }}>
        <summary>История</summary>
        <ul className="cab-bonus__hist">
          {[...list].reverse().map((e, i) => (
            <li key={i}><b className={e.amountRub > 0 ? "ok" : ""}>{e.amountRub > 0 ? "+" : "−"}{Math.abs(e.amountRub)}</b> · {e.kind === "review" ? "за отзыв" : e.kind === "spend" ? "списано" : e.kind === "revoke" ? "отзыв отклонён" : "возврат"}{(e as { note?: string }).note ? ` — ${(e as { note?: string }).note}` : ""}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** /kabinet/otzyv?zakaz=… — отзыв о заказе: после получения книги — +300 бонусов. */
export function KabinetOtzyv({ zakaz }: { zakaz?: string }) {
  const o = zakaz ? orderById(zakaz) : ordersAwaitingReview()[0] ?? null;
  const credit = o && o.status === "DELIVERED" && !(S.bonus ?? []).some((e) => e.kind === "review" && e.orderId === o.id) && DEFAULTS.bonus.enabled ? DEFAULTS.bonus.reviewRub : 0;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Отзыв о книге</h1>
      <p className="muted">Расскажите, как встретили книгу. Нам важна каждая деталь.{o ? ` Заказ ${o.publicCode}.` : ""}</p>
      {o && reviewOf(o.id) ? (
        <div className="panel review-done" data-review-done>
          <p className="ok" style={{ margin: 0 }}>Спасибо! Отзыв появится на сайте после проверки.</p>
          {(S.bonus ?? []).some((e) => e.kind === "review" && e.orderId === o.id) && <p className="bonus-credit" data-bonus-credit>+{(S.bonus ?? []).find((e) => e.kind === "review" && e.orderId === o.id)!.amountRub} бонусов на вашем счёте — спишите их при следующем заказе (1 бонус = 1 ₽). <Link href="/kabinet">Мой бонусный счёт →</Link></p>}
        </div>
      ) : <ReviewForm orderId={o?.id} initialName={S.user?.firstName ?? ""} bonusRub={credit} />}
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
  const files = b.status === "FULL_READY" ? ["pdf-screen", "pdf-a4", "pdf-print-210", "pdf-print-150", ...(bought.has("coloring") ? ["coloring"] : []), ...(bought.has("wallpapers") ? ["addon-wallpaper-phone", "addon-wallpaper-desktop"] : [])] : [];
  // «Добавить к книге»: цифровые допы аудитории книги, ещё не купленные (как src/app/kabinet/kniga/[id]/page.tsx)
  const later = catalogForPricing(bookAudience(b)).addons
    .filter((a) => a.kind === "DIGITAL" && !a.requiresPrint && !a.key.startsWith("cartoon") && !bought.has(a.key))
    .map((a) => ({ key: a.key, title: a.title, description: a.description ?? "", priceRub: a.priceRub ?? 0 }));
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
      {b.status === "FULL_READY" && cartoonOf(b).bought && <CartoonPlayer book={b} />}
      {b.status !== "FULL_READY" && cartoonOf(b).bought && <p className="muted-panel small">«Оживление книги» соберётся, как только книга будет готова.</p>}
      <BookCabinet heroName={normalizeName(b.params.hero.name ?? "")} cartoonSoon={!DEFAULTS.cartoon.enabled} id={id} title={b.text?.title ?? ""} status={b.status} progress={b.progress} redrawsLeft={b.redrawsLeft} pages={pages} files={files} audioUrl={null} selfRead={false} later={later} coverUrl={b.pages.includes(0) ? pageUrl(b, 0) : null} />
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
          <table className="tbl tbl--cards">
            <thead><tr><th>Заказ</th><th>Сумма</th><th>Как идёт</th><th>Изменить</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td data-label="Заказ"><Link href={`/zakaz/${o.id}`}><b>{o.publicCode}</b></Link><br /><small className="muted">{new Date(o.createdAt).toLocaleDateString("ru-RU")}</small></td>
                  <td data-label="Сумма">{o.totalRub.toLocaleString("ru-RU")} ₽</td>
                  <td data-label="Как идёт" className="small">{journeyLine(journeyOf(o)) ?? (o.status === "PENDING_PAYMENT" ? "ждёт оплаты" : "—")}</td>
                  <td data-label="Изменить" className="small">{canChangeOrder(o).ok ? <Link href={`/kniga/${o.bookId}/kupit?izmenit=${o.id}`} data-cab-change={o.id}>Изменить заказ</Link> : o.whoPrints === "bookimi" && o.paidAt && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(o.status) ? <span className="muted">оплачен — через <Link href={SUPPORT_HREF}>поддержку</Link></span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ───────── /kabinet/dannye — как на сайте: имя, адреса, выгрузка, отзыв согласий, удаление ─────────
export function KabinetDannye() {
  const user = S.user!;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои данные</h1>
      <p className="muted">По закону о персональных данных (152-ФЗ) вы можете в любой момент выгрузить свои данные, отозвать согласия и удалить аккаунт.</p>
      <NameForm initial={user.firstName ?? ""} />
      <AddressBook addresses={S.addresses ?? []} />
      <DataActions />
      <p className="small muted demo-note">Демо: «Скачать мои данные» — JSON из этого окна браузера; удаление аккаунта начинает демо сначала.</p>
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
        <LoginBox next={safe} consentGiven={S.consent.pd ? true : undefined} initialName={S.user?.firstName ?? lastFirstName()} />
      </div>
    </div>
  );
}

/** «Как к вам обращаться», если уже знаем (последний вход в этом браузере). */
const lastFirstName = () => (S.orders[0]?.contactName ?? "").split(" ")[0] || "";

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
