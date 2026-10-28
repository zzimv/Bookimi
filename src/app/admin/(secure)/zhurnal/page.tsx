import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdmin("audit");
  const { f } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: f === "outbox" ? { action: { startsWith: "outbox." } } : f === "security" ? { action: { startsWith: "security." } } : { action: { not: { startsWith: "outbox." } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true, role: true } } },
  });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Журнал</h1>
      <div className="chips">
        <a className={`chip ${!f ? "is-active" : ""}`} href="/admin/zhurnal">Действия</a>
        <a className={`chip ${f === "outbox" ? "is-active" : ""}`} href="/admin/zhurnal?f=outbox">Исходящие сообщения</a>
        <a className={`chip ${f === "security" ? "is-active" : ""}`} href="/admin/zhurnal?f=security">Безопасность</a>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Подробности</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{l.createdAt.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td>
                <td>{l.actor?.email ?? "система"}</td>
                <td>{l.action}</td>
                <td className="small" style={{ maxWidth: 420, wordBreak: "break-word" }}>{l.details ? JSON.stringify(l.details).slice(0, 300) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
