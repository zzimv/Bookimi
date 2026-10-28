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

export const metadata: Metadata = { title: "Заказ", robots: { index: false } };
export const dynamic = "force-dynamic";

const FLOW = [
  ["PAID", "Оплачен"],
  ["IN_PRINT", "В печати"],
  ["PACKED", "Упакован"],
  ["SHIPPED", "Передан в доставку"],
  ["DELIVERED", "Доставлен"],
] as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/vhod?next=/zakaz/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await db.order.findUnique({ where: { id }, include: { items: true, receipts: true, shipment: true } });
  if (!order || (order.userId !== user.id && user.role === "CUSTOMER")) notFound();
  const providers = (await canAcceptPayments()) ? await availableProviders() : [];
  const NOTES: Record<string, [string, string]> = {
    sbp_qr: ["СБП по QR-коду", "Оплата в приложении банка за минуту, чек — автоматически"],
    transfer: ["Перевод по номеру телефона или карты", "Подтверждаем вручную, обычно до 2 часов в рабочее время"],
    yookassa: ["Банковской картой", "Через ЮKassa"],
  };
  const bookId = order.items.find((i) => i.bookId)?.bookId;
  const pending = order.status === "PENDING_PAYMENT" || order.status === "AWAITING_CONFIRMATION";
  const idx = FLOW.findIndex(([k]) => k === order.status);

  return (
    <div className="flow">
      <p className="small muted">Заказ {order.publicCode}</p>
      <h1>{pending ? "Оплата заказа" : order.status === "CANCELLED" ? "Заказ отменён" : order.status === "REFUNDED" ? "Деньги возвращены" : "Спасибо за заказ!"}</h1>

      <div className="panel">
        <table className="tbl" style={{ border: 0 }}>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}><td>{i.title.replace(/^Изготовление (персонализированной книги )?/, "").replace(/^на заказ: /, "")}</td><td style={{ textAlign: "right" }}>{i.priceRub.toLocaleString("ru-RU")} ₽</td></tr>
            ))}
            {order.pdfCreditRub > 0 && <tr><td>Зачёт PDF</td><td style={{ textAlign: "right" }}>−{order.pdfCreditRub} ₽</td></tr>}
            {order.discountRub > 0 && <tr><td>Скидка</td><td style={{ textAlign: "right" }}>−{order.discountRub} ₽</td></tr>}
            {order.whoPrints === "bookimi" && <tr><td>Доставка: {order.shipment ? METHOD_TITLES[order.shipment.method as keyof typeof METHOD_TITLES] : ""}</td><td style={{ textAlign: "right" }}>{order.shippingRub} ₽</td></tr>}
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
            demo={isDemo()}
            methods={providers.map((p) => ({ key: p.name, title: NOTES[p.name][0], note: NOTES[p.name][1] }))}
          />
        </div>
      )}

      {!pending && order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
        <div className="panel" style={{ marginTop: 16 }}>
          {order.whoPrints === "bookimi" ? (
            <>
              <ol className="timeline">
                {FLOW.map(([k, label], i) => (
                  <li key={k} className={i <= idx ? "done" : ""}>{label}</li>
                ))}
              </ol>
              {order.readyDate && <p>Дата готовности: <b>{ruDate(order.readyDate)}</b>{order.shipment?.etaDate && <> · доставка ориентировочно к <b>{ruDate(order.shipment.etaDate)}</b></>}</p>}
              {order.shipment?.trackNumber && <p>Трек-номер: <b>{order.shipment.trackNumber}</b></p>}
            </>
          ) : (
            <p>Книга рисуется. PDF во всех форматах появится в личном кабинете — пришлём сообщение.</p>
          )}
          {order.receipts.filter((r) => r.status === "issued").map((r) => (
            <p key={r.id} className="small">Чек: <a href={r.url ?? "#"} target="_blank" rel="noopener">открыть</a></p>
          ))}
          {bookId && <Link className="btn btn--primary" href={`/kabinet/kniga/${bookId}`}>Открыть книгу в кабинете</Link>}
        </div>
      )}
    </div>
  );
}
