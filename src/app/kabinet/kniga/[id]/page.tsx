import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ownBook } from "@/lib/api";
import { signedUrl } from "@/lib/storage";
import { BookCabinet } from "./BookCabinet";
import type { StoryText } from "@/lib/gen/text";

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
  return (
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
    />
  );
}
