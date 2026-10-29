import { z } from "zod";
import { body, err, json, ownBook, throttle } from "@/lib/api";
import { bulkState, ensureBulkCopies } from "@/lib/bulk-server";
import { cfg } from "@/lib/settings";
import { checkInputs } from "@/lib/moderation";

export const dynamic = "force-dynamic";

// «Книга для каждого в группе»: состояние копий и включение (копии создаются один раз, повтор — правит посвящение).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own || own.book.parentBookId) return err("Не найдено", 404);
  return json(await bulkState(own.book));
}

const Input = z.object({ dedication: z.string().trim().max(300).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("bulk", 10, 60_000);
  if (t) return t;
  const own = await ownBook(id);
  if (!own || own.book.parentBookId) return err("Не найдено", 404);
  if (!(await cfg("bulk")).enabled) return err("Заказ «для каждого» сейчас недоступен", 403);
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  if (b.dedication && checkInputs([b.dedication])) return err("Уберите из посвящения недопустимые слова или ссылки");
  try {
    await ensureBulkCopies(own.book, { dedication: b.dedication });
  } catch (e) {
    return err((e as Error).message);
  }
  return json(await bulkState(own.book));
}
