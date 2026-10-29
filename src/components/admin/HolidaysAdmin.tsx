"use client";
// Редактор «Ближайших праздников» (админка → Праздники): список с порядком и включением, форма праздника
// с правилом даты, сроком заказа и книгами, предпросмотр «заказать до». Данные сохраняют действия-пропсы:
// на сайте — серверные действия (src/app/admin/holiday-actions.ts), в демо-стенде — хранилище браузера.
import { useState } from "react";
import {
  computeHoliday,
  deadlineText,
  daysLeftText,
  fmtDay,
  leadCalendarDays,
  MONTH_NAMES,
  parseHoliday,
  ruleLabel,
  WEEKDAY_NAMES,
  type Holiday,
  type LeadTimes,
} from "@/lib/holidays-core";

export type HolidayResult = { ok: true; items: Holiday[] } | { ok: false; error: string };

interface Draft {
  id: string;
  title: string;
  occasion: string; // ключ из списка или "__new"
  newOccasion: string;
  kind: "fixed" | "date" | "nth" | "always";
  month: string;
  day: string;
  date: string;
  weekday: string;
  n: string;
  deadlineAuto: boolean;
  giftDeadlineDays: string;
  showFromDays: string;
  description: string;
  bookSlugs: string[];
  active: boolean;
  sortOrder: number;
}

const AUD: Record<string, string> = { CHILD: "детям", TEEN: "подросткам", ADULT: "взрослым", PET: "питомцам" };

function toDraft(h: Holiday | null, occasions: { key: string }[], nextOrder: number): Draft {
  const r = h?.rule;
  const known = !h || occasions.some((o) => o.key === h.occasionKey);
  return {
    id: h?.id ?? "",
    title: h?.title ?? "",
    occasion: h ? (known ? h.occasionKey : "__new") : "den-materi",
    newOccasion: h && !known ? h.occasionKey : "",
    kind: r?.kind ?? "fixed",
    month: String(r && (r.kind === "fixed" || r.kind === "nth") ? r.month : 1),
    day: String(r?.kind === "fixed" ? r.day : 1),
    date: r?.kind === "date" ? r.date : "",
    weekday: String(r?.kind === "nth" ? r.weekday : 7),
    n: String(r?.kind === "nth" ? r.n : -1),
    deadlineAuto: h?.giftDeadlineDays == null,
    giftDeadlineDays: h?.giftDeadlineDays != null ? String(h.giftDeadlineDays) : "14",
    showFromDays: String(h?.showFromDays ?? 45),
    description: h?.description ?? "",
    bookSlugs: h?.bookSlugs ?? [],
    active: h?.active ?? true,
    sortOrder: h?.sortOrder ?? nextOrder,
  };
}

function toInput(d: Draft) {
  const rule =
    d.kind === "fixed"
      ? { kind: "fixed", month: Number(d.month), day: Number(d.day) }
      : d.kind === "date"
        ? { kind: "date", date: d.date }
        : d.kind === "nth"
          ? { kind: "nth", month: Number(d.month), weekday: Number(d.weekday), n: Number(d.n) }
          : { kind: "always" };
  return {
    id: d.id,
    title: d.title,
    occasionKey: d.occasion === "__new" ? d.newOccasion : d.occasion,
    rule,
    giftDeadlineDays: d.deadlineAuto ? null : d.giftDeadlineDays === "" ? null : Number(d.giftDeadlineDays),
    showFromDays: Number(d.showFromDays || 0),
    description: d.description,
    bookSlugs: d.bookSlugs,
    active: d.active,
    sortOrder: d.sortOrder,
  };
}

function nextLine(h: Holiday, lead: LeadTimes, now: Date) {
  const c = computeHoliday(h, now, lead);
  if (h.rule.kind === "always") return `Всегда на странице · печать — за ${leadCalendarDays(lead)} дней`;
  if (c.date == null) return "Дата прошла — укажите новую";
  return `${fmtDay(c.date, { year: true })} — ${daysLeftText(c.daysLeft!)} · заказать печать до ${fmtDay(c.deadline!)}${c.visible ? " · на витрине" : ` · появится за ${h.showFromDays} дн.`}`;
}

export function HolidaysAdmin({
  initial,
  books,
  occasions,
  lead,
  canEdit,
  onSave,
  onDelete,
  onMove,
  onToggle,
}: {
  initial: Holiday[];
  books: { slug: string; title: string; audience: string }[];
  occasions: { key: string; label: string }[];
  lead: LeadTimes;
  canEdit: boolean;
  onSave: (h: unknown) => Promise<HolidayResult>;
  onDelete: (id: string) => Promise<HolidayResult>;
  onMove: (id: string, dir: number) => Promise<HolidayResult>;
  onToggle: (id: string) => Promise<HolidayResult>;
}) {
  const [items, setItems] = useState<Holiday[]>(initial);
  const [editing, setEditing] = useState<string | null>(null); // id или "new"
  const [d, setD] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  const run = async (p: Promise<HolidayResult>, done: string) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const r = await p;
      if (r.ok) {
        setItems(r.items);
        setMsg(done);
        return true;
      }
      setError(r.error);
    } catch {
      setError("Не удалось сохранить — попробуйте ещё раз");
    } finally {
      setBusy(false);
    }
    return false;
  };

  const open = (h: Holiday | null) => {
    setEditing(h?.id ?? "new");
    setD(toDraft(h, occasions, (sorted.at(-1)?.sortOrder ?? 0) + 10));
    setError("");
    setMsg("");
  };
  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));
  const val = (e: { target: unknown }) => (e.target as HTMLInputElement).value;
  const checked = (e: { target: unknown }) => (e.target as HTMLInputElement).checked;

  const parsed = d ? parseHoliday(toInput(d)) : null;
  const calc = parsed?.ok ? computeHoliday(parsed.holiday, now, lead) : null;

  return (
    <>
      <div className="hadm-list" aria-label="Праздники">
        {sorted.map((h, i) => (
          <div key={h.id} className={`hadm-row${h.active ? "" : " hadm-row--off"}`} data-holiday={h.id}>
            <div className="hadm-row__main">
              <b>
                {h.title} {h.active ? <span className="badge">вкл</span> : <span className="badge badge--gold">выкл</span>}
              </b>
              <span>
                {ruleLabel(h.rule)} · повод <code>{h.occasionKey}</code>
              </span>
              <br />
              <span>{nextLine(h, lead, now)}</span>
            </div>
            {canEdit && (
              <div className="hadm-row__tools">
                <button type="button" className="btn btn--ghost" aria-label={`Выше: ${h.title}`} disabled={busy || i === 0} onClick={() => run(onMove(h.id, -1), "Порядок сохранён")}>↑</button>
                <button type="button" className="btn btn--ghost" aria-label={`Ниже: ${h.title}`} disabled={busy || i === sorted.length - 1} onClick={() => run(onMove(h.id, 1), "Порядок сохранён")}>↓</button>
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => run(onToggle(h.id), h.active ? `«${h.title}» скрыт с витрины` : `«${h.title}» снова на витрине`)}>
                  {h.active ? "Выключить" : "Включить"}
                </button>
                <button type="button" className="btn btn--ghost" data-edit={h.id} onClick={() => open(h)}>Изменить</button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Удалить праздник «${h.title}»?`)) void run(onDelete(h.id), `«${h.title}» удалён`);
                  }}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="muted">Праздников нет — на витрине будет пусто.</p>}
      </div>
      {msg && !d && <p className="ok" role="status">{msg}</p>}
      {error && !d && <p className="error" role="alert">{error}</p>}

      {canEdit && !d && (
        <button type="button" className="btn btn--primary btn--sm" data-demo="holiday-new" onClick={() => open(null)}>
          Добавить праздник
        </button>
      )}

      {canEdit && d && (
        <form
          className="panel hadm-form"
          aria-label={editing === "new" ? "Новый праздник" : `Праздник: ${d.title}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(onSave(toInput(d)), editing === "new" ? `Праздник «${d.title}» добавлен` : "Сохранено");
            if (ok) {
              setD(null);
              setEditing(null);
            }
          }}
        >
          <h2 style={{ fontSize: "var(--fs-lg)", margin: 0 }}>{editing === "new" ? "Новый праздник" : `Изменить: ${d.title}`}</h2>
          <div className="grid2">
            <label className="field">
              <span>Название на сайте</span>
              <input className="input" name="title" value={d.title} maxLength={80} required onChange={(e) => set({ title: val(e) })} />
            </label>
            <label className="field">
              <span>Повод (книги и анкета)</span>
              <select className="select" name="occasion" value={d.occasion} onChange={(e) => set({ occasion: val(e) })}>
                {occasions.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
                <option value="__new">Новый ключ повода…</option>
              </select>
            </label>
            {d.occasion === "__new" && (
              <label className="field">
                <span>Ключ нового повода (латиница)</span>
                <input className="input" name="newOccasion" value={d.newOccasion} placeholder="maslenica" onChange={(e) => set({ newOccasion: val(e) })} />
                <small>Новый ключ не появится в каталоге и анкете — кнопка поведёт во все книги. Лучше выбрать повод из списка.</small>
              </label>
            )}
          </div>

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label">Дата</legend>
            <div className="chips" role="radiogroup">
              {(
                [
                  ["fixed", "Каждый год: день и месяц"],
                  ["nth", "N-й день недели месяца"],
                  ["date", "Разовая дата"],
                  ["always", "Всегда (дни рождения)"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" className="chip" aria-pressed={d.kind === k} data-kind={k} onClick={() => set({ kind: k })}>
                  {l}
                </button>
              ))}
            </div>
            {d.kind === "fixed" && (
              <div className="hadm-grid3">
                <label className="field">
                  <span>День</span>
                  <input className="input" type="number" name="day" min={1} max={31} value={d.day} onChange={(e) => set({ day: val(e) })} />
                </label>
                <label className="field">
                  <span>Месяц</span>
                  <select className="select" name="month" value={d.month} onChange={(e) => set({ month: val(e) })}>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {d.kind === "nth" && (
              <div className="hadm-grid3">
                <label className="field">
                  <span>Какой</span>
                  <select className="select" name="n" value={d.n} onChange={(e) => set({ n: val(e) })}>
                    {[["1", "1-й"], ["2", "2-й"], ["3", "3-й"], ["4", "4-й"], ["-1", "последний"]].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>День недели</span>
                  <select className="select" name="weekday" value={d.weekday} onChange={(e) => set({ weekday: val(e) })}>
                    {WEEKDAY_NAMES.map((w, i) => (
                      <option key={w} value={String(i + 1)}>{w}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Месяц</span>
                  <select className="select" name="month" value={d.month} onChange={(e) => set({ month: val(e) })}>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {d.kind === "date" && (
              <label className="field" style={{ maxWidth: 260 }}>
                <span>Дата</span>
                <input className="input" type="date" name="date" value={d.date} onChange={(e) => set({ date: val(e) })} />
              </label>
            )}
            {d.kind === "always" && <p className="small muted">Карточка всегда на странице — для поводов без общей даты, как дни рождения.</p>}
          </fieldset>

          <div className="grid2">
            <label className="field">
              <span>Показывать на сайте за, дней</span>
              <input className="input" type="number" name="showFromDays" min={1} max={366} value={d.showFromDays} onChange={(e) => set({ showFromDays: val(e) })} />
            </label>
            <div className="field">
              <span>Заказать печатную книгу до</span>
              <label className="check" style={{ margin: 0 }}>
                <input type="checkbox" name="deadlineAuto" checked={d.deadlineAuto} onChange={(e) => set({ deadlineAuto: checked(e) })} />
                Посчитать: печать {lead.productionDays} раб. дн. + доставка {lead.deliveryDays} дн.
              </label>
              {!d.deadlineAuto && (
                <input className="input" type="number" name="giftDeadlineDays" min={0} max={120} aria-label="За сколько дней до праздника" value={d.giftDeadlineDays} onChange={(e) => set({ giftDeadlineDays: val(e) })} />
              )}
            </div>
          </div>

          <div className="hadm-preview" aria-live="polite" data-preview="">
            {!parsed ? null : !parsed.ok ? (
              <>Проверьте поля: {parsed.error}</>
            ) : parsed.holiday.rule.kind === "always" ? (
              <>{deadlineText(calc!, now, lead)}</>
            ) : calc?.date == null ? (
              <>Эта дата уже прошла — на сайте праздник не появится.</>
            ) : (
              <>
                Ближайшая дата: {fmtDay(calc.date, { year: true, weekday: true })} ({daysLeftText(calc.daysLeft!)}). Заказать печатную книгу до{" "}
                <b>{fmtDay(calc.deadline!, { year: true })}</b>
                {calc.printOk ? "" : " — срок уже прошёл, на сайте: «PDF — в тот же день»"}.{" "}
                {calc.visible ? "Сейчас на витрине." : `На витрине — за ${parsed.holiday.showFromDays} дн. до даты.`}
              </>
            )}
          </div>

          <label className="field">
            <span>Описание на карточке</span>
            <textarea className="textarea" name="description" maxLength={600} rows={2} value={d.description} onChange={(e) => set({ description: val(e) })} />
          </label>

          <div className="field">
            <span>Книги на карточке (до 8, на сайте — первые 4; ничего не выбрано — книги к поводу из каталога)</span>
            <div className="hadm-books">
              {books.map((b) => (
                <label key={b.slug} className="check" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    name="bookSlugs"
                    value={b.slug}
                    checked={d.bookSlugs.includes(b.slug)}
                    disabled={!d.bookSlugs.includes(b.slug) && d.bookSlugs.length >= 8}
                    onChange={(e) => set({ bookSlugs: checked(e) ? [...d.bookSlugs, b.slug] : d.bookSlugs.filter((s) => s !== b.slug) })}
                  />
                  <span>
                    {b.title} <span className="muted">· {AUD[b.audience] ?? b.audience}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="check">
            <input type="checkbox" name="active" checked={d.active} onChange={(e) => set({ active: checked(e) })} /> Показывать на сайте
          </label>

          {error && <p className="error" role="alert">{error}</p>}
          <div className="row">
            <button className="btn btn--primary btn--sm" disabled={busy} data-demo="holiday-save">{busy ? "Сохраняем…" : "Сохранить"}</button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setD(null);
                setEditing(null);
                setError("");
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}
      {!canEdit && <p className="small muted">Просмотр: менять праздники могут владелец и маркетолог.</p>}
    </>
  );
}
