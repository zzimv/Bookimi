// Рендер «Мультфильма по книге» (ffmpeg, CPU): обложка-заставка → 12 разворотов → финальная карточка.
// Без видеомодели: медленная камера (наезд/панорама/отъезд по композиции), у демо-иллюстраций — параллакс:
// фон и герои отдельными слоями, герой чуть покачивается/«шагает»/дышит; у картинок GPU — камера + «дыхание».
// Переходы — наплыв и «через белое», частицы по настроению (снег, светлячки, искорки, пылинки) + виньетка,
// субтитры Nunito (libass), шелест страниц и фоновая музыка синтезируются (cartoon-audio.ts), музыка
// приглушается под голос (sidechaincompress), итог — громкость −16 LUFS (loudnorm в два прохода).
// Выход: MP4 H.264 1080×1080 25 fps + AAC, по желанию 1080×1920 (для телефона/историй), постер JPEG.
// Модуль не знает о БД — его вызывают воркер (cartoon.ts) и скрипт образцов (scripts/cartoon-samples.ts).
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cpus } from "node:os";
import sharp from "sharp";
import { ambientBed, AUDIO_RATE, fromS16, placeClips, sfxTrack, wav } from "./cartoon-audio";
import { CARTOON_TIMING, cartoonTimeline, subtitleChunks, type CartoonTiming, type Cue, type CueKind, type Particles, type Timeline } from "./cartoon-script";

export const FFMPEG = () => process.env.FFMPEG_PATH || "ffmpeg";
export const FFPROBE = () => process.env.FFPROBE_PATH || "ffprobe";
export const FONTS_DIR = () => process.env.CARTOON_FONTS_DIR || join(process.cwd(), "src/lib/gen/fonts");

const SIZE = 1080;
const FPS = 25;
/** Высота исходника: окно камеры при наезде до ×1,18 не требует увеличения картинки. */
const SRC_H = 1280;

export interface CartoonSceneInput {
  kind: CueKind;
  /** Иллюстрация целиком (SVG демо, PNG с GPU, JPEG). Для финала — обложка (будет размыта). */
  image: { data: Buffer; contentType: string };
  /** Демо: фон без героев, полная картинка и маска героев (SVG) — для параллакса. */
  layers?: { background: Buffer; full: Buffer; mask: Buffer };
  /** Будущее (CARTOON_I2V): короткий ролик сцены от модели image-to-video. */
  clip?: Buffer;
}

export interface RenderInput {
  title: string;
  dedication: string;
  cues: Cue[];
  /** Аудио реплик (любой формат ffmpeg), по одной на реплику, уже очищенное и выровненное по громкости. */
  voice: Buffer[];
  /** 14 сцен, по одной на реплику. */
  scenes: CartoonSceneInput[];
  particles: Particles;
  subtitles: boolean;
  vertical: boolean;
  /** Высота вертикальной версии (1920 — 1080×1920, 1280 — 720×1280, дешевле). */
  verticalHeight?: number;
  /** Лицензированный трек владельца (иначе синтез). */
  music?: Buffer | null;
  /** Громкость музыки относительно синтеза (1 — по умолчанию). */
  musicVolume?: number;
  timing?: CartoonTiming;
  workDir: string;
  brand?: string;
  onProgress?: (pct: number) => void;
}

export interface RenderOutput {
  square: string;
  vertical: string | null;
  poster: string;
  durationSec: number;
  renderSec: number;
  timeline: Timeline;
  loudness: { I: number; TP: number };
}

// ───────── ffmpeg ─────────

export function ff(args: string[], opts: { bin?: string; onLine?: (l: string) => void; input?: Buffer } = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(opts.bin ?? FFMPEG(), args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    let carry = "";
    p.stdout.on("data", (d: Buffer) => {
      if (opts.onLine) {
        const s = carry + d.toString();
        const lines = s.split("\n");
        carry = lines.pop() ?? "";
        lines.forEach(opts.onLine);
      } else out.push(d);
    });
    p.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ stdout: Buffer.concat(out), stderr: err }) : reject(new Error(`${opts.bin ?? "ffmpeg"} ${code}: ${err.slice(-1500)}`))));
    if (opts.input) p.stdin.end(opts.input);
    else p.stdin.end();
  });
}

export async function probe(file: string): Promise<{ duration: number; sampleRate: number; channels: number; codec: string; format: string }> {
  const { stdout } = await ff(["-v", "error", "-show_entries", "format=duration,format_name:stream=codec_type,codec_name,sample_rate,channels", "-of", "json", file], { bin: FFPROBE() });
  const j = JSON.parse(stdout.toString()) as { format?: { duration?: string; format_name?: string }; streams?: { codec_type: string; codec_name: string; sample_rate?: string; channels?: number }[] };
  const a = j.streams?.find((s) => s.codec_type === "audio");
  let duration = Number(j.format?.duration ?? 0);
  // Запись MediaRecorder (WebM/Opus из браузера) идёт потоком — длительности в заголовке нет: меряем декодированием
  if (!Number.isFinite(duration) || duration <= 0) duration = await decodedDuration(file).catch(() => 0);
  return { duration, sampleRate: Number(a?.sample_rate ?? 0), channels: a?.channels ?? 0, codec: a?.codec_name ?? "", format: j.format?.format_name ?? "" };
}

/** Длительность по декодированию (последнее «time=» ffmpeg) — для файлов без длительности в заголовке. */
export async function decodedDuration(file: string): Promise<number> {
  const { stderr } = await ff(["-hide_banner", "-i", file, "-vn", "-f", "null", "-"]);
  const all = [...stderr.toString().matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const m = all[all.length - 1];
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Декодировать в PCM s16le 48 кГц моно. */
export async function decodeMono(file: string): Promise<Float32Array> {
  const { stdout } = await ff(["-v", "error", "-i", file, "-ac", "1", "-ar", String(AUDIO_RATE), "-f", "s16le", "-"]);
  return fromS16(stdout);
}

/** Измерение громкости (EBU R128) — первый проход loudnorm. */
export async function measureLoudness(file: string, filters = ""): Promise<{ I: number; TP: number; LRA: number; thresh: number; offset: number }> {
  const { stderr } = await ff(["-hide_banner", "-nostats", "-i", file, "-af", `${filters ? filters + "," : ""}loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]);
  const j = JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1)) as Record<string, string>;
  return { I: Number(j.input_i), TP: Number(j.input_tp), LRA: Number(j.input_lra), thresh: Number(j.input_thresh), offset: Number(j.target_offset) };
}

/** Второй проход loudnorm: линейное приведение к −16 LUFS по измерениям первого. */
export function loudnormPass2(m: { I: number; TP: number; LRA: number; thresh: number; offset: number }, I = -16) {
  const f = (x: number) => (Number.isFinite(x) ? x : -70).toFixed(2);
  return `loudnorm=I=${I}:TP=-1.5:LRA=11:measured_I=${f(m.I)}:measured_TP=${f(m.TP)}:measured_LRA=${f(m.LRA)}:measured_thresh=${f(m.thresh)}:offset=${f(m.offset)}:linear=true`;
}

// ───────── картинки ─────────

interface Prepared {
  file: string;
  w: number;
  h: number;
  /** Точка интереса (герой) в пикселях исходника. */
  focus: { x: number; y: number };
  sprite?: { file: string; x: number; y: number; w: number; h: number };
  clip?: string;
}

async function raster(img: { data: Buffer; contentType: string }, height: number) {
  const svg = img.contentType.includes("svg");
  const s = svg ? sharp(img.data, { density: Math.ceil((72 * height) / 1024) + 4 }) : sharp(img.data);
  return s.resize({ height, fit: "inside" }).flatten({ background: "#ffffff" }).removeAlpha();
}

async function prepareScene(sc: CartoonSceneInput, i: number, dir: string): Promise<Prepared> {
  const file = join(dir, `scene-${i}.png`);
  if (sc.clip) {
    const clip = join(dir, `clip-${i}.mp4`);
    await writeFile(clip, sc.clip);
    return { file: clip, w: SIZE, h: SIZE, focus: { x: SIZE / 2, y: SIZE / 2 }, clip };
  }
  if (sc.kind === "end") {
    // Финал: обложка, размытая и чуть затемнённая, — фон для «Конец» и посвящения
    const base = await raster(sc.image, SRC_H);
    const { data, info } = await base.resize(SRC_H, SRC_H, { fit: "cover" }).blur(18).modulate({ brightness: 0.72, saturation: 0.9 }).png().toBuffer({ resolveWithObject: true });
    await writeFile(file, data);
    return { file, w: info.width, h: info.height, focus: { x: info.width / 2, y: info.height / 2 } };
  }
  if (sc.layers) {
    const meta = { contentType: "image/svg+xml" };
    const bg = await (await raster({ data: sc.layers.background, ...meta }, SRC_H)).png().toBuffer({ resolveWithObject: true });
    const W = bg.info.width;
    const H = bg.info.height;
    await writeFile(file, bg.data);
    const full = await (await raster({ data: sc.layers.full, ...meta }, SRC_H)).resize(W, H).raw().toBuffer();
    const mask = await sharp(sc.layers.mask, { density: Math.ceil((72 * SRC_H) / 1024) + 4 }).resize(W, H).greyscale().raw().toBuffer();
    // Рамка героев по маске (+ запас на покачивание)
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (mask[y * W + x] > 10) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 > x0 && y1 > y0) {
      const pad = 28;
      x0 = Math.max(0, x0 - pad);
      y0 = Math.max(0, y0 - pad);
      x1 = Math.min(W - 1, x1 + pad);
      y1 = Math.min(H - 1, y1 + pad);
      const sw = x1 - x0 + 1;
      const sh = y1 - y0 + 1;
      const rgba = Buffer.alloc(sw * sh * 4);
      for (let y = 0; y < sh; y++)
        for (let x = 0; x < sw; x++) {
          const si = (y0 + y) * W + (x0 + x);
          const o = (y * sw + x) * 4;
          rgba[o] = full[si * 3];
          rgba[o + 1] = full[si * 3 + 1];
          rgba[o + 2] = full[si * 3 + 2];
          rgba[o + 3] = mask[si];
        }
      const sp = join(dir, `sprite-${i}.png`);
      await sharp(rgba, { raw: { width: sw, height: sh, channels: 4 } }).png().toFile(sp);
      return { file, w: W, h: H, focus: { x: x0 + sw / 2, y: y0 + sh * 0.42 }, sprite: { file: sp, x: x0, y: y0, w: sw, h: sh } };
    }
    return { file, w: W, h: H, focus: { x: W / 2, y: H / 2 } };
  }
  const img = await raster(sc.image, SRC_H);
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  await writeFile(file, data);
  return { file, w: info.width, h: info.height, focus: await attention(data, info.width, info.height) };
}

/** Точка интереса картинки без слоёв: «внимание» sharp (энтропия, лица, насыщенность) на квадратном кадре. */
async function attention(png: Buffer, w: number, h: number) {
  try {
    if (w <= h) return { x: w / 2, y: h / 2 };
    const r = await sharp(png).resize(h, h, { fit: "cover", position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true });
    const info = r.info as unknown as { cropOffsetLeft?: number; attentionX?: number; attentionY?: number };
    const x = info.attentionX ?? (info.cropOffsetLeft != null ? -info.cropOffsetLeft + h / 2 : w / 2);
    return { x: Math.max(h / 2, Math.min(w - h / 2, Math.abs(x))), y: info.attentionY ?? h / 2 };
  } catch {
    return { x: w / 2, y: h / 2 };
  }
}

// ───────── камера и движение ─────────

export interface CameraPlan {
  z0: number;
  z1: number;
  cx0: number;
  cx1: number;
  cy0: number;
  cy1: number;
  /** Движение героя (слой): дыхание, шаги, покачивание. */
  hero: "breathe" | "walk" | "sway";
  /** «Дыхание» камеры для картинок без слоёв. */
  breathe: boolean;
}

/**
 * План камеры по композиции: где герои (рамка слоя или точка «внимания») и какой это кадр.
 * Любое движение держит рамку героев целиком в кадре (с полем), иначе панорама «режет» героя у края.
 */
export function planCamera(
  kind: CueKind,
  i: number,
  w: number,
  h: number,
  focus: { x: number; y: number },
  layered: boolean,
  box?: { x0: number; x1: number; y0: number; y1: number },
): CameraPlan {
  const b = box ?? { x0: focus.x - h * 0.2, x1: focus.x + h * 0.2, y0: focus.y - h * 0.25, y1: focus.y + h * 0.3 };
  const margin = 36;
  const fitX = (cx: number, z: number) => {
    const hw = h / z / 2;
    let lo = Math.max(hw, b.x1 - hw + margin);
    let hi = Math.min(w - hw, b.x0 + hw - margin);
    if (lo > hi) lo = hi = Math.max(hw, Math.min(w - hw, (b.x0 + b.x1) / 2)); // герои шире окна — по центру группы
    return Math.max(lo, Math.min(hi, cx));
  };
  const fitY = (cy: number, z: number) => {
    const hh = h / z / 2;
    let lo = Math.max(hh, b.y1 - hh + margin * 0.5);
    let hi = Math.min(h - hh, b.y0 + hh - margin * 0.5);
    if (lo > hi) lo = hi = Math.max(hh, Math.min(h - hh, (b.y0 + b.y1) / 2));
    // По возможности ноги героев — выше полосы субтитров (нижние 16% кадра)
    const subLo = b.y1 - 0.68 * hh;
    if (subLo > lo && subLo <= Math.min(hi, h - hh)) lo = subLo;
    return Math.max(lo, Math.min(hi, cy));
  };
  const mk = (z0: number, z1: number, cx0: number, cx1: number, cy0: number, cy1: number, hero: CameraPlan["hero"]): CameraPlan => {
    // Наезд не крупнее, чем помещается группа героев
    const maxZ = Math.max(1, Math.min(1.18, h / Math.max(1, b.y1 - b.y0 + margin * 1.5), w / Math.max(1, b.x1 - b.x0 + margin * 2)));
    const za = Math.min(z0, maxZ);
    const zb = Math.min(z1, maxZ);
    return { z0: za, z1: zb, cx0: fitX(cx0, za), cx1: fitX(cx1, zb), cy0: fitY(cy0, za), cy1: fitY(cy1, zb), hero, breathe: !layered };
  };
  const cx = (b.x0 + b.x1) / 2;
  if (kind === "title") return mk(1.0, 1.08, w / 2, cx, h / 2, h * 0.52, "breathe");
  if (kind === "end") return mk(1.12, 1.0, w / 2, w / 2, h / 2, h / 2, "breathe");
  const heroRight = cx > w / 2;
  switch (i % 3) {
    case 1:
      // Панорама со стороны пейзажа к героям, слегка приближаясь; герои «идут» навстречу
      return mk(1.04, 1.1, heroRight ? 0 : w, cx, h / 2, focus.y, "walk");
    case 2:
      // Наезд на героев
      return mk(1.0, 1.15, (w / 2 + cx) / 2, cx, h / 2, focus.y, "sway");
    default:
      // Отъезд от героев с лёгким дрейфом к пейзажу
      return mk(1.14, 1.02, cx, heroRight ? 0 : w, focus.y, h / 2, "breathe");
  }
}

const n3 = (x: number) => (Math.round(x * 1000) / 1000).toString();

/** Плавность: смесь линейной и smoothstep — без рывков в начале и без полной остановки на переходе. */
const ease = (D: number) => `(0.35*clip(t/${n3(D)},0,1)+0.65*(pow(clip(t/${n3(D)},0,1),2)*(3-2*clip(t/${n3(D)},0,1))))`;

/**
 * Граф одной сцены: картинка (кэш одного кадра) → обрезка по ходу камеры → герой-слой с движением →
 * масштаб/кадр камеры (эвал на каждый кадр, субпиксельный масштаб, сдвиг — по пикселю выхода) → частицы.
 */
export function sceneFilter(p: Prepared, plan: CameraPlan, dur: number, inputs: { v: string; sprite: string | null; particles: string | null }): string {
  const frames = Math.round(dur * FPS);
  const e = ease(dur);
  const lerp = (a: number, b: number) => `(${n3(a)}+(${n3(b - a)})*${e})`;
  const breathe = plan.breathe ? `*(1+0.006*sin(2*PI*t/5.5))` : "";
  const z = `(${lerp(plan.z0, plan.z1)}${breathe})`;
  // Статическая обрезка по ходу камеры — меньше пикселей на кадр для наложения и масштаба
  const half0 = p.h / Math.min(plan.z0, plan.z1) / 2;
  const rx0 = Math.max(0, Math.floor(Math.min(plan.cx0, plan.cx1) - half0 - 8));
  const rx1 = Math.min(p.w, Math.ceil(Math.max(plan.cx0, plan.cx1) + half0 + 8));
  const rw = rx1 - rx0;
  const S = `(${SIZE}*${z}/${p.h})`;
  const chain: string[] = [];
  const loop = (label: string) => `[${label}]loop=loop=${frames - 1}:size=1:start=0,setpts=N/${FPS}/TB`;
  chain.push(`${loop(inputs.v)},crop=${rw}:${p.h}:${rx0}:0[base]`);
  let base = "base";
  if (inputs.sprite && p.sprite) {
    const s = p.sprite;
    let spr = "spr";
    chain.push(`${loop(inputs.sprite)}[spr]`);
    let x = `${s.x - rx0}`;
    let y = `${s.y}`;
    if (plan.hero === "breathe") y = `${s.y}-7*(0.5-0.5*cos(2*PI*t/2.8))`;
    if (plan.hero === "walk") {
      const dir = plan.cx1 >= plan.cx0 ? 1 : -1;
      x = `${s.x - rx0}+${dir * 46}*${e}`;
      y = `${s.y}-6*abs(sin(PI*t/0.95))`;
    }
    if (plan.hero === "sway") {
      chain.push(`[spr]format=rgba,rotate=a='0.022*sin(2*PI*t/3.4)':c=none:ow=iw:oh=ih[sprr]`);
      spr = "sprr";
      y = `${s.y}-4*(0.5-0.5*cos(2*PI*t/3.4))`;
    }
    chain.push(`[base][${spr}]overlay=x='${x}':y='${y}':eval=frame:format=rgb[ov]`);
    base = "ov";
  }
  chain.push(
    `[${base}]scale=w='trunc(${rw}*${S})':h='trunc(${p.h}*${S})':eval=frame:flags=bilinear,` +
      `crop=${SIZE}:${SIZE}:x='clip((${lerp(plan.cx0, plan.cx1)}-${rx0})*in_w/${rw}-${SIZE / 2},0,in_w-${SIZE})':y='clip(${lerp(plan.cy0, plan.cy1)}*in_h/${p.h}-${SIZE / 2},0,in_h-${SIZE})',` +
      `setsar=1,format=yuv420p[cam]`,
  );
  if (inputs.particles) {
    chain.push(`[${inputs.particles}]scale=${SIZE}:${SIZE}:flags=bilinear,format=rgba[pt]`);
    chain.push(`[cam][pt]overlay=0:0:shortest=1:format=yuv420,format=yuv420p[out]`);
  } else chain.push(`[cam]null[out]`);
  return chain.join(";");
}

// ───────── частицы и виньетка ─────────

const LOOP_SEC = 6;
const P_SIZE = 540;

/** Кадры частиц (540×540 RGBA, петля 6 с) с виньеткой; масштабируются до 1080 при наложении. */
export async function particleFrames(kind: Particles, dir: string): Promise<string> {
  const N = LOOP_SEC * FPS;
  const W = P_SIZE;
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  type P = { x: number; y: number; r: number; a: number; k: number; m: number; ph: number; amp: number; col: [number, number, number]; m2: number; ph2: number };
  const count = { snow: 80, fireflies: 22, sparkles: 30, dust: 28, none: 0 }[kind];
  const col: Record<Particles, [number, number, number]> = { snow: [255, 255, 255], fireflies: [255, 228, 140], sparkles: [255, 236, 170], dust: [255, 246, 225], none: [0, 0, 0] };
  const ps: P[] = Array.from({ length: count }, () => ({
    x: rnd() * W,
    y: rnd() * W,
    r: kind === "snow" ? 1.4 + rnd() * 3.2 : kind === "fireflies" ? 1.8 + rnd() * 1.8 : kind === "sparkles" ? 1.2 + rnd() * 2 : 0.9 + rnd() * 1.3,
    a: kind === "dust" ? 0.25 + rnd() * 0.25 : 0.55 + rnd() * 0.4,
    k: kind === "snow" ? 1 + Math.floor(rnd() * 2) : 1,
    m: 1 + Math.floor(rnd() * 2),
    ph: rnd() * Math.PI * 2,
    amp: kind === "snow" ? 6 + rnd() * 14 : 10 + rnd() * 25,
    col: kind === "sparkles" && rnd() < 0.4 ? [255, 255, 255] : col[kind],
    m2: 1 + Math.floor(rnd() * 3),
    ph2: rnd() * Math.PI * 2,
  }));
  // Виньетка: мягкое затемнение углов
  const vig = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2);
    const dy = (y - W / 2) / (W / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    vig[y * W + x] = Math.max(0, Math.min(1, (d - 0.72) / 0.7)) ** 1.6 * 0.32;
  }
  const pattern = join(dir, "p%03d.png");
  for (let f = 0; f < N; f++) {
    const t = f / N; // 0..1 по петле
    const buf = Buffer.alloc(W * W * 4);
    for (let i = 0; i < W * W; i++) buf[i * 4 + 3] = Math.round(vig[i] * 255);
    for (const p of ps) {
      let x = p.x;
      let y = p.y;
      let a = p.a;
      if (kind === "snow") {
        y = (p.y + p.k * W * t) % W;
        x = p.x + p.amp * Math.sin(2 * Math.PI * p.m * t + p.ph);
      } else if (kind === "fireflies") {
        x = p.x + p.amp * Math.sin(2 * Math.PI * p.m * t + p.ph);
        y = p.y + p.amp * 0.7 * Math.sin(2 * Math.PI * p.m2 * t + p.ph2);
        a *= 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (p.m2 + 1) * t + p.ph));
      } else if (kind === "sparkles") {
        y = (p.y - W * t + W) % W;
        x = p.x + 6 * Math.sin(2 * Math.PI * p.m * t + p.ph);
        a *= Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * (p.m2 + 1) * t + p.ph2), 3);
      } else {
        y = (p.y - W * t * 0.5 + W) % W;
        x = p.x + p.amp * 0.5 * Math.sin(2 * Math.PI * p.m * t + p.ph);
      }
      x = ((x % W) + W) % W;
      const glow = kind === "fireflies" ? 4 : kind === "sparkles" ? 2.5 : 1.6;
      const R = p.r * glow;
      for (let yy = Math.max(0, Math.floor(y - R)); yy <= Math.min(W - 1, Math.ceil(y + R)); yy++)
        for (let xx = Math.max(0, Math.floor(x - R)); xx <= Math.min(W - 1, Math.ceil(x + R)); xx++) {
          const d = Math.hypot(xx - x, yy - y);
          const core = Math.max(0, 1 - (d / p.r) ** 2);
          const halo = Math.max(0, 1 - d / R) ** 2 * 0.35;
          const al = Math.min(1, a * Math.max(core, halo));
          if (al <= 0.004) continue;
          const o = (yy * W + xx) * 4;
          const ba = buf[o + 3] / 255;
          const outA = al + ba * (1 - al);
          for (let c = 0; c < 3; c++) buf[o + c] = Math.round((p.col[c] * al + buf[o + c] * ba * (1 - al)) / outA);
          buf[o + 3] = Math.round(outA * 255);
        }
    }
    await sharp(buf, { raw: { width: W, height: W, channels: 4 } }).png({ compressionLevel: 3 }).toFile(join(dir, `p${String(f).padStart(3, "0")}.png`));
  }
  return pattern;
}

// ───────── субтитры и карточки (ASS) ─────────

const assTime = (s: number) => {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
};
const assText = (s: string) => s.replace(/[{}]/g, "").replace(/\\/g, "").replace(/\n/g, "\\N");

/** Перенос по словам: строки не длиннее max символов. */
export function wrapLines(t: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of t.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out;
}

export function buildAss(o: { title: string; dedication: string; cues: Cue[]; tl: Timeline; subtitles: boolean; brand: string; xfade: number }): string {
  const ev: string[] = [];
  const add = (start: number, end: number, style: string, text: string) => ev.push(`Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${text}`);
  const s0 = o.tl.scenes[0];
  const last = o.tl.scenes[o.tl.scenes.length - 1];
  // Заставка: название в мягкой подложке
  const tl = wrapLines(o.title, 22).slice(0, 3);
  const tEnd = s0.start + s0.dur - o.xfade * 0.6;
  const bandH = 70 + tl.length * 96;
  add(0.2, tEnd, "Band", `{\\fad(500,500)\\an7\\pos(0,${150 - bandH / 2 + 30})\\blur34\\p1}m 60 0 l 1020 0 1020 ${bandH} 60 ${bandH}{\\p0}`);
  add(0.45, tEnd, "Title", `{\\fad(700,500)\\move(540,196,540,180,0,1400)}${assText(tl.join("\n"))}`);
  // Субтитры разворотов
  if (o.subtitles) {
    o.cues.forEach((c, i) => {
      if (c.kind !== "spread") return;
      const sc = o.tl.scenes[i];
      const next = o.tl.scenes[i + 1];
      const limit = next ? next.start + 0.15 : sc.start + sc.dur;
      const chunks = subtitleChunks(c.text, sc.voiceSec);
      chunks.forEach((ch, k) => {
        const from = sc.voiceAt + ch.from - 0.05;
        // Следующий кусок не должен пересекаться с этим — иначе libass поднимет строку над предыдущей
        const nextFrom = k + 1 < chunks.length ? sc.voiceAt + chunks[k + 1].from - 0.07 : limit;
        const to = Math.min(nextFrom, sc.voiceAt + ch.to + 0.35);
        add(from, to, "Sub", `{\\fad(160,120)}${assText(ch.text)}`);
      });
    });
  }
  // Финал: «Конец», посвящение, подпись
  const e0 = last.start + o.xfade * 0.6;
  const e1 = last.start + last.dur;
  add(e0, e1, "End", `{\\fad(800,700)\\move(540,${o.dedication ? 360 : 470},540,${o.dedication ? 340 : 450},0,1500)}Конец`);
  if (o.dedication) {
    const lines = wrapLines(o.dedication, 30).slice(0, 6);
    add(e0 + 0.6, e1, "Ded", `{\\fad(900,700)\\pos(540,${470 + lines.length * 28})}${assText(lines.join("\n"))}`);
  }
  add(e0 + 1, e1, "Small", `{\\fad(900,700)}${assText(o.brand)}`);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${SIZE}
PlayResY: ${SIZE}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Nunito,50,&H00FFFFFF,&H00FFFFFF,&H00301E14,&H96000000,-1,0,0,0,100,100,0,0,1,3.4,1.6,2,96,96,74,204
Style: Title,Nunito ExtraBold,82,&H00FFFFFF,&H00FFFFFF,&H00303B1E,&H78000000,0,0,0,0,100,100,0.5,0,1,5,2,8,60,60,0,204
Style: Band,Nunito,20,&H8C1E2A14,&H00FFFFFF,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,204
Style: End,Nunito ExtraBold,128,&H00F4FBFF,&H00FFFFFF,&H00303B1E,&H78000000,0,0,0,0,100,100,1,0,1,5,2,5,60,60,0,204
Style: Ded,Nunito,50,&H00FFFFFF,&H00FFFFFF,&H00301E14,&H96000000,-1,0,0,0,100,100,0,0,1,3,1.5,5,90,90,0,204
Style: Small,Nunito,30,&H30FFFFFF,&H00FFFFFF,&H00301E14,&HB4000000,-1,0,0,0,100,100,0.5,0,1,2,0,2,60,60,56,204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join("\n")}
`;
}

// ───────── звук ─────────

async function buildAudio(dir: string, voiceFiles: string[], tl: Timeline, inp: RenderInput): Promise<{ file: string; loud: { I: number; TP: number } }> {
  const total = tl.total;
  const clips = await Promise.all(voiceFiles.map(async (f, i) => ({ at: tl.scenes[i].voiceAt, pcm: await decodeMono(f) })));
  await writeFile(join(dir, "narration.wav"), wav(placeClips(total, clips), AUDIO_RATE, 1));
  // Шелест — у каждого перехода (сцена i начинается переходом)
  // Музыка и шелест — 24 кГц (мягкий синтез выше 12 кГц не звучит), вдвое меньше памяти; ffmpeg пересчитает в 48 кГц
  const SYN = 24000;
  await writeFile(join(dir, "sfx.wav"), wav(sfxTrack(total, tl.scenes.slice(1).map((s) => s.start - 0.12), SYN), SYN, 2));
  const musicIn = join(dir, "music-in");
  const vol = inp.musicVolume ?? 1;
  let musicArgs: string[];
  if (inp.music?.length) {
    await writeFile(musicIn, inp.music);
    // Трек владельца: по кругу на всю длину, громкость ~ как у синтеза, затухание в конце
    musicArgs = ["-stream_loop", "-1", "-i", musicIn];
  } else {
    await writeFile(join(dir, "music.wav"), wav(ambientBed(total, inp.particles === "none" ? "dust" : inp.particles, SYN), SYN, 2));
    musicArgs = ["-i", join(dir, "music.wav")];
  }
  const musicPre = inp.music?.length ? `volume=${n3(0.12 * vol)},afade=t=out:st=${n3(Math.max(0, total - 3))}:d=3,` : `volume=${n3(vol)},`;
  const graph =
    `[0:a]aformat=sample_rates=${AUDIO_RATE}:channel_layouts=stereo,asplit=2[nv][nsc];` +
    `[1:a]atrim=0:${n3(total)},${musicPre}aformat=sample_rates=${AUDIO_RATE}:channel_layouts=stereo[m];` +
    `[m][nsc]sidechaincompress=threshold=0.012:ratio=6:attack=60:release=700:makeup=1[md];` +
    `[2:a]aformat=sample_rates=${AUDIO_RATE}:channel_layouts=stereo,volume=0.55[fx];` +
    `[nv][md][fx]amix=inputs=3:normalize=0:duration=first[mix]`;
  const mix = join(dir, "mix.wav");
  await ff(["-v", "error", "-i", join(dir, "narration.wav"), ...musicArgs, "-i", join(dir, "sfx.wav"), "-filter_complex", graph, "-map", "[mix]", "-t", n3(total), "-c:a", "pcm_s16le", "-y", mix]);
  // Громкость: два прохода loudnorm (линейно, без «качания»)
  const m = await measureLoudness(mix);
  const final = join(dir, "audio.wav");
  await ff(["-v", "error", "-i", mix, "-af", `${loudnormPass2(m)},aresample=${AUDIO_RATE}`, "-c:a", "pcm_s16le", "-y", final]);
  const after = await measureLoudness(final);
  return { file: final, loud: { I: after.I, TP: after.TP } };
}

// ───────── сборка ─────────

const TRANSITION: Record<string, string> = { first: "fadewhite", last: "fadewhite", middle: "fadewhite", default: "fade" };

export async function renderCartoon(inp: RenderInput): Promise<RenderOutput> {
  const t0 = Date.now();
  // Память воркера ограничена: без кэша sharp и по одному потоку libvips
  sharp.cache(false);
  sharp.concurrency(1);
  const timing = inp.timing ?? CARTOON_TIMING;
  const dir = inp.workDir;
  await mkdir(dir, { recursive: true });
  const pdir = join(dir, "particles");
  await mkdir(pdir, { recursive: true });
  inp.onProgress?.(2);

  // Голос: в WAV 48 кГц и длительности (ffprobe)
  const voiceFiles: string[] = [];
  const durations: number[] = [];
  for (let i = 0; i < inp.cues.length; i++) {
    const src = join(dir, `voice-src-${i}`);
    const out = join(dir, `voice-${i}.wav`);
    await writeFile(src, inp.voice[i]);
    await ff(["-v", "error", "-i", src, "-ac", "1", "-ar", String(AUDIO_RATE), "-c:a", "pcm_s16le", "-y", out]);
    voiceFiles.push(out);
    durations.push((await probe(out)).duration);
  }
  const tl = cartoonTimeline(durations, inp.cues.map((c) => c.kind), timing);
  inp.onProgress?.(6);

  // По очереди, а не разом: 14 растров 2560×1280 одновременно — это сотни мегабайт в памяти воркера
  const audio = await buildAudio(dir, voiceFiles, tl, inp);
  const prepared: Prepared[] = [];
  for (let i = 0; i < inp.scenes.length; i++) {
    prepared.push(await prepareScene(inp.scenes[i], i, dir));
    inp.scenes[i] = { ...inp.scenes[i], image: { data: Buffer.alloc(0), contentType: inp.scenes[i].image.contentType }, layers: undefined, clip: undefined };
  }
  const particles = inp.particles === "none" ? null : await particleFrames(inp.particles, pdir);
  const ass = join(dir, "subs.ass");
  await writeFile(ass, buildAss({ title: inp.title, dedication: inp.dedication, cues: inp.cues, tl, subtitles: inp.subtitles, brand: inp.brand ?? "Сделано с любовью в БУКИМИ", xfade: timing.xfade }));
  inp.onProgress?.(14);

  // Этап 1: сцены — отдельными короткими роликами, по ядру на сцену (память на процесс ограничена одной сценой)
  const sceneFiles: string[] = prepared.map((_, i) => join(dir, `scene-${String(i).padStart(2, "0")}.mp4`));
  let done = 0;
  const jobs = prepared.map((p, i) => async () => {
    const sc = tl.scenes[i];
    const frames = Math.round(sc.dur * FPS);
    const args = ["-hide_banner", "-v", "error", "-nostats", "-filter_threads", "1"];
    let graph: string;
    if (p.clip) {
      args.push("-stream_loop", "-1", "-t", n3(sc.dur), "-i", p.clip);
      graph = `[0:v]fps=${FPS},scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase,crop=${SIZE}:${SIZE},setsar=1,format=yuv420p[out]`;
    } else {
      args.push("-i", p.file);
      let k = 1;
      let sprite: string | null = null;
      if (p.sprite) {
        args.push("-i", p.sprite.file);
        sprite = `${k++}:v`;
      }
      let pt: string | null = null;
      if (particles) {
        // Частицы непрерывны через переходы: кадр петли = общее время сцены
        const off = (sc.start % LOOP_SEC).toFixed(2);
        args.push("-framerate", String(FPS), "-stream_loop", "-1", "-ss", off, "-i", particles);
        pt = `${k++}:v`;
      }
      const box = p.sprite ? { x0: p.sprite.x, x1: p.sprite.x + p.sprite.w, y0: p.sprite.y + 20, y1: p.sprite.y + p.sprite.h - 20 } : undefined;
      const plan = planCamera(inp.cues[i].kind, inp.cues[i].page, p.w, p.h, p.focus, Boolean(p.sprite), box);
      graph = sceneFilter(p, plan, sc.dur, { v: "0:v", sprite, particles: pt });
    }
    args.push("-filter_complex", graph, "-map", "[out]", "-frames:v", String(frames), "-r", String(FPS), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-threads", "1", "-pix_fmt", "yuv420p", "-y", sceneFiles[i]);
    await ff(args);
    done++;
    inp.onProgress?.(14 + Math.round((done / prepared.length) * 36));
  });
  await pool(jobs, Math.max(1, Number(process.env.CARTOON_JOBS ?? Math.min(2, cpus().length))));

  // Этап 2: переходы (наплыв, через белое) → титры → кодирование; вертикаль — тот же кадр на размытом фоне
  const args: string[] = ["-hide_banner", "-v", "error", "-nostats", "-progress", "pipe:1"];
  const parts: string[] = [];
  sceneFiles.forEach((f) => args.push("-threads", "1", "-i", f));
  let cur = "0:v";
  const n = sceneFiles.length;
  for (let i = 1; i < n; i++) {
    const kind = i === 1 ? "first" : i === n - 1 ? "last" : i === Math.ceil(n / 2) ? "middle" : "default";
    const o = `x${i}`;
    parts.push(`[${cur}][${i}:v]xfade=transition=${TRANSITION[kind]}:duration=${timing.xfade}:offset=${n3(tl.scenes[i].start)}[${o}]`);
    cur = o;
  }
  const fontsDir = FONTS_DIR().replace(/([:\\'])/g, "\\$1");
  parts.push(`[${cur}]ass=filename='${ass.replace(/([:\\'])/g, "\\$1")}':fontsdir='${fontsDir}',format=yuv420p,trim=duration=${n3(tl.total)}[vq]`);
  args.push("-i", audio.file);
  const aIn = `${n}:a`;
  const square = join(dir, "cartoon-1080.mp4");
  const vH = inp.verticalHeight ?? 1920;
  const vW = Math.round((vH * 9) / 16 / 2) * 2;
  const vertical = inp.vertical ? join(dir, `cartoon-${vW}x${vH}.mp4`) : null;
  const enc = ["-c:v", "libx264", "-preset", "veryfast", "-tune", "animation", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-g", String(FPS * 2), "-r", String(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", String(AUDIO_RATE), "-movflags", "+faststart"];
  if (vertical) {
    parts.push(`[vq]split=3[vsq][va][vb]`);
    // 9:16: квадрат по центру, сверху и снизу — тот же кадр, размытый (размываем в малом размере — дёшево)
    const sq = vW;
    parts.push(`[va]crop=608:1080:236:0,scale=152:270,boxblur=6:2,scale=${vW}:${vH}:flags=bilinear,eq=brightness=-0.07:saturation=0.9[vbg]`);
    parts.push(`[vb]scale=${sq}:${sq}:flags=bicubic[vsm]`);
    parts.push(`[vbg][vsm]overlay=0:${Math.round((vH - sq) / 2)},format=yuv420p[vv]`);
  }
  args.push("-filter_complex", parts.join(";"));
  args.push("-map", vertical ? "[vsq]" : "[vq]", "-map", aIn, ...enc, "-t", n3(tl.total), "-metadata", `title=${inp.title}`, "-metadata", "comment=bookimi.ru", "-y", square);
  if (vertical) args.push("-map", "[vv]", "-map", aIn, ...enc, "-t", n3(tl.total), "-metadata", `title=${inp.title}`, "-y", vertical);

  if (process.env.CARTOON_DEBUG) await writeFile(join(dir, "ffmpeg-args.json"), JSON.stringify(args));
  await ff(args, {
    onLine: (l) => {
      const m = l.match(/^out_time_us=(\d+)/);
      if (m) inp.onProgress?.(Math.min(97, 50 + Math.round((Number(m[1]) / 1e6 / tl.total) * 47)));
    },
  });
  const poster = join(dir, "poster.jpg");
  await ff(["-v", "error", "-ss", n3(Math.min(2.6, tl.scenes[0].dur - 1)), "-i", square, "-frames:v", "1", "-q:v", "3", "-y", poster]);
  inp.onProgress?.(100);
  return { square, vertical, poster, durationSec: (await probe(square)).duration, renderSec: (Date.now() - t0) / 1000, timeline: tl, loudness: audio.loud };
}

/** Параллельно не больше limit задач. */
async function pool(jobs: (() => Promise<void>)[], limit: number) {
  let next = 0;
  const run = async () => {
    while (next < jobs.length) await jobs[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, run));
}

/** Файл → Buffer (для сохранения в хранилище). */
export const readOut = (f: string) => readFile(f);
