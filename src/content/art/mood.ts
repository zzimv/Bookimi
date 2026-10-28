// ВЛАДЕЛЕЦ: агент 10 (настроения иллюстраций). Никто другой этот файл не меняет.
// Агент 1 оставил рабочую базовую реализацию — её можно улучшать, не меняя сигнатуры:
//  • applyMood(svg, mood) — тонирует готовый SVG демо-иллюстрации (насыщенность, яркость, тон, декор).
//  • moodPrompt(prompt, negative, mood) — добавки настроения к промпту и негативу Qwen.
// Без фреймворков и Node API: модуль попадает в демо-бандл.
//
// requests (просьбы к интегратору, агенту 11): —

import type { Mood } from "../types";
import { drawDeco, rnd } from "./shared";

/** Применяет настроение к SVG-строке (корневой <svg> с viewBox). Без настроения — возвращает как есть. */
export function applyMood(svg: string, mood: Mood | null | undefined): string {
  if (!mood) return svg;
  const open = svg.match(/<svg\b[^>]*>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) return svg;
  const vb = open[0].match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const W = vb ? Number(vb[1]) : 1024;
  const H = vb ? Number(vb[2]) : 1024;
  const { tint, saturation, brightness, extraDeco } = mood.demo;
  const b = brightness.toFixed(3);
  const id = `mood-${mood.id}`;
  const defs = `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${saturation.toFixed(3)}"/><feComponentTransfer><feFuncR type="linear" slope="${b}"/><feFuncG type="linear" slope="${b}"/><feFuncB type="linear" slope="${b}"/></feComponentTransfer></filter></defs>`;
  const start = open.index! + open[0].length;
  const body = svg.slice(start, close);
  const deco = extraDeco ? `<g opacity=".8">${drawDeco(extraDeco, W, H, rnd(mood.id.length * 31 + W), tint, 18)}</g>` : "";
  const tintRect = `<rect width="${W}" height="${H}" fill="${tint}" opacity=".14" style="mix-blend-mode:multiply"/>`;
  return `${svg.slice(0, start)}${defs}<g filter="url(#${id})">${body}</g>${tintRect}${deco}</svg>`;
}

/** Добавки настроения к промпту и негативу Qwen. */
export function moodPrompt(prompt: string, negative: string, mood: Mood | null | undefined): { prompt: string; negative: string } {
  if (!mood) return { prompt, negative };
  return {
    prompt: mood.promptAdd ? `${prompt} Mood: ${mood.promptAdd}` : prompt,
    negative: mood.negativeAdd ? `${negative}, ${mood.negativeAdd}` : negative,
  };
}
