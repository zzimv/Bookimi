import { z } from "zod";
import { CUSTOM_STORY_ENABLED } from "@/content/sections";
import "@/lib/zod-ru";
import { AnswersV2 } from "@/lib/quiz";
import { body, deviceKey, err, json, throttle } from "@/lib/api";
import { cfg } from "@/lib/settings";
import { textProvider } from "@/lib/gen/text";
import { checkInputs } from "@/lib/moderation";
import { hit } from "@/lib/limits";
import { soonAudiences, soonCreateError } from "@/lib/shelf";

// «Своя идея»: 1–2 предложения → 3 варианта сюжета на выбор.
export async function POST(req: Request) {
  // rev 20: «Своя история» выключена (CUSTOM_STORY_ENABLED) — идей не предлагаем
  if (!CUSTOM_STORY_ENABLED) return err("Выберите книгу из каталога", 404);
  const t = await throttle("ideas", 5, 60_000);
  if (t) return t;
  const b = await body(req, z.object({ idea: z.string().trim().min(5).max(300), answers: z.unknown() }));
  if (!b) return err("Опишите идею в одном-двух предложениях");
  if (checkInputs([b.idea])) return err("Уберите недопустимые слова или ссылки");
  if (!(await hit(await deviceKey(), "ideas", 10))) return err("На сегодня идей достаточно — выберите один из вариантов", 429);
  const a = AnswersV2.safeParse(b.answers);
  // Аудитория «скоро» (storefront.soon): идей не придумываем — книгу всё равно не создать
  if (a.success && soonAudiences((await cfg("storefront")).soon).includes(a.data.audience)) return err(soonCreateError(a.data.audience), 403);
  const ai = await cfg("ai");
  try {
    const ideas = await textProvider(ai.text).ideas(b.idea, a.success ? a.data : AnswersV2.parse({ hero: { name: "-", gender: "boy" } }));
    return json({ ideas });
  } catch {
    return err("Не получилось придумать варианты. Попробуйте ещё раз.", 502);
  }
}
