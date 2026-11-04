"use client";
// Превью книги = настоящая книга, которую листают и правят на месте (rev 13): обложка в трёх оформлениях,
// «Приветствие» с именем и автором, «Фото и посвящение», сказка по плану страниц группы (rev 20, src/lib/page-plan.ts:
// картонная книжка 0–3, 30 страниц со страницами «Нарисуй…» 4–6, 40 страниц с заметками 7–9) с текстом прямо на картинке,
// финал и задняя обложка. Цвета — палитра книги под название (src/content/palettes.ts), размер букв — по группе.
// rev 20: внизу — липкая полоса «Оформить книгу», в конце книги — праздничная карточка, переход к оплате — весёлый. Под страницами — кнопки правок: имя, обложка, фото, посвящение, автор.
// Вёрстка общая с PDF — src/lib/book-layout.ts. Превью до оплаты — картинки с одним мягким знаком «букими» на страницу;
// ещё не нарисованные страницы — эскизы демо-рисовальщиком с подписью «эскиз» (rev 14), пустых страниц нет. Работает и в демо-стенде (мини-рантайм: click/input/change/keydown).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { pagePlan, pairPages, planPages, slotText, textFit, type PagePlan } from "@/lib/page-plan";
import type { BookPalette } from "@/content/palettes";
import { usePayTransition } from "./PayTransition";
import { SpreadText } from "@/components/SpreadText";
import { api } from "@/lib/client";
import {
  AUTHOR_MAX, authorLine, backLines, COVER_VARIANTS, fairyPalette, finalLines, pageLabel, singlePages, splitSpread, welcomeLines,
  type BookLayout, type BookPageRef, type FairyLine,
} from "@/lib/book-layout";
import { ConsentGate, type ConsentState } from "@/components/quiz/PhotoSlot";
import { sessionCode, wmCode } from "@/lib/protect";
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
  /** Развороты сюжета (rev 20: столько, сколько в тексте; раскладка — по плану): текст и картинка (sketch — эскиз демо-рисовальщиком до генерации, rev 14; нет картинки — подложка). */
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
  /** Цена «Другой обложки» (rev 19; «Классика» бесплатно). 0 или нет — без цены. */
  coverPriceRub?: number;
  /** rev 20: план страниц книги (PlanId, src/lib/page-plan.ts); нет — classic. */
  plan?: string;
  /** rev 20: палитра книги под название (src/content/palettes.ts). */
  palette?: BookPalette;
  /** rev 20: куда ведёт «Оформить книгу» (липкая полоса и карточка в конце); нет — без кнопки. */
  checkoutHref?: string | null;
}

/** rev 19: после оплаты правок нет — только эта строка со ссылкой на поддержку (и в кабинете). */
export function PaidNote() {
  return (
    <p className="bk-paid-note small" role="note" data-paid-note>
      Книга оплачена и передана в работу. Если нужно что-то исправить — <a href="/kabinet/podderzhka">напишите в поддержку</a>.
    </p>
  );
}

/** Обложка в выбранном оформлении — та же вёрстка, что в PDF (coverInner). Цвет названия — палитра книги (rev 20). */
export function BookCoverView({ variant, art, title, small, palette }: { variant: number; art: string | null; title: string; small?: boolean; palette?: BookPalette }) {
  const v = variant === 1 || variant === 2 ? variant : 0;
  const style = palette ? ({ "--bk-title": palette.cover, "--bk-title-night": palette.coverNight, "--bk-orn": palette.orn } as CSSProperties) : undefined;
  return (
    <div className={`bk-cover bk-cover--v${v}${small ? " bk-cover--small" : ""}`} data-cover-variant={v} data-palette={palette?.name} style={style}>
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

/** Звёздочка-разделитель «сказочных» страниц (rev 19): тонкие линии и четырёхлучевая звезда; декор — скрыт от диктора. */
export function FairyDivider({ className }: { className?: string }) {
  return (
    <span className={`fk-div${className ? ` ${className}` : ""}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z" fill="currentColor" /></svg>
    </span>
  );
}

/** Строки «сказочной» страницы: имя крупно, ключевые слова акцентом (src/lib/book-layout.ts — общие с PDF). */
export function FairyText({ lines, className }: { lines: FairyLine[]; className?: string }) {
  const name = lines[0]?.[0]?.k === "name" ? lines[0][0].t : "";
  return (
    <p className={`fk${className ? ` ${className}` : ""}`} style={{ "--fk-n": String(Math.max(6, name.length)) } as CSSProperties}>
      {lines.map((l, i) =>
        l[0]?.k === "div" ? (
          <FairyDivider key={i} />
        ) : (
          <span key={i} className={`fk-line fk-line--${l[0]?.k ?? "text"}`}>
            {l.map((x, j) => (x.k === "key" ? <em key={j} className="fk-key">{x.t}</em> : x.k === "name" ? <span key={j} className="fk-name">{x.t}</span> : x.t))}
            {i < lines.length - 1 ? " " : ""}
          </span>
        ),
      )}
    </p>
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
  // rev 19: фото добавлено — сразу показываем страницу с фото и коротко подсвечиваем его
  const [flash, setFlash] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const count = p.spreads.length;

  // Водяной знак превью до оплаты: бледный код «книга · сеанс · дата» на каждой странице (src/lib/protect.ts).
  // Только в CSS (::after с пустым альтернативным текстом) — экранный диктор его не читает.
  const [wm, setWm] = useState("");
  useEffect(() => setWm(p.paid ? "" : wmCode(p.bookId, sessionCode())), [p.paid, p.bookId]);

  // Телефон — по одной странице; компьютер — разворотом (переключатель «Одна страница / Разворот»)
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 759px)").matches) setView("single");
  }, []);
  useEffect(() => setNameDraft(p.heroName), [p.heroName]);
  useEffect(() => setDedDraft(p.dedication), [p.dedication]);
  useEffect(() => setAuthorDraft(p.layout.author), [p.layout.author]);

  // rev 20: страницы — по плану группы; лишние развороты сливаются по два (самые короткие), недостающие — «Нарисуй…»
  const plan: PagePlan = pagePlan(p.plan);
  const lensKey = p.spreads.map((s) => s.text.length).join(",");
  const pages = useMemo(() => planPages(plan, count, (i) => (p.spreads[i - 1]?.text ?? "").length), [plan.id, count, lensKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const spreadsView = useMemo(() => pairPages(pages), [pages]);
  const singles = useMemo(() => singlePages(pages), [pages]);
  const frames: BookPageRef[][] = view === "spread" ? spreadsView : singles.map((x) => [x]);
  const at = Math.min(pos, frames.length - 1);
  const frame = frames[at];
  const tones = useTones(p.spreads.map((s) => s.url));
  const photo = p.photos.find((x) => x.id === p.layout.photoId) ?? null;
  const coverArt = p.coverUrl;
  const v = COVER_VARIANTS[p.layout.coverVariant] ?? COVER_VARIANTS[0];
  const fp = fairyPalette(p.layout.coverVariant);
  const pal = p.palette ?? { ink: fp.ink, accent: fp.accent, orn: fp.orn, paper: "#fdfaf2", back: fp.ink, cover: "#143628", coverNight: "#f3d27a", name: "classic", title: "" };
  const coverPrice = Math.max(0, p.coverPriceRub ?? 0);
  const palette = {
    "--fk-ink": pal.ink,
    "--fk-accent": pal.accent,
    "--fk-orn": pal.orn,
    "--bk-paper": pal.paper,
    "--bk-back": pal.back,
    "--bk-title": pal.cover,
    "--bk-title-night": pal.coverNight,
  } as CSSProperties;
  // rev 20: дошли до конца — праздничная карточка и «Оформить книгу» крупно
  const [reachedEnd, setReachedEnd] = useState(false);
  const atEnd = at >= frames.length - 1;
  useEffect(() => {
    if (atEnd) setReachedEnd(true);
  }, [atEnd]);
  const router = useRouter();
  const pay = usePayTransition();
  function toCheckout() {
    const href = p.checkoutHref;
    if (!href) return;
    pay.run(["Упаковываем волшебство…", "Закрываем книгу и перевязываем лентой…", "Ещё чуть-чуть — и книга полетит в типографию"], async () => null, () => router.push(href)).catch(() => {});
  }

  function showPhoto() {
    goTo(plan.front.includes("photo") ? "photo" : "welcome");
    // Книга — в поле зрения (панель правок под ней могла увести страницу вниз)
    stage.current?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  }

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
    if (what === "photo") goTo(plan.front.includes("photo") ? "photo" : "welcome");
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
      showPhoto();
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
    ...(p.photoEnabled ? [{ key: "photo" as const, label: photo ? "Сменить фото" : "Добавить фото", on: (plan.front.includes("photo") ? ["photo"] : ["welcome"]) as BookPageRef["kind"][] }] : []),
    // rev 20: в картонной книжке на 9 страниц посвящения нет — кнопки тоже
    ...(plan.front.includes("dedication") ? [{ key: "dedication" as const, label: p.dedication ? "Изменить посвящение" : "Написать посвящение", on: ["dedication"] as BookPageRef["kind"][] }] : []),
    { key: "author", label: p.layout.author ? "Изменить автора" : "Вписать автора", on: ["welcome", "endpaper"] },
  ];
  /** rev 20: картонная книжка 0–3 — выбор 9 или 12 страниц прямо в превью (книга сразу перелистывается по-новому). */
  const boardPick = plan.board && !p.paid ? (
    <div className="bk-board-pick" role="radiogroup" aria-label="Картонная книжка: сколько страниц" data-board-pick>
      {([9, 12] as const).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={plan.board?.pages === n} data-board={n} disabled={busy} onClick={() => plan.board?.pages !== n && save({ board: n }, n === 9 ? "Книжка на 9 страниц, двойной картон" : "Книжка на 12 страниц, плотный картон").then(() => setPos(0))}>
          <b>{n} страниц</b>
          <small>{n === 9 ? "двойной картон · приветствие и 8 страниц сказки" : "плотный картон · с фото, посвящением и финалом"}</small>
        </button>
      ))}
    </div>
  ) : null;

  const pageView = (ref: BookPageRef) => {
    const k = `${ref.kind}-${ref.spread ?? ""}-${ref.side ?? ""}-${ref.n ?? ""}`;
    switch (ref.kind) {
      case "cover":
        return (
          <div className="bk-page bk-page--cover" key={k} data-wm={wm || undefined} data-page="cover">
            <BookCoverView variant={p.layout.coverVariant} art={coverArt} title={p.title} palette={p.palette} />
            {p.coverSketch && <span className="bk-sketch" data-sketch>эскиз</span>}
          </div>
        );
      case "endpaper":
        return <div className="bk-page bk-page--endpaper" key={k} data-wm={wm || undefined} data-page="endpaper" aria-hidden="true" />;
      case "welcome":
        return (
          <div className="bk-page bk-page--paper bk-welcome" key={k} data-wm={wm || undefined} data-page="welcome">
            <span className="bk-orn" aria-hidden="true"><i /><i /></span>
            <p className="bk-welcome__title">{p.title}</p>
            <FairyText lines={welcomeLines(p.heroName)} className="bk-welcome__text" />
            <FairyDivider className="fk-div--sm" />
            {/* rev 20: фото ребёнка (добавлено в начале анкеты или здесь) — в рамке на первой странице */}
            <div className={`bk-welcome__hero${photo ? " bk-welcome__hero--photo" : ""}${flash && !plan.front.includes("photo") ? " bk-photo--flash" : ""}`} data-welcome-photo={photo ? "1" : undefined}>
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
            {p.layout.author ? (
              <p className="bk-serif bk-welcome__author" data-author>{authorLine(p.layout.author)}</p>
            ) : p.paid ? null : (
              <button type="button" className="bk-add" data-add="author" onClick={() => open("author")}>+ Вписать автора</button>
            )}
            <p className="bk-brand">Создано в <b>букими</b></p>
          </div>
        );
      case "photo":
        return (
          <div className={`bk-page bk-page--paper bk-photo${flash ? " bk-photo--flash" : ""}`} key={k} data-wm={wm || undefined} data-page="photo">
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
            {!photo && p.photoEnabled && !p.paid && (
              <button type="button" className="bk-add bk-add--float" data-add="photo" onClick={() => open("photo")}>+ Добавить фото</button>
            )}
          </div>
        );
      case "dedication":
        return (
          <div className="bk-page bk-page--paper bk-ded" key={k} data-wm={wm || undefined} data-page="dedication">
            <span className="bk-blob bk-blob--ded" aria-hidden="true" />
            {p.dedication || p.paid ? (
              <div className="bk-ded__body">
                <FairyDivider />
                {p.dedication && <p className="bk-serif bk-ded__text" data-dedication>{p.dedication}</p>}
                <FairyDivider />
              </div>
            ) : (
              <button type="button" className="bk-add" data-add="dedication" onClick={() => open("dedication")}>+ Написать посвящение</button>
            )}
          </div>
        );
      case "story": {
        // rev 20: единица плана — один или несколько разворотов сюжета (слитые до переписывания текста)
        const src = ref.src ?? [ref.spread ?? 1];
        const s = p.spreads[(src[0] ?? 1) - 1];
        const text = slotText(src, (n) => p.spreads[n - 1]?.text);
        if (ref.side === "page") {
          // Картонная книжка 0–3: картинка целиком, очень крупный короткий текст на светлой плашке внизу
          return (
            <div className="bk-page bk-page--story bk-page--board" key={k} data-wm={wm || undefined} data-page="story" data-spread={ref.spread} data-side="page" data-src={src.join(",")}>
              {s?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="bk-art bk-art--board" src={s.url} alt={`Иллюстрация страницы ${ref.spread}`} loading="lazy" decoding="async" data-sketch-art={s.sketch ? "1" : undefined} />
              ) : (
                <div className="bk-art bk-art--ph bk-art--board"><span className="bk-art__note">{p.pendingNote}</span></div>
              )}
              {s?.sketch && <span className="bk-sketch bk-sketch--top" data-sketch>эскиз</span>}
              {text && (
                <div className="bk-board-text" style={{ "--tf": String(textFit(plan.textScale, text.length)) } as CSSProperties}>
                  <SpreadText text={text} />
                </div>
              )}
            </div>
          );
        }
        const parts = splitSpread(text);
        const i = ref.side === "left" ? 0 : 1;
        const part = parts[i];
        const tone: Tone = (s?.url && tones[s.url]?.[i]) || "light";
        return (
          <div className={`bk-page bk-page--story bk-page--${ref.side}`} key={k} data-wm={wm || undefined} data-page="story" data-spread={ref.spread} data-side={ref.side} data-tone={tone} data-src={src.join(",")}>
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
              <div className={`bk-text bk-text--${tone}${part.length > 200 ? " bk-text--long" : ""}${i === 0 ? " bk-text--drop" : ""}`} style={{ "--tf": String(textFit(plan.textScale, part.length * 2)) } as CSSProperties}>
                <SpreadText text={part} />
              </div>
            )}
          </div>
        );
      }
      case "activity": {
        // rev 20: страницы, где ребёнок рисует сам или пишет заметки (4–6, 7–9); у малышей — страница-картинка
        const a = ref.activity;
        if (a?.kind === "art")
          return (
            <div className="bk-page bk-page--story bk-page--board" key={k} data-wm={wm || undefined} data-page="activity" data-activity="art">
              {coverArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="bk-art bk-art--board" src={coverArt} alt="" />
              ) : (
                <span className="bk-ph" aria-hidden="true" />
              )}
            </div>
          );
        return (
          <div className={`bk-page bk-page--paper bk-act bk-act--${a?.kind}`} key={k} data-wm={wm || undefined} data-page="activity" data-activity={a?.kind}>
            <span className="bk-orn" aria-hidden="true"><i /><i /></span>
            <p className="bk-act__prompt">{a?.prompt}</p>
            {a?.kind === "notes" ? (
              <span className="bk-act__lines" aria-hidden="true">{Array.from({ length: 9 }, (_, j) => <i key={j} />)}</span>
            ) : (
              <span className="bk-act__frame" aria-hidden="true"><svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M3 21l3.8-1 11-11-2.8-2.8-11 11L3 21zM16.4 4.8l2.8 2.8 1.4-1.4a1 1 0 000-1.4l-1.4-1.4a1 1 0 00-1.4 0l-1.4 1.4z" fill="currentColor" /></svg></span>
            )}
          </div>
        );
      }
      case "final":
        return (
          <div className="bk-page bk-page--paper bk-final" key={k} data-wm={wm || undefined} data-page="final">
            <span className="bk-blob bk-blob--final" aria-hidden="true" />
            <FairyText lines={finalLines(p.heroName, p.heroGender)} className="bk-final__text" />
            <p className="bk-brand"><b>букими</b></p>
          </div>
        );
      case "back":
        return (
          <div className="bk-page bk-back" key={k} data-wm={wm || undefined} data-page="back">
            <FairyText lines={backLines(p.heroName)} className="bk-back__text" />
            <p className="bk-back__brand"><b>букими</b></p>
          </div>
        );
    }
  };

  const here = frame.find((x) => x.kind !== "endpaper") ?? frame[0];
  const label = frame.length === 2 && here.kind === "story" && here.side !== "page" ? `Разворот ${here.spread}` : pageLabel(here);

  return (
    <section className={`bk bk--t-${plan.textScale}${plan.board ? " bk--board" : ""}`} data-book-preview data-plan={plan.id} data-palette={pal.name} data-paid={p.paid ? "1" : "0"} aria-label={p.paid ? "Ваша книга" : "Ваша книга: листайте и правьте"} style={palette}>
      <p className="bk__plan small" data-plan-title>{plan.title}</p>
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

      {/* rev 20: дочитали до конца — праздничная карточка с главной кнопкой */}
      {atEnd && !p.paid && p.checkoutHref && (
        <div className="bk-end" data-preview-end>
          <span className="bk-end__stars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <p className="bk-end__title">Вот и сказке конец — а книге только начало!</p>
          <p className="small bk-end__sub">Всё на месте? Оформим — и {plan.board ? "картонная книжка" : "книга"} отправится в типографию.</p>
          <button type="button" className="btn btn--primary bk-end__btn" onClick={toCheckout} data-preview-checkout="end">Оформить книгу</button>
        </div>
      )}
      {boardPick}

      {p.paid ? (
        <PaidNote />
      ) : (
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
      )}

      {panel && !p.paid && (
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
              {coverPrice > 0 && <p className="small muted" style={{ margin: "2px 0 6px" }}>«Классика» — бесплатно, другая обложка — +{coverPrice} ₽ к заказу.</p>}
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
                    <BookCoverView variant={c.id} art={coverArt} title={p.title} small palette={p.palette} />
                    <b>{c.title}</b>
                    {coverPrice > 0 && <span className="bk-variant__price" data-cover-price>{c.id === 0 ? "бесплатно" : `+${coverPrice} ₽`}</span>}
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
                        <button key={ph.id} type="button" role="radio" aria-checked={p.layout.photoId === ph.id} className="bk-photos__item" disabled={busy} onClick={async () => { if (p.layout.photoId !== ph.id && (await save({ photoId: ph.id }, "Фото в книге"))) showPhoto(); }}>
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
      {!p.paid && p.checkoutHref && (
        <div className={`bk-cta${reachedEnd ? " bk-cta--end" : ""}`} data-preview-cta>
          <span className="bk-cta__text">{reachedEnd ? "Книга готова к печати!" : "Листайте до конца — а оформить можно в любой момент"}</span>
          <button type="button" className={`btn ${reachedEnd ? "btn--gold" : "btn--primary"} btn--sm`} onClick={toCheckout} data-preview-checkout="bar">Оформить книгу →</button>
        </div>
      )}
      {pay.overlay}
      <p className="small muted bk__hint">Обложка: «{v.title}»{coverPrice > 0 && p.layout.coverVariant !== 0 && !p.paid ? ` (+${coverPrice} ₽)` : ""}. Листайте стрелками или кнопками ‹ ›.{p.paid ? "" : " Правки сразу видны в книге и попадут в PDF и печать."}</p>
    </section>
  );
}
