"use client";
// Анкета создания книги для 4 аудиторий (дети, подростки, взрослые, питомцы) → AnswersV2.
// Минимальная функциональная версия: структура шагов прежняя, поля — по аудитории. Дизайн переделывает UX-агент.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover, type CoverColors } from "@/components/Cover";
import { api, goal } from "@/lib/client";
import {
  AGE_GROUPS, CLOTHES, dedicationsFor, extraRoleItems, FUR, HAIR, HAIR_ADULT, HAIRSTYLE, INTERESTS, occasionChips, SKIN, type QuizAnswers,
} from "@/lib/quiz";
import { fillTags } from "@/lib/declension";
import { AUDIENCES, type AudienceKey } from "@/content/profiles";
import { Captcha } from "@/components/Captcha";

export interface QuizStory {
  slug: string;
  title: string;
  tagline: string;
  audience: AudienceKey;
  coverTheme: string;
  coverColors?: CoverColors;
  ageMin: number;
  ageMax: number;
  occasions: string[];
  artStyles: string[];
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
}

const KEY = "bookimi.quiz.v2";
const OLD_KEY = "bookimi.quiz.v1";
const STEPS = ["Герой", "Внешность", "О герое", "Повод", "Сюжет", "Другие герои", "Стиль и посвящение"];

type Extra = QuizAnswers["extras"][number];
type Draft = Omit<QuizAnswers, "hero" | "extras"> & { hero: Partial<QuizAnswers["hero"]>; extras: (Omit<Extra, "gender"> & { gender?: Extra["gender"] })[] };

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

const GENDER: Record<AudienceKey, [string, string]> = {
  CHILD: ["Мальчик", "Девочка"],
  TEEN: ["Парень", "Девушка"],
  ADULT: ["Мужчина", "Женщина"],
  PET: ["Он", "Она"],
};
const DEFAULT_ROLES: Record<AudienceKey, string[]> = {
  CHILD: ["sibling", "mom", "dad", "grandma", "grandpa", "pet", "friend", "toy", "custom"],
  TEEN: ["friend", "sibling", "pet", "mom", "dad"],
  ADULT: ["partner", "child", "grandchild", "friend", "colleague", "pet"],
  PET: ["owner", "child", "partner", "sibling", "pet"],
};

function Chips<T extends string>({ items, value, onChange, multi = false, max = 99, name }: {
  items: { key: T; label: string; hint?: string }[]; value: T | T[]; onChange: (v: T | T[]) => void; multi?: boolean; max?: number; name?: string;
}) {
  const sel = Array.isArray(value) ? value : [value];
  return (
    <div className="chips" data-chips={name}>
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

const asItems = (xs: string[]) => xs.map((x) => ({ key: x, label: x }));

export function QuizWizard({ stories, styles, moods = [], initial, captchaKey }: { stories: QuizStory[]; styles: QuizStyle[]; moods?: QuizMood[]; initial: Partial<Draft>; captchaKey?: string }) {
  const router = useRouter();
  const [a, setA] = useState<Draft>(() => ({ ...empty(initial.audience), ...initial }));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; summary: string }[]>([]);
  const [captcha, setCaptcha] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  // Автосохранение: черновик в браузере, «Назад» без потери ответов (старый черновик v1 тоже подхватываем)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY) ?? "null");
      const name = localStorage.getItem("bookimi.heroName") ?? "";
      setA((cur) => {
        const s = saved?.a ? { ...saved.a } : null;
        if (s && s.artStyle === undefined && typeof s.style === "string") s.artStyle = s.style;
        let base: Draft = s ? { ...cur, ...s, hero: { ...cur.hero, ...s.hero } } : cur;
        if (initial.audience && base.audience !== initial.audience) base = { ...empty(initial.audience), hero: { name: base.hero.name } };
        if (initial.story?.slug) base.story = { ...base.story, slug: initial.story.slug, idea: "" };
        if (initial.occasion?.key) base.occasion = initial.occasion;
        if (!base.hero.name && name) base.hero = { ...base.hero, name };
        return { ...base };
      });
      if (typeof saved?.step === "number" && !initial.story?.slug && !initial.audience) setStep(Math.min(saved.step, STEPS.length - 1));
    } catch {}
    setLoaded(true);
    goal("quiz_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ a, step }));
    } catch {}
  }, [a, step, loaded]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setA((cur) => ({ ...cur, [k]: v }));
  const hero = (patch: Partial<Draft["hero"]>) => setA((cur) => ({ ...cur, hero: { ...cur.hero, ...patch } }));
  const look = (patch: Partial<Draft["appearance"]>) => setA((cur) => ({ ...cur, appearance: { ...cur.appearance, ...patch } }));
  const pet = (patch: Partial<Draft["pet"]>) => setA((cur) => ({ ...cur, pet: { ...cur.pet, ...patch } }));
  const adult = (patch: Partial<Draft["adult"]>) => setA((cur) => ({ ...cur, adult: { ...cur.adult, ...patch } }));
  const aud = a.audience as AudienceKey;

  const preview = useMemo(() => {
    const h = { name: a.hero.name || "Имя", nickname: a.hero.nickname || a.hero.name || "Имя", gender: a.hero.gender };
    return (t: string) => fillTags(t, { hero: h, extras: a.extras.map((e) => ({ name: e.name || "…", gender: e.gender })) });
  }, [a.hero, a.extras]);

  const story = stories.find((s) => s.slug === a.story.slug) ?? null;
  const audStories = useMemo(() => {
    const list = stories.filter((s) => s.audience === aud);
    const rank = (s: QuizStory) => (s.occasions.includes(a.occasion.key) ? s.occasions.indexOf(a.occasion.key) : 100);
    return [...list].sort((x, y) => rank(x) - rank(y));
  }, [stories, aud, a.occasion.key]);
  const roles = story?.extras.roles.length ? story.extras.roles : DEFAULT_ROLES[aud];
  const maxExtras = story ? story.extras.max : 3;
  const audStyles = useMemo(() => {
    const list = styles.filter((s) => !s.audiences || s.audiences.includes(aud));
    const rec = story?.artStyles ?? [];
    return [...list].sort((x, y) => (rec.includes(x.key) ? rec.indexOf(x.key) : 100) - (rec.includes(y.key) ? rec.indexOf(y.key) : 100));
  }, [styles, aud, story]);
  const age = typeof a.hero.age === "number" ? a.hero.age : undefined;
  const audMoods = moods.filter((m) => m.audiences.includes(aud) && (m.minAge === undefined || aud !== "TEEN" || (age !== undefined && age >= m.minAge)));

  function chooseAudience(next: AudienceKey) {
    if (next === aud) return;
    setA((cur) => ({ ...empty(next), hero: { name: cur.hero.name, nickname: cur.hero.nickname } }));
    setIdeas([]);
  }

  function validate(s: number): string {
    if (s === 0) {
      if (!a.hero.name?.trim()) return aud === "PET" ? "Как зовут питомца?" : "Как зовут героя?";
      if (!a.hero.gender) return `Выберите: ${GENDER[aud][0].toLowerCase()} или ${GENDER[aud][1].toLowerCase()}`;
      if (aud === "CHILD" && !a.hero.ageGroup && !a.hero.birthDate) return "Укажите возраст или дату рождения";
      if (aud === "TEEN" && (a.hero.age === undefined || a.hero.age < 10 || a.hero.age > 18)) return "Укажите возраст: от 10 до 18 лет";
      if (aud === "PET" && !a.pet.species) return "Кто это: собака или кошка?";
    }
    if (s === 4 && !a.story.slug && !(a.story.idea && a.story.ideaChoice)) return "Выберите сюжет или придумайте свой и выберите вариант";
    if (s === 5) {
      if (a.extras.some((e) => !e.name.trim())) return "Укажите имя каждого героя или уберите лишнего";
      if (story && a.extras.length < story.extras.min) return story.extras.note ?? `Для этого сюжета добавьте героев: не меньше ${story.extras.min}`;
    }
    return "";
  }

  function next() {
    const e = validate(step);
    if (e) return setError(e);
    setError("");
    if (step === 4 && story && a.extras.length < story.extras.min) {
      // Пара, хозяева питомца: сразу заводим нужное число доп. героев первой ролью сюжета
      const need = story.extras.min - a.extras.length;
      set("extras", [...a.extras, ...Array.from({ length: need }, () => ({ role: story.extras.roles[0] as Extra["role"], name: "", description: "", what: "" }))]);
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else submit();
  }

  async function submit() {
    for (let s = 0; s < STEPS.length; s++) {
      const e = validate(s);
      if (e) {
        setStep(s);
        return setError(e);
      }
    }
    setBusy(true);
    setError("");
    try {
      const answers = { ...a, artStyle: a.artStyle || story?.artStyles[0] || audStyles[0]?.key || "watercolor-air" };
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

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const setExtra = (i: number, patch: Partial<Draft["extras"][number]>) => set("extras", a.extras.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="flow" data-audience={aud}>
      <div className="stepline">
        <span>
          Шаг {step + 1} из {STEPS.length}
        </span>
        <span>{STEPS[step]}</span>
      </div>
      <div className="progress" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>

      {step === 0 && (
        <section>
          <h1>Для кого книга?</h1>
          <Chips name="audience" items={AUDIENCES.map((x) => ({ key: x.key, label: x.label, hint: x.oneLine }))} value={aud} onChange={(v) => v && chooseAudience(v as AudienceKey)} />
          <div className="grid2">
            <label className="field">
              <span>{aud === "PET" ? "Кличка" : "Имя"} <span className="req">*</span></span>
              <input className="input ym-disable-keys" name="hero-name" value={a.hero.name ?? ""} maxLength={30} onChange={(e) => hero({ name: e.target.value })} placeholder={aud === "PET" ? "Например, Пушок" : "Например, Марк"} />
            </label>
            <label className="field">
              <span>Как ласково зовут дома</span>
              <input className="input ym-disable-keys" name="hero-nickname" value={a.hero.nickname ?? ""} maxLength={30} onChange={(e) => hero({ nickname: e.target.value })} placeholder={aud === "PET" ? "Например, Пушистик" : "Например, Марусик"} />
              <small>Так герой будет звучать в тёплых местах книги</small>
            </label>
          </div>
          <span className="label">{aud === "PET" ? "Он или она?" : "Кто это?"} <span className="req">*</span></span>
          <Chips name="gender" items={[{ key: "boy", label: GENDER[aud][0] }, { key: "girl", label: GENDER[aud][1] }]} value={(a.hero.gender ?? "") as "boy"} onChange={(v) => hero({ gender: (v || undefined) as "boy" })} />
          {aud === "PET" && (
            <>
              <span className="label">Кто это? <span className="req">*</span></span>
              <Chips name="species" items={[{ key: "dog", label: "Собака" }, { key: "cat", label: "Кошка" }]} value={(a.pet.species ?? "") as "dog"} onChange={(v) => pet({ species: (v || undefined) as "dog" })} />
            </>
          )}
          {aud === "CHILD" ? (
            <>
              <span className="label">Возраст <span className="req">*</span></span>
              <Chips name="age" items={AGE_GROUPS.map((g) => ({ key: g.key, label: g.label }))} value={(a.hero.ageGroup ?? "") as "2-3"} onChange={(v) => hero({ ageGroup: (v || undefined) as "2-3" })} />
              <label className="field" style={{ maxWidth: 260 }}>
                <span>или дата рождения</span>
                <input className="input" type="date" value={a.hero.birthDate ?? ""} onChange={(e) => hero({ birthDate: e.target.value })} />
                <small>Напомним о дне рождения, если разрешите рассылку</small>
              </label>
            </>
          ) : (
            <label className="field" style={{ maxWidth: 260 }}>
              <span>Возраст{aud === "TEEN" ? <span className="req"> *</span> : null}</span>
              <input className="input" name="hero-age" type="number" min={0} max={120} value={a.hero.age ?? ""} onChange={(e) => hero({ age: e.target.value === "" ? undefined : Math.max(0, Math.min(120, Math.trunc(Number(e.target.value)))) })} />
              {aud !== "TEEN" && <small>Необязательно</small>}
            </label>
          )}
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Как выглядит {preview("{ГЕРОЙ.им}")}?</h1>
          <p className="muted">Фото попросим позже — когда текст вам понравится. Сейчас опишите внешность: так иллюстрации будут похожи, даже если фото не будет.</p>
          {aud === "PET" ? (
            <>
              <label className="field">
                <span>Порода</span>
                <input className="input" name="pet-breed" maxLength={60} value={a.pet.breed ?? ""} onChange={(e) => pet({ breed: e.target.value })} placeholder="Например, корги или «беспородный»" />
              </label>
              <span className="label">Окрас</span>
              <Chips name="fur" items={asItems(FUR)} value={a.pet.furColor ?? ""} onChange={(v) => pet({ furColor: v as string })} />
              <label className="field">
                <span>Окрас и приметы своими словами</span>
                <input className="input" maxLength={120} value={a.pet.furColor ?? ""} onChange={(e) => pet({ furColor: e.target.value })} placeholder="Например: рыжий с белой грудкой, одно ухо висит" />
              </label>
            </>
          ) : (
            <>
              <span className="label">Цвет волос</span>
              <Chips name="hair" items={asItems(aud === "ADULT" ? HAIR_ADULT : HAIR)} value={a.appearance.hair ?? ""} onChange={(v) => look({ hair: v as string })} />
              <span className="label">Причёска</span>
              <Chips name="hairstyle" items={asItems(HAIRSTYLE)} value={a.appearance.hairstyle ?? ""} onChange={(v) => look({ hairstyle: v as string })} />
              <span className="label">Тон кожи</span>
              <Chips name="skin" items={asItems(SKIN)} value={a.appearance.skin ?? ""} onChange={(v) => look({ skin: v as string })} />
              <div className="chips">
                <button type="button" className="chip" aria-pressed={!!a.appearance.glasses} onClick={() => look({ glasses: !a.appearance.glasses })}>Очки</button>
                <button type="button" className="chip" aria-pressed={!!a.appearance.freckles} onClick={() => look({ freckles: !a.appearance.freckles })}>Веснушки</button>
                {aud === "ADULT" && <button type="button" className="chip" aria-pressed={!!a.appearance.beard} onClick={() => look({ beard: !a.appearance.beard })}>Борода или усы</button>}
              </div>
              <span className="label">Любимая одежда</span>
              <Chips name="clothes" items={asItems(CLOTHES)} value={a.appearance.clothes ?? ""} onChange={(v) => look({ clothes: v as string })} />
            </>
          )}
          <label className="field">
            <span>Описать самому</span>
            <textarea className="textarea" maxLength={300} value={a.appearance.custom ?? ""} onChange={(e) => look({ custom: e.target.value })} placeholder={aud === "PET" ? "Например: пушистый хвост бубликом, разные глаза" : "Например: большие голубые глаза, ямочки на щеках, всегда в красной кепке"} />
          </label>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>{aud === "PET" ? `Какой характер у ${preview("{ГЕРОЙ.род}")}?` : `Что любит ${preview("{ГЕРОЙ.им}")}?`}</h1>
          {aud === "PET" && (
            <label className="field">
              <span>Характер и привычки</span>
              <textarea className="textarea" name="pet-traits" maxLength={300} value={a.pet.traits ?? ""} onChange={(e) => pet({ traits: e.target.value })} placeholder="Ворует носки, боится пылесоса, спит на клавиатуре" />
            </label>
          )}
          {aud === "ADULT" && (
            <>
              <label className="field">
                <span>Чем занимается</span>
                <input className="input" name="adult-profession" maxLength={80} value={a.adult.profession ?? ""} onChange={(e) => adult({ profession: e.target.value })} placeholder="Врач, инженер, учитель, на пенсии…" />
              </label>
              <label className="field">
                <span>Кем приходится вам</span>
                <input className="input" name="adult-relation" maxLength={40} value={a.adult.relation ?? ""} onChange={(e) => adult({ relation: e.target.value })} placeholder="Мама, муж, бабушка, друг, коллега…" />
              </label>
              <label className="field">
                <span>Как вы познакомились (для пар)</span>
                <textarea className="textarea" name="adult-howmet" maxLength={400} value={a.adult.howMet ?? ""} onChange={(e) => adult({ howMet: e.target.value })} />
              </label>
              <label className="field">
                <span>Общие воспоминания — по одному в строке, до трёх</span>
                <textarea className="textarea" name="adult-memories" maxLength={900} value={a.adult.memories.join("\n")} onChange={(e) => adult({ memories: e.target.value.split("\n").slice(0, 3).map((x) => x.slice(0, 300)) })} />
              </label>
            </>
          )}
          {(aud === "CHILD" || aud === "TEEN") && (
            <>
              <p className="muted">До трёх увлечений — они появятся в книге.</p>
              <Chips name="interests" items={INTERESTS.map((i) => ({ key: i.key, label: i.key, hint: i.hint }))} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
            </>
          )}
          <label className="field">
            <span>{aud === "CHILD" || aud === "TEEN" ? "Своё увлечение" : "Увлечения"}</span>
            <input className="input" name="interest-custom" maxLength={80} value={a.interestCustom ?? ""} onChange={(e) => set("interestCustom", e.target.value)} placeholder={aud === "PET" ? "Например, мячики и прогулки у реки" : "Например, лего, рыбалка, кино"} />
          </label>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>К какому поводу книга?</h1>
          <Chips name="occasion" items={occasionChips(aud)} value={a.occasion.key} onChange={(v) => set("occasion", { ...a.occasion, key: (v as string) || "bez" })} />
          {a.occasion.key === "svoj" && (
            <label className="field">
              <span>Свой повод</span>
              <input className="input" maxLength={120} value={a.occasion.custom ?? ""} onChange={(e) => set("occasion", { ...a.occasion, custom: e.target.value })} placeholder="Например, первый поход в бассейн" />
            </label>
          )}
        </section>
      )}

      {step === 4 && (
        <section>
          <h1>Выберите сюжет</h1>
          <div className="choice-cards">
            {audStories.map((s) => (
              <button key={s.slug} type="button" className="choice" data-slug={s.slug} aria-pressed={a.story.slug === s.slug} onClick={() => set("story", { slug: s.slug, idea: "" })}>
                <Cover theme={s.coverTheme} colors={s.coverColors} title="" />
                <div>
                  <strong>{preview(s.title.replace("[Имя]", "{ГЕРОЙ.им}"))}</strong>
                  <span>{s.tagline}</span>
                  <br />
                  {(aud === "CHILD" || aud === "TEEN") && <span className="badge" style={{ marginTop: 6 }}>{s.ageMin}–{s.ageMax} лет</span>}
                  {s.extras.note && <span className="badge" style={{ marginTop: 6 }}>{s.extras.note}</span>}
                </div>
              </button>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <strong>Своя идея</strong>
            <p className="small muted">Опишите в 1–2 предложениях — предложим 3 варианта сюжета.</p>
            <textarea className="textarea" name="idea" maxLength={300} value={a.story.idea ?? ""} onChange={(e) => set("story", { slug: "", idea: e.target.value })} placeholder="Например: Марк строит ракету из коробок и летит на Луну к своему коту" />
            <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} disabled={busy || (a.story.idea ?? "").length < 5} onClick={suggest}>
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
        </section>
      )}

      {step === 5 && (
        <section>
          <h1>Кто ещё будет в книге?</h1>
          <p className="muted">{story?.extras.note ?? `Необязательно. До ${maxExtras} героев. Фото для них тоже можно будет добавить позже.`}</p>
          {a.extras.map((e, i) => (
            <div className="extra" key={i} data-extra={i}>
              <Chips name={`role-${i}`} items={extraRoleItems(roles)} value={e.role} onChange={(v) => setExtra(i, { role: ((v as string) || e.role) as Extra["role"] })} />
              <div className="grid2">
                <label className="field">
                  <span>Имя или кличка</span>
                  <input className="input ym-disable-keys" name={`extra-name-${i}`} maxLength={30} value={e.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} />
                </label>
                <label className="field">
                  <span>{e.role === "custom" ? "Кто или что это" : "Как выглядит"}</span>
                  {e.role === "custom" ? (
                    <input className="input" maxLength={60} value={e.what ?? ""} onChange={(ev) => setExtra(i, { what: ev.target.value })} placeholder="Дерево, робот, машина, облако" />
                  ) : (
                    <input className="input" maxLength={200} value={e.description ?? ""} onChange={(ev) => setExtra(i, { description: ev.target.value })} placeholder="Например: рыжий кот с белыми лапками" />
                  )}
                </label>
              </div>
              {!["mom", "dad", "grandma", "grandpa"].includes(e.role) && (
                <Chips
                  name={`extra-gender-${i}`}
                  items={[{ key: "boy", label: e.role === "custom" ? "Он" : "Мужской род" }, { key: "girl", label: e.role === "custom" ? "Она" : "Женский род" }, ...(e.role === "custom" ? [{ key: "n", label: "Оно" }] : [])]}
                  value={(e.gender ?? "") as "boy"}
                  onChange={(v) => setExtra(i, { gender: (v || undefined) as Extra["gender"] })}
                />
              )}
              <button type="button" className="link-btn" onClick={() => set("extras", a.extras.filter((_, j) => j !== i))}>Убрать</button>
            </div>
          ))}
          {a.extras.length < maxExtras && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("extras", [...a.extras, { role: roles[0] as Extra["role"], name: "", description: "", what: "" }])}>
              Добавить героя
            </button>
          )}
        </section>
      )}

      {step === 6 && (
        <section>
          <h1>Стиль и посвящение</h1>
          <span className="label">Стиль иллюстраций</span>
          <div className="choice-cards" style={{ margin: "8px 0 20px" }}>
            {audStyles.map((s, i) => (
              <button key={s.key} type="button" className="choice" data-style={s.key} aria-pressed={(a.artStyle || audStyles[0]?.key) === s.key} onClick={() => set("artStyle", s.key)}>
                <div className={`style-sample style-${s.key}`}>
                  <Cover theme={(["winter", "dragon", "kingdom", "ocean", "sleep"] as const)[i % 5]} title="" />
                </div>
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.description}</span>
                </div>
              </button>
            ))}
          </div>
          {audMoods.length > 1 && (
            <>
              <span className="label">Настроение иллюстраций</span>
              <Chips name="mood" items={audMoods.map((m) => ({ key: m.id, label: m.title, hint: m.oneLine }))} value={a.mood || audMoods[0].id} onChange={(v) => set("mood", (v as string) === audMoods[0].id ? "" : (v as string))} />
            </>
          )}
          <span className="label">Посвящение на первой странице</span>
          <div className="chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {dedicationsFor(aud).map((d) => {
              const t = preview(d);
              return (
                <button key={d} type="button" className="chip" style={{ justifyContent: "flex-start", textAlign: "left", height: "auto", padding: "8px 14px" }} aria-pressed={a.dedication === t} onClick={() => set("dedication", t)}>
                  {t}
                </button>
              );
            })}
          </div>
          <label className="field">
            <span>Написать самому</span>
            <textarea className="textarea" maxLength={300} value={a.dedication ?? ""} onChange={(e) => set("dedication", e.target.value)} />
            <small>{(a.dedication ?? "").length} / 300</small>
          </label>
          {captchaKey && <Captcha siteKey={captchaKey} onToken={setCaptcha} />}
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="flow-nav">
        <div className="in">
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => { setError(""); setStep(step - 1); }}>
              Назад
            </button>
          )}
          <button type="button" className="btn btn--primary" data-next onClick={next} disabled={busy}>
            {step < STEPS.length - 1 ? "Дальше" : busy ? "Отправляем…" : "Сочинить книгу"}
          </button>
        </div>
      </div>
    </div>
  );
}
