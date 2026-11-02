import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { revokeSessionAction, teamAction } from "../../actions";
import { deviceLabel, STAFF_SESSION_HOURS } from "@/lib/auth";

const ROLES: [string, string][] = [
  ["OWNER", "Владелец — всё"],
  ["OPERATOR", "Оператор — заказы, переводы, печать, поддержка"],
  ["MARKETER", "Маркетолог — дашборд, триггеры, промокоды, SEO, без персональных данных"],
  ["CUSTOMER", "Убрать доступ"],
];

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireAdmin("users");
  const { error } = await searchParams;
  const team = await db.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { createdAt: "asc" } });
  // Активные сессии админки (не старше 12 часов) и последние входы
  const since = new Date(Date.now() - STAFF_SESSION_HOURS * 3600_000);
  const sessions = await db.session.findMany({ where: { scope: "staff", expiresAt: { gt: new Date() }, createdAt: { gt: since } }, include: { user: { select: { email: true, role: true } } }, orderBy: { createdAt: "desc" } });
  const logins = await db.auditLog.findMany({ where: { action: "admin.login" }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { email: true } } } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Команда</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted">Самозанятый не нанимает сотрудников по трудовому договору: оператор и маркетолог — подрядчики по договору ГПХ. Вход — по коду на email + 2FA.</p>
      <div className="tbl-wrap">
        <table className="tbl tbl--cards">
          <thead><tr><th>Email</th><th>Роль</th><th>2FA</th></tr></thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td data-label="Email">{u.email ?? u.phone}</td>
                <td data-label="Роль">
                  <form action={teamAction} className="row">
                    <input type="hidden" name="email" value={u.email ?? ""} />
                    <select className="select" name="role" defaultValue={u.role} style={{ width: "auto" }}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                    <button className="btn btn--ghost btn--sm">Сохранить</button>
                  </form>
                </td>
                <td data-label="2FA">{u.totpEnabled ? "включена" : "не настроена"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Активные сессии админки</h2>
      <p className="muted small">Сессия живёт 12 часов. Завершённая сессия выходит из админки сразу; вход — заново по коду и 2FA.</p>
      <div className="tbl-wrap">
        <table className="tbl tbl--cards">
          <thead><tr><th>Сотрудник</th><th>Вход</th><th>IP</th><th>Устройство</th><th></th></tr></thead>
          <tbody>
            {sessions.map((x) => (
              <tr key={x.id}>
                <td data-label="Сотрудник">{x.user.email} · {x.user.role}</td>
                <td data-label="Вход">{x.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}{x.mfaPassed ? "" : " · без 2FA"}</td>
                <td data-label="IP">{x.ip ?? "—"}</td>
                <td data-label="Устройство">{x.userAgent ? deviceLabel(x.userAgent) : "—"}</td>
                <td>
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="id" value={x.id} />
                    <button className="btn btn--ghost btn--sm">{x.userId === me.id ? "Выйти здесь" : "Завершить"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {!sessions.length && <tr><td colSpan={5} className="muted">Нет активных сессий</td></tr>}
          </tbody>
        </table>
      </div>
      <details style={{ marginTop: 12 }}>
        <summary className="small">Последние входы в админку</summary>
        <ul className="small">
          {logins.map((l) => {
            const d = (l.details ?? {}) as { ip?: string; userAgent?: string; newIp?: boolean; newDevice?: boolean };
            return <li key={l.id}>{l.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} — {l.actor?.email ?? "?"}, IP {d.ip}, {deviceLabel(d.userAgent ?? "")}{d.newIp ? " · новый IP" : ""}{d.newDevice ? " · новое устройство" : ""}</li>;
          })}
        </ul>
      </details>
      <form action={teamAction} className="panel row">
        <input className="input" name="email" type="email" placeholder="email подрядчика" required style={{ width: 260, maxWidth: "100%" }} />
        <select className="select" name="role" style={{ width: "auto" }}>{ROLES.slice(1, 3).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn--primary btn--sm">Добавить</button>
      </form>
    </>
  );
}
