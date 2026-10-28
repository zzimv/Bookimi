import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { teamAction } from "../../actions";

const ROLES: [string, string][] = [
  ["OWNER", "Владелец — всё"],
  ["OPERATOR", "Оператор — заказы, переводы, печать, поддержка"],
  ["MARKETER", "Маркетолог — дашборд, триггеры, промокоды, SEO, без персональных данных"],
  ["CUSTOMER", "Убрать доступ"],
];

export default async function Page() {
  await requireAdmin("users");
  const team = await db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { createdAt: "asc" } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Команда</h1>
      <p className="muted">Самозанятый не нанимает сотрудников по трудовому договору: оператор и маркетолог — подрядчики по договору ГПХ. Вход — по коду на email + 2FA.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Email</th><th>Роль</th><th>2FA</th></tr></thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td>{u.email ?? u.phone}</td>
                <td>
                  <form action={teamAction} className="row">
                    <input type="hidden" name="email" value={u.email ?? ""} />
                    <select className="select" name="role" defaultValue={u.role} style={{ width: "auto" }}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className="btn btn--ghost btn--sm">Сохранить</button>
                  </form>
                </td>
                <td>{u.totpEnabled ? "включена" : "не настроена"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={teamAction} className="panel row">
        <input className="input" name="email" type="email" placeholder="email подрядчика" required style={{ width: 260 }} />
        <select className="select" name="role" style={{ width: "auto" }}>{ROLES.slice(1, 3).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn--primary btn--sm">Добавить</button>
      </form>
    </>
  );
}
