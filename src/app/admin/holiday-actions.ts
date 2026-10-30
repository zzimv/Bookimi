"use server";
// Действия раздела «Праздники»: владелец и маркетолог (PERMS.holidaysEdit), каждое — в журнал.
// Список хранится в настройке `holidays` (Setting, JSON); проверка — zod (holidays-core).
import { revalidateHolidays } from "@/lib/holidays-revalidate";
import { requireAdmin } from "@/lib/admin";
import { audit } from "@/lib/orders";
import { getHolidays, saveHolidays } from "@/lib/holidays";
import { moveHoliday, newHolidayId, parseHoliday, ruleLabel, type Holiday } from "@/lib/holidays-core";

export type HolidayResult = { ok: true; items: Holiday[] } | { ok: false; error: string };

async function commit(items: Holiday[]): Promise<HolidayResult> {
  await saveHolidays(items);
  revalidateHolidays();
  return { ok: true, items };
}

export async function saveHolidayAction(input: unknown): Promise<HolidayResult> {
  const u = await requireAdmin("holidaysEdit");
  const r = parseHoliday(input);
  if (!r.ok) return r;
  const items = await getHolidays();
  const h = r.holiday;
  const existing = h.id ? items.find((x) => x.id === h.id) : undefined;
  if (h.id && !existing) return { ok: false, error: "Праздник не найден — обновите страницу" };
  if (!existing) h.id = newHolidayId(h.occasionKey, items.map((x) => x.id));
  const next = existing ? items.map((x) => (x.id === h.id ? h : x)) : [...items, h];
  await audit(u.id, existing ? "holidays.update" : "holidays.create", "holiday", h.id, { title: h.title, rule: ruleLabel(h.rule), occasion: h.occasionKey, active: h.active });
  return commit(next);
}

export async function deleteHolidayAction(id: string): Promise<HolidayResult> {
  const u = await requireAdmin("holidaysEdit");
  const items = await getHolidays();
  const h = items.find((x) => x.id === id);
  if (!h) return { ok: false, error: "Праздник не найден — обновите страницу" };
  await audit(u.id, "holidays.delete", "holiday", id, { title: h.title });
  return commit(items.filter((x) => x.id !== id));
}

export async function moveHolidayAction(id: string, dir: number): Promise<HolidayResult> {
  const u = await requireAdmin("holidaysEdit");
  const items = await getHolidays();
  if (!items.some((x) => x.id === id)) return { ok: false, error: "Праздник не найден — обновите страницу" };
  await audit(u.id, "holidays.move", "holiday", id, { dir: dir < 0 ? "up" : "down" });
  return commit(moveHoliday(items, id, dir < 0 ? -1 : 1));
}

export async function toggleHolidayAction(id: string): Promise<HolidayResult> {
  const u = await requireAdmin("holidaysEdit");
  const items = await getHolidays();
  const h = items.find((x) => x.id === id);
  if (!h) return { ok: false, error: "Праздник не найден — обновите страницу" };
  await audit(u.id, "holidays.toggle", "holiday", id, { title: h.title, active: !h.active });
  return commit(items.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
}
