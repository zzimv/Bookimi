"use client";
// Превью книги = настоящая книга, которую листают и правят на месте (rev 13): обложка в трёх оформлениях,
// «Приветствие» с именем и автором, «Фото и посвящение», 12 разворотов с текстом прямо на картинке (слева и справа),
// финал и задняя обложка. Под страницами — кнопки правок: имя, обложка, фото, посвящение, автор.
// Вёрстка общая с PDF — src/lib/book-layout.ts. Превью до оплаты — картинки с одним мягким знаком «букими» на страницу;
// ещё не нарисованные страницы — эскизы демо-рисовальщиком с подписью «эскиз» (rev 14), пустых страниц нет. Работает и в демо-стенде (мини-рантайм: click/input/change/keydown).
import { useEffect, useMemo, useRef, useState } from "react";
import { SpreadText } from "@/components/SpreadText";
import { api } from "@/lib/client";
import {
  AUTHOR_MAX, authorLine, bookSpreads, COVER_VARIANTS, finalText, pageLabel, singlePages, splitSpread, welcomeText,
  type BookLayout, type BookPageRef,
} from "@/lib/book-layout";
import { ConsentGate, type ConsentState } from "@/components/quiz/PhotoSlot";
import type { AudienceKey } from "@/content/profiles";

type Panel = "name" | "cover" | "photo" | "dedication" | "author";
type Tone = "light" | "dark";

export interface BookPreviewProps {
  bookId: string;
  title: string;
  heroName: string;
  heroGender?: string;
  /** Иллюстрация обложки (превью — с водяным знаком); нет — образец по анкете. */
  coverUrl: string | null;
  /** Обложка — эскиз (ещё не нарисована): подпись «эскиз». */
  coverSketch?: boolean;
  /** 12 разворотов: текст и картинка (sketch — эскиз демо-рисовальщиком до генерации, rev 14; нет картинки — подложка). */
  spreads: { index: number; text: string; url: string | null; sketch?: boolean }[];
  dedication: string;
  layout: BookLayout;
  /** Фото книги: из анкеты (main) и для страницы «Фото» (keepsake). */
  photos: { id: string; url: string; role?: string }[];
  /** Чем заменить нерисованную картинку: «после оплаты» или «в превью». */
  pendingNote: string;
  paid: boolean;
  photoEnabled: boolean;
  consent: ConsentState;
  audience?: AudienceKey;
  /** Правка сохранена — перечитать книгу. */
  onChanged: () => Promise<void> | void;
}

/** Обложка в выбранном оформлении — та же вёрстка, что в PDF (coverInner). */
export function BookCoverView({ variant, art, title, small }: { variant: number; art: string | null; title: string; small?: boolean }) {
  const v = variant === 1 || variant === 2 ? variant : 0;
  return (
    <div className={`bk-cover bk-cover--v${v}${small ? " bk-cover--small" : ""}`} data-cover-variant={v}>
      {v === 1 && <span className="bk-cover__stars" aria-hidden="true" />}
      {v === 2 && <span className="bk-cover__frame" aria-hidden="true" />}
      <div className="bk-cover__art">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" loading="eager" decoding="async" />
        ) : (
          <span className="bk-ph" aria-hidden="true" />
        )}
      </div>
      <div className="bk-cover__title">{title}</div>
    </div>
  );
}

/** Тон текста по верхней части каждой половины картинки (там стоит текст): тёмная сцена — светлые буквы. */
function useTones(urls: (string | null)[]): Record<string, [Tone, Tone]> {
  const [tones, setTones] = useState<Record<string, [Tone, Tone]>>({});
  const key = urls.filter(Boolean).join("|");
  useEffect(() => {
    let stop = false;
    for (const url of urls) {
      if (!url || tones[url]) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (stop) return;
        try {
          const c = document.createElement("canvas");
          c.width = 64;
          c.height = 32;
          const x = c.getContext("2d", { willReadFrequently: true })!;
          x.drawImage(img, 0, 0, 64, 32);
          const d = x.getImageData(0, 0, 64, 14).data;
          const side = (x0: number): Tone => {
            let s = 0;
            let n = 0;
            for (let y = 0; y < 14; y++)
              for (let xx = x0; xx < x0 + 32; xx++, n++) {
                const i = (y * 64 + xx) * 4;
                s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
              }
            return s / n < 105 ? "dark" : "light";
          };
          const t: [Tone, Tone] = [side(0), side(32)];
          setTones((cur) => ({ ...cur, [url]: t }));
        } catch {
          // чужой домен без CORS — оставляем светлую дымку и тёмный текст
        }
      };
      img.src = url;
    }
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return tones;
}

export function BookPreview(p: BookPreviewProps) {
  const [view, setView] = useState<"single" | "spread">("spread");
  const [pos, setPos] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [nameDraft, setNameDraft] = useState(p.heroName);
  const [dedDraft, setDedDraft] = useState(p.dedication);
  const [authorDraft, setAuthorDraft] = useState(p.layout.author);
  const [consent, setConsent] = useState<ConsentState>(p.consent);
  const file = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const count = p.spreads.length;

  // Телефон — по одной странице; компьютер — разворотом (переключатель «Одна страница / Разворот»)
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 759px)").matches) setView("single");
  }, []);
  useEffect(() => setNameDraft(p.heroName), [p.heroName]);
  useEffect(() => setDedDraft(p.dedication), [p.dedication]);
  useEffect(() => setAuthorDraft(p.layout.author), [p.layout.author]);

  const spreadsView = useMemo(() => bookSpreads(count), [count]);
  const singles = useMemo(() => singlePages(count), [count]);
  const frames: BookPageRef[][] = view === "spread" ? spreadsView : singles.map((x) => [x]);
  const at = Math.min(pos, frames.length - 1);
  const frame = frames[at];
  const tones = useTones(p.spreads.map((s) => s.url));
  const photo = p.photos.find((x) => x.id === p.layout.photoId) ?? null;
  const coverArt = p.coverUrl;
  const v = COVER_VARIANTS[p.layout.coverVariant] ?? COVER_VARIANTS[0];

  /** Перейти к странице (при смене вида — та же страница). */
  function goTo(kind: BookPageRef["kind"], spread?: number) {
    const i = frames.findIndex((f) => f.some((x) => x.kind === kind && (spread === undefined || x.spread === spread)));
    if (i >= 0) setPos(i);
  }
  function switchView(next: "single" | "spread") {
    if (next === view) return;
    const first = frame.find((x) => x.kind !== "endpaper") ?? frame[0];
    const list: BookPageRef[][] = next === "spread" ? spreadsView : singles.map((x) => [x]);
    const i = list.findIndex((f) => f.some((x) => x.kind === first.kind && x.spread === first.spread && (x.side === first.side || next === "spread")));
    setView(next);
    setPos(Math.max(0, i));
  }
  function open(what: Panel) {
    setError("");
    setSaved("");
    setPanel(panel === what ? null : what);
    if (what === "cover") goTo("cover");
    if (what === "name" || what === "author") goTo("welcome");
    if (what === "photo") goTo("photo");
    if (what === "dedication") goTo("dedication");
  }

  async function save(patch: Record<string, unknown>, done: string) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await api(`/api/books/${p.bookId}/action`, { action: "layout", ...patch });
      await p.onChanged();
      setSaved(done);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("role", "keepsake");
      const r = await api<{ id: string }>(`/api/books/${p.bookId}/photos`, fd);
      await api(`/api/books/${p.bookId}/action`, { action: "layout", photoId: r.id });
      await p.onChanged();
      setSaved("Фото в книге");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  const tools: { key: Panel; label: string; on: BookPageRef["kind"][] }[] = [
    { key: "name", label: "Изменить имя", on: ["welcome", "story", "final"] },
    { key: "cover", label: "Сменить обложку", on: ["cover", "back"] },
    ...(p.photoEnabled ? [{ key: "photo" as const, label: photo ? "Сменить фото" : "Добавить фото", on: ["photo"] as BookPageRef["kind"][] }] : []),
    { key: "dedication", label: p.dedication ? "Изменить посвящение" : "Написать посвящение", on: ["dedication"] },
    { key: "author", label: p.layout.author ? "Изменить автора" : "Вписать автора", on: ["welcome", "endpaper"] },
  ];

  const pageView = (ref: BookPageRef) => {
    const k = `${ref.kind}-${ref.spread ?? ""}-${ref.side ?? ""}`;
    switch (ref.kind) {
      case "cover":
        return (
          <div className="bk-page bk-page--cover" key={k} data-page="cover">
            <BookCoverView variant={p.layout.coverVariant} art={coverArt} title={p.title} />
            {p.coverSketch && <span className="bk-sketch" data-sketch>эскиз</span>}
          </div>
        );
      case "endpaper":
        return <div className="bk-page bk-page--endpaper" key={k} data-page="endpaper" aria-hidden="true" />;
      case "welcome":
        return (
          <div className="bk-page bk-page--paper bk-welcome" key={k} data-page="welcome">
            <p className="bk-welcome__title">{p.title}</p>
            <p className="bk-serif bk-welcome__text">{welcomeText(p.heroName)}</p>
            <div className="bk-welcome__hero">
              {coverArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverArt} alt="" />
              ) : (
                <span className="bk-ph" aria-hidden="true" />
              )}
            </div>
            {p.layout.author ? (
              <p className="bk-serif bk-welcome__author" data-author>{authorLine(p.layout.author)}</p>
            ) : (
              <button type="button" className="bk-add" data-add="author" onClick={() => open("author")}>+ Вписать автора</button>
            )}
            <p className="bk-brand">Создано в <b>букими</b></p>
          </div>
        );
      case "photo":
        return (
          <div className="bk-page bk-page--paper bk-photo" key={k} data-page="photo">
            <span className="bk-blob" aria-hidden="true" />
            <div className={`bk-frame ${photo ? "" : "bk-frame--art"}`}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="Фото в книге" data-photo-in-book />
              ) : coverArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverArt} alt="" />
              ) : (
                <span className="bk-ph" aria-hidden="true" />
              )}
            </div>
            {!photo && p.photoEnabled && (
              <button type="button" className="bk-add bk-add--float" data-add="photo" onClick={() => open("photo")}>+ Добавить фото</button>
            )}
          </div>
        );
      case "dedication":
        return (
          <div className="bk-page bk-page--paper bk-ded" key={k} data-page="dedication">
            <span className="bk-blob bk-blob--ded" aria-hidden="true" />
            {p.dedication ? (
              <p className="bk-serif bk-ded__text" data-dedication>{p.dedication}</p>
            ) : (
              <button type="button" className="bk-add" data-add="dedication" onClick={() => open("dedication")}>+ Написать посвящение</button>
            )}
          </div>
        );
      case "story": {
        const s = p.spreads[(ref.spread ?? 1) - 1];
        const parts = splitSpread(s?.text);
        const i = ref.side === "left" ? 0 : 1;
        const part = parts[i];
        const tone: Tone = (s?.url && tones[s.url]?.[i]) || "light";
        return (
          <div className={`bk-page bk-page--story bk-page--${ref.side}`} key={k} data-page="story" data-spread={ref.spread} data-side={ref.side} data-tone={tone}>
            {s?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={`bk-art bk-art--${ref.side}`} src={s.url} alt={i === 0 ? `Иллюстрация разворота ${ref.spread}` : ""} loading="lazy" decoding="async" data-sketch-art={s.sketch ? "1" : undefined} />
            ) : (
              <div className={`bk-art bk-art--ph bk-art--${ref.side}`}>
                {i === 1 && <span className="bk-art__note">{p.pendingNote}</span>}
              </div>
            )}
            {s?.sketch && i === 1 && <span className="bk-sketch" data-sketch>эскиз</span>}
            {part && (
              <div className={`bk-text bk-text--${tone}${part.length > 200 ? " bk-text--long" : ""}`}>
                <SpreadText text={part} />
              </div>
            )}
          </div>
        );
      }
      case "final":
        return (
          <div className="bk-page bk-page--paper bk-final" key={k} data-page="final">
            <span className="bk-blob bk-blob--final" aria-hidden="true" />
            <p className="bk-serif bk-final__text">{finalText(p.heroName, p.heroGender)}</p>
            <p className="bk-brand"><b>букими</b></p>
          </div>
        );
      case "back":
        return (
          <div className="bk-page bk-back" key={k} data-page="back">
            <p className="bk-serif">{p.heroName}, эта книга — только твоя.</p>
            <p className="bk-back__brand"><b>букими</b></p>
          </div>
        );
    }
  };

  const here = frame.find((x) => x.kind !== "endpaper") ?? frame[0];
  const label = frame.length === 2 && here.kind === "story" ? `Разворот ${here.spread}` : pageLabel(here);

  return (
    <section className="bk" data-book-preview aria-label="Ваша книга: листайте и правьте">
      <div className="bk__bar">
        <span className="bk__where" aria-live="polite" data-where>{label} · {at + 1} из {frames.length}</span>
        <div className="bk__views" role="group" aria-label="Как показывать книгу">
          <button type="button" aria-pressed={view === "single"} data-view="single" onClick={() => switchView("single")}>Одна страница</button>
          <button type="button" aria-pressed={view === "spread"} data-view="spread" onClick={() => switchView("spread")}>Разворот</button>
        </div>
      </div>
      <div
        className="bk__stage"
        ref={stage}
        tabIndex={0}
        aria-label="Страницы книги: стрелки влево и вправо — листать"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setPos(Math.min(frames.length - 1, at + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setPos(Math.max(0, at - 1)); }
        }}
      >
        <button type="button" className="bk__nav bk__nav--prev" aria-label="Предыдущая страница" data-turn="prev" disabled={at === 0} onClick={() => setPos(Math.max(0, at - 1))}>‹</button>
        <div className={`bk__book bk__book--${view} ${frame.length === 1 ? "bk__book--one" : ""}`} data-k={`${view}-${at}`} data-frame={at}>
          {frame.map(pageView)}
        </div>
        <button type="button" className="bk__nav bk__nav--next" aria-label="Следующая страница" data-turn="next" disabled={at >= frames.length - 1} onClick={() => setPos(Math.min(frames.length - 1, at + 1))}>›</button>
      </div>
      <div className="bk__track" aria-hidden="true"><i style={{ width: `${Math.round(((at + 1) / frames.length) * 100)}%` }} /></div>

      <div className="bk__tools" role="toolbar" aria-label="Правки книги">
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn--sm ${t.on.includes(here.kind) ? "btn--primary" : "btn--ghost"}`}
            data-tool={t.key}
            aria-expanded={panel === t.key}
            onClick={() => open(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {panel && (
        <div className="panel bk__panel" data-panel={panel}>
          {panel === "name" &&
            (p.paid ? (
              <p className="small muted">Имя в оплаченной книге меняем через поддержку — напишите нам, всё поправим.</p>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (nameDraft.trim()) save({ name: nameDraft }, "Имя заменено во всей книге"); }}>
                <label className="field">
                  <span>Имя героя</span>
                  <input className="input ym-disable-keys" name="book-hero-name" autoComplete="off" maxLength={30} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                  <small>Подставим во всю книгу — с правильными окончаниями. Ручные правки текста сказки при этом заменятся.</small>
                </label>
                <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !nameDraft.trim()}>{busy ? "Меняем…" : "Заменить имя"}</button>
              </form>
            ))}
          {panel === "cover" && (
            <div>
              <span className="label">Оформление обложки</span>
              <div className="bk-variants" role="radiogroup" aria-label="Оформление обложки">
                {COVER_VARIANTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={p.layout.coverVariant === c.id}
                    className="bk-variant"
                    data-variant={c.id}
                    disabled={busy}
                    onClick={() => p.layout.coverVariant !== c.id && save({ coverVariant: c.id }, `Обложка: «${c.title}»`)}
                  >
                    <BookCoverView variant={c.id} art={coverArt} title={p.title} small />
                    <b>{c.title}</b>
                    <small>{c.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          {panel === "photo" && (
            <div>
              {!consent.pd || !consent.photo ? (
                <ConsentGate audience={p.audience ?? "CHILD"} consent={consent} onDone={setConsent} />
              ) : (
                <>
                  <p className="small muted" style={{ margin: "0 0 10px" }}>Фото встанет в мягкую рамку как есть — без перерисовки. Хранится 7 дней, потом удаляется; в напечатанной книге и PDF оно останется.</p>
                  {p.photos.length > 0 && (
                    <div className="bk-photos" role="radiogroup" aria-label="Фото для книги">
                      {p.photos.map((ph) => (
                        <button key={ph.id} type="button" role="radio" aria-checked={p.layout.photoId === ph.id} className="bk-photos__item" disabled={busy} onClick={() => p.layout.photoId !== ph.id && save({ photoId: ph.id }, "Фото в книге")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.url} alt="Фото из анкеты" width={72} height={72} />
                        </button>
                      ))}
                    </div>
                  )}
                  {p.paid ? (
                    <p className="small muted">Новые фото после оплаты не загружаются — можно выбрать из загруженных.</p>
                  ) : (
                    <label
                      className="drop drop--sm"
                      role="button"
                      tabIndex={0}
                      aria-label="Загрузить фото для книги"
                      onKeyDown={(e) => {
                        if (busy || (e.key !== "Enter" && e.key !== " ")) return;
                        e.preventDefault();
                        file.current?.click();
                      }}
                    >
                      <input ref={file} tabIndex={-1} type="file" name="book-photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => upload(e.target.files)} />
                      <b>{busy ? "Загружаем…" : p.photos.length ? "Загрузить другое фото" : "Выбрать фото"}</b>
                      <small className="muted">JPG, PNG, WebP, HEIC до 15 МБ</small>
                    </label>
                  )}
                  {photo && (
                    <button type="button" className="link-btn" disabled={busy} onClick={() => save({ photoId: null }, "Фото убрано — на странице иллюстрация")}>Убрать фото со страницы</button>
                  )}
                </>
              )}
            </div>
          )}
          {panel === "dedication" && (
            <form onSubmit={(e) => { e.preventDefault(); save({ dedication: dedDraft }, dedDraft.trim() ? "Посвящение в книге" : "Посвящение убрано"); }}>
              <label className="field">
                <span>Посвящение</span>
                <textarea className="textarea" name="book-dedication" maxLength={300} value={dedDraft} onChange={(e) => setDedDraft(e.target.value)} placeholder="Например: Нашему главному чуду — с любовью, мама и папа" />
                <small>{dedDraft.length} / 300</small>
              </label>
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
            </form>
          )}
          {panel === "author" && (
            <form onSubmit={(e) => { e.preventDefault(); save({ author: authorDraft }, authorDraft.trim() ? "Автор вписан" : "Строка автора убрана"); }}>
              <label className="field">
                <span>Автор</span>
                <input className="input" name="book-author" maxLength={AUTHOR_MAX} value={authorDraft} onChange={(e) => setAuthorDraft(e.target.value)} placeholder="Например: мама и папа" />
                <small>На первой странице: «Автор: …». Пусто — строки не будет. До {AUTHOR_MAX} знаков.</small>
              </label>
              <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
            </form>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {saved && !error && <p className="ok small" role="status" data-saved>✓ {saved}</p>}
        </div>
      )}
      <p className="small muted bk__hint">Обложка: «{v.title}». Листайте стрелками или кнопками ‹ ›. Правки сразу видны в книге и попадут в PDF и печать.</p>
    </section>
  );
}
