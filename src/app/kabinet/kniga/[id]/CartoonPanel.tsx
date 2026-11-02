"use client";
// «Оживление книги» в кабинете: покупка, сборка, плеер, скачивание, ссылка «Поделиться», голос и субтитры.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, rub } from "@/lib/client";

interface State {
  enabled: boolean;
  status: "NONE" | "PENDING" | "QUEUED" | "RENDERING" | "READY" | "FAILED";
  progress: number;
  error: string | null;
  voiceMode: string;
  voice: string | null;
  subtitles: boolean;
  ownVoicePaid: boolean;
  rerendersLeft: number;
  ownBuildsLeft: number;
  durationSec: number | null;
  bought: { cartoon: boolean; ownVoice: boolean };
  share: { token: string; expiresAt: string } | null;
  urls: { video: string | null; poster: string | null; vertical: string | null };
  prices: { cartoon: number; ownVoice: number };
  voices: { key: string; title: string }[];
}

const ruDate = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function CartoonPanel({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [own, setOwn] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api<State>(`/api/books/${bookId}/cartoon`).then(setS).catch(() => {}), [bookId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!s || !["QUEUED", "RENDERING", "PENDING"].includes(s.status) || !s.bought.cartoon) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [s, load]);

  async function act(data: object, after?: (r: unknown) => void) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api(`/api/books/${bookId}/cartoon`, data);
      after?.(r);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!s || (!s.enabled && !s.bought.cartoon)) return null;

  if (!s.bought.cartoon) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <b>Оживление книги</b>
        <p className="small" style={{ margin: "6px 0 10px" }}>
          Две минуты сказки: ваши герои оживают на страницах книги, диктор читает историю, тихо играет музыка. Смотреть на телефоне и телевизоре, скачать и отправить
          бабушке ссылкой.
        </p>
        <label className="check">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} />
          <span>Озвучу своим голосом (+{rub(s.prices.ownVoice)}) — дадим сценарий по репликам и подсказки, как записать</span>
        </label>
        <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => act({ action: "buy", ownVoice: own }, (r) => router.push(`/zakaz/${(r as { orderId: string }).orderId}`))}>
          Добавить «Оживление книги» — {rub(s.prices.cartoon + (own ? s.prices.ownVoice : 0))}
        </button>
        {msg && <p className="error">{msg}</p>}
      </div>
    );
  }

  const shareUrl = s.share ? `${typeof window !== "undefined" ? window.location.origin : ""}/mult/${s.share.token}` : "";
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <b>Оживление книги{s.voiceMode === "own" ? " — вашим голосом" : ""}</b>
      {(s.status === "NONE" || s.status === "PENDING") && <p className="small muted">Начнём собирать ролик, как только книга будет готова.</p>}
      {(s.status === "QUEUED" || s.status === "RENDERING") && (
        <div className="muted-panel" style={{ marginTop: 10 }}>
          Собираем ролик: {s.progress}%. Обычно это 2–4 минуты, страница обновится сама.
          <div className="progress"><i style={{ width: `${s.progress}%` }} /></div>
        </div>
      )}
      {s.status === "FAILED" && (
        <div style={{ marginTop: 10 }}>
          <p className="error">Ролик не собрался. Мы уже знаем и посмотрим; можно попробовать ещё раз.</p>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => act({ action: s.voiceMode === "own" ? "submitOwn" : "rerender" })}>Попробовать ещё раз</button>
        </div>
      )}
      {s.status === "READY" && s.urls.video && (
        <>
          <video controls playsInline preload="metadata" poster={s.urls.poster ?? undefined} src={s.urls.video} style={{ width: "100%", maxWidth: 560, aspectRatio: "1 / 1", borderRadius: 14, background: "#000", marginTop: 10, display: "block" }}>
            Ваш браузер не поддерживает видео.
          </video>
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn btn--primary btn--sm" href={`/api/books/${bookId}/download?kind=cartoon`}>Скачать MP4</a>
            {s.urls.vertical && <a className="btn btn--ghost btn--sm" href={`/api/books/${bookId}/download?kind=cartoon-vertical`}>Для телефона и историй (9:16)</a>}
            {!s.share && <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => act({ action: "share" })}>Поделиться ссылкой</button>}
          </div>
          {s.share && (
            <div className="muted-panel" style={{ marginTop: 10 }}>
              <p className="small" style={{ margin: 0 }}>Ссылка для близких — действует до {ruDate(s.share.expiresAt)}, не попадает в поиск:</p>
              <div className="row" style={{ marginTop: 6 }}>
                <input className="input" readOnly value={shareUrl} style={{ flex: 1, minWidth: 220 }} onFocus={(e) => e.target.select()} />
                <button className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true))}>{copied ? "Скопировано" : "Копировать"}</button>
                <button className="link-btn" disabled={busy} onClick={() => act({ action: "unshare" }, () => setCopied(false))}>Отозвать ссылку</button>
              </div>
            </div>
          )}
        </>
      )}
      {s.status !== "QUEUED" && s.status !== "RENDERING" && s.status !== "NONE" && s.status !== "PENDING" && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Голос, субтитры, пересборка</summary>
          <div className="row" style={{ marginTop: 10 }}>
            {s.voiceMode === "auto" && (
              <label className="field" style={{ margin: 0 }}>
                <span>Голос диктора</span>
                <select className="select" value={s.voice ?? ""} disabled={busy} onChange={(e) => act({ action: "settings", voice: e.target.value })}>
                  <option value="">По книге</option>
                  {s.voices.map((v) => <option key={v.key} value={v.key}>{v.title}</option>)}
                </select>
              </label>
            )}
            <label className="check" style={{ margin: 0 }}>
              <input type="checkbox" checked={s.subtitles} disabled={busy} onChange={(e) => act({ action: "settings", subtitles: e.target.checked })} />
              <span>Субтитры</span>
            </label>
          </div>
          {s.voiceMode === "auto" ? (
            <p className="small" style={{ marginTop: 8 }}>
              Поменяли голос, субтитры или текст книги — пересоберите ролик. Бесплатно: {s.rerendersLeft} раз.{" "}
              <button className="link-btn" disabled={busy || s.rerendersLeft <= 0} onClick={() => act({ action: "rerender" })}>Пересобрать</button>
            </p>
          ) : (
            <p className="small" style={{ marginTop: 8 }}>
              Сейчас в ролике ваш голос.{" "}
              <button className="link-btn" disabled={busy} onClick={() => act({ action: "settings", voiceMode: "auto" }, () => setMsg("Голос диктора выбран — нажмите «Пересобрать»."))}>Вернуть голос диктора</button>
            </p>
          )}
        </details>
      )}
      <div style={{ marginTop: 12 }}>
        {s.ownVoicePaid ? (
          <Link className="btn btn--gold btn--sm" href={`/kabinet/kniga/${bookId}/mult`}>Озвучить своим голосом →</Link>
        ) : (
          <button className="link-btn" disabled={busy} onClick={() => act({ action: "buy", ownVoice: true }, (r) => router.push(`/zakaz/${(r as { orderId: string }).orderId}`))}>
            Озвучить своим голосом — {rub(s.prices.ownVoice)}
          </button>
        )}
      </div>
      {msg && <p className={msg.includes("выбран") ? "ok" : "error"}>{msg}</p>}
    </div>
  );
}
