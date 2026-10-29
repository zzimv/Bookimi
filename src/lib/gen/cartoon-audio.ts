// Звук мультфильма без чужих записей: мягкая фоновая музыка (пэд аккордами + «музыкальная шкатулка»),
// шелест перелистывания страницы и сборка дорожки озвучки по времени сцен. Всё синтезируется здесь (PCM в памяти).
// Свои треки владельца (лицензированные) — настройка cartoon.musicKey: файл в хранилище books/music/…

export const AUDIO_RATE = 48000;

/** WAV PCM 16 бит из float −1..1 (interleaved при channels = 2). */
export function wav(pcm: Float32Array, rate = AUDIO_RATE, channels = 1): Buffer {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2 * channels, 28);
  h.writeUInt16LE(2 * channels, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** s16le mono → float. */
export function fromS16(buf: Buffer): Float32Array {
  const out = new Float32Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

/** Дорожка озвучки: реплики на своих местах (секунды), тишина между ними. */
export function placeClips(totalSec: number, clips: { at: number; pcm: Float32Array }[], rate = AUDIO_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(totalSec * rate));
  for (const c of clips) {
    const o = Math.round(c.at * rate);
    for (let i = 0; i < c.pcm.length && o + i < out.length; i++) out[o + i] += c.pcm[i];
  }
  return out;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** Лад и аккорды по настроению частиц: зима — колыбельная до мажор, ночь — ля минор, праздник — фа мажор. */
const PROGRESSIONS: Record<string, { chords: number[][]; chordSec: number; boxEvery: number }> = {
  snow: { chords: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]], chordSec: 5.2, boxEvery: 0.65 },
  fireflies: { chords: [[45, 52, 60, 64], [41, 48, 57, 60], [48, 55, 64, 67], [43, 50, 55, 62]], chordSec: 6, boxEvery: 0.8 },
  sparkles: { chords: [[41, 48, 57, 64], [43, 50, 58, 65], [45, 52, 60, 64], [48, 55, 64, 67]], chordSec: 4.6, boxEvery: 0.55 },
  dust: { chords: [[48, 55, 62, 64], [45, 52, 59, 64], [41, 48, 55, 60], [43, 50, 57, 62]], chordSec: 5.6, boxEvery: 0.75 },
};

/**
 * Фоновая музыка: тёплый пэд (синусы с обертонами, медленная атака, лёгкая расстройка каналов) и редкие ноты
 * «шкатулки» из аккорда октавой выше. Стерео, громкость ~ −30 dBFS RMS (ниже голоса; дальше — приглушение под речь).
 */
export function ambientBed(sec: number, mood = "snow", rate = AUDIO_RATE): Float32Array {
  const p = PROGRESSIONS[mood] ?? PROGRESSIONS.dust;
  const n = Math.ceil(sec * rate);
  const out = new Float32Array(n * 2);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // Пэд: каждую ноту аккорда держим chordSec + перекрытие, огибающая — приподнятый косинус
  const fade = 1.6;
  for (let c = 0; c * p.chordSec < sec + p.chordSec; c++) {
    const chord = p.chords[c % p.chords.length];
    const t0 = c * p.chordSec - fade / 2;
    const len = p.chordSec + fade;
    const i0 = Math.max(0, Math.floor(t0 * rate));
    const i1 = Math.min(n, Math.ceil((t0 + len) * rate));
    for (const note of chord) {
      const f = midi(note);
      const ph = rnd() * Math.PI * 2;
      for (let i = i0; i < i1; i++) {
        const t = i / rate - t0;
        const env = t < fade ? 0.5 - 0.5 * Math.cos((Math.PI * t) / fade) : t > len - fade ? 0.5 + 0.5 * Math.cos((Math.PI * (t - (len - fade))) / fade) : 1;
        const lfo = 1 + 0.15 * Math.sin(2 * Math.PI * 0.11 * (i / rate) + note);
        const w = 2 * Math.PI * (i / rate);
        const l = Math.sin(w * f + ph) + 0.28 * Math.sin(w * 2 * f + ph) + 0.08 * Math.sin(w * 3 * f);
        const r = Math.sin(w * (f + 0.6) + ph) + 0.28 * Math.sin(w * 2 * (f + 0.6) + ph) + 0.08 * Math.sin(w * 3 * f);
        const a = 0.05 * env * lfo * (note < 50 ? 0.9 : 0.55);
        out[i * 2] += l * a;
        out[i * 2 + 1] += r * a;
      }
    }
  }
  // Шкатулка: ноты аккорда +2 октавы, не каждый такт, с затуханием и лёгким панорамированием
  for (let t = 1.2; t < sec - 1; t += p.boxEvery) {
    if (rnd() < 0.42) continue;
    const chord = p.chords[Math.floor(t / p.chordSec) % p.chords.length];
    const note = chord[1 + Math.floor(rnd() * (chord.length - 1))] + 24;
    const f = midi(note);
    const pan = 0.3 + rnd() * 0.4;
    const i0 = Math.floor(t * rate);
    const dur = Math.floor(1.6 * rate);
    for (let k = 0; k < dur && i0 + k < n; k++) {
      const tt = k / rate;
      const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 2.6);
      const s = (Math.sin(2 * Math.PI * f * tt) + 0.18 * Math.sin(2 * Math.PI * 4 * f * tt) * Math.exp(-tt * 6)) * env * 0.045;
      out[(i0 + k) * 2] += s * (1 - pan);
      out[(i0 + k) * 2 + 1] += s * pan;
    }
  }
  // Мягкий фильтр низких частот и затухание в начале/конце
  let l = 0;
  let r = 0;
  const k = 1 - Math.exp((-2 * Math.PI * 3500) / rate);
  for (let i = 0; i < n; i++) {
    l += (out[i * 2] - l) * k;
    r += (out[i * 2 + 1] - r) * k;
    const t = i / rate;
    const g = Math.min(1, t / 2, (sec - t) / 3);
    out[i * 2] = l * Math.max(0, g);
    out[i * 2 + 1] = r * Math.max(0, g);
  }
  return normalizeRms(out, 0.032);
}

/** Шелест перелистывания: шум через полосовой фильтр с «проходом» частоты, панорама слева направо. Стерео. */
export function pageWhoosh(rate = AUDIO_RATE, seedBase = 3): Float32Array {
  const dur = 0.75;
  const n = Math.floor(dur * rate);
  const out = new Float32Array(n * 2);
  let seed = seedBase;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const x = t / dur;
    const fc = 500 + 2400 * Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5;
    const bw = 900;
    const T = 1 / rate;
    const C = -Math.exp(-2 * Math.PI * bw * T);
    const B = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * fc * T);
    const y = (1 - Math.exp(-Math.PI * bw * T)) * (rnd() * 2 - 1) + B * y1 + C * y2;
    y2 = y1;
    y1 = y;
    // Огибающая: быстрый подъём, «хвост», и лёгкий щелчок бумаги в конце
    const env = Math.sin(Math.PI * Math.min(1, x)) ** 2 * (1 - 0.3 * x);
    const flap = x > 0.62 && x < 0.66 ? (rnd() * 2 - 1) * 0.25 * Math.sin(((x - 0.62) / 0.04) * Math.PI) : 0;
    const s = (y * 3 * env + flap) * 0.5;
    const pan = 0.2 + 0.6 * x;
    out[i * 2] = s * (1 - pan);
    out[i * 2 + 1] = s * pan;
  }
  return out;
}

/** Стерео-дорожка эффектов: шелест у каждого перехода. */
export function sfxTrack(totalSec: number, at: number[], rate = AUDIO_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(totalSec * rate) * 2);
  at.forEach((t, k) => {
    const w = pageWhoosh(rate, 3 + k * 17);
    const o = Math.round(Math.max(0, t) * rate) * 2;
    for (let i = 0; i < w.length && o + i < out.length; i++) out[o + i] += w[i];
  });
  return out;
}

export function normalizeRms(x: Float32Array, target: number): Float32Array {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  const rms = Math.sqrt(s / Math.max(1, x.length));
  if (!rms) return x;
  const g = target / rms;
  for (let i = 0; i < x.length; i++) x[i] = Math.max(-0.98, Math.min(0.98, x[i] * g));
  return x;
}
