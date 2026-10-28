// Анкета создания книги: варианты-чипсы и проверка ответов. Используется и в браузере, и на сервере.
// Схема ответов — AnswersV2 (src/content/answers.ts): 4 аудитории, старые черновики разбираются без потерь
// (style → artStyle, роли доп. героев сохраняются). Модуль безопасен для клиента: без промптов и планов сюжетов.
import { AnswersV2, heroKindFor, type AnswersV2T } from "../content/answers";
import { OCCASIONS, SEGMENTS, type AudienceKey } from "../content/profiles";

export { AnswersV2, ContactV2, normalizePhone, extraGender } from "../content/answers";

/** Ответы анкеты (v2). Старое имя оставлено для совместимости импортов. */
export const Answers = AnswersV2;
export type QuizAnswers = AnswersV2T;

export const AGE_GROUPS = [
  { key: "2-3", label: "2–3 года", age: 3 },
  { key: "4-5", label: "4–5 лет", age: 5 },
  { key: "6-7", label: "6–7 лет", age: 7 },
  { key: "8-9", label: "8–9 лет", age: 9 },
] as const;

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
  friend: "Друг или подруга",
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

// {Р:мужская|женская} — форма по полу героя
const DEDICATIONS_BY: Record<AudienceKey, string[]> = {
  CHILD: [
    "{Р:Самому смелому|Самой смелой} {ЛАСКОВО.дат} на свете — с любовью.",
    "С днём рождения, {ЛАСКОВО.им}! Пусть каждый день будет сказкой.",
    "{ЛАСКОВО.дат}, {Р:который|которая} умеет удивлять. Мы тобой гордимся.",
    "Нашему солнышку {ЛАСКОВО.дат} — чтобы читать вместе перед сном.",
    "С Новым годом, {ЛАСКОВО.им}! Пусть сбываются самые добрые желания.",
  ],
  TEEN: [
    "{ЛАСКОВО.дат} — {Р:тому, кто|той, кто} пишет свою историю {Р:сам|сама}.",
    "С днём рождения, {ЛАСКОВО.им}! Пусть впереди будет много интересных уровней.",
    "{ЛАСКОВО.дат} — мы в тебя верим. Всегда.",
  ],
  ADULT: [
    "{ЛАСКОВО.дат} — с любовью и благодарностью за каждый день.",
    "С праздником, {ЛАСКОВО.им}! Эта книга — о тебе и для тебя.",
    "{ЛАСКОВО.дат}, {Р:который|которая} делает мир теплее.",
  ],
  PET: [
    "{ЛАСКОВО.дат} — самому пушистому члену семьи.",
    "Нашему {ЛАСКОВО.дат} — за каждое утро, начатое с радости.",
    "{ЛАСКОВО.им}, без тебя дом был бы просто квартирой.",
  ],
};
export const dedicationsFor = (audience: AudienceKey = "CHILD") => DEDICATIONS_BY[audience];
export const DEDICATIONS = DEDICATIONS_BY.CHILD;

const DEFAULT_AGE: Record<AudienceKey, number> = { CHILD: 5, TEEN: 14, ADULT: 35, PET: 3 };

/** Возраст героя: число из анкеты → дата рождения → возрастная группа → по аудитории. */
export function heroAge(a: Pick<QuizAnswers, "hero" | "audience">) {
  if (typeof a.hero.age === "number") return a.hero.age;
  if (a.hero.birthDate) {
    const b = new Date(a.hero.birthDate);
    if (!isNaN(+b)) return Math.max(a.audience === "PET" ? 0 : 1, Math.floor((Date.now() - +b) / (365.25 * 86400_000)));
  }
  const g = AGE_GROUPS.find((x) => x.key === a.hero.ageGroup)?.age;
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
