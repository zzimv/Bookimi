import { z } from "zod";
import { body, err, json, throttle } from "@/lib/api";
import { anonId, currentUser } from "@/lib/auth";
import { consentState, grantConsents } from "@/lib/consent";
import { DOC_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

// Согласия анкеты — один раз, перед первой загрузкой фото (две отдельные галочки: ПДн и фото).
// group — отдельная галочка перед первым фото другого ребёнка группы (согласие его родителей).
export async function GET() {
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  return json(await consentState({ userId: user?.id, anonId: anon }));
}

const Input = z.object({ pd: z.boolean().optional(), photo: z.boolean().optional(), group: z.boolean().optional() });

export async function POST(req: Request) {
  const t = await throttle("draft-consent", 20, 60_000);
  if (t) return t;
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  const who = { userId: user?.id, anonId: anon };
  // Фото без согласия на ПДн не принимаем: обе галочки отмечаются вместе (сервер не создаёт дублей)
  if (b.photo && !b.pd && !(await consentState(who)).pd) return err("Отметьте согласие на обработку персональных данных");
  return json(await grantConsents(who, b, { docVersion: DOC_VERSION, userAgent: req.headers.get("user-agent")?.slice(0, 300) }));
}
