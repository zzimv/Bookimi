import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { promoAction } from "../../actions";

const SRC: Record<string, string> = { manual: "вручную", blogger: "блогер", referral_bonus: "за друга", trigger: "триггер", referral_newbie: "новичок" };

export default async function Page() {
  await requireAdmin("promo");
  const promos = await db.promoCode.findMany({ orderBy: { validFrom: "desc" }, take: 200 });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Промокоды</h1>
      <form action={promoAction} className="panel">
        <b>Новый промокод</b>
        <div className="row" style={{ marginTop: 10 }}>
          <input className="input" name="code" placeholder="КОД" required style={{ width: 150 }} />
          <input className="input" name="percentOff" type="number" placeholder="% скидки" style={{ width: 110 }} />
          <input className="input" name="amountOffRub" type="number" placeholder="или ₽" style={{ width: 100 }} />
          <input className="input" name="maxUses" type="number" placeholder="Лимит" style={{ width: 90 }} />
          <input className="input" name="validTo" type="date" style={{ width: 160 }} />
          <input className="input" name="blogger" placeholder="utm_source блогера" style={{ width: 180 }} />
          <button className="btn btn--primary btn--sm">Создать</button>
        </div>
        <small className="muted">Если указан utm_source блогера — промокод применится автоматически к заказам с этой меткой.</small>
      </form>
      <div className="tbl-wrap" style={{ marginTop: 16 }}>
        <table className="tbl">
          <thead><tr><th>Код</th><th>Скидка</th><th>Источник</th><th>Использован</th><th>До</th><th>Активен</th></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td><b>{p.code}</b></td>
                <td>{p.percentOff ? `−${p.percentOff}%` : `−${p.amountOffRub} ₽`}</td>
                <td>{SRC[p.source] ?? p.source}{p.blogger ? ` (${p.blogger})` : ""}</td>
                <td>{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ""}</td>
                <td>{p.validTo ? p.validTo.toLocaleDateString("ru-RU") : "—"}</td>
                <td>
                  <form action={promoAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="isActive" value={p.isActive ? "false" : "true"} />
                    <button className="link-btn">{p.isActive ? "выключить" : "включить"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
