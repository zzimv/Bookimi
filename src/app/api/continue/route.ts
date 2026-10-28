import { db } from "@/lib/db";
import { anonId, currentUser } from "@/lib/auth";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

// «Вернувшийся видит своё превью»: последняя незаконченная книга этого браузера или аккаунта.
export async function GET() {
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  const book = await db.book.findFirst({
    where: { OR: [{ anonId: anon }, ...(user ? [{ userId: user.id }] : [])], status: { in: ["TEXT_READY", "TEXT_APPROVED", "PREVIEW_QUEUED", "PREVIEW_READY"] }, paidFull: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, text: true },
  });
  if (!book) return json({ book: null });
  return json({ book: { id: book.id, status: book.status, title: (book.text as { title?: string } | null)?.title ?? "Ваша сказка" } });
}
