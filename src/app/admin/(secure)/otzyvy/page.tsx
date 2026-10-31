import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { reviewAction } from "../../actions";
import { normalizeSignature } from "@/lib/names";

export default async function Page() {
  await requireAdmin("reviews");
  const reviews = await db.review.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200 });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Отзывы</h1>
      <p className="muted">На сайте — только настоящие отзывы покупателей с их разрешения. Загрузить уже собранные отзывы: <code>scripts/import-reviews.ts</code> (см. data/REVIEWS.md).</p>
      {reviews.length === 0 && <p className="muted">Отзывов пока нет.</p>}
      {reviews.map((r) => (
        <div className="panel" key={r.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span><b>{normalizeSignature(r.authorName)}</b> <span className="review__stars">{"★".repeat(r.rating)}</span></span>
            <span className={`badge ${r.status === "pending" ? "badge--gold" : r.status === "rejected" ? "badge--red" : ""}`}>{r.status === "pending" ? "на модерации" : r.status === "approved" ? "опубликован" : "отклонён"}</span>
          </div>
          <p>{r.text}</p>
          <div className="row">
            {(["approved", "rejected"] as const).map((st) => (
              <form key={st} action={reviewAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={st} />
                <button className={`btn btn--sm ${st === "approved" ? "btn--primary" : "btn--ghost"}`} disabled={r.status === st}>{st === "approved" ? "Опубликовать" : "Отклонить"}</button>
              </form>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
