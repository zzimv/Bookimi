// Демо-иллюстрации для мультфильма слоями: фон без героев, полная картинка без подписей и маска героев.
// Входные данные те же, что у демо-рисовальщика книги (pipeline.drawPages), поэтому кадры совпадают с книгой.
import { renderDemoSpread } from "../../content/art/render";
import { extraDrawKind } from "../../content/art/index";
import { HERO_KIND_BY_AUDIENCE } from "../../content/types";
import type { ExtraV2T } from "../../content/answers";
import { mood as moodById } from "../../content/registry";
import type { QuizAnswers } from "../quiz";
import { extraLook, heroLook, plotInfo } from "./pipeline";
import type { CartoonSceneInput } from "./cartoon-render";

export function demoLayers(a: QuizAnswers, o: { style: string; mood: string | null; index: number; scene?: string }): NonNullable<CartoonSceneInput["layers"]> {
  const { plot } = plotInfo(a);
  const kind = HERO_KIND_BY_AUDIENCE[a.audience];
  const base = {
    plot,
    spreadIndex: o.index,
    scene: o.scene,
    artStyle: o.style,
    mood: o.mood ? moodById(o.mood) : null,
    hero: { ...heroLook(a, o.style), kind: plot.heroKind },
    extras: a.extras.map((e, i) => ({ role: e.role, kind: extraDrawKind(e.role, kind), look: extraLook(e as ExtraV2T, a, o.style, i) })),
  };
  return {
    full: Buffer.from(renderDemoSpread(base)),
    background: Buffer.from(renderDemoSpread({ ...base, layer: "background" })),
    mask: Buffer.from(renderDemoSpread({ ...base, layer: "mask" })),
  };
}

/** 14 сцен мультфильма из демо-рисовальщика: обложка → 12 разворотов → финал (размытая обложка). */
export function demoScenes(a: QuizAnswers, o: { style: string; mood: string | null; scenes?: string[] }): CartoonSceneInput[] {
  const svg = (b: Buffer) => ({ data: b, contentType: "image/svg+xml" });
  const { coverScene } = plotInfo(a);
  const cover = demoLayers(a, { ...o, index: 0, scene: o.scenes?.[0] ?? coverScene ?? undefined });
  const scenes: CartoonSceneInput[] = [{ kind: "title", image: svg(cover.full), layers: cover }];
  for (let i = 1; i <= 12; i++) {
    const l = demoLayers(a, { ...o, index: i, scene: o.scenes?.[i] });
    scenes.push({ kind: "spread", image: svg(l.full), layers: l });
  }
  scenes.push({ kind: "end", image: svg(cover.full) });
  return scenes;
}
