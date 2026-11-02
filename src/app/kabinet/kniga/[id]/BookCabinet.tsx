"use client";
import Link from "next/link";
import { SpreadText } from "@/components/SpreadText";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, rub } from "@/lib/client";
import { AddonCards } from "@/components/book/AddonCards";
import { CartoonPanel } from "./CartoonPanel";
import { SILENT_ERROR, isSilent, levelMeter } from "@/lib/cartoon-guide";

const FILE_TITLES: Record<string, string> = {
  "pdf-screen": "PDF для экрана",
  "pdf-a4": "PDF для домашней печати (А4)",
  "pdf-print-210": "PDF для копицентра 21×21",
  "pdf-print-150": "PDF для копицентра 15×15",
  coloring: "Раскраска (PDF)",
  audio: "Аудиокнига",
  "addon-wallpaper-phone": "Обои для телефона (PNG)",
  "addon-wallpaper-desktop": "Обои для компьютера (PNG)",
};

export interface LaterAddon {
  key: string;
  title: string;
  description: string;
  priceRub: number;
  soon?: boolean;
}
const CARTOON_SOON: LaterAddon = { key: "cartoon", title: "Оживление книги", description: "Иллюстрации оживают, диктор читает сказку — 2 минуты для телевизора и сторис.", priceRub: 0, soon: true };

export function BookCabinet(p: {
  id: string;
  title: string;
  status: string;
  progress: number;
  redrawsLeft: number;
  pages: { index: number; text: string; url: string | null }[];
  files: string[];
  audioUrl: string | null;
  selfRead: boolean;
  /** Цифровые допы для аудитории книги, которые можно докупить сейчас (мультфильм — своя панель). */
  later?: LaterAddon[];
  coverUrl?: string | null;
  heroName?: string;
  /** «Оживление книги» пока не продаётся — карточка «скоро» среди допов. */
  cartoonSoon?: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (p.status !== "FULL_READY") {
      const t = setInterval(() => router.refresh(), 4000);
      return () => clearInterval(t);
    }
  }, [p.status, router]);

  async function redraw(index: number) {
    if (!confirm("Перерисовать эту иллюстрацию? Бесплатных перерисовок осталось: " + p.redrawsLeft)) return;
    try {
      await api(`/api/books/${p.id}/action`, { action: "redraw", index });
      setMsg("Перерисовываем — обновим страницу, когда будет готово.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function saveText(index: number) {
    try {
      await api(`/api/books/${p.id}`, { spreads: [{ index, text: draft }] }, "PATCH");
      setEditing(null);
      setMsg("Текст сохранён. PDF обновятся через минуту.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>{p.title}</h1>
      {p.status !== "FULL_READY" && (
        <div className="muted-panel" style={{ marginBottom: 16 }}>
          Книга рисуется: {p.progress}%. Страница обновится сама.
          <div className="progress"><i style={{ width: `${p.progress}%` }} /></div>
        </div>
      )}
      {msg && <p className="ok">{msg}</p>}

      <div className="panel">
        <b>Файлы</b>
        <div className="row" style={{ marginTop: 10 }}>
          {p.files.filter((k) => FILE_TITLES[k]).map((k) => (
            <a key={k} className="btn btn--ghost btn--sm" href={`/api/books/${p.id}/download?kind=${k}`}>{FILE_TITLES[k]}</a>
          ))}
          {p.files.length === 0 && <span className="small muted">Файлы появятся, когда книга будет готова.</span>}
        </div>
        {p.audioUrl && (
          <audio controls src={p.audioUrl} style={{ width: "100%", marginTop: 12 }}>
            Ваш браузер не поддерживает аудио.
          </audio>
        )}
        <div className="row" style={{ marginTop: 12 }}>
          <Link className="btn btn--primary btn--sm" href={`/kniga/${p.id}/kupit?pechat=1`}>Заказать печать (PDF зачтём)</Link>
          <Link className="btn btn--ghost btn--sm" href={`/kniga/${p.id}/kupit?pechat=1`}>Второй экземпляр −30%</Link>
        </div>
      </div>

      {p.status === "FULL_READY" && <CartoonPanel bookId={p.id} />}

      {p.status === "FULL_READY" && ((p.later?.length ?? 0) > 0 || p.cartoonSoon) && <LaterAddons bookId={p.id} items={[...(p.later ?? []), ...(p.cartoonSoon ? [CARTOON_SOON] : [])]} art={{ images: [p.coverUrl, ...p.pages.filter((x) => x.index > 0).map((x) => x.url)].filter(Boolean) as string[], name: p.heroName ?? "", title: p.title }} />}

      {p.selfRead && <VoiceRecorder bookId={p.id} pages={p.pages} />}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Читалка</h2>
      <p className="small muted">Текст можно править бесплатно. Иллюстрации — перерисовать бесплатно ещё {p.redrawsLeft} раз(а).</p>
      <div className="reader">
        {p.pages.map((pg) => (
          <figure key={pg.index} className="spread-view" style={{ margin: 0 }}>
            {pg.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="preview-img" src={pg.url} alt={pg.index === 0 ? "Обложка" : `Разворот ${pg.index}`} loading="lazy" />
            )}
            {pg.index > 0 &&
              (editing === pg.index ? (
                <div style={{ marginTop: 8 }}>
                  <textarea className="textarea" value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} />
                  <div className="row"><button className="btn btn--primary btn--sm" onClick={() => saveText(pg.index)}>Сохранить</button><button className="link-btn" onClick={() => setEditing(null)}>Отмена</button></div>
                </div>
              ) : (
                <figcaption><SpreadText text={pg.text} /></figcaption>
              ))}
            <div className="row small" style={{ marginTop: 6 }}>
              {pg.index > 0 && editing !== pg.index && <button className="link-btn" onClick={() => { setEditing(pg.index); setDraft(pg.text); }}>Поправить текст</button>}
              <button className="link-btn" disabled={p.redrawsLeft <= 0} onClick={() => redraw(pg.index)}>Перерисовать</button>
            </div>
          </figure>
        ))}
      </div>
    </>
  );
}

/** «Добавить к книге»: докупка цифровых допов к оплаченной книге — отдельный заказ без печати (addonsOnly). */
function LaterAddons({ bookId, items, art }: { bookId: string; items: LaterAddon[]; art: { images: string[]; name: string; title: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  async function buy(key: string) {
    setBusy(key);
    setMsg("");
    try {
      const r = await api<{ orderId: string }>("/api/checkout", { bookId, whoPrints: "self", addons: [key], addonsOnly: true, contact: { name: "" } });
      router.push(`/zakaz/${r.orderId}`);
    } catch (e) {
      setMsg((e as Error).message);
      setBusy("");
    }
  }
  return (
    <div className="panel" style={{ marginTop: 16 }} data-later-addons>
      <b>Добавить к книге</b>
      <AddonCards mode="buy" idPrefix="later" items={items.map((a) => ({ ...a, priceRub: a.priceRub }))} onToggle={buy} busyKey={busy} art={art} />
      {msg && <p className="error">{msg}</p>}
    </div>
  );
}

/** «Читаю сам»: запись голоса по страницам прямо в браузере. */
function VoiceRecorder({ bookId, pages }: { bookId: string; pages: { index: number; text: string }[] }) {
  const [done, setDone] = useState<Record<number, string>>({});
  const [rec, setRec] = useState<number | null>(null);
  const [error, setError] = useState("");
  const mr = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    api<{ pages: { index: number; url: string }[] }>(`/api/books/${bookId}/voice`)
      .then((r) => setDone(Object.fromEntries(r.pages.map((x) => [x.index, x.url]))))
      .catch(() => {});
  }, [bookId]);

  async function start(index: number) {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => chunks.push(e.data);
      // Уровень записи: беззвучную (микрофон выключен) не отправляем — сервер проверяет так же
      const total = levelMeter();
      let ctx: AudioContext | null = null;
      let timer = 0;
      try {
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        timer = window.setInterval(() => {
          an.getFloatTimeDomainData(buf);
          total.add(buf);
        }, 100);
      } catch {}
      r.onstop = async () => {
        window.clearInterval(timer);
        ctx?.close().catch(() => {});
        stream.getTracks().forEach((t) => t.stop());
        const lv = total.result();
        if (lv.frames > 0 && isSilent(lv)) {
          setError(SILENT_ERROR);
          return;
        }
        const blob = new Blob(chunks, { type: r.mimeType });
        const fd = new FormData();
        fd.append("file", blob, `page-${index}`);
        fd.append("index", String(index));
        try {
          await api(`/api/books/${bookId}/voice`, fd);
          setDone((d) => ({ ...d, [index]: URL.createObjectURL(blob) }));
        } catch (e) {
          setError((e as Error).message);
        }
      };
      mr.current = r;
      r.start();
      setRec(index);
    } catch {
      setError("Нет доступа к микрофону. Разрешите его в настройках браузера.");
    }
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <b>Аудиокнига вашим голосом</b>
      <p className="small muted">Прочитайте каждую страницу вслух. Записи сохраняются сразу — можно делать в несколько подходов и перезаписывать.</p>
      {pages.map((pg) => (
        <div key={pg.index} className="spread" style={{ marginBottom: 8 }}>
          <header><span>{pg.index === 0 ? "Название" : `Разворот ${pg.index}`}</span>{done[pg.index] ? <span className="badge">записано</span> : null}</header>
          <p style={{ fontSize: ".95rem" }}><SpreadText text={pg.text} /></p>
          <div className="row" style={{ marginTop: 8 }}>
            {rec === pg.index ? (
              <button className="btn btn--gold btn--sm" onClick={() => { mr.current?.stop(); setRec(null); }}>Остановить</button>
            ) : (
              <button className="btn btn--ghost btn--sm" disabled={rec !== null} onClick={() => start(pg.index)}>{done[pg.index] ? "Перезаписать" : "Записать"}</button>
            )}
            {done[pg.index] && <audio controls src={done[pg.index]} style={{ height: 36 }} />}
          </div>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
