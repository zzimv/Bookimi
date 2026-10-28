"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, goal } from "@/lib/client";
import { OtpForm } from "@/components/OtpForm";

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
  photos: { id: string; url: string }[];
}

export function BookFlow({ bookId, photoEnabled, extras, dedication, printEnabled }: { bookId: string; photoEnabled: boolean; extras: { role: string; name: string }[]; dedication: string; printEnabled: boolean }) {
  const [b, setB] = useState<BookState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<number, string>>({});
  const [photoStep, setPhotoStep] = useState<"consent" | "upload" | "contact">("consent");
  const [pd, setPd] = useState(false);
  const [photoOk, setPhotoOk] = useState(false);
  const [withPhoto, setWithPhoto] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [exitShown, setExitShown] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function upload(files: FileList | null, role = "main") {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const all: string[] = [];
    for (const f of Array.from(files).slice(0, 3)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("role", role);
      try {
        const r = await api<{ hints: string[] }>(`/api/books/${bookId}/photos`, fd);
        all.push(...r.hints);
        goal("photo_upload");
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setHints(all);
    await load();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!b) return <div className="flow"><div className="spinner" style={{ margin: "60px auto" }} /></div>;

  const generating = (label: string, sub: string) => (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div className="spinner" style={{ margin: "0 auto 18px" }} />
      <h1>{label}</h1>
      <p className="muted" style={{ margin: "0 auto" }}>{sub}</p>
      <div className="progress" style={{ maxWidth: 320, margin: "16px auto" }}><i style={{ width: `${Math.max(5, b.progress)}%` }} /></div>
    </div>
  );

  return (
    <div className="flow">
      {b.status === "TEXT_QUEUED" && generating("Сочиняем сказку", "Обычно это занимает меньше минуты.")}

      {b.status === "FAILED" && (
        <div className="panel">
          <h1>Что-то пошло не так</h1>
          <p className="muted">Мы уже знаем об ошибке. Попробуйте ещё раз — черновик сохранён.</p>
          <button className="btn btn--primary" disabled={busy} onClick={() => act({ action: "retry" })}>Попробовать ещё раз</button>
        </div>
      )}

      {b.status === "TEXT_READY" && b.text && (
        <section>
          <h1>{b.text.title}</h1>
          {dedication && <p className="dedication">{dedication}</p>}
          <p className="muted">Прочитайте сказку. Любой разворот можно поправить вручную — бесплатно.</p>
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
                  <p>{s.text}</p>
                ) : (
                  <textarea className="textarea" value={edit[s.index]} maxLength={600} onChange={(e) => setEdit({ ...edit, [s.index]: e.target.value })} />
                )}
              </article>
            ))}
          </div>
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
          {photoStep === "consent" && (
            <>
              <h1>Добавим фото?</h1>
              <p>По фото иллюстрации получаются узнаваемыми. Без фото нарисуем по описанию из анкеты.</p>
              {photoEnabled ? (
                <div className="panel">
                  <p className="small">Перед загрузкой — два отдельных согласия. Фото используется только для иллюстраций, без идентификации личности, хранится в России и удаляется через 7 дней.</p>
                  <label className="check">
                    <input type="checkbox" checked={pd} onChange={(e) => setPd(e.target.checked)} />
                    <span>Даю <Link href="/soglasie/pd" target="_blank">согласие на обработку персональных данных</Link></span>
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={photoOk} onChange={(e) => setPhotoOk(e.target.checked)} />
                    <span>Даю <Link href="/soglasie/foto" target="_blank">согласие на обработку фото ребёнка</Link> как его законный представитель</span>
                  </label>
                  <button className="btn btn--primary" disabled={!pd || !photoOk || busy} onClick={async () => { if (await act({ action: "consent", pd: true, photo: true })) setPhotoStep("upload"); }}>
                    Перейти к загрузке фото
                  </button>
                </div>
              ) : (
                <p className="muted-panel small">Загрузка фото пока выключена — иллюстрации будут по описанию.</p>
              )}
              <p style={{ marginTop: 16 }}>
                <button className="link-btn" onClick={() => { setWithPhoto(false); setPhotoStep("contact"); }}>Без фото — нарисовать по описанию</button>
              </p>
            </>
          )}

          {photoStep === "upload" && (
            <>
              <h1>Фото героя</h1>
              <p className="muted">1–3 фото: лицо крупно, хороший свет, без солнцезащитных очков и других людей в кадре.</p>
              <div className="photos" style={{ marginBottom: 12 }}>
                {b.photos.map((p) => (
                  <div className="photo" key={p.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="Загруженное фото" />
                    <button aria-label="Удалить фото" onClick={async () => { await api(`/api/books/${bookId}/photos?photo=${p.id}`, undefined, "DELETE"); load(); }}>×</button>
                  </div>
                ))}
              </div>
              {b.photos.length < 3 && (
                <label className="drop">
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => upload(e.target.files)} />
                  <b>{busy ? "Загружаем…" : "Выбрать фото"}</b>
                  <small className="muted">JPG, PNG или WebP до 15 МБ</small>
                </label>
              )}
              {hints.length > 0 && <ul className="small">{hints.map((h) => <li key={h}>{h}</li>)}</ul>}
              {extras.length > 0 && (
                <div className="panel" style={{ marginTop: 16 }}>
                  <b>Фото других героев (необязательно)</b>
                  {extras.map((e) => (
                    <label key={e.role + e.name} className="row" style={{ margin: "8px 0" }}>
                      <span className="small">{e.name}</span>
                      <input type="file" accept="image/*" onChange={(ev) => upload(ev.target.files, e.role)} />
                    </label>
                  ))}
                </div>
              )}
              {error && <p className="error">{error}</p>}
              <div className="flow-nav">
                <div className="in">
                  <button className="btn btn--ghost" onClick={() => setPhotoStep("consent")}>Назад</button>
                  <button className="btn btn--primary" disabled={b.photos.length === 0} onClick={() => { setWithPhoto(true); setPhotoStep("contact"); }}>Дальше</button>
                </div>
              </div>
            </>
          )}

          {photoStep === "contact" && (
            <>
              <h1>Куда прислать превью?</h1>
              <p className="muted">Превью — обложка и два разворота — будет готово за 2–5 минут. Пришлём ссылку, а книга сохранится в личном кабинете.</p>
              {!b.loggedIn ? (
                <div className="panel">
                  <OtpForm submitLabel="Получить код" onDone={() => load()} />
                </div>
              ) : (
                <div className="panel">
                  <label className="check">
                    <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                    <span>Хочу получать новости и скидки (<Link href="/soglasie/rassylka" target="_blank">согласие на рассылку</Link>). Можно отписаться в один клик.</span>
                  </label>
                  <button className="btn btn--primary" disabled={busy} onClick={() => act({ action: "preview", withPhoto, marketing })}>
                    Нарисовать превью
                  </button>
                </div>
              )}
              {error && <p className="error">{error}</p>}
            </>
          )}
        </section>
      )}

      {b.status === "PREVIEW_QUEUED" &&
        (b.error === "limit"
          ? generating("Превью в очереди", "Сейчас много заказов — превью нарисуем чуть позже и пришлём ссылку. Можно закрыть страницу.")
          : generating("Рисуем обложку и первые развороты", "Обычно 2–5 минут. Можно закрыть страницу — пришлём ссылку, когда будет готово."))}

      {(b.status === "PREVIEW_READY" || b.status === "FULL_QUEUED" || b.status === "FULL_READY") && b.text && (
        <section>
          <h1>{b.text.title}</h1>
          <div className="preview-grid">
            {b.pages.map((p) => (
              <figure className="spread-view" key={p.index} style={{ margin: 0 }}>
                {p.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="preview-img" src={p.url} alt={p.index === 0 ? "Обложка" : `Разворот ${p.index}`} loading={p.index > 0 ? "lazy" : "eager"} />
                )}
                {p.index > 0 && <figcaption>{p.text}</figcaption>}
              </figure>
            ))}
          </div>
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
    </div>
  );
}
