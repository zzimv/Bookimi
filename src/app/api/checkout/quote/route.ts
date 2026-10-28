import { body, err, json, throttle, ownBook } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { priceCheckout } from "@/lib/orders";
import { Checkout } from "@/lib/checkout-schema";

// Предварительный расчёт суммы — только на сервере.
export async function POST(req: Request) {
  const t = await throttle("quote", 60, 60_000);
  if (t) return t;
  const b = await body(req, Checkout);
  if (!b) return err("Некорректный запрос");
  const own = await ownBook(b.bookId);
  if (!own) return err("Не найдено", 404);
  const user = await currentUser();
  const r = await priceCheckout(user?.id ?? "anon", b);
  return json(r);
}
