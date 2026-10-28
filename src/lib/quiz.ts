// Анкета создания книги: варианты-чипсы и проверка ответов. Используется и в браузере, и на сервере.
import { z } from "zod";

export const AGE_GROUPS = [
  { key: "2-3", label: "2–3 года", age: 3 },
  { key: "4-5", label: "4–5 лет", age: 5 },
  { key: "6-7", label: "6–7 лет", age: 7 },
  { key: "8-9", label: "8–9 лет", age: 9 },
] as const;

export const HAIR = ["светлые", "русые", "каштановые", "тёмные", "рыжие", "чёрные"];
export const HAIRSTYLE = ["короткая стрижка", "чёлка", "длинные", "кудряшки", "хвостик", "косички"];
export const CLOTHES = ["футболка", "платье", "комбинезон", "толстовка с капюшоном", "свитер", "спортивный костюм"];
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
export const OCCASION_CHIPS = [
  { key: "den-rozhdeniya", label: "День рождения" },
  { key: "novyj-god", label: "Новый год" },
  { key: "vypusknoj-v-sadu", label: "Выпускной в детском саду" },
  { key: "pervyj-klass", label: "Первый класс" },
  { key: "rozhdenie-brata-ili-sestry", label: "Рождение брата или сестры" },
  { key: "svoj", label: "Свой повод" },
  { key: "bez", label: "Без повода" },
];
export const EXTRA_ROLES = [
  { key: "sibling", label: "Брат или сестра" },
  { key: "mom", label: "Мама" },
  { key: "dad", label: "Папа" },
  { key: "grandma", label: "Бабушка" },
  { key: "grandpa", label: "Дедушка" },
  { key: "pet", label: "Питомец" },
];
// {Р:мужская|женская} — форма по полу героя
export const DEDICATIONS = [
  "{Р:Самому смелому|Самой смелой} {ЛАСКОВО.дат} на свете — с любовью.",
  "С днём рождения, {ЛАСКОВО.им}! Пусть каждый день будет сказкой.",
  "{ЛАСКОВО.дат}, {Р:который|которая} умеет удивлять. Мы тобой гордимся.",
  "Нашему солнышку {ЛАСКОВО.дат} — чтобы читать вместе перед сном.",
  "С Новым годом, {ЛАСКОВО.им}! Пусть сбываются самые добрые желания.",
];

const str = (max: number) => z.string().trim().max(max);

export const Answers = z.object({
  hero: z.object({
    name: str(30).min(1, "Укажите имя"),
    nickname: str(30).optional().default(""),
    gender: z.enum(["boy", "girl"]),
    ageGroup: z.enum(["2-3", "4-5", "6-7", "8-9"]).optional(),
    birthDate: str(10).optional().default(""),
  }),
  appearance: z
    .object({
      hair: str(40).optional().default(""),
      hairstyle: str(40).optional().default(""),
      glasses: z.boolean().optional().default(false),
      freckles: z.boolean().optional().default(false),
      clothes: str(60).optional().default(""),
      custom: str(300).optional().default(""),
    })
    .default({}),
  interests: z.array(str(40)).max(3).default([]),
  interestCustom: str(80).optional().default(""),
  occasion: z.object({ key: str(40).default("bez"), custom: str(120).optional().default("") }).default({ key: "bez" }),
  story: z
    .object({
      slug: str(80).optional().default(""),
      idea: str(300).optional().default(""),
      ideaChoice: z.object({ title: str(120), summary: str(400) }).optional(),
    })
    .default({}),
  extras: z
    .array(z.object({ role: str(20), name: str(30).min(1), description: str(200).optional().default("") }))
    .max(3)
    .default([]),
  style: str(40).default("watercolor-air"),
  dedication: str(300).optional().default(""),
});

export type QuizAnswers = z.infer<typeof Answers>;

export function heroAge(a: QuizAnswers) {
  if (a.hero.birthDate) {
    const b = new Date(a.hero.birthDate);
    if (!isNaN(+b)) return Math.max(1, Math.floor((Date.now() - +b) / (365.25 * 86400_000)));
  }
  return AGE_GROUPS.find((g) => g.key === a.hero.ageGroup)?.age ?? 5;
}

export function appearanceLine(a: QuizAnswers) {
  const p = a.appearance;
  return [p.hair && `${p.hair} волосы`, p.hairstyle, p.glasses && "носит очки", p.freckles && "веснушки", p.clothes && `любит ${p.clothes}`, p.custom]
    .filter(Boolean)
    .join(", ");
}
