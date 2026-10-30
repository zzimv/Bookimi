import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ownBook } from "@/lib/api";
import { signedUrl } from "@/lib/storage";
import { BookCabinet } from "./BookCabinet";
import type { StoryText } from "@/lib/gen/text";
import { OrderTimeline } from "@/app/zakaz/OrderTimeline";
import { journeyOrder } from "@/app/zakaz/journey-data";
import { laterAddonsFor } from "@/lib/orders";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own || !own.user) notFound();
  const b = own.book;
  if (!b.paidFull) {
    return (
      <div className="panel">
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Книга ещё не оплачена</h1>
        <Link className="btn btn--primary" href={`/kniga/${id}`}>Продолжить создание</Link>
      </div>
    );
  }
  const pages = await db.bookPage.findMany({ where: { bookId: id }, orderBy: { index: "asc" } });
  const files = await db.bookFile.findMany({ where: { bookId: id } });
  const selfRead = await db.orderItem.findFirst({ where: { bookId: id, refKey: "audio-self", order: { paidAt: { not: null } } } });
  const audio = files.find((f) => f.kind === "audio");
  const text = b.text as unknown as StoryText;
  // Последний живой заказ с этой книгой — показываем, как он идёт
  const order = await db.order.findFirst({
    where: { userId: own.user.id, items: { some: { bookId: id } }, status: { notIn: ["CANCELLED", "REFUNDED", "PENDING_PAYMENT"] } },
    orderBy: { createdAt: "desc" },
    include: { shipment: true, items: { select: { bookId: true } } },
  });
  const jo = order ? await journeyOrder(order) : null;
  // «Добавить к книге» позже: цифровые допы для аудитории этой книги, ещё не купленные (мультфильм — своя панель)
  const later = await laterAddonsFor(id);
  const cover = pages.find((p) => p.index === 0);
  return (
    <>
    {order && jo && (
      <details className="panel" open={order.status !== "DELIVERED"} style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Заказ {order.publicCode}: как идёт</summary>
        <OrderTimeline order={jo} compact />
        <p className="small" style={{ margin: "8px 0 0" }}><Link href={`/zakaz/${order.id}`}>Подробнее о заказе →</Link></p>
      </details>
    )}
    <BookCabinet
      id={id}
      title={text.title}
      status={b.status}
      progress={b.progress}
      redrawsLeft={b.redrawsLeft}
      pages={await Promise.all(pages.map(async (p) => ({ index: p.index, text: p.text ?? "", url: p.imageKey ? await signedUrl("books", p.imageKey) : null })))}
      files={files.filter((f) => !f.kind.startsWith("voice-") && !f.kind.startsWith("print-")).map((f) => f.kind)}
      audioUrl={audio ? await signedUrl("books", audio.storageKey) : null}
      selfRead={Boolean(selfRead)}
      later={later}
      coverUrl={cover?.imageKey ? await signedUrl("books", cover.imageKey) : null}
    />
    </>
  );
}
