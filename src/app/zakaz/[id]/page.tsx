import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isDemo } from "@/lib/auth";
import { availableProviders } from "@/lib/orders";
import { canAcceptPayments } from "@/lib/settings";
import { PayBox } from "@/components/book/PayBox";
import { ruDate } from "@/lib/pricing";
import { METHOD_TITLES } from "@/lib/shipping";
import { OrderTimeline } from "../OrderTimeline";
import { ThanksPanel } from "../ThanksPanel";
import { journeyOrder } from "../journey-data";

const COPY_STATUS: Record<string, string> = {
  DRAFT: "сочиним после оплаты",
  TEXT_QUEUED: "сочиняем текст",
  TEXT_READY: "текст готов",
  TEXT_APPROVED: "текст готов",
  PREVIEW_QUEUED: "рисуем превью",
  PREVIEW_READY: "превью готово",
  FULL_QUEUED: "рисуем книгу",
  FULL_READY: "книга готова",
  FAILED: "готовим заново",
};

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/vhod?next=/zakaz/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await db.order.findUnique({ where: { id }, include: { items: true, receipts: true, shipment: true } });
  if (!order || order.userId !== user.id) notFound();
  const providers = (await canAcceptPayments()) ? await availableProviders() : [];
  const NOTES: Record<string, [string, string]> = {
    sbp_qr: ["СБП по QR-коду", "Оплата в приложении банка за минуту, чек — автоматически"],
    transfer: ["Перевод по номеру телефона или карты", "Подтверждаем вручную, обычно до 2 часов в рабочее время"],
    yookassa: ["Банковской картой", "Через ЮKassa"],
  };
  const pending = order.status === "PENDING_PAYMENT" || order.status === "AWAITING_CONFIRMATION";
  const jo = await journeyOrder(order);
  const bookId = jo.bookId;
  const print = order.whoPrints === "bookimi";
  // Благодарность — первые 3 дня после оплаты, пока заказ не уехал
  const fresh = order.paidAt && Date.now() - order.paidAt.getTime() < 3 * 86400_000 && ["PAID", "IN_PRINT"].includes(order.status);
  // Заказ «для каждого в группе»: несколько книг — список со статусами
  const bookIds = [...new Set(order.items.map((i) => i.bookId).filter(Boolean))] as string[];
  const copies = bookIds.length > 1 ? await db.book.findMany({ where: { id: { in: bookIds } }, select: { id: true, status: true, params: true, text: true } }) : [];
  const copyRows = bookIds.map((bid) => copies.find((c) => c.id === bid)).filter(Boolean).map((c) => ({ id: c!.id, status: c!.status, name: (c!.params as { hero?: { name?: string } }).hero?.name ?? "", title: (c!.text as { title?: string } | null)?.title }));
  const firstOrder = fresh ? (await db.order.count({ where: { userId: order.userId, paidAt: { not: null } } })) <= 1 : false;

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
            ) : order.items.map((i) => (
              <tr key={i.id}><td>{i.title.replace(/^Изготовление (персонализированной книги )?/, "").replace(/^на заказ: /, "")}</td><td style={{ textAlign: "right" }}>{i.priceRub.toLocaleString("ru-RU")} ₽</td></tr>
            ))}
            {order.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td style={{ textAlign: "right" }}>−{order.pdfCreditRub} ₽</td></tr>}
            {order.discountRub > 0 && <tr><td>Скидка</td><td style={{ textAlign: "right" }}>−{order.discountRub} ₽</td></tr>}
            {order.whoPrints === "bookimi" && <tr><td>Доставка: {order.shipment ? METHOD_TITLES[order.shipment.method as keyof typeof METHOD_TITLES] : ""}</td><td style={{ textAlign: "right" }}>{order.shippingRub} ₽</td></tr>}
            <tr><td><b>Итого</b></td><td style={{ textAlign: "right" }}><b>{order.totalRub.toLocaleString("ru-RU")} ₽</b></td></tr>
          </tbody>
        </table>
      </div>

      {copyRows.length > 1 && (
        <div className="panel" style={{ marginTop: 16 }} data-order-copies>
          <details open={copyRows.length <= 6}>
          <summary><b>Книги заказа — {copyRows.length}</b> <span className="small muted">в каждой свой главный герой · статус каждой</span></summary>
          <ol className="bulk-copies bulk-copies--list">
            {copyRows.map((c) => (
              <li key={c.id}>
                <span className="bulk-copies__ph" aria-hidden="true">{c.name.slice(0, 1)}</span>
                <span><b>{c.name}</b><small className="muted">{COPY_STATUS[c.status] ?? c.status}</small></span>
                {c.status === "FULL_READY" && <Link className="link-btn small" href={`/kabinet/kniga/${c.id}`}>открыть</Link>}
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
            demo={isDemo()}
            methods={providers.map((p) => ({ key: p.name, title: NOTES[p.name][0], note: NOTES[p.name][1] }))}
            thanks={{ heroAcc: jo.heroAcc, print, bookId }}
          />
        </div>
      )}

      {!pending && order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Как идёт заказ</h2>
          <OrderTimeline order={jo} />
          {print && order.shipment && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Доставка: {METHOD_TITLES[order.shipment.method as keyof typeof METHOD_TITLES] ?? order.shipment.method}
              {order.shipment.pvzAddress && <> ({order.shipment.pvzAddress})</>}
              {order.readyDate && <> · печать к {ruDate(order.readyDate)}</>}
              {order.shipment.etaDate && <> · у вас ориентировочно {ruDate(order.shipment.etaDate)}</>}
            </p>
          )}
          {order.receipts.filter((r) => r.status === "issued").map((r) => (
            <p key={r.id} className="small">Чек: <a href={r.url ?? "#"} target="_blank" rel="noopener">открыть</a></p>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            {bookId && !fresh && <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${bookId}`}>Открыть книгу в кабинете</Link>}
            {order.status === "DELIVERED" && <Link className="btn btn--ghost btn--sm" href="/kabinet/otzyv">Рассказать, как вам книга</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
