import { db } from "@/lib/db";
import { userOrLogin } from "@/lib/auth";
import { cfg } from "@/lib/settings";
import { CopyField } from "../Forms";

export default async function Page() {
  const user = await userOrLogin();
  const ref = await cfg("referral");
  const [invited, paid, promos] = await Promise.all([
    db.referral.count({ where: { inviterId: user.id } }),
    db.referral.count({ where: { inviterId: user.id, paidAt: { not: null } } }),
    db.promoCode.findMany({ where: { ownerId: user.id, source: "referral_bonus" }, orderBy: { validFrom: "desc" } }),
  ]);
  const link = `https://${process.env.DOMAIN ?? "bookimi.ru"}/?ref=${user.referralCode}`;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Приведи друга</h1>
      <p>Друг получит −{ref.newbiePct}% на первую книгу, а вы — промокод −{ref.bonusPct}% за каждого друга, который оплатит заказ. Промокод приходит через {ref.delayDays} дней после оплаты друга. Промокоды копятся, в одном заказе используется один.</p>
      <div className="panel">
        <CopyField label="Ваша ссылка" value={link} />
        <CopyField label="Или промокод для друга" value={user.referralCode} />
      </div>
      <div className="kpis" style={{ marginTop: 16 }}>
        <div className="kpi"><small>Пришли по ссылке</small><b>{invited}</b></div>
        <div className="kpi"><small>Оплатили</small><b>{paid}</b></div>
        <div className="kpi"><small>Ваши промокоды</small><b>{promos.filter((p) => p.usedCount === 0).length}</b></div>
      </div>
      {promos.length > 0 && (
        <div className="tbl-wrap" style={{ marginTop: 16 }}>
          <table className="tbl"><thead><tr><th>Промокод</th><th>Скидка</th><th>Статус</th></tr></thead>
            <tbody>{promos.map((p) => <tr key={p.id}><td><b>{p.code}</b></td><td>−{p.percentOff}%</td><td>{p.usedCount ? "использован" : "доступен"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
