"use client";
// Шаг «Группа» (детсад — до 30 вместе с героем, класс — до 40): быстрый ввод списком, пол по имени (Саша, Женя — спросим),
// по желанию — пара слов о внешности или фото (только с согласия родителей; по умолчанию советуем описание),
// взрослые группы (воспитатели, учитель — с отчеством). CTA «Сделать книгу для каждого ребёнка группы».
import { useState } from "react";
import { parseNames, rosterIssues, adultGender, guessChildGender } from "@/lib/roster";
import { bulkPct, nextTier, type BulkTier } from "@/lib/bulk";
import type { AudienceKey } from "@/content/profiles";
import { PhotoSlot, type ConsentState, type PhotoView } from "./PhotoSlot";

export interface QuizGroup {
  min: number;
  max: number;
  label: string;
  adultRoles: string[];
  adultsMax: number;
}
export interface DraftMember {
  name: string;
  gender?: "boy" | "girl";
  description: string;
  photo?: boolean;
  photoId?: string;
}
export interface DraftAdult {
  name: string;
  role: string;
  gender?: "boy" | "girl";
}

const ROLE_LABEL: Record<string, string> = { "воспитатель": "Воспитатель", "помощник воспитателя": "Помощник воспитателя", "учитель": "Учитель" };

export function GroupStep(p: {
  group: QuizGroup;
  members: DraftMember[];
  adults: DraftAdult[];
  onChange: (members: DraftMember[], adults: DraftAdult[]) => void;
  heroName: string;
  audience: AudienceKey;
  photoEnabled: boolean;
  consent: ConsentState;
  onConsent: (c: ConsentState) => void;
  views: Record<string, PhotoView>;
  onView: (v: PhotoView) => void;
  bulk: boolean;
  onBulk: (on: boolean) => void;
  tiers: BulkTier[];
  showIssues: boolean;
  h1: React.Ref<HTMLHeadingElement>;
}) {
  const max = Math.max(0, p.group.max - 1);
  const [paste, setPaste] = useState("");
  const [photoRow, setPhotoRow] = useState<number | null>(null);
  const kids = p.members;
  const issues = rosterIssues(kids, { heroName: p.heroName, max });
  const word = p.group.label === "класс" ? "класс" : p.group.label === "команда" ? "команда" : "группа";
  const setM = (i: number, patch: Partial<DraftMember>) => p.onChange(kids.map((m, j) => (j === i ? { ...m, ...patch } : m)), p.adults);
  const setA = (i: number, patch: Partial<DraftAdult>) => p.onChange(kids, p.adults.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const copies = kids.length + 1;
  const pct = bulkPct(copies, p.tiers);
  const nt = nextTier(copies, p.tiers);

  function addPasted() {
    const parsed = parseNames(paste);
    if (!parsed.length) return;
    const room = max - kids.length;
    p.onChange([...kids, ...parsed.slice(0, Math.max(0, room)).map((x) => ({ name: x.name, gender: x.gender, description: "" }))], p.adults);
    setPaste("");
  }

  return (
    <section className="group-step">
      <h1 ref={p.h1} tabIndex={-1}>{word === "класс" ? "Наш класс" : "Наша группа"}</h1>
      <p className="muted">
        До {max} детей кроме героя — каждого назовём в книге, а на «общей фотографии» будут все. Проще всего — вставить список имён.
      </p>
      <div className="panel paste-box">
        <label className="field">
          <span>Вставьте имена — по одному в строке или через запятую</span>
          <textarea className="textarea" name="roster-paste" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Аня\nМаша К.\nПетя, Ваня, Саша"} />
          <small>Пол угадаем по имени — проверьте. Фамилии не нужны: если два одинаковых имени, добавьте букву («Маша К.»).</small>
        </label>
        <button type="button" className="btn btn--ghost btn--sm" data-roster-add disabled={!paste.trim() || kids.length >= max} onClick={addPasted}>
          Добавить в список
        </button>
      </div>

      <p className="roster-count" aria-live="polite">
        В списке: <b>{kids.length}</b> из {max}
        {kids.some((m) => !m.gender) && <span className="warnline"> · у {kids.filter((m) => !m.gender).length} нужно выбрать пол</span>}
      </p>
      <ol className="roster" data-roster>
        {kids.map((m, i) => {
          const bad = p.showIssues && issues.some((x) => x.index === i);
          return (
            <li key={i} className={`roster__row ${bad ? "roster__row--bad" : ""}`} data-member={i}>
              <div className="roster__main">
                <input className="input input--sm ym-disable-keys" aria-label={`Имя ${i + 1}`} name={`member-name-${i}`} maxLength={30} value={m.name} onChange={(e) => setM(i, { name: e.target.value, gender: m.gender ?? guessChildGender(e.target.value) ?? undefined })} />
                <div className="seg" role="group" aria-label="Пол">
                  <button type="button" aria-pressed={m.gender === "boy"} className={!m.gender ? "seg--ask" : ""} onClick={() => setM(i, { gender: "boy" })}>М</button>
                  <button type="button" aria-pressed={m.gender === "girl"} className={!m.gender ? "seg--ask" : ""} onClick={() => setM(i, { gender: "girl" })}>Ж</button>
                </div>
                <button type="button" className="icon-btn" aria-label={`Убрать ${m.name || "строку"}`} onClick={() => p.onChange(kids.filter((_, j) => j !== i), p.adults)}>×</button>
              </div>
              <div className="roster__more">
                <input className="input input--sm" name={`member-desc-${i}`} maxLength={200} value={m.description} onChange={(e) => setM(i, { description: e.target.value })} placeholder="Пара слов для рисунка: рыжие кудряшки, очки" />
                {p.photoEnabled && (
                  <button type="button" className="link-btn small" aria-expanded={photoRow === i} onClick={() => setPhotoRow(photoRow === i ? null : i)}>
                    {m.photoId ? "фото ✓" : "фото"}
                  </button>
                )}
              </div>
              {photoRow === i && p.photoEnabled && (
                <PhotoSlot
                  compact
                  slot="member"
                  kind="human"
                  audience={p.audience}
                  ids={m.photoId ? [m.photoId] : []}
                  max={1}
                  views={p.views}
                  consent={p.consent}
                  onConsent={p.onConsent}
                  onAdd={(v) => { p.onView(v); setM(i, { photoId: v.id, photo: true, description: m.description || (v.hair ? `${v.hair} волосы` : "") }); }}
                  onUpdate={p.onView}
                  onRemove={() => setM(i, { photoId: undefined, photo: false })}
                />
              )}
            </li>
          );
        })}
      </ol>
      {kids.length < max && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => p.onChange([...kids, { name: "", description: "" }], p.adults)}>+ Добавить ребёнка</button>
      )}
      {p.showIssues && issues.length > 0 && (
        <ul className="error roster-issues" role="alert">
          {issues.slice(0, 6).map((x) => <li key={x.index + x.kind}>{x.message}</li>)}
          {issues.length > 6 && <li>…и ещё {issues.length - 6}</li>}
        </ul>
      )}

      {p.group.adultsMax > 0 && (
        <>
          <h2 className="quiz__h2">Взрослые {word === "класс" ? "класса" : "группы"}</h2>
          <p className="small muted">Как к ним обращаются дети: «Мария Ивановна». До {p.group.adultsMax}.</p>
          {p.adults.map((x, i) => (
            <div className="adult-row" key={i} data-adult={i}>
              <input className="input input--sm ym-disable-keys" name={`adult-name-${i}`} maxLength={60} value={x.name} placeholder="Имя и отчество" onChange={(e) => setA(i, { name: e.target.value, gender: adultGender(e.target.value) })} />
              <button type="button" className="icon-btn" aria-label="Убрать взрослого" onClick={() => p.onChange(kids, p.adults.filter((_, j) => j !== i))}>×</button>
              <div className="chips chips--sm">
                {p.group.adultRoles.map((r) => (
                  <button key={r} type="button" className="chip" aria-pressed={x.role === r} onClick={() => setA(i, { role: r })}>{ROLE_LABEL[r] ?? r}</button>
                ))}
              </div>
            </div>
          ))}
          {p.adults.length < p.group.adultsMax && (
            <button type="button" className="btn btn--ghost btn--sm" data-adult-add onClick={() => p.onChange(kids, [...p.adults, { name: "", role: p.group.adultRoles[p.adults.length] ?? p.group.adultRoles[0] }])}>
              + {p.group.adultRoles.includes("учитель") ? "Учитель" : "Воспитатель"}
            </button>
          )}
        </>
      )}

      {kids.length > 0 && p.tiers.length > 0 && (
        <div className={`panel bulk-cta ${p.bulk ? "bulk-cta--on" : ""}`} data-bulk-cta>
          <b>Книга для каждого в {word === "класс" ? "классе" : "группе"}</b>
          <p className="small" style={{ margin: "4px 0 10px" }}>
            Один заказ — {copies} книг: в каждой главный герой — свой ребёнок, остальные рядом. Посвящение одно на всех.{" "}
            {pct > 0 ? <>Скидка за количество — <b>−{pct}%</b>.</> : nt ? <>От {nt.min} книг — скидка −{nt.pct}%.</> : null}
          </p>
          <button type="button" className={`btn btn--sm ${p.bulk ? "btn--ghost" : "btn--primary"}`} aria-pressed={p.bulk} data-bulk-toggle onClick={() => p.onBulk(!p.bulk)}>
            {p.bulk ? "✓ Сделаем книгу каждому — отменить" : "Сделать книгу для каждого ребёнка группы"}
          </button>
        </div>
      )}
    </section>
  );
}
