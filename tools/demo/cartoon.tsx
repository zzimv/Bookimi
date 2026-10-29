// «Мультфильм по книге» в демо-стенде: ролик не рендерится на сервере — он играет прямо в браузере.
// Canvas по разворотам книги (наезд/панорама, наплыв между сценами, частицы по настроению, виньетка, субтитры),
// озвучка — русский голос браузера (speechSynthesis, ru-RU) или ваши записи со страницы «Озвучить своим голосом»;
// нет русского голоса — только субтитры. Сценарий и тайминг — те же функции, что на сайте (src/lib/gen/cartoon-script.ts).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CARTOON_TIMING, estimateSpeechSec, particlesFor, subtitleChunks, type Cue, type Particles } from "../../src/lib/gen/cartoon-script";
import { OWN_VOICE_FORMAT, OWN_VOICE_GUIDE, OWN_VOICE_PROCESSING, VOICE_CONSENT_TEXT, VOICE_LIMITS } from "../../src/lib/cartoon-guide";
import { OwnVoice } from "../../src/app/kabinet/kniga/[id]/mult/OwnVoice";
import { api, rub } from "../../src/lib/client";
import { DEFAULTS } from "../../src/lib/settings";
import { bookById, cartoonOf, pageUrl, plotInfo, scriptOf, voiceOf, type DBook } from "./api";
import { NotFoundError } from "./router";

const SIZE = 720;
const T = CARTOON_TIMING;

/** Русский голос браузера (если есть): предпочитаем женский «сказочный», иначе любой ru. */
function ruVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const list = speechSynthesis.getVoices().filter((v) => /^ru(-|_|$)/i.test(v.lang));
  return list.find((v) => /milena|alena|irina|svetlana|dariya|female|жен/i.test(v.name)) ?? list[0] ?? null;
}

interface Scene {
  cue: Cue;
  img: HTMLImageElement | null;
  particles: Particles;
  /** Время (по часам плеера), когда сцена началась / заговорил голос / закончилась реплика. */
  start: number;
  voiceAt: number;
  voiceSec: number;
  chunk: number;
  chunks: { text: string; from: number; to: number }[];
}
type Dot = { x: number; y: number; r: number; vx: number; vy: number; ph: number };

/** Движок плеера: последовательность сцен со своими часами (пауза останавливает и картинку, и голос). */
class Player {
  scenes: Scene[] = [];
  idx = -1;
  acc = 0;
  since = 0;
  paused = false;
  stopped = false;
  raf = 0;
  dots: Dot[] = [];
  audio: HTMLAudioElement | null = null;
  utter: SpeechSynthesisUtterance | null = null;
  constructor(
    private canvasSel: string,
    private cues: Cue[],
    private imgs: (HTMLImageElement | null)[],
    private theme: string,
    private title: string,
    private own: Map<number, { url: string; sec: number }>,
    private voice: SpeechSynthesisVoice | null,
    private onScene: (n: number) => void,
    private onEnd: () => void,
  ) {
    for (let i = 0; i < 70; i++) this.dots.push({ x: Math.random() * SIZE, y: Math.random() * SIZE, r: 1 + Math.random() * 3, vx: Math.random() - 0.5, vy: 0.3 + Math.random(), ph: Math.random() * 6.28 });
  }
  clock() {
    return this.acc + (this.paused || this.stopped ? 0 : (performance.now() - this.since) / 1000);
  }
  sleep(sec: number) {
    const until = this.clock() + sec;
    return new Promise<void>((res) => {
      const tick = () => (this.stopped || this.clock() >= until ? res() : setTimeout(tick, 40));
      tick();
    });
  }
  pause() {
    if (this.paused || this.stopped) return;
    this.acc = this.clock();
    this.paused = true;
    this.audio?.pause();
    if (this.utter) speechSynthesis.pause();
  }
  resume() {
    if (!this.paused || this.stopped) return;
    this.since = performance.now();
    this.paused = false;
    this.audio?.play().catch(() => {});
    if (this.utter) speechSynthesis.resume();
  }
  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
  /** Реплика: своя запись → голос браузера → только субтитры (по оценке длительности). */
  narrate(s: Scene): Promise<void> {
    const rec = this.own.get(s.cue.n);
    const est = s.cue.targetSec || estimateSpeechSec(s.cue.text);
    const guard = (sec: number, done: () => void) => this.sleep(sec).then(done);
    if (rec) {
      s.voiceSec = rec.sec;
      return new Promise((res) => {
        const a = new Audio(rec.url);
        this.audio = a;
        let fin = false;
        const end = () => {
          if (fin) return;
          fin = true;
          this.audio = null;
          res();
        };
        a.onended = end;
        a.onerror = end;
        a.play().catch(end);
        guard(rec.sec + 2, end);
      });
    }
    s.voiceSec = est;
    if (this.voice && typeof speechSynthesis !== "undefined") {
      return new Promise((res) => {
        const u = new SpeechSynthesisUtterance(s.cue.text);
        u.voice = this.voice;
        u.lang = this.voice!.lang || "ru-RU";
        u.rate = 0.95;
        u.pitch = 1.05;
        this.utter = u;
        let fin = false;
        const end = () => {
          if (fin) return;
          fin = true;
          this.utter = null;
          res();
        };
        // Субтитры — по словам, которые сейчас читает голос
        u.onboundary = (e) => {
          let acc = 0;
          for (let i = 0; i < s.chunks.length; i++) {
            acc += s.chunks[i].text.length + 1;
            if (e.charIndex < acc) {
              s.chunk = i;
              break;
            }
          }
        };
        u.onend = end;
        u.onerror = end;
        speechSynthesis.speak(u);
        guard(est * 2 + 3, () => {
          if (!fin) speechSynthesis.cancel();
          end();
        });
      });
    }
    return this.sleep(est);
  }
  async run() {
    this.since = performance.now();
    this.loop();
    for (let i = 0; i < this.cues.length && !this.stopped; i++) {
      const cue = this.cues[i];
      const text = cue.text;
      const est = cue.targetSec || estimateSpeechSec(text);
      const own = this.own.get(cue.n);
      const scene: Scene = { cue, img: this.imgs[cue.page] ?? null, particles: particlesFor(this.theme, text), start: this.clock(), voiceAt: Infinity, voiceSec: own?.sec ?? est, chunk: 0, chunks: subtitleChunks(text, own?.sec ?? est) };
      this.scenes.push(scene);
      this.idx = i;
      this.onScene(cue.n);
      await this.sleep(i === 0 ? 0.9 : T.xfade * 0.5 + T.lead);
      scene.voiceAt = this.clock();
      await this.narrate(scene);
      await this.sleep(i === this.cues.length - 1 ? T.endHold : T.tail + T.xfade * 0.5);
    }
    if (!this.stopped) {
      this.stopped = true;
      this.onEnd();
    }
  }
  loop = () => {
    if (this.stopped && this.idx < this.cues.length - 1) return;
    this.draw();
    if (!this.stopped) this.raf = requestAnimationFrame(this.loop);
  };
  draw() {
    const cv = document.querySelector<HTMLCanvasElement>(this.canvasSel);
    const g = cv?.getContext("2d");
    if (!g) return;
    const now = this.clock();
    const cur = this.scenes[this.idx];
    if (!cur) return;
    const prev = this.scenes[this.idx - 1];
    const k = Math.min(1, (now - cur.start) / T.xfade);
    if (prev && k < 1) this.scene(g, prev, now, 1);
    this.scene(g, cur, now, prev ? k : 1);
    this.particles(g, cur.particles, now);
    // Виньетка
    const vg = g.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.38)");
    g.fillStyle = vg;
    g.fillRect(0, 0, SIZE, SIZE);
    this.subtitle(g, cur, now);
  }
  scene(g: CanvasRenderingContext2D, s: Scene, now: number, alpha: number) {
    g.save();
    g.globalAlpha = alpha;
    const total = 0.9 + s.voiceSec + T.tail + T.xfade;
    const p = Math.min(1, Math.max(0, (now - s.start) / total));
    const ease = p * p * (3 - 2 * p);
    if (s.cue.kind === "end") {
      g.fillStyle = "#143628";
      g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = "#f3e4c2";
      g.textAlign = "center";
      g.font = "800 64px Nunito, system-ui, sans-serif";
      g.fillText("Конец", SIZE / 2, 250);
      g.font = "500 26px Manrope, system-ui, sans-serif";
      wrapText(g, s.cue.text.replace(/^Конец\.\s*/, ""), SIZE / 2, 320, SIZE - 140, 36, 5);
      g.font = "700 22px Manrope, system-ui, sans-serif";
      g.fillStyle = "#d9a948";
      g.fillText("Сделано с любовью в БУКИМИ", SIZE / 2, SIZE - 70);
      g.restore();
      return;
    }
    if (s.img && s.img.complete && s.img.naturalWidth) {
      const iw = s.img.naturalWidth;
      const ih = s.img.naturalHeight;
      const n = s.cue.n;
      // Наезд / отъезд и панорама по широкому развороту: направление меняется от сцены к сцене
      const zoom = s.cue.kind === "title" ? 1 + 0.08 * ease : n % 2 ? 1.04 + 0.1 * ease : 1.14 - 0.1 * ease;
      const scale = (SIZE / ih) * zoom;
      const w = iw * scale;
      const h = ih * scale;
      const span = w - SIZE;
      const x = s.cue.kind === "title" ? -span / 2 : -(n % 2 ? span * (0.3 + 0.4 * ease) : span * (0.7 - 0.4 * ease));
      const y = -(h - SIZE) * (n % 3 === 0 ? 0.3 + 0.4 * ease : 0.5);
      g.drawImage(s.img, x, y, w, h);
    } else {
      g.fillStyle = "#1e4d3b";
      g.fillRect(0, 0, SIZE, SIZE);
    }
    if (s.cue.kind === "title") {
      const a = Math.min(1, Math.max(0, (now - s.start - 0.3) / 0.8));
      g.globalAlpha = alpha * a;
      const grd = g.createLinearGradient(0, SIZE * 0.55, 0, SIZE);
      grd.addColorStop(0, "rgba(20,54,40,0)");
      grd.addColorStop(1, "rgba(20,54,40,.85)");
      g.fillStyle = grd;
      g.fillRect(0, SIZE * 0.55, SIZE, SIZE * 0.45);
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.font = "800 44px Nunito, system-ui, sans-serif";
      wrapText(g, this.title, SIZE / 2, SIZE - 150, SIZE - 80, 50, 2);
    }
    g.restore();
  }
  particles(g: CanvasRenderingContext2D, kind: Particles, now: number) {
    if (kind === "none") return;
    g.save();
    for (const d of this.dots) {
      if (!this.paused) {
        if (kind === "snow") {
          d.y += d.vy * 1.2;
          d.x += Math.sin(now + d.ph) * 0.4;
        } else if (kind === "fireflies") {
          d.x += Math.sin(now * 0.7 + d.ph) * 0.6;
          d.y += Math.cos(now * 0.5 + d.ph) * 0.5;
        } else {
          d.y -= d.vy * 0.25;
          d.x += d.vx * 0.3;
        }
        if (d.y > SIZE + 5) d.y = -5;
        if (d.y < -5) d.y = SIZE + 5;
        if (d.x > SIZE + 5) d.x = -5;
        if (d.x < -5) d.x = SIZE + 5;
      }
      const tw = 0.5 + 0.5 * Math.sin(now * 3 + d.ph);
      if (kind === "snow") g.fillStyle = "rgba(255,255,255,.85)";
      else if (kind === "fireflies") g.fillStyle = `rgba(255,226,120,${0.25 + 0.6 * tw})`;
      else if (kind === "sparkles") g.fillStyle = `rgba(255,240,180,${0.15 + 0.8 * tw})`;
      else g.fillStyle = "rgba(255,248,225,.35)";
      const r = kind === "dust" ? d.r * 0.6 : kind === "sparkles" ? d.r * (0.6 + tw) : d.r;
      if (kind === "fireflies") {
        g.shadowColor = "rgba(255,220,100,.9)";
        g.shadowBlur = 8;
      }
      g.beginPath();
      if (kind === "sparkles") {
        // Четырёхлучевая искорка
        g.moveTo(d.x, d.y - r * 2);
        g.lineTo(d.x + r * 0.5, d.y);
        g.lineTo(d.x, d.y + r * 2);
        g.lineTo(d.x - r * 0.5, d.y);
        g.closePath();
        g.moveTo(d.x - r * 2, d.y);
        g.lineTo(d.x, d.y + r * 0.5);
        g.lineTo(d.x + r * 2, d.y);
        g.lineTo(d.x, d.y - r * 0.5);
      } else g.arc(d.x, d.y, r, 0, 6.283);
      g.fill();
    }
    g.restore();
  }
  subtitle(g: CanvasRenderingContext2D, s: Scene, now: number) {
    if (s.cue.kind === "end" || now < s.voiceAt) return;
    const t = now - s.voiceAt;
    // Без событий голоса — по времени (пропорционально слогам)
    if (!this.utter || s.chunk === 0) {
      const byTime = s.chunks.findIndex((c) => t * (s.chunks.at(-1)!.to / Math.max(0.5, s.voiceSec)) < c.to);
      if (byTime >= 0 && byTime > s.chunk) s.chunk = byTime;
    }
    const c = s.chunks[Math.min(s.chunk, s.chunks.length - 1)];
    if (!c || t > s.voiceSec + T.tail + 0.6) return;
    g.save();
    g.font = "700 32px Manrope, system-ui, sans-serif";
    g.textAlign = "center";
    const lines = c.text.split("\n");
    const w = Math.min(SIZE - 40, Math.max(...lines.map((l) => g.measureText(l).width)) + 36);
    const h = lines.length * 42 + 18;
    const y = SIZE - 40 - h;
    g.fillStyle = "rgba(10,20,16,.72)";
    roundRect(g, (SIZE - w) / 2, y, w, h, 14);
    g.fill();
    g.fillStyle = "#fff";
    lines.forEach((l, i) => g.fillText(l, SIZE / 2, y + 42 + i * 42));
    g.restore();
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines: number) {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (cur && g.measureText(`${cur} ${w}`).width > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(i === maxLines - 1 && lines.length > maxLines ? `${l}…` : l, x, y + i * lh));
}
const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

/** Плеер мультфильма в кабинете (книга оплачена, мультфильм куплен). */
export function CartoonPlayer({ book }: { book: DBook }) {
  const cues = scriptOf(book);
  const c = cartoonOf(book);
  // Записи со страницы «Озвучить своим голосом» играют вместо голоса браузера (незаписанные реплики — голос браузера)
  const own = c.mode === "auto" && !voiceOf(book.id).size ? new Map<number, { url: string; sec: number }>() : voiceOf(book.id);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "done">("idle");
  const [n, setN] = useState(0);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const player = useRef<Player | null>(null);
  const sel = `[data-cartoon="${book.id}"]`;

  useEffect(() => {
    // Постер — обложка с названием, пока не нажали «Смотреть»
    loadImg(pageUrl(book, 0, { full: true })).then((im) => {
      const g = document.querySelector<HTMLCanvasElement>(sel)?.getContext("2d");
      if (!g || player.current) return;
      if (im) g.drawImage(im, 0, 0, SIZE, SIZE);
      g.fillStyle = "rgba(20,54,40,.45)";
      g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(SIZE / 2, SIZE / 2, 54, 0, 6.283);
      g.fill();
      g.fillStyle = "#1e4d3b";
      g.beginPath();
      g.moveTo(SIZE / 2 - 16, SIZE / 2 - 26);
      g.lineTo(SIZE / 2 + 28, SIZE / 2);
      g.lineTo(SIZE / 2 - 16, SIZE / 2 + 26);
      g.fill();
    });
    const pick = () => setVoiceName(ruVoice()?.name ?? null);
    pick();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.addEventListener?.("voiceschanged", pick);
    return () => {
      player.current?.stop();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.removeEventListener?.("voiceschanged", pick);
    };
  }, [book.id]);

  async function play() {
    if (player.current && state === "paused") {
      player.current.resume();
      setState("playing");
      return;
    }
    player.current?.stop();
    setState("loading");
    const imgs = await Promise.all(Array.from({ length: 13 }, (_, i) => (book.pages.includes(i) ? loadImg(pageUrl(book, i, { full: true })) : Promise.resolve(null))));
    const p = new Player(sel, cues, imgs, plotInfo(book.params).theme, book.text?.title ?? "", own, ruVoice(), setN, () => setState("done"));
    player.current = p;
    setState("playing");
    p.run();
  }
  const mode = own.size ? `Ваш голос: ${own.size} из ${cues.length} реплик`  : voiceName ? `Голос браузера: ${voiceName}` : "Без голоса — русского голоса в браузере нет, показываем субтитры";
  return (
    <section className="panel cartoon-demo" data-cartoon-player aria-labelledby="cartoon-h" style={{ marginBottom: 16 }}>
      <h2 id="cartoon-h" style={{ fontSize: "var(--fs-lg)", marginTop: 0 }}>Мультфильм по книге{own.size ? " — вашим голосом" : ""}</h2>
      <canvas data-cartoon={book.id} width={SIZE} height={SIZE} className="cartoon-demo__canvas" aria-label="Мультфильм: развороты книги с озвучкой и субтитрами" onClick={() => (state === "playing" ? (player.current?.pause(), setState("paused")) : play())} />
      <div className="row" style={{ marginTop: 10 }}>
        {state === "playing" ? (
          <button type="button" className="btn btn--primary btn--sm" data-cartoon-pause onClick={() => { player.current?.pause(); setState("paused"); }}>Пауза</button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" data-cartoon-play disabled={state === "loading"} onClick={play}>{state === "paused" ? "Продолжить" : state === "done" ? "Смотреть ещё раз" : state === "loading" ? "Готовим…" : "▶ Смотреть"}</button>
        )}
        {(state === "playing" || state === "paused") && <button type="button" className="btn btn--ghost btn--sm" onClick={() => { player.current?.stop(); player.current = null; setState("idle"); setN(0); }}>Стоп</button>}
        <span className="small muted" data-cartoon-scene>{n ? `Сцена ${n} из ${cues.length}` : `${cues.length} сцен · ~${Math.round(cues.reduce((s, x) => s + x.targetSec + 2, 0) / 60)} мин`}</span>
      </div>
      <p className="small muted" style={{ margin: "8px 0 0" }} data-cartoon-voice>{mode}.</p>
      <p className="small demo-note" style={{ margin: "8px 0 0" }}>
        Демо: мультфильм играет прямо в браузере. На сайте — MP4 1080×1080 и 9:16 с диктором SpeechKit или вашим голосом, музыкой и ссылкой «Поделиться».
      </p>
      <div className="row" style={{ marginTop: 10 }}>
        {c.ownVoice ? (
          <Link className="btn btn--gold btn--sm" href={`/kabinet/kniga/${book.id}/mult`}>{own.size ? "Перезаписать свой голос →" : "Озвучить своим голосом →"}</Link>
        ) : (
          <BuyOwnVoice bookId={book.id} />
        )}
      </div>
    </section>
  );
}

function BuyOwnVoice({ bookId }: { bookId: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        className="link-btn"
        onClick={() =>
          api<{ orderId: string }>(`/api/books/${bookId}/cartoon`, { action: "buy", ownVoice: true })
            .then((r) => (location.hash = `/zakaz/${r.orderId}`))
            .catch((e) => setMsg((e as Error).message))
        }
      >
        Озвучить своим голосом — {rub(DEFAULTS.cartoon.ownVoiceRub)}
      </button>
      {msg && <span className="error small">{msg}</span>}
    </>
  );
}

/** «Озвучить своим голосом» (как src/app/kabinet/kniga/[id]/mult/page.tsx): памятка + настоящий компонент записи. */
export async function DemoMult({ id }: { id: string }) {
  const b = bookById(id);
  if (!b) throw new NotFoundError();
  const c = cartoonOf(b);
  const title = b.text?.title ?? "Книга";
  if (!c.ownVoice) {
    return (
      <div className="panel">
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Озвучить своим голосом</h1>
        <p>Эта возможность — дополнение к мультфильму по книге. Добавить её можно на странице книги.</p>
        <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${id}`}>К книге</Link>
      </div>
    );
  }
  const cues = scriptOf(b);
  const recorded = Object.fromEntries([...voiceOf(id)].map(([n, v]) => [String(n), { sec: v.sec, warnings: [] as string[] }]));
  return (
    <>
      <p className="small"><Link href={`/kabinet/kniga/${id}`}>← {title}</Link></p>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Озвучить своим голосом</h1>
      <p>Прочитайте мультфильм сами — {cues.length} коротких реплик, на всё уйдёт минут десять. Сцены подстроятся под ваш голос.</p>
      <p className="muted-panel small demo-note">Демо: записи остаются только в памяти этой вкладки и играют в плеере вместо голоса браузера. Перезагрузите страницу — записи исчезнут.</p>
      <details className="panel">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>С чего начать</summary>
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
          {OWN_VOICE_GUIDE.map((g) => (
            <li key={g.title}><b>{g.title}.</b> {g.text}</li>
          ))}
        </ol>
      </details>
      <details className="panel">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Требования к записи</summary>
        <ul style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 6 }}>
          {OWN_VOICE_FORMAT.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="small muted" style={{ marginTop: 10 }}>{OWN_VOICE_PROCESSING}</p>
      </details>
      <OwnVoice bookId={id} cues={cues} consentText={VOICE_CONSENT_TEXT} initialConsent={c.consent} initialRecorded={recorded} buildsLeft={3} maxTotalSec={VOICE_LIMITS.maxTotalSec} purgeDays={VOICE_LIMITS.purgeDays} busy={false} />
    </>
  );
}
