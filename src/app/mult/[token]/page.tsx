import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { sharedCartoon } from "@/lib/cartoon";
import { signedUrl } from "@/lib/storage";

// Мультфильм по ссылке «Поделиться»: личная ссылка на 30 дней, владелец может отозвать. Не индексируется
// (metadata robots + X-Robots-Tag в middleware + Disallow в robots.txt). Без имени покупателя и данных заказа.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оживление книги", robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await sharedCartoon(token);
  if (!c) notFound();
  const files = await db.bookFile.findMany({ where: { bookId: c.bookId, kind: { in: ["cartoon", "cartoon-poster"] } } });
  const video = files.find((f) => f.kind === "cartoon");
  const poster = files.find((f) => f.kind === "cartoon-poster");
  if (!video) notFound();
  // Ссылки на файлы — подписанные на 3 часа (страницу можно держать открытой во время просмотра)
  const src = await signedUrl("books", video.storageKey, 3 * 3600);
  const posterUrl = poster ? await signedUrl("books", poster.storageKey, 3 * 3600) : undefined;
  const title = (c.book.text as { title?: string } | null)?.title ?? "Оживление книги";
  return (
    <div className="wrap" style={{ padding: "24px var(--gutter) 64px", maxWidth: 760 }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: 12 }}>{title}</h1>
      <video controls playsInline preload="metadata" poster={posterUrl} src={src} style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 16, background: "#000" }}>
        Ваш браузер не поддерживает видео.
      </video>
      <p className="small muted" style={{ marginTop: 12 }}>
        «Оживление» персональной книги. Ссылка действует до {c.shareExpiresAt!.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" })}.
      </p>
      <p style={{ marginTop: 16 }}>
        <Link className="btn btn--primary btn--sm" href="/">Сделать свою книгу в БУКИМИ</Link>
      </p>
    </div>
  );
}
