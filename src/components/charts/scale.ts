// Общие расчёты для графиков: «красивый» максимум оси, деления, форматирование чисел.

/** Округляет максимум вверх до «красивого» числа: 1, 2, 2.5, 5 × 10^n. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/** Деления оси: 0 … max, count интервалов. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

export function fmtNum(n: number, unit = ""): string {
  const s = Math.round(n).toLocaleString("ru-RU");
  return unit ? `${s} ${unit}` : s;
}

/** Короткая подпись оси: 12 000 → «12 тыс.», 1 500 000 → «1,5 млн». */
export function fmtShort(n: number, unit = ""): string {
  const a = Math.abs(n);
  const u = unit ? ` ${unit}` : "";
  if (a >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн${u}`;
  if (a >= 10_000) return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс.${u}`;
  return `${Math.round(n).toLocaleString("ru-RU")}${u}`;
}
