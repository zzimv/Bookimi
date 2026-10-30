import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminApi } from "@/lib/admin";
import { signedUrl } from "@/lib/storage";

const KINDS = ["pdf-screen", "pdf-a4", "pdf-print-210", "pdf-print-150", "print-block", "print-cover", "audio", "coloring"];

// Файлы книги для поддержки и типографии (владелец, оператор). Каждое скачивание — в журнал.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await adminApi("books");
  if (!u || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Не найдено", { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "pdf-screen";
  if (!KINDS.includes(kind) && !/^(print-)?addon-[a-z0-9-]{2,40}$/.test(kind)) return new NextResponse("Неизвестный формат", { status: 400 });
  const f = await db.bookFile.findFirst({ where: { bookId: id, kind }, orderBy: { createdAt: "desc" } });
  if (!f) return new NextResponse("Файл ещё готовится", { status: 404 });
  await db.auditLog.create({ data: { actorId: u.id, action: "admin.book.download", entity: "book", entityId: id, details: { kind } } });
  return NextResponse.redirect(new URL(await signedUrl("books", f.storageKey, 900, `${kind}.${f.storageKey.split(".").pop()}`), req.url), 302);
}
