import { currentUser } from "@/lib/auth";
import { err, json } from "@/lib/api";
import { bonusFor } from "@/lib/bonus-server";

// Бонусный счёт покупателя: остаток, ближайшее сгорание, настройки (сколько можно списать в заказ).
export async function GET() {
  const user = await currentUser();
  if (!user) return err("Войдите", 401);
  return json(await bonusFor(user.id));
}
