// План страниц и палитра конкретной книги (rev 20) — для сервера и демо-стенда (тянет реестр сюжетов).
// Группа детской книги — по сегменту её сюжета (текст написан для одной группы), без сюжета — по группе анкеты;
// картонная 0–3 — 9 или 12 страниц по выбору покупателя (layout.board).
import { kidGroupByKey, kidGroupOf } from "../content/ages";
import { paletteFor, type BookPalette } from "../content/palettes";
import { plotBySlug } from "../content/registry";
import { layoutOf } from "./book-layout";
import { pagePlan, planFit, planIdFor, type PagePlan } from "./page-plan";

export interface BookPlanInfo {
  plan: PagePlan;
  palette: BookPalette;
  /** Подходит ли объём текста сюжета под план (иначе раскладка подгоняет: «текст ещё не под новый объём»). */
  fit: "ok" | "short" | "long";
}

export function bookPlanFor(params: unknown, storySlug?: string | null, spreadsInText?: number): BookPlanInfo {
  const plot = storySlug ? plotBySlug(storySlug) : null;
  const p = (params ?? {}) as { audience?: string; hero?: { ageGroup?: string } };
  const audience = plot?.audience ?? p.audience ?? "CHILD";
  const group = (plot?.audience === "CHILD" ? kidGroupOf(plot.segments) : undefined)?.key ?? kidGroupByKey(p.hero?.ageGroup)?.key;
  const plan = pagePlan(planIdFor({ audience, group, board: layoutOf(params).board }));
  const n = spreadsInText ?? plot?.spreads.length ?? plan.story;
  return { plan, palette: paletteFor(plot), fit: planFit(plan, n) };
}
