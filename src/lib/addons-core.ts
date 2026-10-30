// Допы по аудиториям книги: у ребёнка, подростка, взрослого и питомца — свои наборы (ASSUMPTIONS.md, «Допы по аудиториям»).
// Чистые функции без БД — общие для сервера (расчёт суммы, кабинет, catalog.json), админки и демо-стенда.
import type { AudienceKey } from "../content/profiles";

export const ADDON_AUDIENCES: AudienceKey[] = ["CHILD", "TEEN", "ADULT", "PET"];
export const ADDON_AUDIENCE_LABEL: Record<AudienceKey, string> = { CHILD: "Дети", TEEN: "Подростки", ADULT: "Взрослые", PET: "Питомцы" };
export const ADDON_SUPPLIERS = ["print", "other"] as const;
export type AddonSupplier = (typeof ADDON_SUPPLIERS)[number];

/** Доп подходит книге этой аудитории: пустой список — для всех; аудитория неизвестна — показываем все. */
export function addonFits(a: { audiences?: readonly string[] | null }, audience?: string | null) {
  if (!audience) return true;
  return !a.audiences?.length || a.audiences.includes(audience);
}

export function addonsForAudience<T extends { audiences?: readonly string[] | null }>(list: T[], audience?: string | null): T[] {
  return list.filter((a) => addonFits(a, audience));
}

/** Аудитория книги по анкете (Book.params.audience); старые анкеты без поля — детские. */
export function audienceOfParams(params: unknown): AudienceKey {
  const a = (params as { audience?: unknown } | null)?.audience;
  return typeof a === "string" && ADDON_AUDIENCES.includes(a as AudienceKey) ? (a as AudienceKey) : "CHILD";
}

/** Аудитории из формы админки (галочки). Все четыре = «для всех» (храним пустой список); ни одной — ошибка. */
export function parseAudiences(values: string[], key?: string, cartoonAudiences?: readonly string[]): { ok: true; value: string[] } | { ok: false; error: string } {
  const set = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  const bad = set.filter((v) => !ADDON_AUDIENCES.includes(v as AudienceKey));
  if (bad.length) return { ok: false, error: `Неизвестная аудитория: ${bad.join(", ")}` };
  if (!set.length) return { ok: false, error: "Отметьте хотя бы одну аудиторию — чтобы скрыть доп, снимите «вкл.»" };
  const value = set.length === ADDON_AUDIENCES.length ? [] : ADDON_AUDIENCES.filter((a) => set.includes(a));
  // «Своим голосом» — дополнение к мультфильму: не там, где мультфильма нет
  if (key === "cartoon-own-voice" && cartoonAudiences?.length) {
    const outside = (value.length ? value : ADDON_AUDIENCES).filter((a) => !cartoonAudiences.includes(a));
    if (outside.length) return { ok: false, error: `«Своим голосом» — только вместе с мультфильмом: мультфильма нет для «${outside.map((a) => ADDON_AUDIENCE_LABEL[a as AudienceKey]).join(", ")}»` };
  }
  return { ok: true, value };
}

/** Проверка остальных полей допа из админки. */
export function validateAddonFields(f: { title: string; description: string; supplier: string; kind: string }): string | null {
  const title = f.title.trim();
  if (title.length < 3 || title.length > 120) return "Название допа: от 3 до 120 символов";
  if (f.description.trim().length > 240) return "Описание допа: не длиннее 240 символов";
  if (!ADDON_SUPPLIERS.includes(f.supplier as AddonSupplier)) return "Изготовитель: типография или другой подрядчик";
  if (f.supplier === "other" && f.kind !== "PHYSICAL") return "Другой подрядчик — только для физических допов";
  return null;
}

export interface AddonForm {
  title: string;
  description: string;
  priceRub: number | null;
  percentOff: number | null;
  audiences: string[];
  supplier: string;
  isActive: boolean;
}

/**
 * Форма допа в админке целиком: цена (целое ≥ 0) или скидка 1–90%, название, описание, изготовитель, аудитории.
 * related — аудитории мультфильма и «своим голосом» (пусто — для всех): «своим голосом» не шире мультфильма.
 */
export function validateAddonForm(
  f: AddonForm,
  row: { key: string; kind: string },
  related: { cartoon?: readonly string[]; ownVoice?: readonly string[] } = {},
): { ok: true; value: AddonForm } | { ok: false; error: string } {
  if (f.priceRub != null && (!Number.isInteger(f.priceRub) || f.priceRub < 0 || f.priceRub > 1_000_000)) return { ok: false, error: "Цена допа: целое число рублей, не меньше 0" };
  if (f.percentOff != null && (!Number.isInteger(f.percentOff) || f.percentOff < 1 || f.percentOff > 90)) return { ok: false, error: "Скидка допа: от 1 до 90%" };
  const fields = validateAddonFields({ title: f.title, description: f.description, supplier: f.supplier, kind: row.kind });
  if (fields) return { ok: false, error: fields };
  const aud = parseAudiences(f.audiences, row.key, related.cartoon);
  if (!aud.ok) return aud;
  if (row.key === "cartoon" && related.ownVoice) {
    const all = (l: readonly string[]) => (l.length ? l : ADDON_AUDIENCES);
    const lost = all(related.ownVoice).filter((a) => !all(aud.value).includes(a as AudienceKey));
    if (lost.length) return { ok: false, error: `Сначала уберите «Своим голосом» у аудиторий: ${lost.map((a) => ADDON_AUDIENCE_LABEL[a as AudienceKey]).join(", ")} — без мультфильма он не продаётся` };
  }
  return { ok: true, value: { ...f, title: f.title.trim(), description: f.description.trim(), audiences: aud.value } };
}

/** Подпись «для кого» в админке и catalog.json. */
export function audiencesLabel(list: readonly string[] | null | undefined) {
  if (!list?.length) return "для всех книг";
  return list.map((a) => ADDON_AUDIENCE_LABEL[a as AudienceKey] ?? a).join(", ");
}
