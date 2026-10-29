import type { MoodEx } from "../content/moods";

/** Образец цвета настроения для карточек выбора: тонировка + свечение демо, для «как задумал художник» — нейтральный. */
export function moodSwatch(m: Pick<MoodEx, "demo">) {
  const t = m.demo.tint && m.demo.tint.toLowerCase() !== "#ffffff" ? m.demo.tint : m.demo.glow?.color;
  return t ? `linear-gradient(135deg, ${t}, ${m.demo.glow?.color ?? t})` : "linear-gradient(135deg, #e3ede6, #f3e4c2)";
}
