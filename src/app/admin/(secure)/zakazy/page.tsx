import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { ORDER_STATUS } from "@/lib/labels";


export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin("orders");
  const sp = await searchParams;
  const orders = await db.order.findMany({
    where: {
      ...(sp.status ? { status: sp.status as OrderStatus } : {}),
      ...(sp.q ? { OR: [{ publicCode: { contains: sp.q.toUpperCase() } }, { contactPhone: { contains: sp.q } }, { contactEmail: { contains: sp.q.toLowerCase() } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, phone: true } } },
  });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Заказы</h1>
      <form className="row" style={{ marginBottom: 12 }}>
        <input className="input" name="q" placeholder="Код, телефон или email" defaultValue={sp.q} style={{ width: 240 }} />
        <select className="select" name="status" defaultValue={sp.status ?? ""} style={{ width: "auto" }}>
          <option value="">Все статусы</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn--ghost btn--sm">Найти</button>
      </form>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Заказ</th><th>Покупатель</th><th>Кто печатает</th><th>Сумма</th><th>Статус</th><th>Создан</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/zakazy/${o.id}`}>{o.publicCode}</Link></td>
                <td>{o.contactName ?? ""}<br /><small className="muted">{o.user.email ?? o.user.phone}</small></td>
                <td>{o.whoPrints === "self" ? "PDF" : "БУКИМИ"}</td>
                <td>{o.totalRub.toLocaleString("ru-RU")} ₽</td>
                <td><span className={`badge ${o.status === "AWAITING_CONFIRMATION" ? "badge--gold" : o.status === "REFUNDED" || o.status === "CANCELLED" ? "badge--red" : ""}`}>{ORDER_STATUS[o.status]}</span></td>
                <td>{o.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">Заказов нет</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
