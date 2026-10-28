import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { ticketAction } from "../../actions";

export default async function Page() {
  await requireAdmin("support");
  const tickets = await db.supportTicket.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Поддержка</h1>
      {tickets.length === 0 && <p className="muted">Обращений нет.</p>}
      {tickets.map((t) => (
        <div className="panel" key={t.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>{t.contact}</b>
            <span className={`badge ${t.status === "open" ? "badge--gold" : ""}`}>{t.status === "open" ? "новое" : t.status === "answered" ? "отвечено" : "закрыто"}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{t.message}</p>
          <form action={ticketAction} className="row">
            <input type="hidden" name="id" value={t.id} />
            <input className="input" name="answer" placeholder="Заметка или ответ (отправьте покупателю в его канал)" defaultValue={t.answer ?? ""} style={{ flex: 1, minWidth: 240 }} />
            <select className="select" name="status" defaultValue={t.status} style={{ width: "auto" }}>
              <option value="open">новое</option><option value="answered">отвечено</option><option value="closed">закрыто</option>
            </select>
            <button className="btn btn--ghost btn--sm">Сохранить</button>
          </form>
        </div>
      ))}
    </>
  );
}
