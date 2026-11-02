import { enabledOAuth } from "@/lib/oauth";
import { cfg } from "@/lib/settings";
import { json } from "@/lib/api";

// Для формы входа: какие внешние аккаунты настроены (по умолчанию — ни одного) и включён ли вход по SMS.
export async function GET() {
  const auth = await cfg("auth");
  return json({ oauth: enabledOAuth(), smsLogin: Boolean(auth.smsLogin) });
}
