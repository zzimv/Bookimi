import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { SupportForm } from "../Forms";

export default async function Page() {
  const user = (await currentUser())!;
  const orders = await db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const tg = process.env.TELEGRAM_SUPPORT_URL;
  const max = process.env.MAX_SUPPORT_URL;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Поддержка</h1>
      {(tg || max) && (
        <p className="row">
          {tg && <a className="btn btn--ghost btn--sm" href={tg} target="_blank" rel="noopener">Написать в Telegram</a>}
          {max && <a className="btn btn--ghost btn--sm" href={max} target="_blank" rel="noopener">Написать в MAX</a>}
        </p>
      )}
      <SupportForm orders={orders.map((o) => ({ id: o.id, code: o.publicCode }))} contact={user.email ?? user.phone ?? ""} />
    </>
  );
}
