"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/Cover";
import { api, goal } from "@/lib/client";
import {
  AGE_GROUPS, CLOTHES, DEDICATIONS, EXTRA_ROLES, HAIR, HAIRSTYLE, INTERESTS, OCCASION_CHIPS, type QuizAnswers,
} from "@/lib/quiz";
import { applyGender, fillNames } from "@/lib/declension";
import type { CoverTheme } from "@/lib/catalog-defaults";
import { Captcha } from "@/components/Captcha";

export interface QuizStory { slug: string; title: string; tagline: string; coverTheme: CoverTheme; ageMin: number; ageMax: number }
export interface QuizStyle { key: string; title: string; description: string }

const KEY = "bookimi.quiz.v1";
const STEPS = ["Герой", "Внешность", "Характер и увлечения", "Повод", "Сюжет", "Другие герои", "Стиль и посвящение"];

type Draft = Omit<QuizAnswers, "hero"> & { hero: Partial<QuizAnswers["hero"]> };

const empty = (): Draft => ({
  hero: { name: "", nickname: "", gender: undefined, ageGroup: undefined, birthDate: "" },
  appearance: { hair: "", hairstyle: "", glasses: false, freckles: false, clothes: "", custom: "" },
  interests: [],
  interestCustom: "",
  occasion: { key: "bez", custom: "" },
  story: { slug: "", idea: "" },
  extras: [],
  style: "watercolor-air",
  dedication: "",
});

function Chips<T extends string>({ items, value, onChange, multi = false, max = 99 }: {
  items: { key: T; label: string; hint?: string }[]; value: T | T[]; onChange: (v: T | T[]) => void; multi?: boolean; max?: number;
}) {
  const sel = Array.isArray(value) ? value : [value];
  return (
    <div className="chips">
      {items.map((it) => {
        const on = sel.includes(it.key);
        return (
          <button
            key={it.key}
            type="button"
            className="chip"
            aria-pressed={on}
            title={it.hint}
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

export function QuizWizard({ stories, styles, initial, captchaKey }: { stories: QuizStory[]; styles: QuizStyle[]; initial: Partial<Draft>; captchaKey?: string }) {
  const router = useRouter();
  const [a, setA] = useState<Draft>(() => ({ ...empty(), ...initial }));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; summary: string }[]>([]);
  const [captcha, setCaptcha] = useState<string>();
  const [loaded, setLoaded] = useState(false);

  // Автосохранение: черновик в браузере, «Назад» без потери ответов
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      const name = localStorage.getItem("bookimi.heroName") ?? "";
      setA((cur) => {
        const base = saved?.a ? { ...cur, ...saved.a } : cur;
        if (initial.story?.slug) base.story = { ...base.story, slug: initial.story.slug, idea: "" };
        if (initial.occasion?.key) base.occasion = initial.occasion;
        if (!base.hero.name && name) base.hero = { ...base.hero, name };
        return { ...base };
      });
      if (typeof saved?.step === "number" && !initial.story?.slug) setStep(Math.min(saved.step, STEPS.length - 1));
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

  const preview = useMemo(() => {
    const h = { name: a.hero.name || "Имя", nickname: a.hero.nickname || a.hero.name || "Имя", gender: a.hero.gender };
    return (t: string) => fillNames(applyGender(t, a.hero.gender), h);
  }, [a.hero]);

  function validate(s: number): string {
    if (s === 0) {
      if (!a.hero.name?.trim()) return "Как зовут героя?";
      if (!a.hero.gender) return "Выберите: мальчик или девочка";
      if (!a.hero.ageGroup && !a.hero.birthDate) return "Укажите возраст или дату рождения";
    }
    if (s === 4 && !a.story.slug && !(a.story.idea && a.story.ideaChoice)) return "Выберите сюжет или придумайте свой и выберите вариант";
    return "";
  }

  function next() {
    const e = validate(step);
    if (e) return setError(e);
    setError("");
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
      const r = await api<{ bookId: string }>("/api/books", { answers: a, captcha });
      localStorage.removeItem(KEY);
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

  return (
    <div className="flow">
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
          <h1>Кто главный герой?</h1>
          <div className="grid2">
            <label className="field">
              <span>Имя <span className="req">*</span></span>
              <input className="input ym-disable-keys" value={a.hero.name ?? ""} maxLength={30} onChange={(e) => hero({ name: e.target.value })} placeholder="Например, Марк" />
            </label>
            <label className="field">
              <span>Как ласково зовут дома</span>
              <input className="input ym-disable-keys" value={a.hero.nickname ?? ""} maxLength={30} onChange={(e) => hero({ nickname: e.target.value })} placeholder="Например, Марусик" />
              <small>Так герой будет звучать в тёплых местах сказки</small>
            </label>
          </div>
          <span className="label">Кто это? <span className="req">*</span></span>
          <Chips items={[{ key: "boy", label: "Мальчик" }, { key: "girl", label: "Девочка" }]} value={(a.hero.gender ?? "") as "boy"} onChange={(v) => hero({ gender: (v || undefined) as "boy" })} />
          <span className="label">Возраст <span className="req">*</span></span>
          <Chips items={AGE_GROUPS.map((g) => ({ key: g.key, label: g.label }))} value={(a.hero.ageGroup ?? "") as "2-3"} onChange={(v) => hero({ ageGroup: (v || undefined) as "2-3" })} />
          <label className="field" style={{ maxWidth: 260 }}>
            <span>или дата рождения</span>
            <input className="input" type="date" value={a.hero.birthDate ?? ""} onChange={(e) => hero({ birthDate: e.target.value })} />
            <small>Напомним о дне рождения, если разрешите рассылку</small>
          </label>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Как выглядит {preview("{ГЕРОЙ.им}")}?</h1>
          <p className="muted">Фото попросим позже — когда сказка вам понравится. Сейчас опишите внешность: так иллюстрации будут похожи, даже если фото не будет.</p>
          <span className="label">Цвет волос</span>
          <Chips items={asItems(HAIR)} value={a.appearance.hair ?? ""} onChange={(v) => look({ hair: v as string })} />
          <span className="label">Причёска</span>
          <Chips items={asItems(HAIRSTYLE)} value={a.appearance.hairstyle ?? ""} onChange={(v) => look({ hairstyle: v as string })} />
          <div className="chips">
            <button type="button" className="chip" aria-pressed={!!a.appearance.glasses} onClick={() => look({ glasses: !a.appearance.glasses })}>Очки</button>
            <button type="button" className="chip" aria-pressed={!!a.appearance.freckles} onClick={() => look({ freckles: !a.appearance.freckles })}>Веснушки</button>
          </div>
          <span className="label">Любимая одежда</span>
          <Chips items={asItems(CLOTHES)} value={a.appearance.clothes ?? ""} onChange={(v) => look({ clothes: v as string })} />
          <label className="field">
            <span>Описать самому</span>
            <textarea className="textarea" maxLength={300} value={a.appearance.custom ?? ""} onChange={(e) => look({ custom: e.target.value })} placeholder="Например: большие голубые глаза, ямочки на щеках, всегда в красной кепке" />
          </label>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>Что любит {preview("{ГЕРОЙ.им}")}?</h1>
          <p className="muted">До трёх увлечений — они появятся в сказке.</p>
          <Chips items={INTERESTS.map((i) => ({ key: i.key, label: i.key, hint: i.hint }))} value={a.interests} multi max={3} onChange={(v) => set("interests", v as string[])} />
          <label className="field">
            <span>Своё увлечение</span>
            <input className="input" maxLength={80} value={a.interestCustom ?? ""} onChange={(e) => set("interestCustom", e.target.value)} placeholder="Например, лего или кошка Муся" />
          </label>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1>К какому поводу книга?</h1>
          <Chips items={OCCASION_CHIPS} value={a.occasion.key} onChange={(v) => set("occasion", { ...a.occasion, key: (v as string) || "bez" })} />
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
            {stories.map((s) => (
              <button key={s.slug} type="button" className="choice" aria-pressed={a.story.slug === s.slug} onClick={() => set("story", { slug: s.slug, idea: "" })}>
                <Cover theme={s.coverTheme} title="" />
                <div>
                  <strong>{preview(s.title.replace("[Имя]", "{ГЕРОЙ.им}"))}</strong>
                  <span>{s.tagline}</span>
                  <br />
                  <span className="badge" style={{ marginTop: 6 }}>{s.ageMin}–{s.ageMax} лет</span>
                </div>
              </button>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <strong>Своя идея</strong>
            <p className="small muted">Опишите в 1–2 предложениях — предложим 3 варианта сюжета.</p>
            <textarea className="textarea" maxLength={300} value={a.story.idea ?? ""} onChange={(e) => set("story", { slug: "", idea: e.target.value })} placeholder="Например: Марк строит ракету из коробок и летит на Луну к своему коту" />
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
          <h1>Кто ещё будет в сказке?</h1>
          <p className="muted">Необязательно. До трёх героев: брат или сестра, мама, папа, бабушка, дедушка, питомец. Фото для них тоже можно будет добавить позже.</p>
          {a.extras.map((e, i) => (
            <div className="extra" key={i}>
              <Chips items={EXTRA_ROLES} value={e.role} onChange={(v) => set("extras", a.extras.map((x, j) => (j === i ? { ...x, role: (v as string) || x.role } : x)))} />
              <div className="grid2">
                <label className="field">
                  <span>Имя или кличка</span>
                  <input className="input ym-disable-keys" maxLength={30} value={e.name} onChange={(ev) => set("extras", a.extras.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} />
                </label>
                <label className="field">
                  <span>Как выглядит</span>
                  <input className="input" maxLength={200} value={e.description ?? ""} onChange={(ev) => set("extras", a.extras.map((x, j) => (j === i ? { ...x, description: ev.target.value } : x)))} placeholder="Например: рыжий кот с белыми лапками" />
                </label>
              </div>
              <button type="button" className="link-btn" onClick={() => set("extras", a.extras.filter((_, j) => j !== i))}>Убрать</button>
            </div>
          ))}
          {a.extras.length < 3 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set("extras", [...a.extras, { role: "sibling", name: "", description: "" }])}>
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
            {styles.map((s, i) => (
              <button key={s.key} type="button" className="choice" aria-pressed={a.style === s.key} onClick={() => set("style", s.key)}>
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
          <span className="label">Посвящение на первой странице</span>
          <div className="chips" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {DEDICATIONS.map((d) => {
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
          <button type="button" className="btn btn--primary" onClick={next} disabled={busy}>
            {step < STEPS.length - 1 ? "Дальше" : busy ? "Отправляем…" : "Сочинить сказку"}
          </button>
        </div>
      </div>
    </div>
  );
}
