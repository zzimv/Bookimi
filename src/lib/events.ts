// События воронки: в funnel_events (для дашборда и триггеров) и, на клиенте, в Яндекс Метрику.
import { db } from "./db";

export type FunnelName =
  | "quiz_start"
  | "quiz_step"
  | "text_ready"
  | "text_approved"
  | "photo_upload"
  | "preview_ready"
  | "choose_print"
  | "checkout"
  | "pay"
  | "delivered"
  | "review"
  | "mood_change";

export async function track(name: FunnelName, ctx: { anonId?: string; userId?: string | null; props?: object; source?: string; device?: string }) {
  try {
    await db.funnelEvent.create({
      data: {
        name,
        anonId: ctx.anonId ?? "server",
        userId: ctx.userId ?? undefined,
        props: (ctx.props ?? undefined) as object | undefined,
        source: ctx.source,
        device: ctx.device,
      },
    });
  } catch {
    /* аналитика не должна ломать основной сценарий */
  }
}

export function deviceFromUa(ua: string | null) {
  if (!ua) return "unknown";
  return /mobile|android|iphone/i.test(ua) ? "mobile" : /ipad|tablet/i.test(ua) ? "tablet" : "desktop";
}
