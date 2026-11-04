// Возрастные группы детских книг (решение владелицы 03.11.2026, rev 20): строго 0–3, 4–6 и 7–9 лет
// (до rev 20 — 2–4 / 5–7 / 8–10; книги перенесены 2–4→0–3, 5–7→4–6, 8–10→7–9, старые ключи анкеты переводятся).
// Текст книги фиксирован — покупатель получает ровно написанный текст, поэтому каждая детская книга относится
// ровно к ОДНОЙ группе: той, для которой написан её текст (сегмент kids-*, ageMin/ageMax = границы группы).
// Чистый модуль без импортов: им пользуются реестр (validateContent), анкета в браузере, витрина и демо.

export interface KidAgeGroup {
  /** Значение hero.ageGroup в анкете. */
  key: "0-3" | "4-6" | "7-9";
  /** Сегмент детской аудитории (SEGMENTS в profiles.ts). */
  segment: "kids-0-3" | "kids-4-6" | "kids-7-9";
  min: number;
  max: number;
  /** Подпись везде, где возраст видит покупатель. */
  label: string;
  /** Возраст числом для рисунка и подбора (середина группы). */
  age: number;
  /** Страница /vozrast/<slug>. */
  page: string;
}

export const KID_AGE_GROUPS: readonly KidAgeGroup[] = [
  { key: "0-3", segment: "kids-0-3", min: 0, max: 3, label: "0–3 года", age: 2, page: "0-3-goda" },
  { key: "4-6", segment: "kids-4-6", min: 4, max: 6, label: "4–6 лет", age: 5, page: "4-6-let" },
  { key: "7-9", segment: "kids-7-9", min: 7, max: 9, label: "7–9 лет", age: 8, page: "7-9-let" },
];

export const KID_AGE_KEYS = ["0-3", "4-6", "7-9"] as const;
export type KidAgeKey = (typeof KID_AGE_KEYS)[number];

/** Старые значения анкеты (до 02.11.2026 и группы rev 11–19) → группы rev 20. */
export const LEGACY_AGE_GROUPS: Record<string, KidAgeKey> = { "2-3": "0-3", "2-4": "0-3", "4-5": "4-6", "5-7": "4-6", "6-7": "4-6", "8-9": "7-9", "8-10": "7-9" };
/** Старые сегменты (rev 11–19) → сегменты rev 20: книги и ответы, сохранённые до переезда групп. */
export const LEGACY_SEGMENTS: Record<string, KidAgeGroup["segment"]> = { "kids-2-4": "kids-0-3", "kids-5-7": "kids-4-6", "kids-8-10": "kids-7-9" };
export const normalizeSegment = (s: string) => LEGACY_SEGMENTS[s] ?? s;

/** Новое значение группы из нового или старого ключа; иначе undefined. */
export function normalizeAgeGroup(v: unknown): KidAgeKey | undefined {
  if (typeof v !== "string") return undefined;
  if ((KID_AGE_KEYS as readonly string[]).includes(v)) return v as KidAgeKey;
  return LEGACY_AGE_GROUPS[v];
}

export const kidGroupByKey = (key?: string | null) => KID_AGE_GROUPS.find((g) => g.key === normalizeAgeGroup(key));
export const kidGroupBySegment = (segment?: string | null) => KID_AGE_GROUPS.find((g) => g.segment === (segment ? normalizeSegment(segment) : segment));
/** Группа детской книги — по её (единственному) сегменту kids-* (старые сегменты тоже понимаем). */
export const kidGroupOf = (segments: readonly string[]) => KID_AGE_GROUPS.find((g) => segments.some((s) => normalizeSegment(s) === g.segment));
/** Группа по возрасту числом (дата рождения): младше 0 — 0–3, старше 9 — 7–9. */
export function kidGroupByAge(age: number): KidAgeGroup {
  return KID_AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? (age < 0 ? KID_AGE_GROUPS[0] : KID_AGE_GROUPS[KID_AGE_GROUPS.length - 1]);
}

const unitFor = (n: number) => {
  const m = n % 100;
  return m % 10 >= 2 && m % 10 <= 4 && (m < 12 || m > 14) ? "года" : "лет";
};

/** Подпись возраста книги для покупателя: дети — ровно «0–3 года» / «4–6 лет» / «7–9 лет». */
export function bookAgeLabel(s: { audience: string; ageMin: number; ageMax: number; segments?: readonly string[] }): string {
  if (s.audience === "ADULT") return "Для взрослых";
  if (s.audience === "PET") return "Собакам и кошкам";
  if (s.audience === "CHILD") {
    const g = (s.segments && kidGroupOf(s.segments)) || KID_AGE_GROUPS.find((x) => x.min === s.ageMin && x.max === s.ageMax);
    if (g) return g.label;
  }
  return `${s.ageMin}–${s.ageMax} ${unitFor(s.ageMax)}`;
}
