"use client";
// Анкета создания книги (4 аудитории) → AnswersV2. Решение владельца: в начале — герои (фото или описание),
// дальше логичный путь (src/lib/flow.ts):
//  • книга выбрана заранее (карточка, страница книги, ?skazka=): Герои → (Группа) → Детали;
//  • «Создать книгу»: Герои → Для кого и повод → Книга → (Группа) → Детали.
// Книги на шаге «Книга» — разделы повода (src/content/sections.ts, как на сайте): core → «Своя история» → «Тоже подойдут» →
// остальные; «Без повода» и «Свой повод» — «Своя история» первой; сильная тема прячет чужие книги за «Показать все книги (N)».
// Фото обрабатывается на сервере сразу (/api/draft/photos); согласия — один раз, перед первой загрузкой.
// Черновик в браузере хранит id фото, не сами фото. Дальше: текст → подтверждение → вход → превью → оформление.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/Cover";
import { api, goal } from "@/lib/client";
import {
  ADULT_AGES, AGE_GROUPS, AUDIENCE_EXTRA_ROLES, bookAgeLabel, kidGroupByKey, kidGroupOf, CLOTHES, dedicationsFor, EXTRA_ROLE_LABELS, FUR, HAIR, HAIR_ADULT, HAIRSTYLE, INTERESTS, occasionChips, SKIN, TEEN_INTERESTS,
  ADULT_HAIRSTYLE_F, ADULT_HAIRSTYLE_M, EYES, extraGender, OUTFIT_COLOR_KEYS, sampleExtras, SMILES, TOYS,
  heroHairAndClothes, kidLookExtras, KID_HAIR_ACCS, KID_HATS, KID_BUILDS, KID_BODIES, HAIR_ACC_COLOR_KEYS, HAIR_ACC_COLOR_WORD, KID_HAIRSTYLE_DEFAULT, KID_HAIRSTYLE_KEYS, KID_OUTFIT_KEYS, normalizeKidHairstyle, normalizeKidOutfit,
  type QuizAnswers,
} from "@/lib/quiz";
import { fillTags, guessGender, normalizeName } from "@/lib/declension";
import { NameHint } from "./NameHint";
import { nameError } from "@/lib/names";
import { occasionWord } from "@/content/occasions";
import { titleForCatalog, titleTemplate } from "@/content/title";
import { sampleUrl } from "@/lib/obrazec";
import type { AudienceKey } from "@/content/profiles";
import { Captcha } from "@/components/Captcha";
import { CUSTOM_STORY_ENABLED, sectionOrder, sectionsOf, FITS_TITLE } from "@/content/sections";
import { flowSteps, FLOW_STEP_LABEL, stepProgress, type FlowStep } from "@/lib/flow";
import { rosterIssues } from "@/lib/roster";
import { DEFAULT_BULK_TIERS, type BulkTier } from "@/lib/bulk";
import { PhotoSlot, type ConsentState, type PhotoView } from "./PhotoSlot";
import { GroupStep, type DraftAdult, type DraftMember, type QuizGroup } from "./GroupStep";
import { FlowLegal } from "@/components/FlowLegal";
import { ROLE_LOOK } from "@/lib/gen/extras";
import { MagicLoader } from "@/components/MagicLoader";
import { SceneIcon, type SceneIconKind } from "./SceneIcon";
import { PicRow, PicToggles } from "./PicPicker";

export interface QuizStory {
  slug: string;
  title: string;
  tagline: string;
  audience: AudienceKey;
  coverTheme: string;
  ageMin: number;
  ageMax: number;
  occasions: string[];
  artStyles: string[];
  segments: string[];
  extras: { roles: string[]; min: number; max: number; note?: string };
  /** Для разделов повода (sections.ts): поводы, для которых книга написана, и свои крючки. */
  core?: string[];
  hooks?: string[];
  /** Книга о группе (детсад, класс): шаг «Группа». */
  group?: QuizGroup | null;
}
export interface QuizStyle {
  key: string;
  title: string;
  description: string;
  audiences?: AudienceKey[];
  /** Пробный стиль — в карточке значок «пробный». */
  trial?: boolean;
}
export interface QuizMood {
  id: string;
  title: string;
  oneLine: string;
  audiences: AudienceKey[];
  minAge?: number;
  swatch?: string;
}

const KEY = "bookimi.quiz.v3";
const HERO_NAME_KEY = "bookimi.heroName";
const OLD_KEYS = ["bookimi.quiz.v2", "bookimi.quiz.v1"];

type Extra = QuizAnswers["extras"][number];
type DraftExtra = Omit<Extra, "gender"> & { gender?: Extra["gender"] };
type Draft = Omit<QuizAnswers, "hero" | "extras" | "group" | "layout"> & {
  hero: Partial<QuizAnswers["hero"]>;
  extras: DraftExtra[];
  group: { members: DraftMember[]; adults: DraftAdult[] };
  /** rev 20: фото «в книгу» с первого шага — на страницу «Фото» и в рамку приветствия (id одного из hero.photoIds). */
  layout?: { photoId?: string };
};
type Mode = "photo" | "describe";

/** Шаг «Герои» — три маленькие сцены (rev 13): имя → внешность картинкой → кто ещё в книге. */
const HERO_SCENES = 3;

/**
 * Готовые герои для выбора картинкой (rev 13): тон кожи, цвет волос и причёска. Рисует тот же рисовальщик, что книгу
 * (/obrazec?p=1), — ребёнок выбранного возраста. Тонкая настройка — ряды картинок сразу под героями (rev 17, без «Подробнее»).
 */
// rev 15: у каждого из 6 готовых героев своя причёска — только из набора своего пола (KID_HAIRSTYLES)
const LOOK_PRESETS: Record<"boy" | "girl", { skin: string; hair: string; hairstyle: string }[]> = {
  boy: [
    { skin: "светлый", hair: "светлые", hairstyle: "короткая стрижка" },
    { skin: "светлый", hair: "рыжие", hairstyle: "кудрявые" },
    { skin: "светлый", hair: "русые", hairstyle: "с чёлкой" },
    { skin: "смуглый", hair: "каштановые", hairstyle: "волнистые до ушей" },
    { skin: "смуглый", hair: "чёрные", hairstyle: "шапочка" },
    { skin: "тёмный", hair: "чёрные", hairstyle: "ёжик" },
  ],
  girl: [
    { skin: "светлый", hair: "светлые", hairstyle: "косички" },
    { skin: "светлый", hair: "рыжие", hairstyle: "два хвостика" },
    { skin: "светлый", hair: "русые", hairstyle: "длинные распущенные" },
    { skin: "смуглый", hair: "каштановые", hairstyle: "хвост" },
    { skin: "смуглый", hair: "тёмные", hairstyle: "каре" },
    { skin: "тёмный", hair: "чёрные", hairstyle: "длинные кудри" },
  ],
};
const SKIN_WORD: Record<string, string> = { светлый: "светлая кожа", смуглый: "смуглая кожа", тёмный: "тёмная кожа" };
const cap1 = (x: string) => (x ? x[0].toUpperCase() + x.slice(1) : x);
/** Подписи вариантов-картинок для экранного диктора (rev 14). */
const PIC_LABEL = {
  skin: (x: string) => cap1(SKIN_WORD[x] ?? x),
  hair: (x: string) => `${cap1(x)} волосы`,
  hairstyle: (x: string) => cap1(x),
  eyes: (x: string) => `${cap1(x)} глаза`,
  outfit: (x: string) => `${cap1(x)} одежда`,
  clothes: (x: string) => cap1(x),
  fur: (x: string) => `${cap1(x)} окрас`,
};
const SPECIES_PICS: { key: "cat" | "dog" | "other"; label: string; what?: string }[] = [
  { key: "cat", label: "Кошка" },
  { key: "dog", label: "Собака" },
  { key: "other", label: "Другой питомец", what: "кролик" },
];
const presetLabel = (x: { skin: string; hair: string; hairstyle: string }) => `${x.hair[0].toUpperCase()}${x.hair.slice(1)} волосы, ${x.hairstyle}, ${SKIN_WORD[x.skin] ?? x.skin}`;

const empty = (audience: AudienceKey = "CHILD"): Draft => ({
  version: 2,
  audience,
  segment: "",
  hero: { name: "", nickname: "", gender: undefined, ageGroup: undefined, birthDate: "", age: undefined, photoIds: [] },
  appearance: { hair: "", hairstyle: "", skin: "", glasses: false, freckles: false, beard: false, clothes: "", eyes: "", smile: "", blush: false, outfitColor: "", dimples: false, toothGap: false, hairAcc: "", hairAccColor: "", hat: "", build: "", body: "", custom: "" },
  adult: { profession: "", relation: "", howMet: "", memories: [] },
  pet: { species: undefined, breed: "", furColor: "", traits: "" },
  interests: [],
  interestCustom: "",
  occasion: { key: "bez", custom: "" },
  story: { slug: "", idea: "" },
  extras: [],
  group: { members: [], adults: [] },
  artStyle: "",
  mood: "",
  textStyle: "",
  dedication: "",
  contact: { phone: "", email: "" },
});

/** Черновик открыт по ссылке с готовыми ответами: шаг восстанавливаем, только если ссылка та же. */
const linkKey = (i: Partial<Draft>) => [i.story?.slug, i.audience, i.occasion?.key, i.segment, i.hero?.gender].map((x) => x ?? "").join("|");

const KIND_CARDS: { key: AudienceKey; label: string }[] = [
  { key: "CHILD", label: "Ребёнок" },
  { key: "TEEN", label: "Подросток" },
  { key: "ADULT", label: "Взрослый" },
  { key: "PET", label: "Питомец" },
];
const AUDIENCE_LABEL: Record<AudienceKey, string> = { CHILD: "Ребёнку", TEEN: "Подростку", ADULT: "Взрослому", PET: "Питомцу" };

const GENDER: Record<AudienceKey, [string, string]> = {
  CHILD: ["Мальчик", "Девочка"],
  TEEN: ["Парень", "Девушка"],
  ADULT: ["Мужчина", "Женщина"],
  PET: ["Мальчик", "Девочка"],
};
const FALLBACK_SLUG: Record<AudienceKey, string> = { CHILD: "imya-i-zvyozdnyj-drakonchik", TEEN: "stazher-orbity", ADULT: "nasha-istoriya", PET: "moj-chelovek" };
/** Подсказка под полями свободного текста: имена во внешние сервисы не уходят (src/lib/gen/redact.ts). */
const NAMES_HINT = "Имена здесь не нужны — мы подставим их сами";
const HERO_WORD: Record<AudienceKey, string> = { CHILD: "Ваш ребёнок", TEEN: "Ваш герой", ADULT: "Ваш герой", PET: "Ваш питомец" };
const HUMAN_ROLES = ["mom", "dad", "grandma", "grandpa"];
const NO_PHOTO_ROLES = ["toy", "custom"];

/** Подписи пола доп. героя по роли: «Брат / Сестра», «Хозяин / Хозяйка». */
function extraGenders(role: string): { key: "boy" | "girl" | "n"; label: string }[] {
  const pairs: Record<string, [string, string]> = {
    sibling: ["Брат", "Сестра"],
    friend: ["Друг", "Подружка"],
    owner: ["Хозяин", "Хозяйка"],
    child: ["Сын", "Дочь"],
    grandchild: ["Внук", "Внучка"],
    partner: ["Он", "Она"],
    colleague: ["Коллега-мужчина", "Коллега-женщина"],
    pet: ["Он", "Она"],
  };
  const [m, f] = pairs[role] ?? ["Он", "Она"];
  return [{ key: "boy", label: m }, { key: "girl", label: f }, ...(role === "custom" || role === "toy" ? [{ key: "n" as const, label: "Оно" }] : [])];
}

function Chips<T extends string>({ items, value, onChange, multi = false, max = 99, name, label }: {
  items: { key: T; label: string; hint?: string }[]; value: T | T[]; onChange: (v: T | T[]) => void; multi?: boolean; max?: number; name?: string; label?: string;
}) {
  const sel = Array.isArray(value) ? value : [value];
  return (
    <div className="chips" data-chips={name} role="group" aria-label={label}>
      {items.map((it) => {
        const on = sel.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            className="chip"
            aria-pressed={on}
            title={it.hint}
            data-key={it.key}
            onClick={() => {
              if (!multi) return onChange(on ? ("" as T) : it.key);
              const next = on ? sel.filter((x) => x !== it.key) : sel.length < max ? [...sel, it.key] : sel;
              onChange(next);
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

const asItems = (xs: readonly string[]) => xs.map((x) => ({ key: x, label: x }));

// Шаг анкеты в адресе (?step=): «Назад»/«Вперёд» браузера ходят по шагам, ответы остаются (черновик — в localStorage).
// На сайте — обычный ?step=, в демо-стенде адрес живёт в hash (#/sozdat?step=…).
const FLOW_KEYS: FlowStep[] = ["heroes", "occasion", "book", "group", "details"];
function stepFromUrl(): FlowStep | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  const qs = h.startsWith("#/") ? h.split("?")[1] ?? "" : window.location.search.slice(1);
  const k = new URLSearchParams(qs).get("step") as FlowStep | null;
  return k && FLOW_KEYS.includes(k) ? k : null;
}
function urlWithStep(k: FlowStep): string {
  const { pathname, search, hash } = window.location;
  if (hash.startsWith("#/")) {
    const [p, q = ""] = hash.slice(1).split("?");
    const sp = new URLSearchParams(q);
    sp.set("step", k);
    return `${pathname}${search}#${p}?${sp.toString()}`;
  }
  const sp = new URLSearchParams(search);
  sp.set("step", k);
  return `${pathname}?${sp.toString()}${hash}`;
}

export function QuizWizard({
  stories,
  styles,
  moods = [],
  initial,
  captchaKey,
  locked = false,
  presetAudience = false,
  presetOccasion = false,
  photoEnabled = true,
  bulkTiers = DEFAULT_BULK_TIERS,
  soon = [],
}: {
  stories: QuizStory[];
  styles: QuizStyle[];
  moods?: QuizMood[];
  initial: Partial<Draft>;
  captchaKey?: string;
  /** Книга выбрана до анкеты (?skazka=) — повод и сюжет не спрашиваем. */
  locked?: boolean;
  /** Аудитория пришла из ссылки (?dlya=). */
  presetAudience?: boolean;
  /** Повод пришёл из ссылки (?povod=). */
  presetOccasion?: boolean;
  /** Приём фото включён (Настройки → flags.photoUploadEnabled). Иначе — только описание. */
  photoEnabled?: boolean;
  bulkTiers?: BulkTier[];
  /** Аудитории «скоро» (storefront.soon): их не предлагаем в «Кто герой?». */
  soon?: AudienceKey[];
}) {
  const router = useRouter();
  const [a, setA] = useState<Draft>(() => { const e = empty(initial.audience); return { ...e, ...initial, hero: { ...e.hero, ...initial.hero }, group: { members: [], adults: [], ...(initial.group ?? {}) } }; });
  const [stepKey, setStepKey] = useState<FlowStep>("heroes");
  const [scene, setScene] = useState(0);
  const [making, setMaking] = useState(false);
  const [occChosen, setOccChosen] = useState(presetOccasion || locked);
  const [own, setOwn] = useState(false);
  const [photoAsk, setPhotoAsk] = useState<"yes" | "no" | "">("");
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [bulk, setBulk] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const [showIssues, setShowIssues] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; summary: string }[]>([]);
  const [captcha, setCaptcha] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [views, setViews] = useState<Record<string, PhotoView>>({});
  const [consent, setConsent] = useState<ConsentState>({ pd: false, photo: false, group: false });
  const h1 = useRef<HTMLHeadingElement>(null);

  // Черновик в браузере: «Назад» и возврат на страницу — без потери ответов. Фото — только id; ссылки обновляем с сервера.
  useEffect(() => {
    let ids: string[] = [];
    try {
      const raw = localStorage.getItem(KEY) ?? OLD_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ?? "null";
      const saved = JSON.parse(raw);
      const name = normalizeName(localStorage.getItem(HERO_NAME_KEY) ?? "");
      const fromLink = Boolean(initial.story?.slug || initial.audience || initial.occasion?.key);
      setA((cur) => {
        const s = saved?.a ? { ...saved.a } : null;
        if (s && s.artStyle === undefined && typeof s.style === "string") s.artStyle = s.style;
        let base: Draft = s ? { ...cur, ...s, hero: { ...cur.hero, ...s.hero }, group: { members: [], adults: [], ...(s.group ?? {}) } } : cur;
        if (initial.audience && base.audience !== initial.audience) base = { ...empty(initial.audience), hero: { name: base.hero.name, photoIds: base.audience !== "PET" && initial.audience !== "PET" ? base.hero.photoIds ?? [] : [] } };
        if (initial.story?.slug) base.story = { slug: initial.story.slug, idea: "" };
        else if (fromLink) base.story = { slug: "", idea: "" };
        if (initial.occasion?.key) base.occasion = initial.occasion;
        // Полка главной: пол героя и сегмент из ссылки (?pol=, ?segment=)
        if (fromLink && initial.segment) base.segment = initial.segment;
        if (fromLink && initial.hero?.gender) base.hero = { ...base.hero, gender: initial.hero.gender };
        // Имя, введённое на странице книги («живая обложка»), — главнее старого черновика: вопрос не повторяем
        if (name && name !== normalizeName(base.hero.name ?? "")) base.hero = { ...base.hero, name };
        ids = [...(base.hero.photoIds ?? []), ...base.extras.map((e) => e.photoId ?? ""), ...base.group.members.map((m) => m.photoId ?? "")].filter(Boolean);
        return { ...base };
      });
      if (saved?.stepKey && (!fromLink || saved.fromLink === linkKey(initial))) {
        if (FLOW_KEYS.includes(saved.stepKey)) setStepKey(saved.stepKey);
        if (!fromLink) setOccChosen(Boolean(saved.occChosen));
        // rev 20: «Своя история» выключена — старый черновик с ней открывается на выборе книги
        setOwn(CUSTOM_STORY_ENABLED && Boolean(saved.own));
        setModes(saved.modes ?? {});
        setBulk(Boolean(saved.bulk));
        if (typeof saved.scene === "number") setScene(Math.max(0, Math.min(HERO_SCENES - 1, saved.scene)));
      }
    } catch {}
    // Шаг из адреса (Назад/Вперёд браузера, перезагрузка) важнее сохранённого
    const fromUrl = stepFromUrl();
    if (fromUrl) setStepKey(fromUrl);
    setLoaded(true);
    goal("quiz_start");
    api<ConsentState>("/api/draft/consent").then(setConsent).catch(() => {});
    if (ids.length) {
      api<{ photos: PhotoView[] }>(`/api/draft/photos?ids=${ids.join(",")}`)
        .then((r) => {
          const alive = new Set(r.photos.map((p) => p.id));
          setViews(Object.fromEntries(r.photos.map((p) => [p.id, p])));
          // Фото удалено (24 ч без книги) — убираем id из черновика
          setA((cur) => ({
            ...cur,
            hero: { ...cur.hero, photoIds: (cur.hero.photoIds ?? []).filter((x) => alive.has(x)) },
            layout: cur.layout?.photoId && !alive.has(cur.layout.photoId) ? {} : cur.layout,
            extras: cur.extras.map((e) => (e.photoId && !alive.has(e.photoId) ? { ...e, photoId: undefined } : e)),
            group: { ...cur.group, members: cur.group.members.map((m) => (m.photoId && !alive.has(m.photoId) ? { ...m, photoId: undefined, photo: false } : m)) },
          }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ a, stepKey, scene, occChosen, own, modes, bulk, fromLink: linkKey(initial) }));
    } catch {}
  }, [a, stepKey, scene, occChosen, own, modes, bulk, loaded, initial]);

  // Искорки при выборе (чипсы, картинки героев, книги, стили): маленькая вспышка звёздочек у курсора.
  // Без движения, если в системе включено «Уменьшить движение».
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const on = (e: MouseEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(".quiz .chip, .quiz .char-card, .quiz .choice, .quiz .style-card, .quiz .mood, .quiz .dedication-chip");
      if (!t) return;
      const r = t.getBoundingClientRect();
      const box = document.createElement("span");
      box.className = "sparkle";
      box.setAttribute("aria-hidden", "true");
      box.style.left = `${e.clientX || r.left + r.width / 2}px`;
      box.style.top = `${e.clientY || r.top + r.height / 2}px`;
      for (let i = 0; i < 7; i++) {
        const st = document.createElement("i");
        st.style.setProperty("--a", `${i * (360 / 7)}deg`);
        box.appendChild(st);
      }
      document.body.appendChild(box);
      setTimeout(() => box.remove(), 800);
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setA((cur) => ({ ...cur, [k]: v }));
  const hero = (patch: Partial<Draft["hero"]>) => setA((cur) => ({ ...cur, hero: { ...cur.hero, ...patch } }));
  // Имя героя — одно на сайт: то же, что в «живой обложке» страницы книги (bookimi.heroName), чтобы не спрашивать дважды
  const heroName = (name: string) => {
    hero({ name });
    try {
      localStorage.setItem(HERO_NAME_KEY, name.replace(/[^A-Za-zА-Яа-яЁё\- ]/g, "").slice(0, 20));
    } catch {}
  };
  const look = (patch: Partial<Draft["appearance"]>) => setA((cur) => ({ ...cur, appearance: { ...cur.appearance, ...patch } }));
  // Смена пола (rev 15): причёска — по умолчанию нового пола (наборы мальчиков и девочек не пересекаются),
  // одежда — своя, если её нет в наборе нового пола (комбинезон и спортивный костюм остаются)
  const setGender = (gender: "boy" | "girl" | undefined) =>
    setA((cur) => {
      if (cur.audience !== "CHILD" || !gender || gender === cur.hero.gender) return { ...cur, hero: { ...cur.hero, gender } };
      const ap0 = cur.appearance;
      return {
        ...cur,
        hero: { ...cur.hero, gender },
        appearance: {
          ...ap0,
          hairstyle: KID_HAIRSTYLE_KEYS[gender].includes(ap0.hairstyle ?? "") ? ap0.hairstyle : KID_HAIRSTYLE_DEFAULT[gender],
          clothes: ap0.clothes && KID_OUTFIT_KEYS[gender].includes(ap0.clothes) ? ap0.clothes : ap0.clothes ? normalizeKidOutfit(ap0.clothes, gender) : "",
        },
      };
    });
  const pet = (patch: Partial<Draft["pet"]>) => setA((cur) => ({ ...cur, pet: { ...cur.pet, ...patch } }));
  const adult = (patch: Partial<Draft["adult"]>) => setA((cur) => ({ ...cur, adult: { ...cur.adult, ...patch } }));
  const setExtra = (i: number, patch: Partial<DraftExtra>) => setA((cur) => ({ ...cur, extras: cur.extras.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const addView = (v: PhotoView) => setViews((cur) => ({ ...cur, [v.id]: v }));
  const aud = a.audience as AudienceKey;

  const story = stories.find((s) => s.slug === a.story.slug && s.audience === aud) ?? null;
  const fill = useMemo(() => {
    const h = { name: normalizeName(a.hero.name ?? "") || "Имя", nickname: normalizeName(a.hero.nickname || a.hero.name || "") || "Имя", gender: a.hero.gender };
    return (t: string) => fillTags(t, { hero: h, extras: a.extras.map((e) => ({ name: e.name || e.what || "…", gender: e.gender })), occasion: occasionWord(a.occasion.key, a.occasion.custom) ?? (a.occasion.custom || "особенный день") });
  }, [a.hero, a.extras, a.occasion.key, a.occasion.custom]);

  // Доп. герои по сюжету: первые min — обязательная роль (пара, хозяева питомца, дарители)
  const plotRoles = story?.extras.roles ?? [];
  const minExtras = story?.extras.min ?? 0;
  const maxExtras = story ? story.extras.max : 3;
  const lockedRole = minExtras > 0 ? plotRoles[0] : null;
  const roleOptions = useMemo(() => Array.from(new Set([...plotRoles, ...AUDIENCE_EXTRA_ROLES[aud]])), [plotRoles, aud]);

  useEffect(() => {
    // Сюжет требует героев (пара, хозяева): заводим нужное число карточек обязательной роли
    if (!story || !lockedRole) return;
    setA((cur) => {
      const ex = [...cur.extras];
      let changed = false;
      for (let i = 0; i < minExtras; i++) {
        if (!ex[i]) {
          ex[i] = { role: lockedRole as Extra["role"], name: "", description: "", what: "" };
          changed = true;
        } else if (ex[i].role !== lockedRole) {
          ex[i] = { ...ex[i], role: lockedRole as Extra["role"] };
          changed = true;
        }
      }
      return changed ? { ...cur, extras: ex } : cur;
    });
  }, [story, lockedRole, minExtras]);

  const steps = flowSteps({ preselected: locked, presetAudience, presetOccasion, group: Boolean(story?.group) });
  const step = steps.includes(stepKey) ? stepKey : steps[0];
  const prog = stepProgress(steps, step);
  const stepIdx = prog.index - 1;

  useEffect(() => {
    if (loaded) h1.current?.focus({ preventScroll: true });
  }, [step, scene, loaded]);

  // Адрес ↔ шаг: первый шаг — без новой записи; «Назад»/«Вперёд» браузера → шаг из адреса
  const pushedRef = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!loaded) return;
    if (!stepFromUrl()) window.history.replaceState(null, "", urlWithStep(stepRef.current));
    const onPop = () => {
      const k = stepFromUrl();
      if (!k) return;
      const from = FLOW_KEYS.indexOf(stepRef.current);
      pushedRef.current = Math.max(0, pushedRef.current + (FLOW_KEYS.indexOf(k) < from ? -1 : 1));
      setError("");
      setStepKey(k);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [loaded]);

  // Обязательные доп. герои (пара, хозяева), которых уже назвали на шаге «Герои», в «Деталях» второй раз не спрашиваем.
  // Снимок при входе на шаг: поле не исчезает, пока его заполняют здесь.
  const [askedOnHeroes, setAskedOnHeroes] = useState<number[]>([]);
  useEffect(() => {
    if (step !== "details") return;
    setAskedOnHeroes(a.extras.map((e, i) => (e.name.trim() && (HUMAN_ROLES.includes(e.role) || e.gender) ? i : -1)).filter((i) => i >= 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const age = typeof a.hero.age === "number" ? a.hero.age : undefined;
  const heroAgeNum = aud === "CHILD" ? AGE_GROUPS.find((g) => g.key === a.hero.ageGroup)?.age : age;
  // Дети: книга написана для одной группы (0–3, 4–6, 7–9) — выбрана группа, предлагаем только её книги
  const kidGroup = aud === "CHILD" ? kidGroupByKey(a.hero.ageGroup) : undefined;
  const lockedKidGroup = locked && aud === "CHILD" && story ? kidGroupOf(story.segments) : undefined;
  useEffect(() => {
    // Книга выбрана заранее (страница книги) — возраст анкеты = группа этой книги
    if (lockedKidGroup && a.hero.ageGroup !== lockedKidGroup.key) hero({ ageGroup: lockedKidGroup.key });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedKidGroup, a.hero.ageGroup]);
  useEffect(() => {
    // Аудитория «скоро» (старый черновик, ссылка) — анкета открывается для ребёнка
    if (loaded && soon.includes(aud)) chooseAudience("CHILD");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, aud]);

  // Шаг «Книга»: те же разделы повода, что на сайте (sections.ts), с учётом возраста героя
  const occ = occChosen ? a.occasion.key : "bez";
  const sections = useMemo(() => {
    const byAud = stories.filter((s) => s.audience === aud);
    const byAge = kidGroup ? byAud.filter((s) => kidGroupOf(s.segments)?.key === kidGroup.key) : heroAgeNum !== undefined && aud === "TEEN" ? byAud.filter((s) => s.ageMin <= heroAgeNum && heroAgeNum <= s.ageMax) : byAud;
    const pool = (byAge.length ? byAge : byAud).map((s) => ({ ...s, core: s.core ?? [], hooks: s.hooks ?? [] }));
    return sectionsOf(pool, occ);
  }, [stories, aud, heroAgeNum, kidGroup, occ]);

  const audStyles = useMemo(() => {
    const list = styles.filter((s) => !s.audiences || s.audiences.includes(aud));
    const rec = story?.artStyles ?? [];
    return [...list].sort((x, y) => (rec.includes(x.key) ? rec.indexOf(x.key) : 100) - (rec.includes(y.key) ? rec.indexOf(y.key) : 100));
  }, [styles, aud, story]);
  const audMoods = moods.filter((m) => m.audiences.includes(aud) && (m.minAge === undefined || aud !== "TEEN" || (age !== undefined && age >= m.minAge)));
  const style = a.artStyle || story?.artStyles[0] || audStyles[0]?.key || "";
  const kind = ({ CHILD: "child", TEEN: "teen", ADULT: "adult", PET: "pet" } as const)[aud];
  const previewLook = {
    slug: story?.slug ?? FALLBACK_SLUG[aud],
    kind,
    gender: a.hero.gender,
    age: heroAgeNum,
    hair: a.appearance.hair,
    // Причёска и вид одежды — из набора своего пола (rev 15): та же функция, что у страниц книги и PDF
    ...heroHairAndClothes(a),
    skin: a.appearance.skin,
    glasses: a.appearance.glasses,
    freckles: a.appearance.freckles,
    beard: a.appearance.beard,
    species: a.pet.species,
    fur: FUR.includes(a.pet.furColor ?? "") ? a.pet.furColor : undefined,
    eyes: a.appearance.eyes || undefined,
    smile: a.appearance.smile || undefined,
    blush: a.appearance.blush || undefined,
    outfit: a.appearance.outfitColor || undefined,
    // Доп. герои с ролью, полом, видом питомца и внешностью — мама, бабушка, дедушка, кошка рисуются собой (rev 14)
    extraLooks: sampleExtras(a.extras.map((e) => ({ ...e, name: e.name ?? "" }) as Extra)),
  };
  const coverSample = sampleUrl({ ...previewLook, style, mood: a.mood });
  // До ввода имени — «Ваш ребёнок и …» (как в каталоге), а не «Имя и …»
  const named = Boolean(a.hero.name?.trim());
  const coverTitle = story ? fill(named ? titleTemplate(story.title) : titleForCatalog(story.title, aud)) : own ? a.story.ideaChoice?.title || "Своя история" : "";
  const coverName = normalizeName(a.hero.name ?? "") || HERO_WORD[aud];
  // Внешность картинкой — главный путь для ребёнка и подростка (rev 13); фото — запасной («Загрузить фото»)
  const pictures = aud === "CHILD" || aud === "TEEN";
  // Доп. герои детской книги — тоже картинками по умолчанию (rev 14); фото — вкладка «Загрузить фото»
  const mode = (k: string): Mode =>
    modes[k] ??
    (k === "main" && pictures
      ? (a.hero.photoIds?.length ?? 0) > 0 ? "photo" : "describe"
      : pictures && k.startsWith("extra-")
        ? a.extras[Number(k.slice(6))]?.photoId ? "photo" : "describe"
        : photoEnabled ? "photo" : "describe");

  function chooseAudience(next: AudienceKey) {
    if (next === aud) return;
    setA((cur) => ({ ...empty(next), occasion: cur.occasion, hero: { name: cur.hero.name, nickname: cur.hero.nickname, photoIds: (cur.audience === "PET") === (next === "PET") ? cur.hero.photoIds ?? [] : [] } }));
    setIdeas([]);
    setOwn(false);
    if (!presetOccasion) setOccChosen(false);
  }
  function chooseOccasion(key: string) {
    setOccChosen(Boolean(key));
    set("occasion", { ...a.occasion, key: key || "bez" });
    setShowAll(false);
  }
  function chooseStory(slug: string) {
    setOwn(false);
    set("story", { slug, idea: "" });
  }

  const extrasNamed = (from = 0) => a.extras.slice(from).every((e) => (e.role === "custom" ? e.what?.trim() || e.name.trim() : e.name.trim()));

  function validate(s: FlowStep): string {
    if (s === "heroes") return validateScene(0) || validateScene(1) || validateScene(2);
    if (s === "occasion" && occChosen && a.occasion.key === "svoj" && !a.occasion.custom?.trim()) return "Напишите, какой у вас повод";
    if (s === "book") {
      if (own) {
        if ((a.story.idea ?? "").trim().length < 5) return "Опишите идею своей истории в 1–2 предложениях";
        if (!a.story.ideaChoice) return "Нажмите «Предложить варианты» и выберите один";
      } else if (!story) return CUSTOM_STORY_ENABLED ? "Выберите книгу из списка — или «Своя история»" : "Выберите книгу из списка";
    }
    if (s === "group" && story?.group) {
      if (rosterIssues(a.group.members, { heroName: a.hero.name, max: story.group.max - 1 }).length) return "Проверьте список: отмечено красным";
      if (a.group.adults.some((x) => !x.name.trim())) return "Впишите имя взрослого или уберите строку";
    }
    if (s === "details") {
      if (lockedRole === "partner" && a.extras.slice(0, minExtras).some((e) => !e.name.trim())) return "Как зовут вторую половинку? Это второй герой книги";
      if (!extrasNamed()) return "Укажите имя каждого героя (для «своего варианта» — кто это) или уберите лишнего";
      if (story && a.extras.length < story.extras.min) return story.extras.note ?? `Для этой книги добавьте героев: не меньше ${story.extras.min}`;
    }
    return "";
  }

  /** Сцены шага «Герои»: 0 — имя (пол, возраст — не ребёнку); 1 — внешность (ребёнку rev 17: сначала возраст, потом пол
   *  картинками, дальше — по желанию); 2 — кто ещё в книге. */
  // rev 17: возраст и пол выбраны картинкой — подсказка «Выберите возраст…» сразу исчезает
  useEffect(() => {
    if (step === "heroes" && scene === 1 && error && !validateScene(1)) setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.hero.ageGroup, a.hero.gender, a.hero.birthDate]);
  function validateScene(n: number): string {
    if (n === 1 && aud === "CHILD") {
      if (!a.hero.ageGroup && !a.hero.birthDate) return "Выберите возраст — нажмите на картинку";
      if (!a.hero.gender) return "Кто наш герой: мальчик или девочка? Нажмите на картинку";
    }
    if (n === 0) {
      if (!a.hero.name?.trim()) return aud === "PET" ? "Как зовут питомца?" : "Как зовут героя?";
      const badName = nameError(a.hero.name, "free") ?? nameError(a.hero.nickname, "free");
      if (badName) return badName;
      if (aud === "PET" && !a.pet.species) return "Кто это: собака или кошка?";
      if (!a.hero.gender && aud !== "CHILD") return aud === "PET" ? "Мальчик или девочка?" : `Выберите: ${GENDER[aud][0].toLowerCase()} или ${GENDER[aud][1].toLowerCase()}`;
      if (aud === "TEEN" && (a.hero.age === undefined || a.hero.age < 11 || a.hero.age > 17)) return "Укажите возраст: от 11 до 17 лет";
    }
    if (n === 2) {
      const badExtra = a.extras.map((e) => nameError(e.name, "free")).find(Boolean);
      if (badExtra) return badExtra;
      if (!extrasNamed()) return "Укажите имя каждого героя (для «своего варианта» — кто это) или уберите лишнего";
      // Вид питомца не блокирует «Дальше»: не выбран и не понятен из описания — в тексте нейтральное «питомец»
    }
    return "";
  }

  function go(k: FlowStep) {
    setError("");
    setStepKey(k);
    // Новая запись в истории — «Назад» браузера вернёт на предыдущий шаг (Next подхватывает pushState)
    if (stepFromUrl() !== k) {
      window.history.pushState(null, "", urlWithStep(k));
      pushedRef.current = Math.max(0, pushedRef.current + (FLOW_KEYS.indexOf(k) > FLOW_KEYS.indexOf(stepRef.current) ? 1 : -1));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  /** Кнопка «Назад» анкеты — как «Назад» браузера, если предыдущий шаг уже в истории. */
  function back() {
    if (step === "heroes" && scene > 0) {
      setError("");
      setScene(scene - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const prev = steps[stepIdx - 1];
    if (!prev) return;
    if (pushedRef.current > 0) window.history.back();
    else go(prev);
  }

  function next() {
    if (step === "heroes" && scene < HERO_SCENES - 1) {
      const e0 = validateScene(scene);
      if (e0) return setError(e0);
      setError("");
      setScene(scene + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const e = validate(step);
    if (step === "group") setShowIssues(true);
    if (e) return setError(e);
    if (stepIdx < steps.length - 1) go(steps[stepIdx + 1]);
    else submit();
  }

  async function submit() {
    for (const s of steps) {
      const e = validate(s);
      if (e) {
        go(s);
        if (s === "heroes") setScene(validateScene(0) ? 0 : validateScene(1) ? 1 : 2);
        if (s === "group") setShowIssues(true);
        return setError(e);
      }
    }
    setBusy(true);
    setMaking(true);
    setError("");
    try {
      const maxExtrasNow = story ? story.extras.max : 3;
      const answers = {
        ...a,
        occasion: occChosen ? a.occasion : { key: "bez", custom: "" },
        story: own ? { slug: "", idea: a.story.idea, ideaChoice: a.story.ideaChoice } : { slug: story?.slug ?? a.story.slug, idea: "" },
        extras: a.extras.slice(0, maxExtrasNow).map((e) => ({ ...e, name: e.name.trim() || e.what?.trim() || "" })),
        group: story?.group
          ? {
              members: a.group.members.map((m) => ({ name: m.name.trim(), gender: m.gender, description: m.description.trim(), photo: Boolean(m.photoId), photoId: m.photoId })),
              adults: a.group.adults.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), role: x.role, gender: x.gender })),
            }
          : undefined,
        artStyle: style || "soft-gouache",
      };
      const r = await api<{ bookId: string }>("/api/books", { answers, captcha, ...(bulk && story?.group && a.group.members.length ? { bulk: {} } : {}) });
      for (const k of [KEY, ...OLD_KEYS]) localStorage.removeItem(k);
      router.push(`/kniga/${r.bookId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setMaking(false);
    }
  }

  async function suggest() {
    setError("");
    setBusy(true);
    try {
      const r = await api<{ ideas: { title: string; summary: string }[] }>("/api/ideas", { idea: a.story.idea, answers: { ...a, group: undefined, hero: { ...a.hero, gender: a.hero.gender ?? "boy", name: a.hero.name || "-" } } });
      setIdeas(r.ideas);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const occLabel = occasionChips(aud).find((o) => o.key === a.occasion.key)?.label;
  // Живая обложка — рядом с анкетой на всех шагах (кроме списка группы): меняется от имени, внешности, героев
  const withPreview = step !== "group";

  const bookCard = (s: QuizStory, badge?: string) => (
    <button key={s.slug} type="button" className="choice" data-slug={s.slug} aria-pressed={!own && a.story.slug === s.slug} onClick={() => chooseStory(s.slug)}>
      <Cover theme={s.coverTheme} title="" sample={sampleUrl({ slug: s.slug })} />
      <div>
        <strong>{titleForCatalog(s.title, aud)}</strong>
        <span>{s.tagline}</span>
        <span className="choice__badges">
          {badge && <span className={`badge ${badge === "к вашему поводу" ? "badge--gold" : ""}`}>{badge}</span>}
          {s.group && <span className="badge">вся {s.group.label === "класс" ? "класс" : "группа"} — до {s.group.max}</span>}
          {(aud === "CHILD" || aud === "TEEN") && <span className="badge">{bookAgeLabel({ audience: aud, ageMin: s.ageMin, ageMax: s.ageMax, segments: s.segments })}</span>}
        </span>
      </div>
    </button>
  );

  const ownCard = (
    <div key="own" className="own-wrap">
      <button type="button" className="choice choice--own" data-slug="svoya-istoriya" aria-pressed={own} onClick={() => { setOwn(true); set("story", { slug: "", idea: a.story.idea ?? "" }); }}>
        <span className="own-icon" aria-hidden="true">✎</span>
        <div>
          <strong>Своя история</strong>
          <span>Опишите идею в 1–2 предложениях — предложим 3 сюжета, а ваш повод станет его частью.</span>
        </div>
      </button>
      {own && (
        <div className="panel own-panel">
          <label className="field">
            <span>Ваша идея</span>
            <textarea className="textarea" name="idea" maxLength={300} value={a.story.idea ?? ""} onChange={(e) => set("story", { slug: "", idea: e.target.value })} placeholder={aud === "PET" ? "Например: кот охраняет ёлку от ночных шорохов" : "Например: герой строит ракету из коробок и летит на Луну к своему коту"} />
            <small className="names-hint">{NAMES_HINT}</small>
          </label>
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy || (a.story.idea ?? "").trim().length < 5} onClick={suggest}>
            {busy ? "Придумываем…" : "Предложить варианты"}
          </button>
          {ideas.length > 0 && (
            <div className="choice-cards" style={{ marginTop: 12 }}>
              {ideas.map((i) => (
                <button key={i.title} type="button" className="choice" aria-pressed={a.story.ideaChoice?.title === i.title} onClick={() => set("story", { ...a.story, slug: "", ideaChoice: i })}>
                  <div>
                    <strong>{i.title}</strong>
                    <span>{i.summary}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // rev 20: «Добавить фото ребёнка в книгу?» — в самом начале (сцена «Имя»), с согласием; фото сразу видно в макете,
  // потом — в превью на странице «Фото» и в рамке приветствия. По нему же нарисуем героя похожим.
  const bookPhoto = a.layout?.photoId ? views[a.layout.photoId] ?? null : null;
  const photoIntroOn = photoAsk === "yes" || Boolean(a.layout?.photoId);
  const photoIntro = (
    <section className="panel photo-intro" data-photo-intro aria-labelledby="photo-intro-h">
      <span className="label" id="photo-intro-h">{aud === "CHILD" ? "Добавить фото ребёнка в книгу?" : "Добавить фото героя в книгу?"}</span>
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        Фото встанет как есть, без перерисовки: в рамку на первой странице и на страницу «Фото». По нему же нарисуем героя похожим. Можно и позже — прямо в книге.
      </p>
      <div className="photo-intro__q chips" role="radiogroup" aria-labelledby="photo-intro-h">
        <button type="button" role="radio" className="chip" aria-checked={photoIntroOn} aria-pressed={photoIntroOn} data-photo-ask="yes" onClick={() => setPhotoAsk("yes")}>Да, добавить фото</button>
        <button type="button" role="radio" className="chip" aria-checked={!photoIntroOn && photoAsk === "no"} aria-pressed={!photoIntroOn && photoAsk === "no"} data-photo-ask="no" onClick={() => { setPhotoAsk("no"); setA((cur) => ({ ...cur, layout: {} })); }}>Без фото</button>
      </div>
      {photoIntroOn && (
        <div style={{ marginTop: 10 }}>
          <PhotoSlot
            slot="main"
            kind="human"
            adult={aud === "ADULT"}
            audience={aud}
            ids={a.hero.photoIds ?? []}
            max={3}
            views={views}
            consent={consent}
            onConsent={setConsent}
            onAdd={(v) => { addView(v); setA((cur) => ({ ...cur, hero: { ...cur.hero, photoIds: [...(cur.hero.photoIds ?? []), v.id].slice(0, 3) }, layout: { photoId: cur.layout?.photoId ?? v.id } })); setModes((m) => ({ ...m, main: "photo" })); }}
            onUpdate={addView}
            onRemove={(id) => setA((cur) => ({ ...cur, hero: { ...cur.hero, photoIds: (cur.hero.photoIds ?? []).filter((x) => x !== id) }, layout: cur.layout?.photoId === id ? {} : cur.layout }))}
          />
          {bookPhoto && <p className="small ok photo-intro__note" data-photo-in-book-note>✓ Фото будет в книге. Его видно в макете справа{withPreview ? "" : ""} и в превью.</p>}
        </div>
      )}
    </section>
  );

  const modeTabs = (k: string, photoOk = true) =>
    photoEnabled && photoOk ? (
      pictures ? (
        <div className="mode-tabs" role="tablist" aria-label="Картинка или фото">
          <button type="button" role="tab" aria-selected={mode(k) === "describe"} data-mode="describe" onClick={() => setModes({ ...modes, [k]: "describe" })}>Выбрать картинку</button>
          <button type="button" role="tab" aria-selected={mode(k) === "photo"} data-mode="photo" onClick={() => setModes({ ...modes, [k]: "photo" })}>Загрузить фото</button>
        </div>
      ) : (
        <div className="mode-tabs" role="tablist" aria-label="Фото или выбор внешности">
          <button type="button" role="tab" aria-selected={mode(k) === "photo"} data-mode="photo" onClick={() => setModes({ ...modes, [k]: "photo" })}>Загрузить фото</button>
          <button type="button" role="tab" aria-selected={mode(k) === "describe"} data-mode="describe" onClick={() => setModes({ ...modes, [k]: "describe" })}>Выбрать внешность</button>
        </div>
      )
    ) : null;

  // Подсказка по фото: «похоже, волосы русые» — только предложение, отмечает покупатель
  const suggestChip = (v: PhotoView) => {
    if (aud === "PET" ? !v.fur || a.pet.furColor === v.fur : !v.hair || a.appearance.hair === v.hair) return null;
    return (
      <p className="small suggest">
        По фото похоже: {aud === "PET" ? `окрас ${v.fur}` : `волосы ${v.hair}`}.{" "}
        <button type="button" className="link-btn" data-suggest onClick={() => (aud === "PET" ? pet({ furColor: v.fur }) : look({ hair: v.hair }))}>Отметить</button>
      </p>
    );
  };

  const describeHuman = (
    <div className="describe" data-describe="main">
      <span className="label">Цвет волос</span>
      <Chips name="hair" label="Цвет волос" items={asItems(aud === "ADULT" ? HAIR_ADULT : HAIR)} value={a.appearance.hair ?? ""} onChange={(v) => look({ hair: v as string })} />
      <span className="label">Причёска</span>
      <Chips name="hairstyle" label="Причёска" items={asItems(HAIRSTYLE)} value={a.appearance.hairstyle ?? ""} onChange={(v) => look({ hairstyle: v as string })} />
      <span className="label">Тон кожи</span>
      <Chips name="skin" label="Тон кожи" items={asItems(SKIN)} value={a.appearance.skin ?? ""} onChange={(v) => look({ skin: v as string })} />
      <span className="label">Особые приметы</span>
      <div className="chips" role="group" aria-label="Особые приметы">
        <button type="button" className="chip" aria-pressed={!!a.appearance.glasses} onClick={() => look({ glasses: !a.appearance.glasses })}>Очки</button>
        <button type="button" className="chip" aria-pressed={!!a.appearance.freckles} onClick={() => look({ freckles: !a.appearance.freckles })}>Веснушки</button>
        {aud === "ADULT" && <button type="button" className="chip" aria-pressed={!!a.appearance.beard} onClick={() => look({ beard: !a.appearance.beard })}>Борода или усы</button>}
      </div>
      {aud !== "ADULT" && (
        <>
          <span className="label">Любимая одежда</span>
          <Chips name="clothes" label="Любимая одежда" items={asItems(CLOTHES)} value={a.appearance.clothes ?? ""} onChange={(v) => look({ clothes: v as string })} />
        </>
      )}
    </div>
  );
  /** Заголовок сцены: картинка-значок, вопрос голосом рассказчика и подсказка. */
  const sceneHead = (icon: SceneIconKind, title: string, sub?: string) => (
    <div className="scene__head">
      <SceneIcon kind={icon} />
      <div>
        <h1 ref={h1} tabIndex={-1}>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
    </div>
  );

  const g = (a.hero.gender === "girl" ? "girl" : "boy") as "boy" | "girl";
  // Внешность картинками (rev 14): каждый вариант — рисунок героя с этим вариантом поверх текущего выбора
  const ap = a.appearance;
  // Ребёнок (rev 15): 6 причёсок и 6 видов одежды своего пола; подросток — прежний общий список причёсок
  const kidSets = aud === "CHILD";
  const hairNow = kidSets ? normalizeKidHairstyle(ap.hairstyle, g) : ap.hairstyle || LOOK_PRESETS[g][0].hairstyle;
  const clothesNow = kidSets ? normalizeKidOutfit(ap.clothes, g) : undefined;
  // rev 16: ямочки, щербинка, украшение для волос (девочке), головной убор, рост — на всех картинках выбора
  const kidX = kidSets ? kidLookExtras(ap, g) : {};
  const accNow = (kidX as { hairAcc?: string }).hairAcc ?? "";
  const accG = KID_HAIR_ACCS.find((x) => x.key === accNow)?.g ?? "m";
  const heroPic = (patch: Record<string, unknown>, face: boolean | "bust" = true) =>
    sampleUrl({
      portrait: true,
      face,
      kind,
      gender: g,
      age: heroAgeNum,
      // Тот же сюжет и те же значения по умолчанию, что у живой обложки и книги (иначе в выборе — светлые волосы, а в книге — другие)
      slug: previewLook.slug,
      hair: ap.hair || undefined,
      hairstyle: hairNow,
      clothes: clothesNow,
      skin: ap.skin || undefined,
      glasses: ap.glasses,
      freckles: ap.freckles,
      blush: ap.blush,
      eyes: ap.eyes || undefined,
      smile: ap.smile || undefined,
      outfit: ap.outfitColor || undefined,
      ...kidX,
      style,
      ...patch,
    });
  const heroPics = (
    <div className="describe" data-describe="pics">
      <PicRow name="skin" label={kidSets ? "Кожа" : "Тон кожи"} options={SKIN.map((x) => ({ key: x, label: PIC_LABEL.skin(x), src: heroPic({ skin: x }) }))} value={ap.skin ?? ""} onChange={(v) => look({ skin: v })} />
      <PicRow name="hair" label={kidSets ? "Волосы" : "Цвет волос"} options={HAIR.map((x) => ({ key: x, label: PIC_LABEL.hair(x), src: heroPic({ hair: x }) }))} value={ap.hair ?? ""} onChange={(v) => look({ hair: v })} />
      <PicRow name="hairstyle" label="Причёска" options={(kidSets ? KID_HAIRSTYLE_KEYS[g] : HAIRSTYLE).map((x) => ({ key: x, label: `Причёска: ${PIC_LABEL.hairstyle(x).toLowerCase()}`, src: heroPic({ hairstyle: x }, "bust") }))} value={kidSets ? hairNow : ap.hairstyle ?? ""} onChange={(v) => look({ hairstyle: v || hairNow })} />
      <PicRow name="eyes" label={kidSets ? "Глаза" : "Цвет глаз"} options={EYES.map((x) => ({ key: x, label: PIC_LABEL.eyes(x), src: heroPic({ eyes: x }) }))} value={ap.eyes ?? ""} onChange={(v) => look({ eyes: v })} allowEmpty />
      <PicToggles
        name="face"
        label="Лицо"
        options={[
          { key: "freckles", label: "Веснушки", src: heroPic({ freckles: true }) },
          { key: "glasses", label: "Очки", src: heroPic({ glasses: true }) },
          { key: "blush", label: "Румянец", src: heroPic({ blush: true }) },
          ...(kidSets
            ? [
                { key: "dimples", label: "Ямочки на щеках", src: heroPic({ dimples: true }) },
                { key: "toothGap", label: "Щербинка — выпал зуб", src: heroPic({ toothGap: true }) },
              ]
            : []),
        ]}
        value={{ freckles: ap.freckles, glasses: ap.glasses, blush: ap.blush, dimples: ap.dimples, toothGap: ap.toothGap }}
        onToggle={(k) => look({ [k]: !ap[k as "freckles" | "glasses" | "blush" | "dimples" | "toothGap"] })}
      />
      <PicRow name="smile" label="Улыбка" options={SMILES.map((x) => ({ key: x.key, label: x.label, src: heroPic({ smile: x.key }) }))} value={ap.smile ?? ""} onChange={(v) => look({ smile: v })} allowEmpty />
      {kidSets && (
        <PicRow name="clothes" label="Одежда" options={KID_OUTFIT_KEYS[g].map((x) => ({ key: x, label: `Одежда: ${x}`, src: heroPic({ clothes: x }, false) }))} value={clothesNow ?? ""} onChange={(v) => look({ clothes: v || clothesNow })} />
      )}
      <PicRow name="outfit" label="Цвет одежды" options={OUTFIT_COLOR_KEYS.map((x) => ({ key: x, label: PIC_LABEL.outfit(x), src: heroPic({ outfit: x }, kidSets ? false : "bust") }))} value={ap.outfitColor ?? ""} onChange={(v) => look({ outfitColor: v })} allowEmpty />
      {kidSets && g === "girl" && (
        <PicRow
          name="hairAcc"
          label="Украшения"
          options={[{ key: "нет", label: "Без украшения", src: heroPic({ hairAcc: undefined, hairAccColor: undefined, hat: undefined }) }, ...KID_HAIR_ACCS.map((x) => ({ key: x.key, label: x.label, src: heroPic({ hairAcc: x.key, hat: undefined }) }))]}
          value={accNow || "нет"}
          onChange={(v) => look({ hairAcc: v === "нет" ? "" : v })}
        />
      )}
      {kidSets && g === "girl" && accNow && (
        <PicRow
          name="hairAccColor"
          label="Цвет украшения"
          size="s"
          options={[{ key: "как одежда", label: `Цвет: как одежда`, src: heroPic({ hairAccColor: undefined, hat: undefined }) }, ...HAIR_ACC_COLOR_KEYS.map((x) => ({ key: x, label: `${cap1(HAIR_ACC_COLOR_WORD[x][accG])} ${accNow}`, src: heroPic({ hairAccColor: x, hat: undefined }) }))]}
          value={(kidX as { hairAccColor?: string }).hairAccColor || "как одежда"}
          onChange={(v) => look({ hairAccColor: v === "как одежда" ? "" : v })}
        />
      )}
      {kidSets && (
        <PicRow
          name="hat"
          label="Головной убор"
          options={[{ key: "нет", label: "Без головного убора", src: heroPic({ hat: undefined }) }, ...KID_HATS.map((x) => ({ key: x.key, label: x.label, src: heroPic({ hat: x.key }) }))]}
          value={(kidX as { hat?: string }).hat || "нет"}
          onChange={(v) => look({ hat: v === "нет" ? "" : v })}
        />
      )}
      {kidSets && (
        // rev 17: рост и сложение — два ряда, разница видна сразу (рост ~±13%, сложение — ширина фигуры и щёчки)
        <div className="pic-group" data-pic-group="body">
          <span className="label pic-group__title">Рост и сложение</span>
          <PicRow
            name="build"
            label="Рост"
            caps
            options={KID_BUILDS.map((x) => ({ key: x.key, label: x.label, src: heroPic({ build: x.key === "обычный" ? undefined : x.key }, false) }))}
            value={(kidX as { build?: string }).build || "обычный"}
            onChange={(v) => look({ build: v === "обычный" ? "" : v })}
          />
          <PicRow
            name="body"
            label="Сложение"
            caps
            options={KID_BODIES.map((x) => ({ key: x.key, label: x.label[g], src: heroPic({ body: x.key === "обычный" ? undefined : x.key }, "bust") }))}
            value={(kidX as { body?: string }).body || "обычный"}
            onChange={(v) => look({ body: v === "обычный" ? "" : v })}
          />
        </div>
      )}
      {aud !== "ADULT" && !kidSets && (
        <>
          <span className="label">Любимая одежда</span>
          <Chips name="clothes" label="Любимая одежда" items={asItems(CLOTHES)} value={ap.clothes ?? ""} onChange={(v) => look({ clothes: v as string })} />
        </>
      )}
    </div>
  );
  // Доп. герои картинками (rev 14): мама, бабушка, папа, дедушка — волосы, причёска, очки, борода/усы;
  // брат, сестра, друг — как ребёнок; питомец — вид и окрас; игрушка — какая
  const extraPic = (e: DraftExtra, patch: { species?: Extra["species"]; what?: string; look?: Extra["look"] } = {}, face: boolean | "bust" = false) => {
    const [sx] = sampleExtras([{ ...e, name: e.name ?? "" } as Extra]);
    return sampleUrl({
      kind,
      style,
      age: heroAgeNum,
      extraPortrait: true,
      face,
      extraLooks: [{ ...sx, species: patch.species ?? sx.species, what: patch.what ?? sx.what, look: { ...sx.look, ...patch.look } }],
    });
  };
  const extraPics = (e: DraftExtra, i: number) => {
    const L = e.look ?? {};
    const def = ROLE_LOOK[e.role] ?? { age: 0 };
    const setL = (patch: Extra["look"]) => setExtra(i, { look: { ...L, ...patch } });
    if (e.role === "pet") {
      if (!e.species) return null;
      return (
        <PicRow name={`extra-fur-${i}`} label="Окрас" options={FUR.map((x) => ({ key: x, label: PIC_LABEL.fur(x), src: extraPic(e, { look: { fur: x } }) }))} value={L.fur ?? ""} onChange={(v) => setL({ fur: v || undefined })} allowEmpty />
      );
    }
    if (e.role === "toy" || e.role === "custom") return null;
    const adult = HUMAN_ROLES.includes(e.role);
    const male = adult ? def.gender === "boy" : extraGender({ role: e.role, name: e.name ?? "", gender: e.gender }, guessGender) === "boy";
    // Брат, сестра, друг — 6 причёсок своего пола (rev 15); взрослые — свои наборы (женщины / мужчины)
    const kidG = male ? "boy" : "girl";
    const styles = adult ? (male ? ADULT_HAIRSTYLE_M : ADULT_HAIRSTYLE_F) : KID_HAIRSTYLE_KEYS[kidG];
    return (
      <div className="describe" data-describe={`extra-pics-${i}`}>
        <PicRow name={`extra-hair-${i}`} label="Цвет волос" options={(adult ? HAIR_ADULT : HAIR).map((x) => ({ key: x, label: PIC_LABEL.hair(x), src: extraPic(e, { look: { hair: x } }, true) }))} value={L.hair ?? def.hair ?? ""} onChange={(v) => setL({ hair: v || undefined })} />
        <PicRow name={`extra-hairstyle-${i}`} label="Причёска" options={styles.map((x) => ({ key: x, label: `Причёска: ${PIC_LABEL.hairstyle(x).toLowerCase()}`, src: extraPic(e, { look: { hairstyle: x } }, "bust") }))} value={adult ? L.hairstyle ?? def.hairstyle ?? "" : normalizeKidHairstyle(L.hairstyle, kidG)} onChange={(v) => setL({ hairstyle: v || undefined })} />
        <PicRow name={`extra-skin-${i}`} label="Тон кожи" options={SKIN.map((x) => ({ key: x, label: PIC_LABEL.skin(x), src: extraPic(e, { look: { skin: x } }, true) }))} value={L.skin ?? ""} onChange={(v) => setL({ skin: v || undefined })} allowEmpty />
        {adult && (
          <PicToggles
            name={`extra-face-${i}`}
            label="Приметы"
            options={[
              { key: "glasses", label: "Очки", src: extraPic(e, { look: { glasses: true } }, true) },
              ...(male
                ? [
                    { key: "moustache", label: "Усы", src: extraPic(e, { look: { moustache: true, beard: false } }, true) },
                    { key: "beard", label: "Борода", src: extraPic(e, { look: { beard: true } }, true) },
                  ]
                : []),
            ]}
            value={{ glasses: L.glasses ?? def.glasses, moustache: L.moustache ?? def.moustache, beard: L.beard ?? def.beard }}
            onToggle={(k) => {
              const cur = { glasses: L.glasses ?? def.glasses, moustache: L.moustache ?? def.moustache, beard: L.beard ?? def.beard }[k as "glasses"];
              setL({ [k]: !cur });
            }}
          />
        )}
      </div>
    );
  };
  // rev 17 (ребёнок): сначала возраст картинками (три фигурки), потом мальчик / девочка — картинками этого возраста.
  // Пока пол не выбран, на карточке возраста — мальчик и девочка рядом.
  const ageGenderPicker = (() => {
    const kidPic = (gender: "boy" | "girl", ageNum: number | undefined, face: boolean | "bust" = false) =>
      sampleUrl({ portrait: true, face, kind: "child", gender, age: ageNum, slug: previewLook.slug, style, ...(a.hero.gender === gender ? { hair: ap.hair || undefined, skin: ap.skin || undefined, hairstyle: hairNow, clothes: clothesNow, outfit: ap.outfitColor || undefined, eyes: ap.eyes || undefined, ...kidX, build: undefined, body: undefined, hat: undefined } : {}) });
    const groups = AGE_GROUPS.filter((x) => !lockedKidGroup || x.key === lockedKidGroup.key);
    const ageChosen = Boolean(kidGroup || a.hero.birthDate);
    return (
      <div className="age-gender" data-age-gender>
        <span className="label pic-group__title" id="pic-age">Сколько лет? <span className="req">*</span></span>
        <div className="age-grid" role="radiogroup" aria-labelledby="pic-age">
          {groups.map((x) => {
            const on = a.hero.ageGroup === x.key;
            return (
              <button key={x.key} type="button" role="radio" aria-checked={on} className="age-card" data-age={x.key} aria-label={x.label} onClick={() => hero({ ageGroup: x.key as "0-3" })}>
                <span className="age-card__pics">
                  {(a.hero.gender ? [a.hero.gender] : (["boy", "girl"] as const)).map((gg) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={gg} src={kidPic(gg as "boy" | "girl", x.age)} alt="" width={120} height={120} />
                  ))}
                </span>
                <span className="age-card__cap">{x.label}</span>
                <span className="char-card__check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>
        {lockedKidGroup && <small className="muted" data-age-locked>Текст этой книги написан для детей {lockedKidGroup.label.replace("года", "лет")}.</small>}
        <details className="more" open={Boolean(a.hero.birthDate)}>
          <summary>или указать дату рождения</summary>
          <label className="field" style={{ maxWidth: 260 }}>
            <span>Дата рождения</span>
            <input className="input" type="date" name="birth-date" value={a.hero.birthDate ?? ""} onChange={(e) => hero({ birthDate: e.target.value })} />
            <small>Напомним о дне рождения, если разрешите письма</small>
          </label>
        </details>
        {ageChosen && (
          <>
            <span className="label pic-group__title" id="pic-gender">Мальчик или девочка? <span className="req">*</span></span>
            <div className="gender-grid" role="radiogroup" aria-labelledby="pic-gender">
              {(["boy", "girl"] as const).map((gg, i) => {
                const on = a.hero.gender === gg;
                return (
                  <button key={gg} type="button" role="radio" aria-checked={on} className="age-card gender-card" data-gender-pic={gg} aria-label={GENDER.CHILD[i]} onClick={() => setGender(gg)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kidPic(gg, heroAgeNum, "bust")} alt="" width={150} height={150} />
                    <span className="age-card__cap">{GENDER.CHILD[i]}</span>
                    <span className="char-card__check" aria-hidden="true">✓</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  })();
  const charPicker = (
    <div className="describe" data-describe="pictures">
      {kidSets && <span className="label pic-group__title">Готовые герои</span>}
      <div className="char-grid" role="radiogroup" aria-label="Внешность героя: выберите картинку">
        {LOOK_PRESETS[g].map((x, i) => {
          const on = a.appearance.hair === x.hair && hairNow === x.hairstyle && a.appearance.skin === x.skin;
          return (
            <button key={`${g}-${i}`} type="button" role="radio" aria-checked={on} className="char-card" data-char={i} aria-label={presetLabel(x)} title={presetLabel(x)} onClick={() => look(x)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sampleUrl({ portrait: true, kind, gender: g, age: heroAgeNum, ...x, clothes: clothesNow, glasses: ap.glasses, freckles: ap.freckles, blush: ap.blush, eyes: ap.eyes || undefined, smile: ap.smile || undefined, outfit: ap.outfitColor || undefined, ...kidX, style })} alt="" width={150} height={150} />
              <span className="char-card__check" aria-hidden="true">✓</span>
            </button>
          );
        })}
      </div>
      {/* rev 17: все ряды сразу, без «Подробнее» */}
      {kidSets && <p className="pic-scroll-hint small muted" aria-hidden="true">Ряды картинок листаются вбок →</p>}
      {heroPics}
    </div>
  );

  const describePet = (
    <div className="describe" data-describe="main">
      <span className="label">Окрас</span>
      <Chips name="fur" label="Окрас" items={asItems(FUR)} value={a.pet.furColor ?? ""} onChange={(v) => pet({ furColor: v as string })} />
      <label className="field">
        <span>Приметы</span>
        <input className="input" name="pet-marks" maxLength={300} value={a.appearance.custom ?? ""} onChange={(e) => look({ custom: e.target.value })} placeholder="Белое пятно на груди, одно ухо висит, разные глаза" />
        <small className="names-hint">{NAMES_HINT}</small>
      </label>
    </div>
  );

  const stepTitle = FLOW_STEP_LABEL[step];

  return (
    <div className={`flow quiz ${withPreview ? "quiz--wide" : ""}`} data-audience={aud} data-step={step}>
      <div className="quiz__top">
        <div className="stepline">
          <span>
            Шаг {prog.index} из {prog.total}
          </span>
          <span>{stepTitle}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={prog.total} aria-valuenow={prog.index} aria-label={`Шаг ${prog.index} из ${prog.total}`}>
          <i style={{ width: `${prog.pct}%` }} />
        </div>
        <ol className="steps-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <li key={s} className={i < stepIdx ? "done" : i === stepIdx ? "now" : ""}>{FLOW_STEP_LABEL[s]}</li>
          ))}
        </ol>
        {locked && story && (
          <p className="quiz__book small">
            Книга: <b>{coverTitle}</b> · <a href={`/skazki?dlya=${({ CHILD: "detyam", TEEN: "podrostkam", ADULT: "vzroslym", PET: "pitomcam" } as const)[aud]}`}>сменить</a>
          </p>
        )}
      </div>

      <div className={withPreview ? "quiz__grid" : undefined}>
        <div className="quiz__main">
          {step === "heroes" && (
            <section className="scene" data-k={`heroes-${scene}`} data-scene={scene}>
              <ol className="scene-dots" aria-label={`Часть ${scene + 1} из ${HERO_SCENES}`}>
                {["Имя", "Внешность", "Друзья"].map((t, i) => (
                  <li key={t} className={i < scene ? "done" : i === scene ? "now" : ""}>{t}</li>
                ))}
              </ol>
              {scene === 0 && (
                <>
              {sceneHead("name", aud === "PET" ? "Как зовут нашего питомца?" : "Как зовут нашего героя?", "Каждая хорошая история начинается с имени. Его мы впишем в название, на обложку и на каждую страницу — с правильными окончаниями.")}
              <fieldset className="hero-card" data-hero="main">
                <legend>{aud === "PET" ? "Питомец" : "Главный герой"}</legend>
                {!locked && !presetAudience && (
                  <>
                    <span className="label">Кто герой?</span>
                    {KIND_CARDS.filter((k) => !soon.includes(k.key)).length > 1 ? (
                      <Chips name="kind" label="Кто герой" items={KIND_CARDS.filter((k) => !soon.includes(k.key)).map((k) => ({ key: k.key, label: k.label }))} value={aud} onChange={(v) => v && chooseAudience(v as AudienceKey)} />
                    ) : (
                      <p className="small muted" data-kind-only={aud}>Ребёнок 0–9 лет. Книги для подростков, взрослых и питомцев — скоро.</p>
                    )}
                    {soon.length > 0 && KIND_CARDS.filter((k) => !soon.includes(k.key)).length > 1 && <p className="small muted">Скоро: {KIND_CARDS.filter((k) => soon.includes(k.key)).map((k) => k.label.toLowerCase()).join(", ")}.</p>}
                  </>
                )}
                <div className="grid2">
                  <label className="field">
                    <span>{aud === "PET" ? "Кличка" : "Имя"} <span className="req">*</span></span>
                    <input className="input input--lg ym-disable-keys" name="hero-name" autoComplete="off" value={a.hero.name ?? ""} maxLength={30} onChange={(e) => heroName(e.target.value)} onBlur={() => heroName(normalizeName(a.hero.name ?? ""))} placeholder={aud === "PET" ? "Например, Пушок" : aud === "ADULT" ? "Например, Анна" : "Например, Марк"} />
                    <NameHint value={a.hero.name} onFix={(v) => heroName(v)} />
                    {aud !== "TEEN" && (
                      <details className="more nick" open={Boolean(a.hero.nickname)}>
                        <summary>{aud === "PET" ? "+ как ласково зовут дома" : "+ ласковое имя — как зовут дома"}</summary>
                        <input className="input ym-disable-keys" name="hero-nickname" aria-label="Как ласково зовут дома" autoComplete="off" value={a.hero.nickname ?? ""} maxLength={30} onChange={(e) => hero({ nickname: e.target.value })} onBlur={() => hero({ nickname: normalizeName(a.hero.nickname ?? "") })} placeholder={aud === "PET" ? "Например, Пушистик" : aud === "ADULT" ? "Например, Анечка" : "Например, Марусик"} />
                        <small>Необязательно. Так герой будет звучать в тёплых местах книги</small>
                        <NameHint value={a.hero.nickname} onFix={(v) => hero({ nickname: v })} />
                      </details>
                    )}
                  </label>
                  {aud === "PET" && (
                    <div>
                      <span className="label">Кто это? <span className="req">*</span></span>
                      <Chips name="species" label="Вид питомца" items={[{ key: "dog", label: "Собака" }, { key: "cat", label: "Кошка" }]} value={(a.pet.species ?? "") as "dog"} onChange={(v) => pet({ species: (v || undefined) as "dog" })} />
                    </div>
                  )}
                </div>
                {/* Ребёнку (rev 17) возраст и пол выбираются картинками в начале сцены «Внешность» */}
                {aud !== "CHILD" && (
                  <>
                    <span className="label">{aud === "PET" ? "Пол" : "Кто это?"} <span className="req">*</span></span>
                    <Chips name="gender" label="Пол" items={[{ key: "boy", label: GENDER[aud][0] }, { key: "girl", label: GENDER[aud][1] }]} value={(a.hero.gender ?? "") as "boy"} onChange={(v) => setGender((v || undefined) as "boy" | "girl" | undefined)} />
                  </>
                )}
                {aud === "TEEN" && (
                  <>
                    <span className="label">Сколько лет <span className="req">*</span></span>
                    <Chips name="age" label="Возраст" items={["11", "12", "13", "14", "15", "16", "17"].map((x) => ({ key: x, label: x }))} value={a.hero.age !== undefined ? String(a.hero.age) : ""} onChange={(v) => hero({ age: v ? Number(v) : undefined })} />
                  </>
                )}
                {aud === "ADULT" && (
                  <>
                    <span className="label">Возраст</span>
                    <Chips name="age" label="Возраст" items={ADULT_AGES.map((x) => ({ key: x.key, label: x.label }))} value={a.hero.age !== undefined ? String(ADULT_AGES.reduce((best, x) => (Math.abs(Number(x.key) - a.hero.age!) < Math.abs(Number(best.key) - a.hero.age!) ? x : best)).key) : ""} onChange={(v) => hero({ age: v ? Number(v) : undefined })} />
                  </>
                )}
                {aud === "PET" && (
                  <label className="field">
                    <span>Порода</span>
                    <input className="input" name="pet-breed" list="breeds" maxLength={60} value={a.pet.breed ?? ""} onChange={(e) => pet({ breed: e.target.value })} placeholder="Например, корги или «беспородный»" />
                    <datalist id="breeds">
                      {(a.pet.species === "cat" ? ["беспородная", "британская", "мейн-кун", "шотландская вислоухая", "сфинкс", "сиамская"] : ["беспородная", "корги", "лабрадор", "той-терьер", "шпиц", "хаски", "такса", "овчарка"]).map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </label>
                )}
              </fieldset>
              {photoEnabled && aud !== "PET" && photoIntro}
                </>
              )}
              {scene === 1 && (
                <>
              {sceneHead("look", aud === "PET" ? `Как выглядит ${fill("{ГЕРОЙ.им}")}?` : aud === "CHILD" && !a.hero.gender ? `Как нарисуем ${fill("{ГЕРОЙ.вин}")}?` : `${a.hero.gender === "girl" ? "Какой" : "Каким"} нарисуем ${fill("{ГЕРОЙ.вин}")}?`, aud === "CHILD" ? "Сначала возраст, потом мальчик или девочка — и все картинки ниже нарисуются такими. Нажмите на картинку — так герой будет выглядеть на всех страницах. Можно загрузить фото — нарисуем похожим." : pictures ? "Нажмите на картинку — так герой будет выглядеть на всех страницах. Можно загрузить фото — нарисуем похожим. Лучше всего — фото в анфас, с улыбкой, чтобы были хорошо видны глаза." : photoEnabled ? "Загрузите фото — сразу проверим и обрежем до портрета, а иллюстрации нарисуем по фото в выбранном стиле. Лучше всего — фото в анфас, с улыбкой, чтобы были хорошо видны глаза. Или выберите внешность — без фото." : "Выберите, как выглядит герой, — так он будет нарисован на всех страницах.")}
              <div className="hero-card hero-card--look" data-hero="look">
                {aud === "CHILD" && ageGenderPicker}
                {(aud !== "CHILD" || (kidGroup || a.hero.birthDate) && a.hero.gender) && modeTabs("main")}
                {aud === "CHILD" && !((kidGroup || a.hero.birthDate) && a.hero.gender) ? null : mode("main") === "photo" && photoEnabled ? (
                  <PhotoSlot
                    slot="main"
                    kind={aud === "PET" ? "pet" : "human"}
                    adult={aud === "ADULT"}
                    audience={aud}
                    ids={a.hero.photoIds ?? []}
                    max={3}
                    views={views}
                    consent={consent}
                    onConsent={setConsent}
                    onAdd={(v) => { addView(v); setA((cur) => ({ ...cur, hero: { ...cur.hero, photoIds: [...(cur.hero.photoIds ?? []), v.id].slice(0, 3) } })); }}
                    onUpdate={addView}
                    onRemove={(id) => setA((cur) => ({ ...cur, hero: { ...cur.hero, photoIds: (cur.hero.photoIds ?? []).filter((x) => x !== id) }, layout: cur.layout?.photoId === id ? {} : cur.layout }))}
                    suggest={suggestChip}
                  />
                ) : aud === "PET" ? (
                  describePet
                ) : pictures ? (
                  charPicker
                ) : (
                  describeHuman
                )}
              </div>
                </>
              )}
              {scene === 2 && (
                <>
              {sceneHead("friends", `Кто отправится в путешествие вместе с ${fill("{ГЕРОЙ.тв}")}?`, "Мама, брат, бабушка, друг, питомец или любимая игрушка — они появятся на картинках и в тексте. Можно никого: тогда герой отправится сам.")}
              {a.extras.map((e, i) => {
                const required = i < minExtras;
                const photoOk = !NO_PHOTO_ROLES.includes(e.role);
                const k = `extra-${i}`;
                return (
                  <fieldset className="hero-card hero-card--extra" key={i} data-extra={i}>
                    <legend>{required ? EXTRA_ROLE_LABELS[e.role] ?? "Герой" : `Ещё герой ${i + 1}`}</legend>
                    {!required && (
                      <Chips name={`role-${i}`} label="Кто это" items={roleOptions.map((r) => ({ key: r, label: aud === "PET" && r === "pet" ? "Ещё питомец" : EXTRA_ROLE_LABELS[r] ?? r }))} value={e.role} onChange={(v) => setExtra(i, { role: ((v as string) || e.role) as Extra["role"], gender: undefined, species: undefined })} />
                    )}
                    {e.role === "custom" && (
                      <label className="field">
                        <span>Кто или что это <span className="req">*</span></span>
                        <input className="input" name={`extra-what-${i}`} maxLength={60} value={e.what ?? ""} onChange={(ev) => setExtra(i, { what: ev.target.value })} placeholder="Дерево, робот, машинка, облако, плюшевый заяц" />
                      </label>
                    )}
                    {/* Питомец: вид обязателен — по нему и текст («кошка Мурка»), и рисунок; выбор — картинкой (rev 14) */}
                    {e.role === "pet" && (
                      <PicRow
                        name={`extra-species-${i}`}
                        label="Кошка или собака?"
                        options={SPECIES_PICS.map((x) => ({ key: x.key, label: x.label, src: extraPic(e, { species: x.key, what: x.what ?? e.what }) }))}
                        value={e.species ?? ""}
                        onChange={(v) => setExtra(i, { species: (v || undefined) as Extra["species"] })}
                      />
                    )}
                    {e.role === "pet" && e.species === "other" && (
                      <label className="field">
                        <span>Какой это питомец</span>
                        <input className="input" name={`extra-what-${i}`} maxLength={60} value={e.what ?? ""} onChange={(ev) => setExtra(i, { what: ev.target.value })} placeholder="Попугай, хомяк, кролик, черепаха" />
                      </label>
                    )}
                    {e.role === "toy" && (
                      <PicRow
                        name={`extra-toy-${i}`}
                        label="Какая игрушка?"
                        options={TOYS.map((x) => ({ key: x, label: cap1(x), src: extraPic(e, { look: { toy: x } }) }))}
                        value={e.look?.toy ?? ""}
                        onChange={(v) => setExtra(i, { look: { ...e.look, toy: v || undefined }, what: v || e.what })}
                      />
                    )}
                    <label className="field">
                      <span>{e.role === "pet" ? "Кличка" : e.role === "custom" || e.role === "toy" ? "Как зовут (если есть имя)" : "Имя"}{e.role !== "custom" && <span className="req"> *</span>}</span>
                      <input className="input ym-disable-keys" name={`extra-name-${i}`} autoComplete="off" maxLength={30} value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} onBlur={() => setExtra(i, { name: normalizeName(e.name) })} placeholder={e.role === "custom" ? "Например, Дуб Дубыч" : e.role === "mom" ? "Например, мама Оля" : e.role === "pet" ? "Например, Пушок" : e.role === "toy" ? "Например, Зайка" : "Например, Аня"} />
                      <NameHint value={e.name} onFix={(v) => setExtra(i, { name: v })} />
                    </label>
                    {!HUMAN_ROLES.includes(e.role) && (
                      <Chips name={`extra-gender-${i}`} label="Род" items={extraGenders(e.role)} value={(e.gender ?? "") as "boy"} onChange={(v) => setExtra(i, { gender: (v || undefined) as Extra["gender"], ...(HUMAN_ROLES.includes(e.role) || (v || undefined) === e.gender ? {} : { look: { ...e.look, hairstyle: undefined } }) })} />
                    )}
                    {modeTabs(k, photoOk)}
                    {photoOk && photoEnabled && mode(k) === "photo" ? (
                      <PhotoSlot
                        compact
                        slot="extra"
                        kind={e.role === "pet" ? "pet" : "human"}
                        audience={e.role === "pet" ? "PET" : aud === "PET" ? "ADULT" : aud}
                        ids={e.photoId ? [e.photoId] : []}
                        max={1}
                        views={views}
                        consent={consent}
                        onConsent={setConsent}
                        onAdd={(v) => { addView(v); setExtra(i, { photoId: v.id }); }}
                        onUpdate={addView}
                        onRemove={() => setExtra(i, { photoId: undefined })}
                      />
                    ) : (
                      <>
                      {extraPics(e, i)}
                      </>
                    )}
                    {!required && (
                      <button type="button" className="link-btn" onClick={() => set("extras", a.extras.filter((_, j) => j !== i))}>Убрать</button>
                    )}
                  </fieldset>
                );
              })}
              {a.extras.length < maxExtras && (
                <button type="button" className="btn btn--ghost add-extra" data-add-hero onClick={() => set("extras", [...a.extras, { role: (lockedRole && a.extras.length < minExtras ? lockedRole : roleOptions.find((r) => r !== "partner" || aud === "ADULT") ?? "friend") as Extra["role"], name: "", description: "", what: "" }])}>
                  + Добавить героя
                </button>
              )}
              <p className="small muted" style={{ marginTop: 8 }}>Необязательно, до {maxExtras}. {story?.group ? "Детей группы впишем отдельным списком." : ""}</p>
                </>
              )}
            </section>
          )}

          {step === "occasion" && (
            <section className="scene" data-k="occasion">
              {sceneHead("occasion", "Какой повод мы празднуем?", "День рождения, Новый год, первый раз в садик — или просто так. Повод впишем в первую и последнюю страницы.")}
              {/* «Для кого» уже выбрано на шаге «Герои» («Кто герой?») — здесь только напоминание, без второго вопроса */}
              <p className="muted quiz__known" data-known="audience">
                {AUDIENCE_LABEL[aud]}{a.hero.name?.trim() ? <> — <b>{normalizeName(a.hero.name)}</b></> : null}
                {!presetAudience && <> · <button type="button" className="link-btn" onClick={() => go("heroes")}>изменить</button></>}
              </p>
              <span className="label">Повод</span>
              <Chips name="occasion" label="Повод" items={occasionChips(aud)} value={occChosen ? a.occasion.key : ""} onChange={(v) => chooseOccasion(v as string)} />
              {occChosen && a.occasion.key === "svoj" && (
                <label className="field">
                  <span>Какой у вас повод? <span className="req">*</span></span>
                  <input className="input" name="occasion-custom" maxLength={120} value={a.occasion.custom ?? ""} onChange={(e) => set("occasion", { ...a.occasion, custom: e.target.value })} placeholder={aud === "PET" ? "Например, первая зима на даче" : "Например, первый поход в бассейн"} />
                  <small>Впишем его в первую и последнюю страницы. {NAMES_HINT}.</small>
                </label>
              )}
              <p className="small muted">Не нашли свой — выберите «Свой повод» или «Без повода». Книги к поводу — на следующем шаге.</p>
            </section>
          )}

          {step === "book" && (
            <section className="scene" data-k="book">
              {sceneHead("book", `Какую историю подарим ${a.hero.name?.trim() ? fill("{ГЕРОЙ.дат}") : "герою"}?`)}
              <p className="muted">
                {AUDIENCE_LABEL[aud]}
                {occ !== "bez" ? <> · повод: <b>{occ === "svoj" ? a.occasion.custom || "свой" : occLabel}</b></> : " · без повода"}
                {steps.includes("occasion") && <> · <button type="button" className="link-btn" onClick={() => go("occasion")}>изменить</button></>}
              </p>
              <div className="choice-cards choice-cards--books" data-sections={sectionOrder(sections).join(",")}>
                {sectionOrder(sections).map((part) => {
                  if (part === "custom") return CUSTOM_STORY_ENABLED ? ownCard : null;
                  if (part === "core") return sections.core.map((s) => bookCard(s, "к вашему поводу"));
                  if (part === "fits")
                    return sections.fits.length ? (
                      <div key="fits" className="book-section" data-section="fits">
                        <h2 className="quiz__h2">{FITS_TITLE}</h2>
                        <div className="choice-cards choice-cards--books">{sections.fits.map((s) => bookCard(s, "впишем ваш повод"))}</div>
                      </div>
                    ) : null;
                  return sections.others.length ? (
                    <div key="others" className="book-section" data-section="others">
                      {sections.core.length + sections.fits.length > 0 && <h2 className="quiz__h2">Другие книги — повод впишем</h2>}
                      <div className="choice-cards choice-cards--books">{sections.others.map((s) => bookCard(s, occ !== "bez" && occ !== "svoj" ? "впишем ваш повод" : undefined))}</div>
                    </div>
                  ) : null;
                })}
              </div>
              {sections.hiddenCount > 0 && (
                <>
                  <button type="button" className="btn btn--ghost btn--sm show-all" data-show-all aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Скрыть остальные книги" : `Показать все книги (${sections.hiddenCount})`}
                  </button>
                  {showAll && <div className="choice-cards choice-cards--books" data-section="hidden">{sections.hidden.map((s) => bookCard(s, "впишем ваш повод"))}</div>}
                </>
              )}
            </section>
          )}

          {step === "group" && story?.group && (
            <GroupStep
              h1={h1}
              group={story.group}
              members={a.group.members}
              adults={a.group.adults}
              onChange={(members, adults) => {
                set("group", { members, adults });
                setError("");
              }}
              heroName={a.hero.name ?? ""}
              audience={aud}
              photoEnabled={photoEnabled}
              consent={consent}
              onConsent={setConsent}
              views={views}
              onView={addView}
              bulk={bulk}
              onBulk={setBulk}
              tiers={bulkTiers}
              showIssues={showIssues}
            />
          )}

          {step === "details" && (
            <section className="scene" data-k="details">
              {sceneHead("details", aud === "PET" ? `Какой характер у ${fill("{ГЕРОЙ.род}")}?` : `Что любит ${fill("{ГЕРОЙ.им}")}?`, "Привычки и увлечения станут сценами книги. Последний штрих — стиль картинок и посвящение.")}
              {aud === "CHILD" && (
                <>
                  <span className="label">Увлечения — до трёх</span>
                  <Chips name="interests" label="Увлечения" items={INTERESTS.map((i) => ({ key: i.key, label: i.key, hint: i.hint }))} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
                </>
              )}
              {aud === "TEEN" && (
                <>
                  <span className="label">Чем увлекается — до трёх</span>
                  <Chips name="interests" label="Увлечения" items={asItems(TEEN_INTERESTS)} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
                </>
              )}
              {aud === "PET" && (
                <label className="field">
                  <span>Характер и привычки</span>
                  <textarea className="textarea" name="pet-traits" maxLength={300} value={a.pet.traits ?? ""} onChange={(e) => pet({ traits: e.target.value })} placeholder="Ворует носки, боится пылесоса, спит на клавиатуре" />
                  <small className="names-hint">{NAMES_HINT}</small>
                </label>
              )}
              {aud === "ADULT" && (
                <>
                  <div className="grid2">
                    <label className="field">
                      <span>Чем занимается</span>
                      <input className="input" name="adult-profession" maxLength={80} value={a.adult.profession ?? ""} onChange={(e) => adult({ profession: e.target.value })} placeholder="Врач, инженер, на пенсии…" />
                    </label>
                    <label className="field">
                      <span>Кем приходится вам</span>
                      <input className="input" name="adult-relation" maxLength={40} value={a.adult.relation ?? ""} onChange={(e) => adult({ relation: e.target.value })} placeholder="Мама, муж, бабушка, коллега…" />
                    </label>
                  </div>
                  {(lockedRole === "partner" || story?.segments.includes("adult-couple")) && (
                    <label className="field">
                      <span>Как вы познакомились</span>
                      <textarea className="textarea" name="adult-howmet" maxLength={400} value={a.adult.howMet ?? ""} onChange={(e) => adult({ howMet: e.target.value })} placeholder="Пара предложений: где, когда, что запомнилось" />
                      <small className="names-hint">{NAMES_HINT}</small>
                    </label>
                  )}
                  <span className="label">Общие воспоминания или семейные шутки — до трёх</span>
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      className="input memory"
                      name={`memory-${i}`}
                      maxLength={300}
                      value={a.adult.memories[i] ?? ""}
                      onChange={(e) => {
                        const m = [...a.adult.memories];
                        m[i] = e.target.value;
                        adult({ memories: m.map((x) => x ?? "").slice(0, 3) });
                      }}
                      placeholder={["Например: как мы заблудились в Суздале", "Например: папины блины по воскресеньям", "Например: «главное — не забыть ключи»"][i]}
                    />
                  ))}
                  <small className="names-hint">{NAMES_HINT}</small>
                </>
              )}
              <label className="field">
                <span>{aud === "PET" ? "Любимые занятия" : aud === "ADULT" ? "Увлечения" : "Ещё увлечения своими словами"}</span>
                <input className="input" name="interest-custom" maxLength={80} value={a.interestCustom ?? ""} onChange={(e) => set("interestCustom", e.target.value)} placeholder={aud === "PET" ? "Мячики, прогулки у реки, коробки" : aud === "ADULT" ? "Дача, рыбалка, кино, вязание" : "Лего, футбол, рисовать комиксы"} />
              </label>

              {a.extras.length > 0 && (
                <>
                  <h2 className="quiz__h2">Кто ещё в книге</h2>
                  {story?.extras.note && <p className="small muted">{story.extras.note}</p>}
                  {a.extras.map((e, i) => {
                    const required = i < minExtras;
                    const over = i >= maxExtras;
                    return (
                      <div className={`extra-line ${over ? "extra-line--over" : ""}`} key={i} data-extra-detail={i}>
                        {required && askedOnHeroes.includes(i) ? (
                          <p className="extra-known" data-known={`extra-${i}`}>
                            {EXTRA_ROLE_LABELS[e.role] ?? e.role}: <b>{e.name}</b> · <button type="button" className="link-btn" onClick={() => go("heroes")}>изменить</button>
                          </p>
                        ) : required ? (
                          <div className="grid2">
                            <label className="field">
                              <span>{EXTRA_ROLE_LABELS[e.role] ?? e.role} — имя <span className="req">*</span></span>
                              <input className="input ym-disable-keys" name={`partner-name-${i}`} autoComplete="off" maxLength={30} value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} onBlur={() => setExtra(i, { name: normalizeName(e.name) })} placeholder="Например, Илья" />
                            </label>
                            {!HUMAN_ROLES.includes(e.role) && (
                              <div>
                                <span className="label">Кто это?</span>
                                <Chips name={`partner-gender-${i}`} label="Пол" items={extraGenders(e.role)} value={(e.gender ?? "") as "boy"} onChange={(v) => setExtra(i, { gender: (v || undefined) as "boy" })} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <b>{e.name || e.what || "Герой"}</b>
                            <Chips name={`role-d-${i}`} label="Роль в книге" items={roleOptions.map((r) => ({ key: r, label: EXTRA_ROLE_LABELS[r] ?? r }))} value={e.role} onChange={(v) => setExtra(i, { role: ((v as string) || e.role) as Extra["role"] })} />
                            {over && <p className="small warnline">В этой книге — до {maxExtras} {maxExtras === 1 ? "доп. героя" : "доп. героев"}: этот не войдёт.</p>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {minExtras > a.extras.length && <p className="error">{story?.extras.note}</p>}

              <h2 className="quiz__h2">Стиль иллюстраций</h2>
              <p className="small muted" style={{ margin: "2px 0 8px" }}>Первые — лучшие для этой книги.</p>
              <div className="styles" role="radiogroup" aria-label="Стиль иллюстраций">
                {audStyles.map((s, i) => (
                  <button key={s.key} type="button" role="radio" className="style-card" data-style={s.key} aria-checked={style === s.key} onClick={() => set("artStyle", s.key)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sampleUrl({ ...previewLook, style: s.key, mood: undefined })} alt="" loading={i < 4 ? "eager" : "lazy"} width={160} height={160} />
                    <strong>{s.title}</strong>
                    {i < 2 && story?.artStyles.includes(s.key) && <span className="badge badge--gold">лучший выбор</span>}
                    {s.trial && <span className="badge badge--trial" title="Новый стиль: пробуем вместе с вами">пробный</span>}
                  </button>
                ))}
              </div>
              <p className="small muted">{audStyles.find((s) => s.key === style)?.description}</p>
              {audMoods.length > 1 && (
                <>
                  <span className="label">Настроение иллюстраций</span>
                  <div className="moods" role="radiogroup" aria-label="Настроение иллюстраций">
                    {audMoods.map((m) => {
                      const on = (a.mood || audMoods[0].id) === m.id;
                      return (
                        <button key={m.id} type="button" role="radio" className="mood" data-mood={m.id} aria-checked={on} onClick={() => set("mood", m.id === audMoods[0].id ? "" : m.id)}>
                          <i style={{ background: m.swatch ?? "var(--sage)" }} aria-hidden="true" />
                          <b>{m.title}</b>
                          <span>{m.oneLine}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <span className="label">Посвящение на первой странице</span>
              <div className="dedications" role="radiogroup" aria-label="Готовые посвящения">
                {dedicationsFor(aud, occChosen ? a.occasion.key : undefined).map((d) => {
                  const t = fill(d);
                  return (
                    <button key={d} type="button" role="radio" className="dedication-chip" aria-checked={a.dedication === t} onClick={() => set("dedication", t)}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <label className="field">
                <span>Или напишите своё</span>
                <textarea className="textarea" name="dedication" maxLength={300} value={a.dedication ?? ""} onChange={(e) => set("dedication", e.target.value)} placeholder="Необязательно" />
                <small>{(a.dedication ?? "").length} / 300{bulk ? " · в книгах для каждого ребёнка — общее посвящение, его можно поправить при оформлении" : ""}</small>
              </label>
              {captchaKey && <Captcha siteKey={captchaKey} onToken={setCaptcha} />}
            </section>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>

        {withPreview && (
          <aside className="quiz__preview" aria-label="Обложка, пример" data-live-cover>
            <div className="quiz__cover" data-k={coverSample}>
              <Cover theme={story?.coverTheme ?? ""} title={coverTitle} sample={coverSample} name={named ? (coverTitle.includes(coverName) ? "" : coverName) : /ваш/i.test(coverTitle) ? "" : coverName} eager />
              <span className="quiz__glow" aria-hidden="true" />
            </div>
            <p className="small muted">
              {named ? <><b>Это книга {fill("{ГЕРОЙ.род}")}.</b> </> : null}Обложка меняется от ваших ответов. {(a.hero.photoIds?.length ?? 0) > 0 ? "По вашему фото нарисуем героя похожим — на шаге превью." : aud === "PET" ? "По фото питомца нарисуем ещё точнее." : "По фото нарисуем героя ещё точнее."}
            </p>
            {/* rev 20: фото «в книгу» с первого шага видно в макете сразу */}
            {bookPhoto && (
              <div className="mock-photo" data-mock-photo>
                <span className="mock-photo__frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bookPhoto.url} alt="Фото в книге" />
                </span>
                <span className="small">Это фото будет в книге: в рамке на первой странице{aud === "CHILD" ? " и на странице «Фото»" : ""}.</span>
              </div>
            )}
          </aside>
        )}
      </div>

      {making && (
        <div className="magic-overlay">
          <MagicLoader title="Книга готовится…" lines={[`Пишем имя ${fill("{ГЕРОЙ.род}")} на обложке`, "Подбираем слова для сказки", "Раскрашиваем небо", "Зажигаем звёзды"]} />
        </div>
      )}
      <div className="flow-nav">
        <div className="in">
          {(stepIdx > 0 || (step === "heroes" && scene > 0)) && (
            <button type="button" className="btn btn--ghost" onClick={back}>
              Назад
            </button>
          )}
          <button type="button" className="btn btn--primary" data-next onClick={next} disabled={busy}>
            {stepIdx < steps.length - 1 || (step === "heroes" && scene < HERO_SCENES - 1) ? "Дальше" : busy ? "Сочиняем…" : "Сочинить книгу"}
          </button>
        </div>
      </div>
      <FlowLegal />
    </div>
  );
}
