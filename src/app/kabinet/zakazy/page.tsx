import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ruDate } from "@/lib/pricing";

const ST: Record<string, string> = {
  PENDING_PAYMENT: "Ждёт оплаты", AWAITING_CONFIRMATION: "Проверяем перевод", PAID: "Оплачен", IN_PRINT: "В печати",
  PACKED: "Упакован", SHIPPED: "Передан в доставку", DELIVERED: "Доставлен", CANCELLED: "Отменён", REFUNDED: "Возврат",
};

export default async function Page() {
  const user = (await currentUser())!;
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { receipts: true, shipment: true, items: true } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказы</h1>
      {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Заказ</th><th>Статус</th><th>Сумма</th><th>Готовность / трек</th><th>Чек</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/zakaz/${o.id}`}>{o.publicCode}</Link><br /><small className="muted">{o.createdAt.toLocaleDateString("ru-RU")}</small></td>
                  <td>{ST[o.status]}</td>
                  <td>{o.totalRub.toLocaleString("ru-RU")} ₽</td>
                  <td>{o.readyDate ? ruDate(o.readyDate) : "—"}{o.shipment?.trackNumber && <><br />Трек: {o.shipment.trackNumber}</>}</td>
                  <td>{o.receipts.filter((r) => r.status === "issued").map((r) => <a key={r.id} href={r.url ?? "#"} target="_blank" rel="noopener">чек</a>)}</td>
                  <td>{o.items[0]?.bookId && <Link href={`/kniga/${o.items[0].bookId}/kupit`}>Повторить</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
