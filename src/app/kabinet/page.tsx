import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Черновик", ""],
  TEXT_QUEUED: ["Сочиняется", "badge--gold"],
  TEXT_READY: ["Сказка готова — посмотрите", "badge--gold"],
  TEXT_APPROVED: ["Ждёт фото", "badge--gold"],
  PREVIEW_QUEUED: ["Рисуется превью", "badge--gold"],
  PREVIEW_READY: ["Превью готово", ""],
  FULL_QUEUED: ["Рисуется полная книга", "badge--gold"],
  FULL_READY: ["Готова", ""],
  FAILED: ["Ошибка — повторите", "badge--red"],
};

export default async function Page() {
  const user = (await currentUser())!;
  const books = await db.book.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { pages: { where: { index: 0 } } } });
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои книги</h1>
      {books.length === 0 ? (
        <div className="panel">
          <p>Здесь появятся ваши книги.</p>
          <Link className="btn btn--primary" href="/sozdat">Создать первую книгу</Link>
        </div>
      ) : (
        <div className="cards">
          {await Promise.all(
            books.map(async (b) => {
              const cover = b.pages[0];
              const url = cover ? await signedUrl("books", (b.paidFull && b.status === "FULL_READY" ? cover.imageKey : cover.previewKey) ?? "") : null;
              const title = (b.text as { title?: string } | null)?.title ?? "Сказка сочиняется";
              const [label, cls] = STATUS[b.status] ?? [b.status, ""];
              return (
                <article key={b.id} className="panel" style={{ padding: 14 }}>
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="preview-img" style={{ aspectRatio: 1, objectFit: "cover", marginBottom: 10 }} />
                  )}
                  <span className={`badge ${cls}`}>{label}</span>
                  <h3 style={{ margin: "8px 0" }}>{title}</h3>
                  <div className="row">
                    {b.paidFull ? (
                      <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${b.id}`}>Открыть</Link>
                    ) : (
                      <Link className="btn btn--primary btn--sm" href={b.status === "PREVIEW_READY" ? `/kniga/${b.id}/kupit` : `/kniga/${b.id}`}>
                        {b.status === "PREVIEW_READY" ? "Оформить" : "Продолжить"}
                      </Link>
                    )}
                    {b.paidFull && <Link className="btn btn--ghost btn--sm" href={`/kniga/${b.id}/kupit?pechat=1`}>Заказать печать</Link>}
                  </div>
                </article>
              );
            }),
          )}
        </div>
      )}
    </>
  );
}
