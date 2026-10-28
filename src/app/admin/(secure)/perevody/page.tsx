import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { confirmTransferAction } from "../../actions";

export default async function Page() {
  await requireAdmin("transfers");
  const orders = await db.order.findMany({ where: { status: { in: ["AWAITING_CONFIRMATION", "PENDING_PAYMENT"] }, payments: { some: { provider: "transfer" } } }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Переводы на подтверждении</h1>
      <p className="muted">Сверьте сумму и код заказа в комментарии к переводу в банке. После подтверждения — чек НПД и запуск заказа.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Код (комментарий)</th><th>Сумма</th><th>Покупатель</th><th>Статус</th><th>Ждёт с</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/zakazy/${o.id}`}><b>{o.publicCode}</b></Link></td>
                <td><b>{o.totalRub.toLocaleString("ru-RU")} ₽</b></td>
                <td>{o.contactName}</td>
                <td>{o.status === "AWAITING_CONFIRMATION" ? <span className="badge badge--gold">нажал «Я оплатил»</span> : "ещё не отметил"}</td>
                <td>{o.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
                <td><form action={confirmTransferAction}><input type="hidden" name="orderId" value={o.id} /><button className="btn btn--primary btn--sm">Деньги пришли</button></form></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">Нет переводов на подтверждении</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
