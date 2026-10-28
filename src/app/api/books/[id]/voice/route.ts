import { db } from "@/lib/db";
import { err, json, ownBook, throttle } from "@/lib/api";
import { putFile, deleteFile, signedUrl } from "@/lib/storage";

// «Читаю сам»: родитель записывает книгу постранично. Доступно после покупки допа audio-self.
async function allowed(bookId: string) {
  const own = await ownBook(bookId);
  if (!own) return null;
  const bought = await db.orderItem.findFirst({ where: { bookId, refKey: "audio-self", order: { paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] } } } });
  return bought || own.admin ? own : null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await allowed(id))) return err("Доступно после покупки «Аудиокнига вашим голосом»", 403);
  const files = await db.bookFile.findMany({ where: { bookId: id, kind: { startsWith: "voice-" } }, orderBy: { kind: "asc" } });
  return json({
    pages: await Promise.all(files.map(async (f) => ({ index: Number(f.kind.replace("voice-", "")), url: await signedUrl("books", f.storageKey) }))),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("voice", 40, 60_000);
  if (t) return t;
  if (!(await allowed(id))) return err("Доступно после покупки «Аудиокнига вашим голосом»", 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const index = Number(form?.get("index"));
  if (!(file instanceof File) || !Number.isInteger(index) || index < 0 || index > 12) return err("Некорректная запись");
  if (file.size > 8 * 1024 * 1024) return err("Запись слишком длинная — не больше 3 минут на страницу");
  const ext = file.type.includes("ogg") ? "ogg" : file.type.includes("mp4") ? "m4a" : "webm";
  const kind = `voice-${String(index).padStart(2, "0")}`;
  const key = `${id}/voice/${kind}-${Date.now().toString(36)}.${ext}`;
  await putFile("books", key, Buffer.from(await file.arrayBuffer()), file.type || "audio/webm");
  const old = await db.bookFile.findMany({ where: { bookId: id, kind } });
  for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
  await db.bookFile.deleteMany({ where: { bookId: id, kind } });
  await db.bookFile.create({ data: { bookId: id, kind, storageKey: key } });
  return json({ ok: true });
}
