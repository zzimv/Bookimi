import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, currentUser, isDemo } from "@/lib/auth";
import { getSeller } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

// Только демо-режим: образец того, какие данные будут в чеке. Не является фискальным документом.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!isDemo()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const user = await currentUser();
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  // Покупатель — свой чек; сотрудник — только с правом на заказы (маркетологу — нет)
  if (!order || !user || (order.userId !== user.id && !can(user.role, "orders"))) notFound();
  const seller = await getSeller();
  return (
    <div className="flow" style={{ maxWidth: 520 }}>
      <p className="notice"><b>ДЕМО.</b> Это не чек и не фискальный документ. В рабочем режиме здесь будет ссылка на настоящий чек из «Мой налог».</p>
      <div className="panel" style={{ fontFamily: "monospace", fontSize: 14 }}>
        <p>Чек (образец)<br />{seller.fullName} · ИНН {seller.inn}<br />Налог на профессиональный доход</p>
        {order.items.map((i) => (
          <p key={i.id}>{i.title} — {i.priceRub} ₽</p>
        ))}
        <p><b>Итого: {order.totalRub} ₽</b><br />Заказ {order.publicCode}</p>
      </div>
    </div>
  );
}
