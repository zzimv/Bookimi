// Целевая схема анкеты v2 для четырёх аудиторий (владелец — агент 1; переключает агент 11).
// Обратно совместима: AnswersV2.parse(старые ответы src/lib/quiz.ts) даёт валидный v2 —
// style → artStyle, роли доп. героев сохраняются, новые поля получают значения по умолчанию.
// Модуль безопасен для клиента (только zod).

import { z } from "zod";
import "../lib/zod-ru";
import { zName, zNameOpt } from "../lib/names";
import { EXTRA_ROLES, GROUP_ADULT_ROLES, GROUP_MAX_LIMIT, HERO_KIND_BY_AUDIENCE, type HeroKind } from "./types";
import type { AudienceKey } from "./profiles";
import { KID_AGE_KEYS, normalizeAgeGroup } from "./ages";

const str = (max: number) => z.string().trim().max(max);
/** Имя: всегда с заглавной буквы («маша» → «Маша»), склоняется отдельно в declension.ts. Нормализация — src/lib/names.ts. */
const nameStr = (max: number, msg = "Укажите имя") => zName(max, msg);
const nameOpt = (max: number) => zNameOpt(max, "free");

/** Российский мобильный → +7XXXXXXXXXX. Принимает «8 (912) 345-67-89», «+7 912 3456789», «9123456789». */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const ten = d.length === 11 && (d[0] === "7" || d[0] === "8") ? d.slice(1) : d.length === 10 ? d : null;
  return ten && ten[0] === "9" ? `+7${ten}` : null;
}

export const Phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Укажите мобильный номер: +7 9XX XXX-XX-XX" });
      return z.NEVER;
    }
    return p;
  });

/** Контакт для входа: телефон обязателен, код приходит на почту. Проверяется на шаге входа/оформления. */
export const ContactV2 = z.object({
  phone: Phone,
  email: z.string().trim().toLowerCase().email("Проверьте адрес почты"),
});
export type ContactV2T = z.infer<typeof ContactV2>;

/** Пол: старые boy/girl + синонимы для взрослых. Внутри всегда boy | girl (для питомца — он | она). */
const Gender = z.preprocess(
  (v) => (v === "male" || v === "m" ? "boy" : v === "female" || v === "f" ? "girl" : v),
  z.enum(["boy", "girl"]),
);

export const ExtraV2 = z.object({
  role: z.enum(EXTRA_ROLES),
  /** «Свой вариант» («Робот Бип-2») — можно цифры. */
  name: zName(40, "Укажите имя", "free"),
  /** Грамматический род для {Рn:…}; если пусто — по роли или по имени (guessGender). n — средний (облако, солнце). */
  gender: z.enum(["boy", "girl", "n"]).optional(),
  description: str(200).optional().default(""),
  /** «Свой вариант»: кто или что это — «дерево», «робот», «машина», «плюшевый заяц». */
  what: str(60).optional().default(""),
  /** Для питомца в роли доп. героя. */
  species: z.enum(["dog", "cat", "other"]).optional(),
  /** Обработанное фото (id из /api/draft/photos): само фото не в анкете, только id; удаляется через 24 ч без книги, иначе через 7 дней. */
  photoId: z.string().uuid().optional(),
  /**
   * Внешность, выбранная картинками (rev 14): взрослым — волосы, причёска, очки, борода/усы; питомцу — окрас;
   * игрушке — какая. Пусто — по роли (бабушка седая с пучком и в очках, дедушка седой с усами…), src/lib/gen/extras.ts.
   */
  look: z
    .object({
      hair: str(40).optional(),
      hairstyle: str(40).optional(),
      skin: str(40).optional(),
      glasses: z.boolean().optional(),
      beard: z.boolean().optional(),
      moustache: z.boolean().optional(),
      fur: str(40).optional(),
      toy: str(40).optional(),
    })
    .optional(),
});
export type ExtraV2T = z.infer<typeof ExtraV2>;

/** Ребёнок группы (детсад, класс) — без героя. Пол — для {РДn:…}; пусто — по имени (guessGender). */
export const GroupMemberV2 = z.object({
  name: nameStr(30),
  gender: Gender.optional(),
  /** Есть ли фото (сами фото — отдельной загрузкой, как у доп. героев). */
  photo: z.boolean().optional().default(false),
  /** Пара слов для рисунка: «рыжие кудряшки, очки» — имена отсюда вычищает redact.ts. */
  description: str(200).optional().default(""),
  /** Обработанное фото (id из /api/draft/photos): само фото не в анкете, только id; удаляется через 24 ч без книги, иначе через 7 дней. */
  photoId: z.string().uuid().optional(),
});
export type GroupMemberV2T = z.infer<typeof GroupMemberV2>;

/** Взрослый группы: имя-отчество можно («Мария Ивановна»), роль, пол (пусто — по отчеству/имени). */
export const GroupAdultV2 = z.object({
  name: nameStr(60),
  role: z.enum(GROUP_ADULT_ROLES),
  gender: Gender.optional(),
});
export type GroupAdultV2T = z.infer<typeof GroupAdultV2>;

/** Группа: дети без героя (до GROUP_MAX_LIMIT − 1; лимит сюжета — plot.group.max − 1) и до 3 взрослых. */
export const GroupV2 = z.object({
  members: z.array(GroupMemberV2).max(GROUP_MAX_LIMIT - 1).default([]),
  adults: z.array(GroupAdultV2).max(3).default([]),
});
export type GroupV2T = z.infer<typeof GroupV2>;

export const AnswersV2 = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const o = { ...(raw as Record<string, unknown>) };
    if (o.artStyle === undefined && typeof o.style === "string") o.artStyle = o.style;
    // Возраст ребёнка: старые группы анкеты (2-3, 4-5, 6-7, 8-9) → 2-4, 5-7, 8-10
    if (o.hero && typeof o.hero === "object") {
      const h = o.hero as Record<string, unknown>;
      if (h.ageGroup !== undefined && h.ageGroup !== null && h.ageGroup !== "") o.hero = { ...h, ageGroup: normalizeAgeGroup(h.ageGroup) ?? h.ageGroup };
      else if (h.ageGroup === null || h.ageGroup === "") o.hero = { ...h, ageGroup: undefined };
    }
    return o;
  },
  z.object({
    version: z.literal(2).default(2),
    audience: z.enum(["CHILD", "TEEN", "ADULT", "PET"]).default("CHILD"),
    /** id сегмента из SEGMENTS; пусто — определить по возрасту/виду. */
    segment: str(40).default(""),
    hero: z.object({
      /** Имя или кличка питомца (можно цифры: «Бусинка-2»). */
      name: zName(30, "Укажите имя", "free"),
      nickname: nameOpt(30),
      gender: Gender,
      /** Возрастная группа ребёнка: 2–4, 5–7, 8–10 (старые 2-3/4-5/6-7/8-9 переводятся в preprocess). */
      ageGroup: z.enum(KID_AGE_KEYS).optional(),
      birthDate: str(10).optional().default(""),
      /** Возраст числом (подростки, взрослые, питомцы). */
      age: z.number().int().min(0).max(120).optional(),
      /** Фото героя (id обработанных фото, до 3) — загружены на первом шаге «Герои». */
      photoIds: z.array(z.string().uuid()).max(3).optional().default([]),
    }),
    appearance: z
      .object({
        hair: str(40).optional().default(""),
        /** Ребёнку (rev 15) — ключ из KID_HAIRSTYLES своего пола; старые «длинные», «кудряшки» → normalizeKidHairstyle. */
        hairstyle: str(40).optional().default(""),
        skin: str(40).optional().default(""),
        glasses: z.boolean().optional().default(false),
        freckles: z.boolean().optional().default(false),
        beard: z.boolean().optional().default(false),
        /** Ребёнку (rev 15) — вид одежды картинкой, ключ из KID_OUTFITS своего пола; старые «футболка», «свитер» → normalizeKidOutfit. */
        clothes: str(60).optional().default(""),
        /** rev 14 — выбор картинками: цвет глаз, улыбка (smile | wide | calm), румянец, цвет одежды (OUTFIT_COLORS). */
        eyes: str(20).optional().default(""),
        smile: str(20).optional().default(""),
        blush: z.boolean().optional().default(false),
        outfitColor: str(20).optional().default(""),
        /** rev 16 — картинками (ребёнку): ямочки, щербинка, украшение для волос (девочкам: бантик | заколка | ободок)
         *  и его цвет (HAIR_ACC_COLOR_KEYS, пусто — как одежда), головной убор (кепка | шапка с помпоном), рост
         *  (пониже | обычный | повыше). Пусто — нет / как обычно (src/content/looks.ts). */
        dimples: z.boolean().optional().default(false),
        toothGap: z.boolean().optional().default(false),
        hairAcc: str(20).optional().default(""),
        hairAccColor: str(20).optional().default(""),
        hat: str(30).optional().default(""),
        build: str(20).optional().default(""),
        /** Своё описание словами: с rev 16 в анкете поля нет; старые черновики читаются (идёт в промпт GPU как раньше). */
        custom: str(300).optional().default(""),
      })
      .default({}),
    /** Взрослые: профиль героя (heroFields сегментов adult-*). */
    adult: z
      .object({
        profession: str(80).optional().default(""),
        relation: str(40).optional().default(""),
        howMet: str(400).optional().default(""),
        memories: z.array(str(300)).max(3).default([]),
      })
      .default({}),
    /** Питомцы: species, breed, furColor, petTraits. Кличка — hero.name, пол — hero.gender. */
    pet: z
      .object({
        species: z.enum(["dog", "cat", "other"]).optional(),
        breed: str(60).optional().default(""),
        furColor: str(120).optional().default(""),
        traits: str(300).optional().default(""),
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
    /** Доп. герои: ДОП1..ДОП3. Пары — partner первым; хозяева питомца — owner; дарители — child/grandchild/friend/colleague. */
    extras: z.array(ExtraV2).max(3).default([]),
    /** Группа для сюжетов с plot.group (выпускной в саду, первый класс, выпускной в школе). Необязательна: старые черновики без неё. */
    group: GroupV2.optional(),
    /** id стиля картинок (ART_STYLE_IDS). Старое поле style переносится сюда. */
    artStyle: str(40).default("watercolor-air"),
    /** Старое поле — оставлено для совместимости, не использовать в новом коде. */
    style: str(40).optional(),
    /** id настроения (MOODS); пусто — без настроения / по умолчанию. */
    mood: str(40).default(""),
    /** Голос книги; пусто — голос сюжета (plot.textStyle). Для своей идеи — выбор покупателя. */
    textStyle: str(40).default(""),
    dedication: str(300).optional().default(""),
    /**
     * Вёрстка книги (rev 13, src/lib/book-layout.ts): вариант обложки, «Автор: …» на первой странице, фото на странице
     * «Фото и посвящение» (id фото книги, само фото — в бакете photos и удаляется по общим правилам). Старые ответы — по умолчанию.
     */
    layout: z
      .object({
        coverVariant: z.preprocess((v) => (v === undefined || v === null || v === "" ? 0 : Number(v)), z.number().int().min(0).max(2)).default(0),
        author: str(60).optional().default(""),
        photoId: z.string().uuid().optional(),
      })
      .default({}),
    /** Контакт: в анкете может быть пустым, ContactV2 проверяется на шаге входа/оформления. */
    contact: z
      .object({
        phone: z.string().trim().max(30).default(""),
        email: z.string().trim().max(120).default(""),
      })
      .default({}),
  }),
);

export type AnswersV2T = z.infer<typeof AnswersV2>;

export const heroKindFor = (a: Pick<AnswersV2T, "audience">): HeroKind => HERO_KIND_BY_AUDIENCE[a.audience as AudienceKey];

/** Род доп. героя для {Рn:…}: явный → по роли → по имени. */
export function extraGender(e: Pick<ExtraV2T, "role" | "gender" | "name">, guess: (name: string) => "boy" | "girl"): "boy" | "girl" | "n" {
  if (e.gender) return e.gender;
  if (["mom", "grandma"].includes(e.role)) return "girl";
  if (["dad", "grandpa"].includes(e.role)) return "boy";
  return guess(e.name);
}
