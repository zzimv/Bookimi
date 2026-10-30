"use client";
// Запись своего голоса по репликам: индикатор уровня во время записи (предупреждения «слишком громко»/«тихо»),
// волна после записи, прослушать/перезаписать/удалить; или одна загруженная запись (режем по паузам на сервере).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { Cue } from "@/lib/gen/cartoon-script";
import { SILENT_ERROR, isSilent, levelMeter } from "@/lib/cartoon-guide";

type Rec = Record<string, { sec: number; warnings: string[] }>;

const label = (c: Cue) => (c.kind === "title" ? "Название" : c.kind === "end" ? "Финал" : `Разворот ${c.page}`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const WARN: Record<string, string> = { clipping: "местами перегруз — отодвиньте телефон чуть дальше", quiet: "тихо — поднесите телефон ближе" };

function pickMime() {
  const list = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  return typeof MediaRecorder !== "undefined" ? list.find((m) => MediaRecorder.isTypeSupported?.(m)) : undefined;
}

export function OwnVoice(p: {
  bookId: string;
  cues: Cue[];
  consentText: string;
  initialConsent: boolean;
  initialRecorded: Rec;
  buildsLeft: number;
  maxTotalSec: number;
  purgeDays: number;
  busy: boolean;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(p.initialConsent);
  const [rec, setRec] = useState<Rec>(p.initialRecorded);
  const [active, setActive] = useState<number | null>(null);
  const [level, setLevel] = useState({ rms: 0, peak: 0, clip: false, sec: 0 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | "all" | null>(null);
  const [local, setLocal] = useState<Record<number, string>>({});
  const mr = useRef<MediaRecorder | null>(null);
  const raf = useRef<number>(0);
  const meter = useRef<HTMLCanvasElement | null>(null);

  const total = Object.values(rec).reduce((s, r) => s + r.sec, 0);
  const done = p.cues.filter((c) => rec[String(c.n)]).length;

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  async function setConsentOn(v: boolean) {
    setError("");
    try {
      await api(`/api/books/${p.bookId}/cartoon`, { action: "consent", granted: v });
      setConsent(v);
      if (!v) setRec({});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function upload(cue: number | "all", blob: Blob, name: string) {
    setSaving(cue);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", blob, name);
      fd.append("cue", String(cue));
      const r = await api<{ recorded: Rec; overLimit: boolean }>(`/api/books/${p.bookId}/cartoon/voice`, fd);
      setRec(r.recorded);
      if (r.overLimit) setError("Вся озвучка длиннее 3 минут — перезапишите самые длинные реплики чуть быстрее.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function start(n: number) {
    setError("");
    let stream: MediaStream;
    try {
      // Без автогромкости и эхоподавления — они «качают» голос; шумодав браузера оставляем
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, autoGainControl: false, noiseSuppression: true } });
    } catch {
      setError("Нет доступа к микрофону. Разрешите его в настройках браузера или загрузите готовый файл ниже.");
      return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    // Индикатор уровня: RMS и пик по AnalyserNode, перегруз — сэмплы у ±1
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const t0 = performance.now();
    let clipSeen = false;
    const total = levelMeter();
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      total.add(buf);
      let s = 0;
      let pk = 0;
      for (const v of buf) {
        s += v * v;
        pk = Math.max(pk, Math.abs(v));
      }
      if (pk > 0.985) clipSeen = true;
      const rms = Math.sqrt(s / buf.length);
      setLevel({ rms, peak: pk, clip: clipSeen, sec: (performance.now() - t0) / 1000 });
      const cv = meter.current;
      if (cv) {
        const g = cv.getContext("2d")!;
        g.clearRect(0, 0, cv.width, cv.height);
        const db = 20 * Math.log10(Math.max(1e-4, rms));
        const w = Math.max(0, Math.min(1, (db + 60) / 60)) * cv.width;
        g.fillStyle = pk > 0.985 ? "#c0392b" : db < -42 ? "#c9a227" : "#2f7d5b";
        g.fillRect(0, 0, w, cv.height);
        g.fillStyle = "#1a2b24";
        g.fillRect(Math.min(cv.width - 2, pk * cv.width), 0, 2, cv.height);
      }
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    r.onstop = async () => {
      cancelAnimationFrame(raf.current);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
      // Тишина (микрофон выключен или заглушён) — не отправляем; сервер проверяет так же
      const lv = total.result();
      if (lv.frames > 0 && isSilent(lv)) {
        setError(SILENT_ERROR);
        return;
      }
      setLocal((l) => ({ ...l, [n]: URL.createObjectURL(blob) }));
      await upload(n, blob, `cue-${n}`);
    };
    mr.current = r;
    r.start(250);
    setActive(n);
  }

  function stop() {
    mr.current?.stop();
    setActive(null);
  }

  async function play(n: number) {
    if (local[n]) return new Audio(local[n]).play();
    try {
      const r = await api<{ url: string }>(`/api/books/${p.bookId}/cartoon/voice?n=${n}`);
      setLocal((l) => ({ ...l, [n]: r.url }));
      new Audio(r.url).play();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(n: number) {
    try {
      const r = await api<{ recorded: Rec }>(`/api/books/${p.bookId}/cartoon/voice?n=${n}`, undefined, "DELETE");
      setRec(r.recorded);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function build() {
    setError("");
    try {
      await api(`/api/books/${p.bookId}/cartoon`, { action: "submitOwn" });
      router.push(`/kabinet/kniga/${p.bookId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteAll() {
    if (!confirm("Удалить все ваши записи? Мультфильм, который уже собран, останется.")) return;
    try {
      await api(`/api/books/${p.bookId}/cartoon`, { action: "deleteVoice" });
      setRec({});
      setLocal({});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="panel">
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsentOn(e.target.checked)} />
          <span>{p.consentText}</span>
        </label>
      </div>

      <div className="panel" aria-disabled={!consent}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <b>Реплики</b>
          <span className="small muted">Записано {done} из {p.cues.length} · {mmss(total)} из {mmss(p.maxTotalSec)}</span>
        </div>
        {!consent && <p className="small muted">Отметьте согласие выше — и можно записывать.</p>}
        {active !== null && (
          <div className="muted-panel" style={{ marginTop: 10, position: "sticky", top: 8, zIndex: 2 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>Идёт запись — реплика {active}</b>
              <span>{level.sec.toFixed(1)} с</span>
            </div>
            <canvas ref={meter} width={600} height={14} style={{ width: "100%", height: 14, borderRadius: 7, background: "#e6efe9", marginTop: 6 }} aria-label="Уровень записи" />
            <p className="small" style={{ margin: "6px 0 0" }}>
              {level.clip ? "Слишком громко — отодвиньте телефон чуть дальше и перезапишите." : level.rms > 0 && level.rms < 0.008 && level.sec > 1.5 ? "Очень тихо — поднесите телефон ближе (15–20 см)." : "Хорошо слышно. Прочитайте реплику, помолчите секунду и нажмите «Стоп»."}
            </p>
            <button className="btn btn--gold btn--sm" style={{ marginTop: 8 }} onClick={stop}>Стоп</button>
          </div>
        )}
        <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
          {p.cues.map((c) => {
            const r = rec[String(c.n)];
            return (
              <li key={c.n} className="spread" style={{ margin: 0 }}>
                <header>
                  <span>{c.n}. {label(c)} · ≈ {Math.max(2, Math.round(c.targetSec))} с</span>
                  {r ? <span className="badge">записано · {r.sec.toFixed(1)} с</span> : null}
                </header>
                <p style={{ fontSize: "1.02rem", margin: "6px 0" }}>{c.text}</p>
                {r?.warnings?.length ? <p className="small" style={{ color: "var(--gold-ink)", margin: "0 0 6px" }}>{r.warnings.map((w) => WARN[w] ?? w).join("; ")}</p> : null}
                {local[c.n] && <Wave src={local[c.n]} />}
                <div className="row">
                  {active === c.n ? (
                    <button className="btn btn--gold btn--sm" onClick={stop}>Стоп</button>
                  ) : (
                    <button className="btn btn--ghost btn--sm" disabled={!consent || active !== null || saving !== null || p.busy} onClick={() => start(c.n)}>
                      {saving === c.n ? "Сохраняем…" : r ? "Перезаписать" : "Записать"}
                    </button>
                  )}
                  {r && active === null && <button className="link-btn" onClick={() => play(c.n)}>Прослушать</button>}
                  {r && active === null && <button className="link-btn" onClick={() => remove(c.n)}>Удалить</button>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="panel">
        <b>Или загрузите одну запись</b>
        <p className="small muted">Все реплики подряд, с паузой 1–2 секунды между ними. WAV, MP3, M4A/AAC, OGG/Opus или WebM, до 50 МБ.</p>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.webm"
          disabled={!consent || saving !== null || p.busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload("all", f, f.name);
            e.target.value = "";
          }}
        />
        {saving === "all" && <p className="small">Загружаем и разрезаем на реплики…</p>}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn--primary" disabled={!consent || done < p.cues.length || total > p.maxTotalSec || p.buildsLeft <= 0 || p.busy} onClick={build}>
          Собрать мультфильм с моим голосом
        </button>
        <span className="small muted">{p.busy ? "Мультфильм сейчас собирается…" : `Можно собрать ещё ${p.buildsLeft} раз(а).`}</span>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Записи храним на серверах в России и удаляем через {p.purgeDays} дней после готовности мультфильма. Не передаём третьим лицам и не «клонируем» голос.{" "}
        <button className="link-btn" onClick={deleteAll}>Удалить мои записи сейчас</button>
      </p>
    </>
  );
}

/** Волна записи (после записи — из локального файла). */
function Wave({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await (await fetch(src)).arrayBuffer();
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(data);
        ctx.close().catch(() => {});
        const ch = audio.getChannelData(0);
        const cv = ref.current;
        if (!alive || !cv) return;
        const g = cv.getContext("2d")!;
        const W = cv.width;
        const H = cv.height;
        g.clearRect(0, 0, W, H);
        const step = Math.max(1, Math.floor(ch.length / W));
        for (let x = 0; x < W; x++) {
          let pk = 0;
          for (let i = x * step; i < (x + 1) * step && i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i]));
          g.fillStyle = pk > 0.985 ? "#c0392b" : "#2f7d5b";
          const h = Math.max(1, pk * H);
          g.fillRect(x, (H - h) / 2, 1, h);
        }
      } catch {
        /* формат не декодируется браузером — без волны */
      }
    })();
    return () => {
      alive = false;
    };
  }, [src]);
  return <canvas ref={ref} width={600} height={40} style={{ width: "100%", height: 40, display: "block", margin: "4px 0 6px" }} aria-hidden="true" />;
}
