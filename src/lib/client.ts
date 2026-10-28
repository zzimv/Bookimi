"use client";

export async function api<T = unknown>(url: string, data?: unknown, method = data === undefined ? "GET" : "POST"): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: data instanceof FormData || data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j as { error?: string }).error ?? "Что-то пошло не так. Попробуйте ещё раз."), { status: r.status });
  return j as T;
}

/** Цель Яндекс Метрики (только если пользователь разрешил аналитику — скрипт загружен). */
export function goal(name: "quiz_start" | "photo_upload" | "preview_ready" | "choose_print" | "pay" | "text_ready", params?: object) {
  const w = window as unknown as { ym?: (...a: unknown[]) => void; __YM_ID?: number };
  if (w.ym && w.__YM_ID) w.ym(w.__YM_ID, "reachGoal", name, params);
}

export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;
