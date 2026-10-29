import Link from "next/link";
import { db } from "@/lib/db";
import { userOrLogin } from "@/lib/auth";
import { ruDate } from "@/lib/pricing";
import { journeyLine } from "@/app/zakaz/journey";

const ST: Record<string, string> = {
  PENDING_PAYMENT: "Ждёт оплаты", AWAITING_CONFIRMATION: "Проверяем перевод", PAID: "Оплачен", IN_PRINT: "В печати",
  PACKED: "Упакован", SHIPPED: "Передан в доставку", DELIVERED: "Доставлен", CANCELLED: "Отменён", REFUNDED: "Возврат",
};

export default async function Page() {
  const user = await userOrLogin();
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { receipts: true, shipment: true, items: { include: { book: { select: { status: true, fullReadyAt: true } } } } } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказы</h1>
      {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : (
        <div className="tbl-wrap">
          <table className="tbl tbl--cards">
            <thead><tr><th>Заказ</th><th>Статус</th><th>Сумма</th><th>Готовность / трек</th><th>Чек</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td data-label="Заказ" style={{ whiteSpace: "nowrap" }}><Link href={`/zakaz/${o.id}`}>{o.publicCode}</Link><br /><small className="muted">{o.createdAt.toLocaleDateString("ru-RU")}</small></td>
                  <td data-label="Статус">
                    {ST[o.status]}
                    {(() => {
                      const book = o.items.find((i) => i.book)?.book;
                      const line = journeyLine({ ...o, bookReadyAt: book?.status === "FULL_READY" ? (book.fullReadyAt ?? o.paidAt) : null });
                      return line && o.status !== "PENDING_PAYMENT" ? <><br /><small className="muted">{line}</small></> : null;
                    })()}
                  </td>
                  <td data-label="Сумма" style={{ whiteSpace: "nowrap" }}>{o.totalRub.toLocaleString("ru-RU")} ₽</td>
                  <td data-label="Готовность">{o.readyDate ? ruDate(o.readyDate) : "—"}{o.shipment?.trackNumber && <><br />Трек: {o.shipment.trackNumber}</>}</td>
                  <td data-label="Чек">{o.receipts.filter((r) => r.status === "issued").map((r) => <a key={r.id} href={r.url ?? "#"} target="_blank" rel="noopener">чек</a>)}</td>
                  <td data-label="">{o.items[0]?.bookId && <Link href={`/kniga/${o.items[0].bookId}/kupit`}>Повторить</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
