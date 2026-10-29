// Озвучка мультфильма: проверка файлов покупателя (по сигнатуре, не по расширению), очистка записи
// (срез низа, мягкое шумоподавление, обрезка тишины и длинных пауз), выравнивание громкости всех реплик
// к −16 LUFS (loudnorm в два прохода, общий замер — реплики звучат ровно), уровни для предупреждений,
// разрезание одной загруженной записи на реплики по паузам. Голос не уходит третьим лицам, клонирования нет.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ff, loudnormPass2, measureLoudness, probe } from "./cartoon-render";
import { splitBySilences } from "./cartoon-script";

export { VOICE_LIMITS, sniffAudio, checkVoiceMeta, type AudioSniff } from "../cartoon-guide";
import { checkVoiceMeta, sniffAudio } from "../cartoon-guide";

export interface Levels {
  peakDb: number;
  rmsDb: number;
  warnings: ("clipping" | "quiet")[];
}

/** Пик и средний уровень: предупредить о перегрузе (≥ −0,3 dBFS) и о слишком тихой записи (RMS < −38 dBFS). */
export async function levels(file: string): Promise<Levels> {
  const { stderr } = await ff(["-hide_banner", "-nostats", "-i", file, "-af", "astats=measure_overall=Peak_level+RMS_level+Number_of_samples:measure_perchannel=none", "-f", "null", "-"]);
  const peak = Number(stderr.match(/Peak level dB:\s*(-?[\d.]+|-inf)/)?.[1] ?? -90);
  const rms = Number(stderr.match(/RMS level dB:\s*(-?[\d.]+|-inf)/)?.[1] ?? -90);
  const warnings: Levels["warnings"] = [];
  if (Number.isFinite(peak) && peak >= -0.3) warnings.push("clipping");
  if (!Number.isFinite(rms) || rms < -38) warnings.push("quiet");
  return { peakDb: Number.isFinite(peak) ? peak : -90, rmsDb: Number.isFinite(rms) ? rms : -90, warnings };
}

/** Проверить загруженный файл: сигнатура, размер, частота, каналы, длительность. */
export async function validateVoiceFile(buf: Buffer, dir: string, name: string) {
  const s = sniffAudio(buf);
  if (!s.ok) return { ok: false as const, error: s.error };
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${name}.${s.ext}`);
  await writeFile(file, buf);
  const meta = await probe(file).catch(() => null);
  if (!meta) return { ok: false as const, error: "Не получилось прочитать запись — попробуйте другой файл или запишите в браузере" };
  const bad = checkVoiceMeta(meta);
  if (bad) return { ok: false as const, error: bad };
  return { ok: true as const, file, format: s.format, meta };
}

/** Цепочка очистки записи покупателя (без выравнивания громкости). */
export const CLEAN_FILTER =
  "highpass=f=80,lowpass=f=12000,afftdn=nr=12:nf=-42:tn=1," +
  "silenceremove=start_periods=1:start_threshold=-44dB:start_silence=0.12:stop_periods=-1:stop_duration=0.8:stop_threshold=-44dB:stop_silence=0.4";
/** Для синтеза (SpeechKit, демо) — только обрезка тишины по краям. */
export const TTS_FILTER = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05:stop_periods=-1:stop_duration=1.2:stop_threshold=-50dB:stop_silence=0.5";

/**
 * Подготовить реплики: очистка → общий замер громкости (первый проход по всем репликам подряд) →
 * линейное приведение каждой реплики к −16 LUFS по общему замеру (второй проход). WAV 48 кГц моно.
 */
export async function prepareCues(files: string[], dir: string, opts: { own: boolean }): Promise<{ files: string[]; durations: number[]; loudness: number }> {
  await mkdir(dir, { recursive: true });
  const clean: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const out = join(dir, `clean-${String(i).padStart(2, "0")}.wav`);
    await ff(["-v", "error", "-i", files[i], "-af", `${opts.own ? CLEAN_FILTER : TTS_FILTER},aresample=48000`, "-ac", "1", "-c:a", "pcm_s16le", "-y", out]);
    clean.push(out);
  }
  // Общий замер: склеиваем все реплики (concat filter) и меряем
  const all = join(dir, "all.wav");
  const inputs = clean.flatMap((f) => ["-i", f]);
  await ff(["-v", "error", ...inputs, "-filter_complex", `${clean.map((_, i) => `[${i}:a]`).join("")}concat=n=${clean.length}:v=0:a=1[a]`, "-map", "[a]", "-c:a", "pcm_s16le", "-y", all]);
  const m = await measureLoudness(all);
  const out: string[] = [];
  const durations: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const f = join(dir, `cue-${String(i).padStart(2, "0")}.wav`);
    await ff(["-v", "error", "-i", clean[i], "-af", `${loudnormPass2(m)},aresample=48000`, "-ac", "1", "-c:a", "pcm_s16le", "-y", f]);
    out.push(f);
    durations.push((await probe(f)).duration);
  }
  return { files: out, durations, loudness: m.I };
}

/** Найти паузы (silencedetect) — для разрезания одной записи на реплики. */
export async function silences(file: string, minSec = 0.45, db = -38): Promise<[number, number][]> {
  const { stderr } = await ff(["-hide_banner", "-nostats", "-i", file, "-af", `highpass=f=80,afftdn=nr=10,silencedetect=n=${db}dB:d=${minSec}`, "-f", "null", "-"]);
  const out: [number, number][] = [];
  let start: number | null = null;
  for (const l of stderr.split("\n")) {
    const s = l.match(/silence_start: (-?[\d.]+)/);
    const e = l.match(/silence_end: ([\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    if (e && start != null) {
      out.push([start, Number(e[1])]);
      start = null;
    }
  }
  return out;
}

/** Одна запись → файлы реплик по паузам (ожидаемые длительности — из сценария). */
export async function splitUpload(file: string, expectedSec: number[], dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const total = (await probe(file)).duration;
  const parts = splitBySilences(await silences(file), total, expectedSec);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const [a, b] = parts[i];
    const f = join(dir, `part-${String(i).padStart(2, "0")}.wav`);
    await ff(["-v", "error", "-ss", a.toFixed(3), "-to", Math.max(a + 0.2, b).toFixed(3), "-i", file, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", "-y", f]);
    out.push(f);
  }
  return out;
}
