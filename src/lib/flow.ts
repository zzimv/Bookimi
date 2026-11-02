// Путь создания книги: какие шаги анкеты показать (src/components/quiz/QuizWizard.tsx, демо-стенд).
// Решение владельца: в начале — герои (фото или описание), дальше — «Для кого и повод» → «Книга» → «Группа» → «Детали».
//  • книга выбрана заранее (карточка, страница книги, ?skazka=) — аудитория и повод известны: Герои → (Группа) → Детали;
//  • иначе: Герои → Для кого и повод → Книга → (Группа) → Детали; аудитория и повод из ссылки (?dlya= & ?povod=) —
//    шаг «Для кого и повод» пропускается целиком, только одно из двух — шаг показывается.
// Дальше — уже не анкета: текст → подтверждение → вход (телефон + код на почту) → превью → оформление.
// Модуль безопасен для клиента.

export type FlowStep = "heroes" | "occasion" | "book" | "group" | "details";

export const FLOW_STEP_LABEL: Record<FlowStep, string> = {
  heroes: "Герои",
  occasion: "Повод",
  book: "Книга",
  group: "Группа",
  details: "Детали",
};

export interface FlowCase {
  /** Книга выбрана до анкеты. */
  preselected: boolean;
  /** Аудитория пришла из ссылки (?dlya=). */
  presetAudience?: boolean;
  /** Повод пришёл из ссылки (?povod=). */
  presetOccasion?: boolean;
  /** У выбранного сюжета есть группа (plot.group): детсад, класс. */
  group: boolean;
}

export function flowSteps(c: FlowCase): FlowStep[] {
  const steps: FlowStep[] = ["heroes"];
  if (!c.preselected) {
    if (!(c.presetAudience && c.presetOccasion)) steps.push("occasion");
    steps.push("book");
  }
  if (c.group) steps.push("group");
  steps.push("details");
  return steps;
}

/** Номер шага и всего шагов для полосы прогресса («Шаг 2 из 4»). */
export function stepProgress(steps: FlowStep[], step: FlowStep) {
  const i = Math.max(0, steps.indexOf(step));
  return { index: i + 1, total: steps.length, pct: Math.round(((i + 1) / steps.length) * 100) };
}
