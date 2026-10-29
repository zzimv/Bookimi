"use client";
// Анкета создания книги (4 аудитории) → AnswersV2. Сначала книга, потом герой (как у Wonderbly):
//  • книга выбрана (карточка, страница книги, повода): Герой → Внешность и что любит → Кто ещё в сказке → Стиль и посвящение;
//    повод и сюжет не спрашиваем;
//  • книга не выбрана («Создать книгу»): Для кого книга? → Какой повод? (+ подходящие книги прямо под чипсами) → те же 4 шага.
// «Кто ещё» пропускается, если добавлять некого (пара: имя второй половинки — уже на шаге «Герой»).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/Cover";
import { api, goal } from "@/lib/client";
import {
  ADULT_AGES, AGE_GROUPS, AUDIENCE_EXTRA_ROLES, CLOTHES, dedicationsFor, EXTRA_ROLE_LABELS, FUR, HAIR, HAIR_ADULT, HAIRSTYLE, INTERESTS, occasionChips, SKIN, TEEN_INTERESTS,
  type QuizAnswers,
} from "@/lib/quiz";
import { fillTags } from "@/lib/declension";
import { sampleUrl } from "@/lib/obrazec";
import type { AudienceKey } from "@/content/profiles";
import { Captcha } from "@/components/Captcha";

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
}
export interface QuizStyle {
  key: string;
  title: string;
  description: string;
  audiences?: AudienceKey[];
}
export interface QuizMood {
  id: string;
  title: string;
  oneLine: string;
  audiences: AudienceKey[];
  minAge?: number;
  swatch?: string;
}

const KEY = "bookimi.quiz.v2";
const OLD_KEY = "bookimi.quiz.v1";

type StepKey = "audience" | "occasion" | "hero" | "look" | "extras" | "style";
const STEP_LABEL: Record<StepKey, string> = {
  audience: "Для кого",
  occasion: "Повод и книга",
  hero: "Герой",
  look: "Внешность и что любит",
  extras: "Кто ещё в сказке",
  style: "Стиль и посвящение",
};

type Extra = QuizAnswers["extras"][number];
type DraftExtra = Omit<Extra, "gender"> & { gender?: Extra["gender"] };
type Draft = Omit<QuizAnswers, "hero" | "extras"> & { hero: Partial<QuizAnswers["hero"]>; extras: DraftExtra[] };

const empty = (audience: AudienceKey = "CHILD"): Draft => ({
  version: 2,
  audience,
  segment: "",
  hero: { name: "", nickname: "", gender: undefined, ageGroup: undefined, birthDate: "", age: undefined },
  appearance: { hair: "", hairstyle: "", skin: "", glasses: false, freckles: false, beard: false, clothes: "", custom: "" },
  adult: { profession: "", relation: "", howMet: "", memories: [] },
  pet: { species: undefined, breed: "", furColor: "", traits: "" },
  interests: [],
  interestCustom: "",
  occasion: { key: "bez", custom: "" },
  story: { slug: "", idea: "" },
  extras: [],
  artStyle: "",
  mood: "",
  textStyle: "",
  dedication: "",
  contact: { phone: "", email: "" },
});

const AUDIENCE_CARDS: { key: AudienceKey; title: string; sub: string; look: Parameters<typeof sampleUrl>[0] }[] = [
  { key: "CHILD", title: "Ребёнку", sub: "Сказки для 2–10 лет", look: { slug: "imya-i-zvyozdnyj-drakonchik", gender: "girl", age: 5, hairstyle: "хвостик", extras: [] } },
  { key: "TEEN", title: "Подростку", sub: "Квесты, детективы, космос", look: { slug: "stazher-orbity", gender: "boy", extras: [] } },
  { key: "ADULT", title: "Взрослому", sub: "Паре, маме, бабушке, коллеге", look: { slug: "dve-planety" } },
  { key: "PET", title: "Питомцу", sub: "Книга о собаке или кошке", look: { slug: "skazanie-o-divane", species: "cat", fur: "рыжий", extras: [] } },
];

const GENDER: Record<AudienceKey, [string, string]> = {
  CHILD: ["Мальчик", "Девочка"],
  TEEN: ["Парень", "Девушка"],
  ADULT: ["Мужчина", "Женщина"],
  PET: ["Мальчик", "Девочка"],
};
const FALLBACK_SLUG: Record<AudienceKey, string> = { CHILD: "imya-i-zvyozdnyj-drakonchik", TEEN: "stazher-orbity", ADULT: "nasha-istoriya", PET: "moj-chelovek" };
const HERO_WORD: Record<AudienceKey, string> = { CHILD: "Ваш ребёнок", TEEN: "Ваш герой", ADULT: "Ваш герой", PET: "Ваш питомец" };
const HUMAN_ROLES = ["mom", "dad", "grandma", "grandpa"];

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

export function QuizWizard({
  stories,
  styles,
  moods = [],
  initial,
  captchaKey,
  locked = false,
  presetAudience = false,
  presetOccasion = false,
}: {
  stories: QuizStory[];
  styles: QuizStyle[];
  moods?: QuizMood[];
  initial: Partial<Draft>;
  captchaKey?: string;
  /** Книга выбрана до анкеты (?skazka=) — повод и сюжет не спрашиваем. */
  locked?: boolean;
  /** Аудитория пришла из ссылки (?dlya=) — шаг «Для кого» не нужен. */
  presetAudience?: boolean;
  /** Повод пришёл из ссылки (?povod=) — на шаге книги показываем его, а не спрашиваем. */
  presetOccasion?: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<Draft>(() => ({ ...empty(initial.audience), ...initial }));
  const [stepKey, setStepKey] = useState<StepKey>(locked ? "hero" : presetAudience ? "occasion" : "audience");
  const [audChosen, setAudChosen] = useState(presetAudience || locked);
  const [occChosen, setOccChosen] = useState(presetOccasion || locked);
  const [own, setOwn] = useState(false);
  const [editOcc, setEditOcc] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; summary: string }[]>([]);
  const [captcha, setCaptcha] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const h1 = useRef<HTMLHeadingElement>(null);

  // Черновик в браузере: «Назад» и возврат на страницу — без потери ответов (старый черновик v1 тоже подхватываем)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? "null");
      const name = localStorage.getItem("bookimi.heroName") ?? "";
      const fromLink = Boolean(initial.story?.slug || initial.audience || initial.occasion?.key);
      setA((cur) => {
        const s = saved?.a ? { ...saved.a } : null;
        if (s && s.artStyle === undefined && typeof s.style === "string") s.artStyle = s.style;
        let base: Draft = s ? { ...cur, ...s, hero: { ...cur.hero, ...s.hero } } : cur;
        if (initial.audience && base.audience !== initial.audience) base = { ...empty(initial.audience), hero: { name: base.hero.name } };
        if (initial.story?.slug) base.story = { slug: initial.story.slug, idea: "" };
        else if (fromLink) base.story = { slug: "", idea: "" };
        if (initial.occasion?.key) base.occasion = initial.occasion;
        if (!base.hero.name && name) base.hero = { ...base.hero, name };
        return { ...base };
      });
      if (!fromLink && saved?.stepKey) {
        setStepKey(saved.stepKey);
        setAudChosen(Boolean(saved.audChosen));
        setOccChosen(Boolean(saved.occChosen));
        setOwn(Boolean(saved.own));
      }
    } catch {}
    setLoaded(true);
    goal("quiz_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ a, stepKey, audChosen, occChosen, own }));
    } catch {}
  }, [a, stepKey, audChosen, occChosen, own, loaded]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setA((cur) => ({ ...cur, [k]: v }));
  const hero = (patch: Partial<Draft["hero"]>) => setA((cur) => ({ ...cur, hero: { ...cur.hero, ...patch } }));
  const look = (patch: Partial<Draft["appearance"]>) => setA((cur) => ({ ...cur, appearance: { ...cur.appearance, ...patch } }));
  const pet = (patch: Partial<Draft["pet"]>) => setA((cur) => ({ ...cur, pet: { ...cur.pet, ...patch } }));
  const adult = (patch: Partial<Draft["adult"]>) => setA((cur) => ({ ...cur, adult: { ...cur.adult, ...patch } }));
  const setExtra = (i: number, patch: Partial<DraftExtra>) => setA((cur) => ({ ...cur, extras: cur.extras.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const aud = a.audience as AudienceKey;

  const story = stories.find((s) => s.slug === a.story.slug && s.audience === aud) ?? null;
  const fill = useMemo(() => {
    const h = { name: a.hero.name || "Имя", nickname: a.hero.nickname || a.hero.name || "Имя", gender: a.hero.gender };
    return (t: string) => fillTags(t, { hero: h, extras: a.extras.map((e) => ({ name: e.name || e.what || "…", gender: e.gender })), occasion: a.occasion.custom || "особенный день" });
  }, [a.hero, a.extras, a.occasion.custom]);

  // Доп. герои по сюжету: первые min — обязательная роль (пара, хозяева питомца, дарители)
  const plotRoles = story?.extras.roles ?? [];
  const minExtras = story?.extras.min ?? 0;
  const maxExtras = story ? story.extras.max : 3;
  const lockedRole = minExtras > 0 ? plotRoles[0] : null;
  const partnerInHero = lockedRole === "partner";
  const roleOptions = useMemo(() => Array.from(new Set([...plotRoles, ...AUDIENCE_EXTRA_ROLES[aud]])), [plotRoles, aud]);
  const freeSlots = maxExtras - (partnerInHero ? minExtras : 0);

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
      if (ex.length > maxExtras) {
        ex.length = maxExtras;
        changed = true;
      }
      return changed ? { ...cur, extras: ex } : cur;
    });
  }, [story, lockedRole, minExtras, maxExtras]);

  const steps: StepKey[] = [
    ...(!locked && !presetAudience ? (["audience"] as const) : []),
    ...(!locked ? (["occasion"] as const) : []),
    "hero",
    "look",
    ...(freeSlots > 0 ? (["extras"] as const) : []),
    "style",
  ];
  const stepIdx = Math.max(0, steps.indexOf(stepKey));
  const step = steps[stepIdx];

  useEffect(() => {
    if (loaded) h1.current?.focus({ preventScroll: true });
  }, [step, loaded]);

  // Книги для повода: сначала написанные к нему, затем остальные — повод впишем
  const occ = occChosen ? a.occasion.key : "";
  const audStories = useMemo(() => stories.filter((s) => s.audience === aud), [stories, aud]);
  const matching = occ && occ !== "svoj" && occ !== "bez" ? audStories.filter((s) => s.occasions.includes(occ)).sort((x, y) => x.occasions.indexOf(occ) - y.occasions.indexOf(occ)) : [];
  const others = audStories.filter((s) => !matching.includes(s));

  const audStyles = useMemo(() => {
    const list = styles.filter((s) => !s.audiences || s.audiences.includes(aud));
    const rec = story?.artStyles ?? [];
    return [...list].sort((x, y) => (rec.includes(x.key) ? rec.indexOf(x.key) : 100) - (rec.includes(y.key) ? rec.indexOf(y.key) : 100));
  }, [styles, aud, story]);
  const age = typeof a.hero.age === "number" ? a.hero.age : undefined;
  const audMoods = moods.filter((m) => m.audiences.includes(aud) && (m.minAge === undefined || aud !== "TEEN" || (age !== undefined && age >= m.minAge)));
  const style = a.artStyle || story?.artStyles[0] || audStyles[0]?.key || "";
  const kind = ({ CHILD: "child", TEEN: "teen", ADULT: "adult", PET: "pet" } as const)[aud];
  const heroAgeNum = aud === "CHILD" ? AGE_GROUPS.find((g) => g.key === a.hero.ageGroup)?.age : age;
  const previewLook = {
    slug: story?.slug ?? FALLBACK_SLUG[aud],
    kind,
    gender: a.hero.gender,
    age: heroAgeNum,
    hair: a.appearance.hair,
    hairstyle: a.appearance.hairstyle,
    skin: a.appearance.skin,
    glasses: a.appearance.glasses,
    freckles: a.appearance.freckles,
    beard: a.appearance.beard,
    species: a.pet.species,
    fur: FUR.includes(a.pet.furColor ?? "") ? a.pet.furColor : undefined,
    extras: a.extras.map((e) => e.role),
  };
  const coverTitle = story ? fill(story.title.replace(/ о \[Имя\]/, " о {ГЕРОЙ.пр}").replace("[Имя]", "{ГЕРОЙ.им}")) : own ? "Своя история" : "";
  const coverName = a.hero.name?.trim() || HERO_WORD[aud];

  function chooseAudience(next: AudienceKey) {
    setAudChosen(true);
    if (next !== aud) {
      setA((cur) => ({ ...empty(next), hero: { name: cur.hero.name, nickname: cur.hero.nickname } }));
      setIdeas([]);
      setOwn(false);
      setOccChosen(false);
    }
  }
  function chooseOccasion(key: string) {
    setOccChosen(Boolean(key));
    set("occasion", { ...a.occasion, key: key || "bez" });
    if (key === "svoj" && !a.story.slug) setOwn(true);
  }
  function chooseStory(slug: string) {
    setOwn(false);
    set("story", { slug, idea: "" });
  }

  function validate(s: StepKey): string {
    if (s === "audience" && !audChosen) return "Выберите, для кого книга";
    if (s === "occasion") {
      if (occChosen && a.occasion.key === "svoj" && !a.occasion.custom?.trim()) return "Напишите, какой у вас повод";
      if (own) {
        if ((a.story.idea ?? "").trim().length < 5) return "Опишите идею своей истории в 1–2 предложениях";
        if (!a.story.ideaChoice) return "Нажмите «Предложить варианты» и выберите один";
      } else if (!story) return "Выберите книгу из списка — или «Своя история»";
    }
    if (s === "hero") {
      if (!a.hero.name?.trim()) return aud === "PET" ? "Как зовут питомца?" : "Как зовут героя?";
      if (aud === "PET" && !a.pet.species) return "Кто это: собака или кошка?";
      if (!a.hero.gender) return aud === "PET" ? "Мальчик или девочка?" : `Выберите: ${GENDER[aud][0].toLowerCase()} или ${GENDER[aud][1].toLowerCase()}`;
      if (aud === "CHILD" && !a.hero.ageGroup && !a.hero.birthDate) return "Укажите возраст или дату рождения";
      if (aud === "TEEN" && (a.hero.age === undefined || a.hero.age < 10 || a.hero.age > 18)) return "Укажите возраст: от 11 до 17 лет";
      if (partnerInHero && a.extras.slice(0, minExtras).some((e) => !e.name.trim())) return "Как зовут вторую половинку? Это второй герой книги";
    }
    if (s === "extras") {
      if (a.extras.some((e) => e.role === "custom" ? !(e.what?.trim() || e.name.trim()) : !e.name.trim())) return "Укажите имя каждого героя (для «своего варианта» — кто это) или уберите лишнего";
      if (story && a.extras.length < story.extras.min) return story.extras.note ?? `Для этой книги добавьте героев: не меньше ${story.extras.min}`;
    }
    return "";
  }

  function go(k: StepKey) {
    setError("");
    setStepKey(k);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    const e = validate(step);
    if (e) return setError(e);
    if (stepIdx < steps.length - 1) go(steps[stepIdx + 1]);
    else submit();
  }

  async function submit() {
    for (const s of steps) {
      const e = validate(s);
      if (e) {
        go(s);
        return setError(e);
      }
    }
    setBusy(true);
    setError("");
    try {
      const answers = {
        ...a,
        occasion: occChosen ? a.occasion : { key: "bez", custom: "" },
        story: own ? { slug: "", idea: a.story.idea, ideaChoice: a.story.ideaChoice } : { slug: story?.slug ?? a.story.slug, idea: "" },
        extras: a.extras.map((e) => ({ ...e, name: e.name.trim() || e.what?.trim() || "" })),
        artStyle: style || "watercolor-air",
      };
      const r = await api<{ bookId: string }>("/api/books", { answers, captcha });
      localStorage.removeItem(KEY);
      localStorage.removeItem(OLD_KEY);
      router.push(`/kniga/${r.bookId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function suggest() {
    setError("");
    setBusy(true);
    try {
      const r = await api<{ ideas: { title: string; summary: string }[] }>("/api/ideas", { idea: a.story.idea, answers: { ...a, hero: { ...a.hero, gender: a.hero.gender ?? "boy", name: a.hero.name || "-" } } });
      setIdeas(r.ideas);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pct = Math.round(((stepIdx + 1) / steps.length) * 100);
  const occLabel = occasionChips(aud).find((o) => o.key === a.occasion.key)?.label;
  const withPreview = step === "hero" || step === "look" || step === "extras" || step === "style";

  const bookCard = (s: QuizStory, badge?: string) => (
    <button key={s.slug} type="button" className="choice" data-slug={s.slug} aria-pressed={!own && a.story.slug === s.slug} onClick={() => chooseStory(s.slug)}>
      <Cover theme={s.coverTheme} title="" sample={sampleUrl({ slug: s.slug })} />
      <div>
        <strong>{s.title.replace(/ о \[Имя\]/, aud === "PET" ? " о вашем питомце" : " о вашем герое").replace("[Имя]", HERO_WORD[aud])}</strong>
        <span>{s.tagline}</span>
        <span className="choice__badges">
          {badge && <span className={`badge ${badge === "к вашему поводу" ? "badge--gold" : ""}`}>{badge}</span>}
          {(aud === "CHILD" || aud === "TEEN") && <span className="badge">{s.ageMin}–{s.ageMax} лет</span>}
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
            <textarea className="textarea" name="idea" maxLength={300} value={a.story.idea ?? ""} onChange={(e) => set("story", { slug: "", idea: e.target.value })} placeholder={aud === "PET" ? "Например: кот Барсик охраняет ёлку от ночных шорохов" : "Например: Марк строит ракету из коробок и летит на Луну к своему коту"} />
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

  return (
    <div className={`flow quiz ${withPreview ? "quiz--wide" : ""}`} data-audience={aud} data-step={step}>
      <div className="quiz__top">
        <div className="stepline">
          <span>
            Шаг {stepIdx + 1} из {steps.length}
          </span>
          <span>{STEP_LABEL[step]}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={stepIdx + 1} aria-label={`Шаг ${stepIdx + 1} из ${steps.length}`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        {locked && story && (
          <p className="quiz__book small">
            Книга: <b>{coverTitle}</b> · <a href={`/skazki?dlya=${({ CHILD: "detyam", TEEN: "podrostkam", ADULT: "vzroslym", PET: "pitomcam" } as const)[aud]}`}>сменить</a>
          </p>
        )}
      </div>

      <div className={withPreview ? "quiz__grid" : undefined}>
        <div className="quiz__main">
          {step === "audience" && (
            <section>
              <h1 ref={h1} tabIndex={-1}>Для кого книга?</h1>
              <p className="muted">Подберём книги, голос и стиль иллюстраций под героя.</p>
              <div className="aud-cards" role="group" aria-label="Для кого книга">
                {AUDIENCE_CARDS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className="aud-card"
                    data-key={c.key}
                    aria-pressed={audChosen && aud === c.key}
                    onClick={() => {
                      chooseAudience(c.key);
                      go("occasion");
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sampleUrl(c.look)} alt="" width={160} height={160} loading="eager" />
                    <strong>{c.title}</strong>
                    <span>{c.sub}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === "occasion" && (
            <section>
              {presetOccasion && !editOcc ? (
                <>
                  <h1 ref={h1} tabIndex={-1}>Выберите книгу</h1>
                  <p className="muted">
                    Повод: <b>{occLabel ?? "свой"}</b> ·{" "}
                    <button type="button" className="link-btn" onClick={() => setEditOcc(true)}>изменить</button>
                  </p>
                </>
              ) : (
                <>
                  <h1 ref={h1} tabIndex={-1}>Какой повод?</h1>
                  <Chips name="occasion" label="Повод" items={occasionChips(aud)} value={occ} onChange={(v) => chooseOccasion(v as string)} />
                </>
              )}
              {occChosen && a.occasion.key === "svoj" && (
                <label className="field">
                  <span>Какой у вас повод? <span className="req">*</span></span>
                  <input className="input" name="occasion-custom" maxLength={120} value={a.occasion.custom ?? ""} onChange={(e) => set("occasion", { ...a.occasion, custom: e.target.value })} placeholder={aud === "PET" ? "Например, первая зима на даче" : "Например, первый поход в бассейн"} />
                  <small>Впишем его в первую и последнюю страницы.</small>
                </label>
              )}
              <h2 className="quiz__h2" aria-live="polite">
                {!occ || occ === "bez" ? "Выберите книгу" : occ === "svoj" ? "Книги к вашему поводу" : `Книги к поводу «${occLabel}»`}
              </h2>
              <div className="choice-cards choice-cards--books">
                {occ === "svoj" && ownCard}
                {matching.map((s) => bookCard(s, "к вашему поводу"))}
                {others.map((s) => bookCard(s, occ && occ !== "bez" ? "впишем ваш повод" : undefined))}
                {occ !== "svoj" && ownCard}
              </div>
            </section>
          )}

          {step === "hero" && (
            <section>
              <h1 ref={h1} tabIndex={-1}>{aud === "PET" ? "Кто герой книги?" : aud === "ADULT" ? "Кому книга?" : "Кто главный герой?"}</h1>
              <div className="grid2">
                <label className="field">
                  <span>{aud === "PET" ? "Кличка" : "Имя"} <span className="req">*</span></span>
                  <input className="input input--lg ym-disable-keys" name="hero-name" autoComplete="off" value={a.hero.name ?? ""} maxLength={30} onChange={(e) => hero({ name: e.target.value })} placeholder={aud === "PET" ? "Например, Пушок" : aud === "ADULT" ? "Например, Анна" : "Например, Марк"} />
                </label>
                {aud !== "TEEN" && (
                  <label className="field">
                    <span>Как ласково зовут дома</span>
                    <input className="input input--lg ym-disable-keys" name="hero-nickname" autoComplete="off" value={a.hero.nickname ?? ""} maxLength={30} onChange={(e) => hero({ nickname: e.target.value })} placeholder={aud === "PET" ? "Например, Пушистик" : aud === "ADULT" ? "Например, Анечка" : "Например, Марусик"} />
                    <small>Необязательно. Так герой будет звучать в тёплых местах книги</small>
                  </label>
                )}
              </div>
              {aud === "PET" && (
                <>
                  <span className="label">Кто это? <span className="req">*</span></span>
                  <Chips name="species" label="Вид питомца" items={[{ key: "dog", label: "Собака" }, { key: "cat", label: "Кошка" }]} value={(a.pet.species ?? "") as "dog"} onChange={(v) => pet({ species: (v || undefined) as "dog" })} />
                </>
              )}
              <span className="label">{aud === "PET" ? "Пол" : "Кто это?"} <span className="req">*</span></span>
              <Chips name="gender" label="Пол" items={[{ key: "boy", label: GENDER[aud][0] }, { key: "girl", label: GENDER[aud][1] }]} value={(a.hero.gender ?? "") as "boy"} onChange={(v) => hero({ gender: (v || undefined) as "boy" })} />
              {aud === "CHILD" && (
                <>
                  <span className="label">Возраст <span className="req">*</span></span>
                  <Chips name="age" label="Возраст" items={AGE_GROUPS.map((g) => ({ key: g.key, label: g.label }))} value={(a.hero.ageGroup ?? "") as "2-3"} onChange={(v) => hero({ ageGroup: (v || undefined) as "2-3" })} />
                  <details className="more" open={Boolean(a.hero.birthDate)}>
                    <summary>или указать дату рождения</summary>
                    <label className="field" style={{ maxWidth: 260 }}>
                      <span>Дата рождения</span>
                      <input className="input" type="date" name="birth-date" value={a.hero.birthDate ?? ""} onChange={(e) => hero({ birthDate: e.target.value })} />
                      <small>Напомним о дне рождения, если разрешите письма</small>
                    </label>
                  </details>
                </>
              )}
              {aud === "TEEN" && (
                <>
                  <span className="label">Сколько лет <span className="req">*</span></span>
                  <Chips name="age" label="Возраст" items={["11", "12", "13", "14", "15", "16", "17"].map((x) => ({ key: x, label: x }))} value={a.hero.age !== undefined ? String(a.hero.age) : ""} onChange={(v) => hero({ age: v ? Number(v) : undefined })} />
                  <span className="label">Чем увлекается — до трёх</span>
                  <Chips name="interests" label="Увлечения" items={asItems(TEEN_INTERESTS)} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
                </>
              )}
              {aud === "ADULT" && (
                <>
                  <span className="label">Возраст</span>
                  <Chips name="age" label="Возраст" items={ADULT_AGES.map((x) => ({ key: x.key, label: x.label }))} value={a.hero.age !== undefined ? String(ADULT_AGES.reduce((best, x) => (Math.abs(Number(x.key) - a.hero.age!) < Math.abs(Number(best.key) - a.hero.age!) ? x : best)).key) : ""} onChange={(v) => hero({ age: v ? Number(v) : undefined })} />
                </>
              )}
              {aud === "PET" && (
                <>
                  <label className="field">
                    <span>Порода</span>
                    <input className="input" name="pet-breed" list="breeds" maxLength={60} value={a.pet.breed ?? ""} onChange={(e) => pet({ breed: e.target.value })} placeholder="Например, корги или «беспородный»" />
                    <datalist id="breeds">
                      {(a.pet.species === "cat" ? ["беспородная", "британская", "мейн-кун", "шотландская вислоухая", "сфинкс", "сиамская"] : ["беспородная", "корги", "лабрадор", "той-терьер", "шпиц", "хаски", "такса", "овчарка"]).map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </label>
                  <span className="label">Окрас</span>
                  <Chips name="fur" label="Окрас" items={asItems(FUR)} value={a.pet.furColor ?? ""} onChange={(v) => pet({ furColor: v as string })} />
                </>
              )}
              {partnerInHero && (
                <fieldset className="partner">
                  <legend>Вторая половинка <span className="req">*</span></legend>
                  <p className="small muted">{story?.extras.note ?? "Второй герой книги — рядом на каждой странице."}</p>
                  {a.extras.slice(0, minExtras).map((e, i) => (
                    <div key={i} className="grid2">
                      <label className="field">
                        <span>Имя</span>
                        <input className="input input--lg ym-disable-keys" name={`partner-name-${i}`} autoComplete="off" maxLength={30} value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} placeholder="Например, Илья" />
                      </label>
                      <div>
                        <span className="label">Кто это?</span>
                        <Chips name={`partner-gender-${i}`} label="Пол второй половинки" items={[{ key: "boy", label: "Он" }, { key: "girl", label: "Она" }]} value={(e.gender ?? "") as "boy"} onChange={(v) => setExtra(i, { gender: (v || undefined) as "boy" })} />
                      </div>
                    </div>
                  ))}
                </fieldset>
              )}
            </section>
          )}

          {step === "look" && (
            <section>
              <h1 ref={h1} tabIndex={-1}>{aud === "PET" ? `Какой характер у ${fill("{ГЕРОЙ.род}")}?` : `Как выглядит ${fill("{ГЕРОЙ.им}")}?`}</h1>
              <p className="muted">
                {aud === "PET"
                  ? "Привычки и приметы станут сценами книги. Фото попросим позже — после текста."
                  : "Фото попросим позже — когда текст понравится. Описание нужно, чтобы иллюстрации были похожи и без фото."}
              </p>
              {aud !== "PET" ? (
                <>
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
                  <label className="field">
                    <span>Своими словами</span>
                    <textarea className="textarea" name="look-custom" maxLength={300} value={a.appearance.custom ?? ""} onChange={(e) => look({ custom: e.target.value })} placeholder="Например: большие голубые глаза, ямочки на щеках, всегда в красной кепке" />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Характер и привычки</span>
                    <textarea className="textarea" name="pet-traits" maxLength={300} value={a.pet.traits ?? ""} onChange={(e) => pet({ traits: e.target.value })} placeholder="Ворует носки, боится пылесоса, спит на клавиатуре" />
                  </label>
                  <label className="field">
                    <span>Приметы</span>
                    <input className="input" name="pet-marks" maxLength={300} value={a.appearance.custom ?? ""} onChange={(e) => look({ custom: e.target.value })} placeholder="Белое пятно на груди, одно ухо висит, разные глаза" />
                  </label>
                </>
              )}

              <h2 className="quiz__h2">{aud === "PET" ? "Что любит" : aud === "ADULT" ? "О герое" : `Что любит ${fill("{ГЕРОЙ.им}")}`}</h2>
              {aud === "CHILD" && (
                <>
                  <p className="small muted">До трёх — они появятся в сказке.</p>
                  <Chips name="interests" label="Увлечения" items={INTERESTS.map((i) => ({ key: i.key, label: i.key, hint: i.hint }))} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
                </>
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
                  {(partnerInHero || story?.segments.includes("adult-couple")) && (
                    <label className="field">
                      <span>Как вы познакомились</span>
                      <textarea className="textarea" name="adult-howmet" maxLength={400} value={a.adult.howMet ?? ""} onChange={(e) => adult({ howMet: e.target.value })} placeholder="Пара предложений: где, когда, что запомнилось" />
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
                </>
              )}
              <label className="field">
                <span>{aud === "PET" ? "Любимые занятия" : aud === "ADULT" ? "Увлечения" : "Ещё увлечения своими словами"}</span>
                <input className="input" name="interest-custom" maxLength={80} value={a.interestCustom ?? ""} onChange={(e) => set("interestCustom", e.target.value)} placeholder={aud === "PET" ? "Мячики, прогулки у реки, коробки" : aud === "ADULT" ? "Дача, рыбалка, кино, вязание" : "Лего, футбол, рисовать комиксы"} />
              </label>
            </section>
          )}

          {step === "extras" && (
            <section>
              <h1 ref={h1} tabIndex={-1}>Кто ещё в сказке?</h1>
              <p className="muted">
                {story?.extras.note ?? (aud === "PET" ? "Хозяева, ещё питомец или кто угодно." : "Мама, брат, бабушка, друг, питомец, любимая игрушка — или свой вариант: дерево, робот, машинка, облако.")}{" "}
                {minExtras > 0 ? "" : `Необязательно, до ${maxExtras}.`}
              </p>
              {a.extras.map((e, i) => {
                const required = i < minExtras;
                if (partnerInHero && required) return null;
                return (
                  <fieldset className="extra" key={i} data-extra={i}>
                    <legend>
                      Герой {i + 1}
                      {required ? <span className="badge" style={{ marginLeft: 8 }}>обязательно</span> : null}
                    </legend>
                    {!required ? (
                      <Chips name={`role-${i}`} label="Кто это" items={roleOptions.map((r) => ({ key: r, label: aud === "PET" && r === "pet" ? "Ещё питомец" : EXTRA_ROLE_LABELS[r] ?? r }))} value={e.role} onChange={(v) => setExtra(i, { role: ((v as string) || e.role) as Extra["role"], gender: undefined })} />
                    ) : (
                      <p className="small"><b>{EXTRA_ROLE_LABELS[e.role] ?? e.role}</b></p>
                    )}
                    {e.role === "custom" && (
                      <label className="field">
                        <span>Кто или что это <span className="req">*</span></span>
                        <input className="input" name={`extra-what-${i}`} maxLength={60} value={e.what ?? ""} onChange={(ev) => setExtra(i, { what: ev.target.value })} placeholder="Дерево, робот, машинка, облако, плюшевый заяц" />
                      </label>
                    )}
                    <div className="grid2">
                      <label className="field">
                        <span>
                          {e.role === "pet" ? "Кличка" : e.role === "custom" || e.role === "toy" ? "Как зовут (если есть имя)" : "Имя"}
                          {e.role !== "custom" && <span className="req"> *</span>}
                        </span>
                        <input className="input ym-disable-keys" name={`extra-name-${i}`} autoComplete="off" maxLength={30} value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} placeholder={e.role === "custom" ? "Например, Дуб Дубыч" : e.role === "mom" ? "Например, мама Оля" : "Например, Аня"} />
                      </label>
                      <label className="field">
                        <span>{e.role === "custom" ? "Какой он" : "Как выглядит"}</span>
                        <input className="input" name={`extra-desc-${i}`} maxLength={200} value={e.description ?? ""} onChange={(ev) => setExtra(i, { description: ev.target.value })} placeholder={e.role === "pet" ? "Рыжий кот с белыми лапками" : e.role === "custom" ? "Старый, мудрый, с дуплом-окошком" : "Светлые волосы, очки"} />
                      </label>
                    </div>
                    {e.role === "pet" && (
                      <Chips name={`extra-species-${i}`} label="Вид" items={[{ key: "dog", label: "Собака" }, { key: "cat", label: "Кошка" }, { key: "other", label: "Другое" }]} value={(e.species ?? "") as "dog"} onChange={(v) => setExtra(i, { species: (v || undefined) as "dog" })} />
                    )}
                    {!HUMAN_ROLES.includes(e.role) && (
                      <Chips name={`extra-gender-${i}`} label="Род" items={extraGenders(e.role)} value={(e.gender ?? "") as "boy"} onChange={(v) => setExtra(i, { gender: (v || undefined) as Extra["gender"] })} />
                    )}
                    {!required && (
                      <button type="button" className="link-btn" onClick={() => set("extras", a.extras.filter((_, j) => j !== i))}>
                        Убрать
                      </button>
                    )}
                  </fieldset>
                );
              })}
              {a.extras.length < maxExtras && (
                <button type="button" className="btn btn--ghost add-extra" onClick={() => set("extras", [...a.extras, { role: (lockedRole && a.extras.length < minExtras ? lockedRole : roleOptions.find((r) => r !== "partner" || aud === "ADULT") ?? "friend") as Extra["role"], name: "", description: "", what: "" }])}>
                  + Добавить героя
                </button>
              )}
              {a.extras.length === 0 && <p className="small muted" style={{ marginTop: 12 }}>Можно никого не добавлять — нажмите «Дальше».</p>}
            </section>
          )}

          {step === "style" && (
            <section>
              <h1 ref={h1} tabIndex={-1}>Стиль, настроение, посвящение</h1>
              <span className="label">Стиль иллюстраций</span>
              <p className="small muted" style={{ margin: "2px 0 8px" }}>Первые — лучшие для этой книги.</p>
              <div className="styles" role="radiogroup" aria-label="Стиль иллюстраций">
                {audStyles.map((s, i) => (
                  <button key={s.key} type="button" role="radio" className="style-card" data-style={s.key} aria-checked={style === s.key} onClick={() => set("artStyle", s.key)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sampleUrl({ ...previewLook, style: s.key, mood: undefined })} alt="" loading={i < 4 ? "eager" : "lazy"} width={160} height={160} />
                    <strong>{s.title}</strong>
                    {i < 2 && story?.artStyles.includes(s.key) && <span className="badge badge--gold">лучший выбор</span>}
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
                <small>{(a.dedication ?? "").length} / 300</small>
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
          <aside className="quiz__preview" aria-label="Обложка, пример">
            <Cover theme={story?.coverTheme ?? ""} title={coverTitle} sample={sampleUrl({ ...previewLook, style, mood: a.mood })} name={coverTitle.includes(a.hero.name?.trim() || "\u0000") ? "" : coverName} eager />
            <p className="small muted">
              Обложка-пример: меняется по вашим ответам. {aud === "PET" ? "По фото питомца" : "По фото"} нейросеть нарисует героя ещё точнее.
            </p>
          </aside>
        )}
      </div>

      <div className="flow-nav">
        <div className="in">
          {stepIdx > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => go(steps[stepIdx - 1])}>
              Назад
            </button>
          )}
          <button type="button" className="btn btn--primary" data-next onClick={next} disabled={busy}>
            {stepIdx < steps.length - 1 ? "Дальше" : busy ? "Отправляем…" : "Сочинить книгу"}
          </button>
        </div>
      </div>
    </div>
  );
}
