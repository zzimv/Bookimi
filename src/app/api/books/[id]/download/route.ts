import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ownBook } from "@/lib/api";
import { signedUrl } from "@/lib/storage";

const NAMES: Record<string, string> = {
  "pdf-screen": "для-экрана.pdf",
  "pdf-a4": "домашняя-печать-A4.pdf",
  "pdf-print-210": "копицентр-21x21.pdf",
  "pdf-print-150": "копицентр-15x15.pdf",
  audio: "аудиокнига",
  coloring: "раскраска.pdf",
  "voice-mix": "мой-голос",
  cartoon: "мультфильм.mp4",
  "cartoon-vertical": "мультфильм-для-телефона.mp4",
  "addon-wallpaper-phone": "обои-для-телефона.png",
  "addon-wallpaper-desktop": "обои-для-компьютера.png",
};

// Полные файлы — только после оплаты. До оплаты — 403 (проверено тестом).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) return new NextResponse("Не найдено", { status: 404 });
  if (!own.book.paidFull) return new NextResponse("Файл доступен после оплаты", { status: 403 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "pdf-screen";
  if (!NAMES[kind]) return new NextResponse("Неизвестный формат", { status: 400 });
  const f = await db.bookFile.findFirst({ where: { bookId: id, kind }, orderBy: { createdAt: "desc" } });
  if (!f) return new NextResponse("Файл ещё готовится", { status: 404 });
  const ext = f.storageKey.split(".").pop();
  const title = ((own.book.text as { title?: string } | null)?.title ?? "книга").replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 60);
  const name = NAMES[kind].includes(".") ? `${title} — ${NAMES[kind]}` : `${title} — ${NAMES[kind]}.${ext}`;
  // Локальное хранилище даёт относительную ссылку, S3 — абсолютную
  return NextResponse.redirect(new URL(await signedUrl("books", f.storageKey, 900, name), req.url), 302);
}
