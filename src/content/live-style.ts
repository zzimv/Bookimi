// rev 17: стиль картинок для покупателя (детям — 5 живых). Отдельно от profiles.ts: тот — только данные
// (демо-сборка вычисляет его и упаковывает как JSON, функции туда не попадают).
import { ART_STYLE_LEGACY, DEFAULT_ART_STYLE, KIDS_LIVE_ART_STYLES } from "./profiles";

/** Живой стиль: живой — как есть; скрытый (archived) или неизвестный — ближайший из пяти (ART_STYLE_LEGACY). */
export function liveArtStyle(id: string | undefined | null): string {
  const v = (id ?? "").trim();
  if ((KIDS_LIVE_ART_STYLES as readonly string[]).includes(v)) return v;
  return ART_STYLE_LEGACY[v] ?? DEFAULT_ART_STYLE;
}
