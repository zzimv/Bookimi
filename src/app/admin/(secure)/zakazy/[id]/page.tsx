import Link from "next/link";
import { addressLine, type DeliveryAddress } from "@/lib/delivery";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { signedUrl } from "@/lib/storage";
import { ORDER_STATUS } from "@/lib/labels";
import { METHOD_TITLES } from "@/lib/shipping";
import { npdMode } from "@/lib/npd";
import {
  attachReceiptAction, confirmTransferAction, refundAction, regenerateAction, reprintAction, sendToPrintAction, setStatusAction,
} from "../../../actions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("orders");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const o = await db.order.findUnique({
    where: { id },
    include: { items: true, payments: true, receipts: true, shipment: true, printJob: true, user: true, promoCode: true },
  });
  if (!o) notFound();
  const bookId = o.items.find((i) => i.bookId)?.bookId;
  const book = bookId ? await db.book.findUnique({ where: { id: bookId }, include: { pages: { orderBy: { index: "asc" } }, files: true } }) : null;
  // Фото видно только в заказах младше 7 дней
  const fresh = Date.now() - o.createdAt.getTime() < 7 * 86400_000;
  const photos = fresh && bookId ? await db.photo.findMany({ where: { hero: { bookId }, deletedAt: null } }) : [];
  const addr = o.shipment ? { ...(o.shipment.address as DeliveryAddress), ...(o.shipment.pvzCode ? { pvzCode: o.shipment.pvzCode, pvzAddress: o.shipment.pvzAddress ?? undefined } : {}) } : undefined;
  const logs = await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { email: true } } } });
  const hid = (name: string, v: string) => <input type="hidden" name={name} value={v} />;

  return (
    <>
      <p className="small"><Link href="/admin/zakazy">← Заказы</Link></p>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказ {o.publicCode} <span className="badge">{ORDER_STATUS[o.status]}</span></h1>

      <div className="grid2">
        <section className="panel">
          <b>Состав</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              {o.items.map((i) => <tr key={i.id}><td>{i.title}</td><td>{i.priceRub} ₽</td></tr>)}
              {o.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td>−{o.pdfCreditRub} ₽</td></tr>}
              {o.discountRub > 0 && <tr><td>Скидка {o.promoCode ? `(${o.promoCode.code})` : ""}</td><td>−{o.discountRub} ₽</td></tr>}
              <tr><td>Доставка</td><td>{o.shippingRub} ₽</td></tr>
              <tr><td><b>Итого</b></td><td><b>{o.totalRub} ₽</b></td></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <b>Покупатель и доставка</b>
          <p className="small">{o.contactName}<br />{o.contactPhone} · {o.contactEmail ?? o.user.email}</p>
          {o.shipment && (
            <p className="small">
              {METHOD_TITLES[o.shipment.method as keyof typeof METHOD_TITLES]}
              {addr && <><br />{addressLine(addr)}</>}
              {o.shipment.trackNumber && <><br />Трек: <b>{o.shipment.trackNumber}</b></>}
            </p>
          )}
          {o.utm && <p className="small muted">UTM: {JSON.stringify(o.utm)}</p>}
        </section>
      </div>

      <section className="panel">
        <b>Действия</b>
        <div className="row" style={{ marginTop: 10 }}>
          {o.status === "AWAITING_CONFIRMATION" || o.status === "PENDING_PAYMENT" ? (
            <form action={confirmTransferAction}>{hid("orderId", o.id)}<button className="btn btn--primary btn--sm">Подтвердить оплату ({o.totalRub} ₽, код {o.publicCode})</button></form>
          ) : null}
          {o.whoPrints === "bookimi" && o.status === "PAID" && !o.printJob && (
            <form action={sendToPrintAction}>{hid("orderId", o.id)}<button className="btn btn--primary btn--sm">Передать в печать</button></form>
          )}
        </div>
        {o.whoPrints === "bookimi" && !["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "CANCELLED", "REFUNDED"].includes(o.status) && (
          <form action={setStatusAction} className="row" style={{ marginTop: 10 }}>
            {hid("orderId", o.id)}
            <select className="select" name="status" defaultValue={o.status} style={{ width: "auto" }}>
              {["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"].map((s) => <option key={s} value={s}>{ORDER_STATUS[s]}</option>)}
            </select>
            <input className="input" name="track" placeholder="Трек-номер (при передаче в доставку)" defaultValue={o.shipment?.trackNumber ?? ""} style={{ width: 260 }} />
            <button className="btn btn--ghost btn--sm">Сохранить статус</button>
          </form>
        )}
        {o.paidAt && !o.receipts.some((r) => r.status === "issued") && (
          <form action={attachReceiptAction} className="row" style={{ marginTop: 10 }}>
            {hid("orderId", o.id)}
            <input className="input" name="url" placeholder="Ссылка на чек из «Мой налог»" style={{ width: 340 }} required />
            <button className="btn btn--ghost btn--sm">Прикрепить чек</button>
            <small className="muted">Режим чеков: {npdMode()}</small>
          </form>
        )}
        {o.paidAt && o.status !== "REFUNDED" && (
          <details className="edit" style={{ marginTop: 12 }}>
            <summary>Брак: перепечатать или вернуть деньги</summary>
            <div className="row" style={{ marginTop: 8 }}>
              {o.whoPrints === "bookimi" && (
                <form action={reprintAction} className="row">{hid("orderId", o.id)}<input className="input" name="reason" placeholder="Причина" style={{ width: 200 }} /><button className="btn btn--ghost btn--sm">Перепечатать бесплатно</button></form>
              )}
              <form action={refundAction} className="row">{hid("orderId", o.id)}<input className="input" name="reason" placeholder="Причина возврата" style={{ width: 200 }} required /><button className="btn btn--sm" style={{ background: "var(--danger)", color: "#fff" }}>Вернуть {o.totalRub} ₽</button></form>
            </div>
            <p className="small muted">Возврат по QR — через сервис, по переводу — обратным переводом вручную. Чек аннулируется{npdMode() === "manual" ? " — сделайте это в «Мой налог»" : " автоматически"}.</p>
          </details>
        )}
      </section>

      <div className="grid2">
        <section className="panel">
          <b>Платежи и чеки</b>
          <table className="tbl" style={{ marginTop: 8 }}>
            <tbody>
              {o.payments.map((p) => <tr key={p.id}><td>{p.provider}</td><td>{p.amountRub} ₽</td><td>{p.status}</td></tr>)}
              {o.receipts.map((r) => <tr key={r.id}><td>Чек</td><td><a href={r.url ?? "#"} target="_blank" rel="noopener">открыть</a></td><td>{r.status}</td></tr>)}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <b>Журнал</b>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {logs.map((l) => <li key={l.id}>{l.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} — {l.action} {l.actor?.email ? `(${l.actor.email})` : ""}</li>)}
          </ul>
        </section>
      </div>

      {book && (
        <section className="panel">
          <b>Книга</b> <span className="badge">{book.status}</span> <Link className="small" href={`/kabinet/kniga/${book.id}`}>открыть</Link>
          {photos.length > 0 && (
            <div className="photos" style={{ margin: "10px 0" }}>
              {await Promise.all(photos.map(async (p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <div className="photo" key={p.id}><img src={await signedUrl("photos", p.storageKey)} alt="Фото героя" /></div>
              )))}
            </div>
          )}
          <div className="cards" style={{ marginTop: 10 }}>
            {await Promise.all(book.pages.map(async (p) => (
              <div key={p.id}>
                {p.imageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="preview-img" src={await signedUrl("books", p.imageKey)} alt="" />
                )}
                <form action={regenerateAction} className="row" style={{ marginTop: 6 }}>
                  {hid("orderId", o.id)}{hid("bookId", book.id)}{hid("index", String(p.index))}
                  <span className="small">{p.index === 0 ? "Обложка" : `Разворот ${p.index}`}</span>
                  <button className="link-btn">Перегенерировать</button>
                </form>
              </div>
            )))}
          </div>
          <p className="small muted">Файлы: {book.files.map((f) => f.kind).join(", ") || "ещё нет"}</p>
        </section>
      )}
    </>
  );
}
