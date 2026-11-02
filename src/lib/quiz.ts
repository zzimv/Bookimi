// Анкета создания книги: варианты-чипсы и проверка ответов. Используется и в браузере, и на сервере.
// Схема ответов — AnswersV2 (src/content/answers.ts): 4 аудитории, старые черновики разбираются без потерь
// (style → artStyle, роли доп. героев сохраняются). Модуль безопасен для клиента: без промптов и планов сюжетов.
import { sampleUrl } from "./obrazec";
import { AnswersV2, heroKindFor, type AnswersV2T } from "../content/answers";
import { OCCASIONS, SEGMENTS, type AudienceKey } from "../content/profiles";
import { dedicationsFor } from "./dedications";
import { KID_AGE_GROUPS, kidGroupByAge, kidGroupByKey } from "../content/ages";

export { AnswersV2, ContactV2, normalizePhone, extraGender } from "../content/answers";

/** Ответы анкеты (v2). Старое имя оставлено для совместимости импортов. */
export const Answers = AnswersV2;
export type QuizAnswers = AnswersV2T;

/** Возраст ребёнка в анкете: строго 2–4, 5–7, 8–10 (src/content/ages.ts) — как фильтры каталога и группы книг. */
export const AGE_GROUPS = KID_AGE_GROUPS.map((g) => ({ key: g.key, label: g.label, age: g.age, segment: g.segment }));
export { KID_AGE_GROUPS, kidGroupByKey, kidGroupOf, bookAgeLabel } from "../content/ages";

export const HAIR = ["светлые", "русые", "каштановые", "тёмные", "рыжие", "чёрные"];
export const HAIR_ADULT = [...HAIR, "седые", "с проседью"];
export const HAIRSTYLE = ["короткая стрижка", "чёлка", "длинные", "кудряшки", "хвостик", "косички"];
export const CLOTHES = ["футболка", "платье", "комбинезон", "толстовка с капюшоном", "свитер", "спортивный костюм"];
export const SKIN = ["светлый", "смуглый", "тёмный"];
export const FUR = ["рыжий", "чёрный", "белый", "серый", "коричневый", "палевый", "трёхцветный", "полосатый"];
export const INTERESTS = [
  { key: "динозавры", hint: "в сказке появится добрый динозавр" },
  { key: "космос", hint: "звёзды, ракеты и карта неба" },
  { key: "принцессы", hint: "корона и бал" },
  { key: "машины", hint: "любимая машинка поедет с героем" },
  { key: "животные", hint: "зверята станут друзьями героя" },
  { key: "спорт", hint: "герой быстрее всех" },
  { key: "рисование", hint: "волшебные краски" },
  { key: "музыка", hint: "песня, которая помогает" },
  { key: "супергерои", hint: "плащ и суперсила доброты" },
  { key: "море", hint: "ракушки, волны и маяк" },
];

/** Увлечения подростков — свой список, без «принцесс и машинок». */
export const TEEN_INTERESTS = ["игры", "музыка", "спорт", "рисование", "космос", "детективы", "кино и сериалы", "программирование", "животные", "путешествия"];

/** Возрастные группы взрослых → возраст числом (для сегмента и рисунка). */
export const ADULT_AGES = [
  { key: "25", label: "до 30" },
  { key: "38", label: "30–45" },
  { key: "52", label: "45–60" },
  { key: "67", label: "60+" },
] as const;

/** Роли доп. героев по аудитории (после ролей сюжета); «свой вариант» — всегда. */
export const AUDIENCE_EXTRA_ROLES: Record<AudienceKey, string[]> = {
  CHILD: ["sibling", "mom", "dad", "grandma", "grandpa", "friend", "pet", "toy", "custom"],
  TEEN: ["friend", "sibling", "mom", "dad", "grandma", "grandpa", "pet", "custom"],
  ADULT: ["partner", "child", "grandchild", "friend", "colleague", "pet", "custom"],
  PET: ["owner", "pet", "child", "custom"],
};

/** Поводы для аудитории (из profiles.ts), «свой» и «без повода» — в конце. */
export function occasionChips(audience: AudienceKey = "CHILD") {
  return OCCASIONS.filter((o) => o.audiences.includes(audience)).map((o) => ({ key: o.key, label: o.label }));
}
/** Детские поводы — старый список чипсов. */
export const OCCASION_CHIPS = occasionChips("CHILD");

export const EXTRA_ROLE_LABELS: Record<string, string> = {
  sibling: "Брат или сестра",
  mom: "Мама",
  dad: "Папа",
  grandma: "Бабушка",
  grandpa: "Дедушка",
  pet: "Питомец",
  partner: "Вторая половинка",
  friend: "Друг или подружка",
  toy: "Любимая игрушка",
  child: "Ребёнок",
  grandchild: "Внук или внучка",
  owner: "Хозяин или хозяйка",
  colleague: "Коллега",
  custom: "Свой вариант",
};
/** Роли доп. героев по умолчанию для детской книги (старый список). */
export const EXTRA_ROLES = ["sibling", "mom", "dad", "grandma", "grandpa", "pet"].map((key) => ({ key, label: EXTRA_ROLE_LABELS[key] }));
export const extraRoleItems = (roles: string[]) => roles.map((key) => ({ key, label: EXTRA_ROLE_LABELS[key] ?? key }));

// Посвящения — по аудитории и поводу, с формами рода ({Р:м|ж}): src/lib/dedications.ts
export { dedicationsFor } from "./dedications";
export const DEDICATIONS = dedicationsFor("CHILD");

const DEFAULT_AGE: Record<AudienceKey, number> = { CHILD: 5, TEEN: 14, ADULT: 35, PET: 3 };

/** Возраст героя: число из анкеты → дата рождения → возрастная группа → по аудитории. */
export function heroAge(a: Pick<QuizAnswers, "hero" | "audience">) {
  if (typeof a.hero.age === "number") return a.hero.age;
  if (a.hero.birthDate) {
    const b = new Date(a.hero.birthDate);
    if (!isNaN(+b)) return Math.max(a.audience === "PET" ? 0 : 1, Math.floor((Date.now() - +b) / (365.25 * 86400_000)));
  }
  const g = kidGroupByKey(a.hero.ageGroup)?.age;
  return g ?? DEFAULT_AGE[(a.audience ?? "CHILD") as AudienceKey];
}

/** Возраст точно известен (для {ВОЗРАСТ}): указан числом или датой рождения. */
export function exactAge(a: Pick<QuizAnswers, "hero" | "audience">): number | undefined {
  if (typeof a.hero.age === "number" || a.hero.birthDate) return heroAge(a);
  return undefined;
}

/** Сегмент анкеты: явный → по сюжету и возрасту → первый сегмент аудитории. */
export function segmentFor(a: QuizAnswers, plotSegments: string[] = []) {
  const all = SEGMENTS.filter((s) => s.audience === a.audience);
  const explicit = all.find((s) => s.id === a.segment);
  if (explicit) return explicit;
  const pool = plotSegments.length ? all.filter((s) => plotSegments.includes(s.id)) : all;
  // Дети: группа анкеты → сегмент 1:1 (у детской книги ровно одна группа — она и главнее)
  if (a.audience === "CHILD") {
    const byPlot = pool.length === 1 && plotSegments.length ? pool[0] : undefined;
    const g = kidGroupByKey(a.hero.ageGroup) ?? kidGroupByAge(heroAge(a));
    return byPlot ?? all.find((s) => s.id === g.segment) ?? all[0];
  }
  const age = heroAge(a);
  if (a.audience === "PET") {
    const sp = a.pet.species === "cat" ? "pet-cat" : "pet-dog";
    return pool.find((s) => s.id === sp) ?? pool[0] ?? all[0];
  }
  return pool.find((s) => s.heroAge && age >= s.heroAge[0] && age <= s.heroAge[1]) ?? pool[0] ?? all[0];
}

/** Внешность одной строкой (для промпта картинок и брифа текста). */
export function appearanceLine(a: QuizAnswers) {
  const p = a.appearance;
  if (a.audience === "PET") {
    const pet = a.pet;
    return [pet.breed, pet.furColor && `окрас: ${pet.furColor}`, pet.traits && `характер: ${pet.traits}`, p.custom].filter(Boolean).join(", ");
  }
  return [
    p.hair && `${p.hair} волосы`,
    p.hairstyle,
    p.skin && `тон кожи ${p.skin}`,
    p.glasses && "носит очки",
    p.freckles && "веснушки",
    p.beard && "борода",
    p.clothes && `любит ${p.clothes}`,
    p.custom,
  ]
    .filter(Boolean)
    .join(", ");
}

export { heroKindFor };

/** Образец обложки по ответам (/obrazec) — пока иллюстрации книги не нарисованы (превью книги, rev 13). */
export function coverSampleUrl(a: QuizAnswers): string {
  const kind = ({ CHILD: "child", TEEN: "teen", ADULT: "adult", PET: "pet" } as const)[a.audience];
  return sampleUrl({
    slug: a.story.slug || undefined,
    kind,
    gender: a.hero.gender,
    age: heroAge(a),
    hair: a.appearance.hair,
    hairstyle: a.appearance.hairstyle,
    skin: a.appearance.skin,
    glasses: a.appearance.glasses,
    freckles: a.appearance.freckles,
    beard: a.appearance.beard,
    species: a.pet.species,
    style: a.artStyle,
    mood: a.mood || undefined,
    extras: a.extras.map((e) => e.role),
  });
}
