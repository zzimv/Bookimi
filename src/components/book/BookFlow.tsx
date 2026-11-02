"use client";
import Link from "next/link";
import { SpreadText } from "@/components/SpreadText";
import { useCallback, useEffect, useState } from "react";
import { api, goal } from "@/lib/client";
import { OtpForm } from "@/components/OtpForm";
import { FlowLegal } from "@/components/FlowLegal";
import { MagicLoader } from "@/components/MagicLoader";
import { BookPreview } from "./BookPreview";
import { DEFAULT_LAYOUT, type BookLayout } from "@/lib/book-layout";

interface BookState {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  text: { title: string; spreads: { index: number; text: string }[] } | null;
  rewritesLeft: number;
  withPhoto: boolean;
  paid: boolean;
  loggedIn: boolean;
  pages: { index: number; text: string | null; url: string | null }[];
  mood: string;
  moodChanges: { preview: number; full: number };
  redrawsLeft: number;
  photos: { id: string; url: string; role?: string }[];
  consent?: { pd: boolean; photo: boolean; group?: boolean };
  /** Вёрстка книги (rev 13). */
  hero?: { name: string; gender?: string } | null;
  dedication?: string;
  layout?: BookLayout;
}

type Audience = "CHILD" | "TEEN" | "ADULT" | "PET";

export interface MoodOption {
  id: string;
  title: string;
  oneLine: string;
  /** Цвет-образец настроения (из демо-тонировки). */
  swatch?: string;
}

export function BookFlow({
  bookId,
  photoEnabled,
  extras,
  dedication,
  printEnabled,
  moods = [],
  moodChangesPreview = 2,
  audience = "CHILD",
  bulkAvailable = false,
  coverSample,
}: {
  bookId: string;
  photoEnabled: boolean;
  extras: { role: string; name: string }[];
  dedication: string;
  printEnabled: boolean;
  moods?: MoodOption[];
  moodChangesPreview?: number;
  audience?: Audience;
  /** Книга о группе: можно заказать «для каждого ребёнка» (src/lib/bulk.ts). */
  bulkAvailable?: boolean;
  /** Образец обложки по анкете (/obrazec) — пока иллюстрации не нарисованы. */
  coverSample?: string;
}) {
  const [b, setB] = useState<BookState | null>(null);
  const [error, setError] = useState("");
  // Дневной лимит превью исчерпан — можно оформить книгу сразу, без превью (сервер это разрешает)
  const [buyNow, setBuyNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [pdNow, setPdNow] = useState(false);
  const [exitShown, setExitShown] = useState(false);
  const [bulk, setBulk] = useState<BulkView | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await api<BookState>(`/api/books/${bookId}`);
      setB((prev) => {
        if (prev?.status !== "PREVIEW_READY" && s.status === "PREVIEW_READY") goal("preview_ready");
        if (prev?.status !== "TEXT_READY" && s.status === "TEXT_READY") goal("text_ready");
        return s;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);
  // Пока идёт генерация — опрашиваем статус
  useEffect(() => {
    if (!b || !["TEXT_QUEUED", "PREVIEW_QUEUED", "FULL_QUEUED", "DRAFT"].includes(b.status)) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [b, load]);

  // Exit-intent на превью: мягкое напоминание, что превью сохранено
  useEffect(() => {
    if (b?.status !== "PREVIEW_READY" || exitShown) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) setExitShown(true);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [b?.status, exitShown]);

  async function act(body: object) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/books/${bookId}/action`, body);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      if ((e as { status?: number }).status === 429 && (body as { action?: string }).action === "preview") setBuyNow(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits() {
    const spreads = Object.entries(edit).map(([index, text]) => ({ index: Number(index), text }));
    if (!spreads.length) return;
    setBusy(true);
    try {
      await api(`/api/books/${bookId}`, { spreads }, "PATCH");
      setEdit({});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // «Для каждого в группе»: состояние копий (первые — с превью), опрос, пока они сочиняются и рисуются
  const showBulk = bulkAvailable && Boolean(b && ["PREVIEW_READY", "FULL_QUEUED", "FULL_READY"].includes(b.status));
  useEffect(() => {
    if (!showBulk) return;
    let stop = false;
    const tick = () => api<BulkView>(`/api/books/${bookId}/bulk`).then((r) => !stop && setBulk(r)).catch(() => {});
    tick();
    const t = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [showBulk, bookId]);

  if (!b) return <div className="flow"><div className="spinner" style={{ margin: "60px auto" }} /><FlowLegal /></div>;

  const moodLeft = Math.max(0, moodChangesPreview - b.moodChanges.preview);
  void extras;

  const generating = (label: string, sub: string, lines?: string[]) => (
    <div style={{ textAlign: "center", padding: "28px 0" }}>
      <h1 className="sr-only">{label}</h1>
      <MagicLoader title={label} lines={lines} progress={b.progress} />
      <p className="muted" style={{ margin: "0 auto" }}>{sub}</p>
    </div>
  );

  // Книга, которую листают и правят на месте (rev 13): до превью — образец обложки и подложки разворотов
  const book = (pendingNote: string) =>
    b.text ? (
      <BookPreview
        bookId={b.id}
        title={b.text.title}
        heroName={b.hero?.name ?? ""}
        heroGender={b.hero?.gender}
        coverUrl={b.pages.find((p) => p.index === 0)?.url ?? coverSample ?? null}
        spreads={b.text.spreads.map((s) => ({ index: s.index, text: b.pages.find((p) => p.index === s.index)?.text ?? s.text, url: b.pages.find((p) => p.index === s.index)?.url ?? null }))}
        dedication={b.dedication ?? dedication}
        layout={b.layout ?? DEFAULT_LAYOUT}
        photos={b.photos}
        pendingNote={pendingNote}
        paid={b.paid}
        photoEnabled={photoEnabled}
        consent={{ pd: Boolean(b.consent?.pd), photo: Boolean(b.consent?.photo), group: Boolean(b.consent?.group) }}
        audience={audience}
        onChanged={load}
      />
    ) : null;

  return (
    <div className="flow">
      {b.status === "TEXT_QUEUED" && generating("Книга готовится…", "Обычно это занимает меньше минуты.")}

      {b.status === "FAILED" && b.paid && (
        <div className="panel" role="status">
          <h1>Мы уже исправляем</h1>
          <p className="muted">При подготовке книги случилась заминка — мы уже знаем о ней и всё исправим. Книга будет готова, вам придёт письмо. Делать ничего не нужно.</p>
        </div>
      )}

      {b.status === "FAILED" && !b.paid && (
        <div className="panel">
          <h1>Что-то пошло не так</h1>
          <p className="muted">Мы уже знаем об ошибке. Попробуйте ещё раз — черновик сохранён.</p>
          <button className="btn btn--primary" disabled={busy} onClick={() => act({ action: "retry" })}>Попробовать ещё раз</button>
        </div>
      )}

      {b.status === "TEXT_READY" && b.text && (
        <section>
          <h1>{b.text.title}</h1>
          <p className="muted">Это ваша книга — листайте её. Имя, обложку, фото, посвящение и автора можно поменять прямо здесь, текст — поправить вручную. Иллюстрации нарисуем на следующем шаге.</p>
          {book("Иллюстрацию нарисуем в превью")}
          <details className="more story-edit" open={Object.keys(edit).length > 0}>
            <summary>Поправить текст вручную — бесплатно</summary>
          <div className="story-text">
            {b.text.spreads.map((s) => (
              <article className="spread" key={s.index}>
                <header>
                  <span>Разворот {s.index}</span>
                  {edit[s.index] === undefined ? (
                    <button className="link-btn" onClick={() => setEdit({ ...edit, [s.index]: s.text })}>Поправить</button>
                  ) : (
                    <button className="link-btn" onClick={() => { const n = { ...edit }; delete n[s.index]; setEdit(n); }}>Отменить</button>
                  )}
                </header>
                {edit[s.index] === undefined ? (
                  <p><SpreadText text={s.text} /></p>
                ) : (
                  <textarea className="textarea" value={edit[s.index]} maxLength={600} onChange={(e) => setEdit({ ...edit, [s.index]: e.target.value })} />
                )}
              </article>
            ))}
          </div>
          </details>
          {Object.keys(edit).length > 0 && <button className="btn btn--ghost" disabled={busy} onClick={saveEdits}>Сохранить правки</button>}
          {error && <p className="error">{error}</p>}
          <div className="flow-nav">
            <div className="in">
              <button className="btn btn--ghost" disabled={busy || b.rewritesLeft <= 0} onClick={() => act({ action: "rewrite" })} title="Сочинить заново">
                Переписать ({b.rewritesLeft})
              </button>
              <button className="btn btn--primary" disabled={busy || Object.keys(edit).length > 0} onClick={() => act({ action: "approve" })}>
                Всё нравится, дальше
              </button>
            </div>
          </div>
        </section>
      )}

      {b.status === "TEXT_APPROVED" && (
        <section>
          {
            <>
              <h1>{b.loggedIn ? "Рисуем превью?" : "Куда прислать превью?"}</h1>
              <p className="muted">
                Обложка и два разворота будут готовы за <span style={{ whiteSpace: "nowrap" }}>2–5 минут</span>. {b.loggedIn ? "Пришлём ссылку на почту" : "Войдите по коду — пришлём ссылку, а книга сохранится в личном кабинете"}.
              </p>
              {!b.loggedIn ? (
                <div className="panel">
                  <OtpForm submitLabel="Получить код на почту" consentGiven={Boolean(b.consent?.pd)} onDone={() => load()} />
                </div>
              ) : (
                <div className="panel">
                  {!b.consent?.pd && (
                    <label className="check">
                      <input type="checkbox" name="consent-pd" checked={pdNow} onChange={(e) => setPdNow(e.target.checked)} />
                      <span>Даю <Link href="/soglasie/pd" target="_blank">согласие на обработку персональных данных</Link></span>
                    </label>
                  )}
                  <button className="btn btn--primary btn--block" disabled={busy || (!b.consent?.pd && !pdNow)} onClick={() => act({ action: "preview", withPhoto: b.withPhoto, ...(pdNow ? { pd: true } : {}) })}>
                    {b.withPhoto ? "Нарисовать превью по фото" : "Нарисовать превью по описанию"}
                  </button>
                </div>
              )}
              <p className="small muted" style={{ marginTop: 12 }}>
                {b.withPhoto ? "Нарисуем по фото, которое вы загрузили и мы уже обработали." : "Нарисуем по описанию из анкеты."}
              </p>
              {error && <p className="error" role="alert">{error}</p>}
              {buyNow && (
                <p style={{ marginTop: 8 }}>
                  <Link className="btn btn--gold" href={`/kniga/${bookId}/kupit`} onClick={() => goal("choose_print", { withoutPreview: 1 })}>Оформить без превью</Link>
                </p>
              )}
            </>
          }
        </section>
      )}

      {b.status === "PREVIEW_QUEUED" &&
        (b.error === "limit"
          ? generating("Превью в очереди", "Сейчас много заказов — превью нарисуем чуть позже и пришлём ссылку. Можно закрыть страницу.")
          : generating("Рисуем обложку и первые развороты", "Обычно 2–5 минут. Можно закрыть страницу — пришлём ссылку, когда будет готово.", ["Смешиваем краски", "Рисуем героя", "Зажигаем звёзды", "Сушим страницы"]))}

      {(b.status === "PREVIEW_READY" || b.status === "FULL_QUEUED" || b.status === "FULL_READY") && b.text && (
        <section>
          <h1>{b.text.title}</h1>
          {book(b.paid ? (b.status === "FULL_READY" ? "Иллюстрация готовится" : "Рисуем иллюстрацию…") : "Иллюстрацию нарисуем после оплаты")}
          {moods.length > 1 && (b.status === "PREVIEW_READY" || b.status === "FULL_READY") && (
            <section className="panel mood-panel" style={{ marginTop: 20 }} data-mood-panel aria-labelledby="mood-h">
              <h2 id="mood-h" className="mood-panel__h">Настроение иллюстраций</h2>
              <p className="small muted" style={{ margin: "0 0 10px" }}>
                {b.paid
                  ? b.moodChanges.full === 0
                    ? "Перерисуем всю книгу в новом настроении — один раз бесплатно."
                    : `Каждая следующая смена — одна перерисовка из бесплатных (осталось ${b.redrawsLeft}).`
                  : moodLeft > 0
                    ? `Перерисуем обложку и развороты превью — бесплатно, осталось ${moodLeft} ${moodLeft === 1 ? "смена" : "смены"}.`
                    : "Бесплатные смены до оплаты закончились — после покупки можно сменить ещё раз для всей книги."}
              </p>
              <div className="moods" role="radiogroup" aria-label="Настроение иллюстраций">
                {moods.map((m) => {
                  const on = (b.mood || "as-drawn") === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className="mood"
                      name="mood"
                      data-mood={m.id}
                      disabled={busy || (!on && !b.paid && moodLeft <= 0)}
                      onClick={() => !on && act({ action: "mood", mood: m.id })}
                    >
                      <i style={{ background: m.swatch ?? "var(--sage)" }} aria-hidden="true" />
                      <b>{m.title}</b>
                      <span>{m.oneLine}</span>
                    </button>
                  );
                })}
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </section>
          )}
          {b.status === "PREVIEW_READY" && (
            <>
              <h2 style={{ marginTop: 28, fontSize: "var(--fs-xl)" }}>Кто печатает книгу?</h2>
              <div className="choice-cards">
                <Link className="big-choice" href={`/kniga/${b.id}/kupit?who=self`} onClick={() => goal("choose_print", { who: "self" })}>
                  <strong>Напечатаю сам</strong>
                  PDF за 990 ₽: для экрана, для домашней печати на А4 и для копицентра. Сразу после оплаты.
                </Link>
                {printEnabled && (
                  <Link className="big-choice" href={`/kniga/${b.id}/kupit?who=bookimi`} onClick={() => goal("choose_print", { who: "bookimi" })}>
                    <strong>Напечатает БУКИМИ</strong>
                    Книга 24 страницы в мягкой или твёрдой обложке, от 2 490 ₽. PDF — в подарок. Доставка по России.
                  </Link>
                )}
              </div>
            </>
          )}
          {showBulk && bulk?.available && <BulkPanel bookId={b.id} bulk={bulk} onChange={setBulk} />}
          {b.status !== "PREVIEW_READY" && (
            <p style={{ marginTop: 20 }}>
              <Link className="btn btn--primary" href={`/kabinet/kniga/${b.id}`}>Открыть в личном кабинете</Link>
            </p>
          )}
        </section>
      )}

      {exitShown && (
        <div className="cookie" role="dialog" aria-label="Превью сохранено">
          <b>Превью сохранено</b>
          <p className="small" style={{ margin: "6px 0 0" }}>Книга ждёт вас в личном кабинете — вернуться можно в любой момент. Превью хранится 7 дней.</p>
          <div className="cookie__row">
            <button className="btn btn--primary" onClick={() => setExitShown(false)}>Хорошо</button>
          </div>
        </div>
      )}
      <FlowLegal />
    </div>
  );
}

export interface BulkView {
  available: boolean;
  created: boolean;
  count: number;
  dedication: string;
  tiers: { min: number; pct: number }[];
  previewCopies: number;
  copies: { id: string; name: string; status: string; statusText: string; title: string | null; dedication: string | null; cover: string | null }[];
}

/** «Книга для каждого в группе» на странице превью: первые копии с обложкой, остальные — после оплаты. */
function BulkPanel({ bookId, bulk, onChange }: { bookId: string; bulk: BulkView; onChange: (b: BulkView) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const best = [...bulk.tiers].sort((x, y) => x.min - y.min).reduce((p, t) => (bulk.count >= t.min ? t.pct : p), 0);
  return (
    <section className="panel bulk-panel" data-bulk-panel style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", margin: 0 }}>Книга для каждого ребёнка группы</h2>
      <p className="small" style={{ margin: "6px 0 10px" }}>
        {bulk.count} книг одним заказом: в каждой главный герой — свой ребёнок, остальные рядом.{best > 0 ? ` Скидка за количество −${best}%.` : ""} Превью — у первых {Math.min(bulk.previewCopies, bulk.count)}, остальные нарисуем после оплаты.
      </p>
      {bulk.created ? (
        <>
          <ol className="bulk-copies">
            {bulk.copies.slice(0, 6).map((c, i) => (
              <li key={c.id} data-copy={i}>
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt={`Обложка: ${c.name}`} width={64} height={64} />
                ) : (
                  <span className="bulk-copies__ph" aria-hidden="true">{c.name.slice(0, 1)}</span>
                )}
                <span><b>{c.name}</b><small className="muted">{c.statusText}</small></span>
              </li>
            ))}
          </ol>
          {bulk.copies.length > 6 && <p className="small muted">…и ещё {bulk.copies.length - 6}</p>}
          <Link className="btn btn--primary" href={`/kniga/${bookId}/kupit?dlya-vseh=1`}>Оформить {bulk.count} книг</Link>
        </>
      ) : (
        <button
          className="btn btn--primary"
          data-bulk-start
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              onChange(await api<BulkView>(`/api/books/${bookId}/bulk`, {}));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Готовим…" : "Сделать книгу для каждого ребёнка группы"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
