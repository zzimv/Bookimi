// Возрастные группы детских книг (решение владелицы 02.11.2026): строго 2–4, 5–7 и 8–10 лет.
// Текст книги фиксирован — покупатель получает ровно написанный текст, поэтому каждая детская книга относится
// ровно к ОДНОЙ группе: той, для которой написан её текст (сегмент kids-*, ageMin/ageMax = границы группы).
// Чистый модуль без импортов: им пользуются реестр (validateContent), анкета в браузере, витрина и демо.

export interface KidAgeGroup {
  /** Значение hero.ageGroup в анкете. */
  key: "2-4" | "5-7" | "8-10";
  /** Сегмент детской аудитории (SEGMENTS в profiles.ts). */
  segment: "kids-2-4" | "kids-5-7" | "kids-8-10";
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
  { key: "2-4", segment: "kids-2-4", min: 2, max: 4, label: "2–4 года", age: 3, page: "2-4-goda" },
  { key: "5-7", segment: "kids-5-7", min: 5, max: 7, label: "5–7 лет", age: 6, page: "5-7-let" },
  { key: "8-10", segment: "kids-8-10", min: 8, max: 10, label: "8–10 лет", age: 9, page: "8-10-let" },
];

export const KID_AGE_KEYS = ["2-4", "5-7", "8-10"] as const;
export type KidAgeKey = (typeof KID_AGE_KEYS)[number];

/** Старые значения анкеты (до 02.11.2026) → новые группы. */
export const LEGACY_AGE_GROUPS: Record<string, KidAgeKey> = { "2-3": "2-4", "4-5": "5-7", "6-7": "5-7", "8-9": "8-10" };

/** Новое значение группы из нового или старого ключа; иначе undefined. */
export function normalizeAgeGroup(v: unknown): KidAgeKey | undefined {
  if (typeof v !== "string") return undefined;
  if ((KID_AGE_KEYS as readonly string[]).includes(v)) return v as KidAgeKey;
  return LEGACY_AGE_GROUPS[v];
}

export const kidGroupByKey = (key?: string | null) => KID_AGE_GROUPS.find((g) => g.key === normalizeAgeGroup(key));
export const kidGroupBySegment = (segment?: string | null) => KID_AGE_GROUPS.find((g) => g.segment === segment);
/** Группа детской книги — по её (единственному) сегменту kids-*. */
export const kidGroupOf = (segments: readonly string[]) => KID_AGE_GROUPS.find((g) => segments.includes(g.segment));
/** Группа по возрасту числом (дата рождения): младше 2 — 2–4, старше 10 — 8–10. */
export function kidGroupByAge(age: number): KidAgeGroup {
  return KID_AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? (age < 2 ? KID_AGE_GROUPS[0] : KID_AGE_GROUPS[KID_AGE_GROUPS.length - 1]);
}

const unitFor = (n: number) => {
  const m = n % 100;
  return m % 10 >= 2 && m % 10 <= 4 && (m < 12 || m > 14) ? "года" : "лет";
};

/** Подпись возраста книги для покупателя: дети — ровно «2–4 года» / «5–7 лет» / «8–10 лет». */
export function bookAgeLabel(s: { audience: string; ageMin: number; ageMax: number; segments?: readonly string[] }): string {
  if (s.audience === "ADULT") return "Для взрослых";
  if (s.audience === "PET") return "Собакам и кошкам";
  if (s.audience === "CHILD") {
    const g = (s.segments && kidGroupOf(s.segments)) || KID_AGE_GROUPS.find((x) => x.min === s.ageMin && x.max === s.ageMax);
    if (g) return g.label;
  }
  return `${s.ageMin}–${s.ageMax} ${unitFor(s.ageMax)}`;
}
