// Озвучка книги. SpeechKit — по умолчанию, SaluteSpeech — альтернатива, demo — без внешних сервисов.
// Цена за символ — из настроек/окружения; расход пишется в generation_costs.

import { estimateSpeechSec } from "./cartoon-script";

export interface TtsResult {
  data: Buffer;
  ext: "mp3" | "wav";
  costKopecks: number;
}

export interface TtsProvider {
  name: string;
  synth(parts: string[], voice: string): Promise<TtsResult>;
}

class SpeechKit implements TtsProvider {
  name = "speechkit";
  async synth(parts: string[], voice: string): Promise<TtsResult> {
    const key = process.env.YANDEX_CLOUD_API_KEY;
    const folder = process.env.YANDEX_CLOUD_FOLDER_ID;
    if (!key || !folder) throw new Error("SpeechKit: не заданы ключи Yandex Cloud");
    const chunks: Buffer[] = [];
    let chars = 0;
    for (const text of parts) {
      chars += text.length;
      const body = new URLSearchParams({ text, lang: "ru-RU", voice, format: "mp3", speed: "0.95", folderId: folder });
      const r = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
        method: "POST",
        headers: { Authorization: `Api-Key ${key}` },
        body,
      });
      if (!r.ok) throw new Error(`SpeechKit ${r.status}: ${(await r.text()).slice(0, 200)}`);
      chunks.push(Buffer.from(await r.arrayBuffer()));
    }
    const perMillion = Number(process.env.SPEECHKIT_RUB_PER_1M ?? 1320);
    return { data: Buffer.concat(chunks), ext: "mp3", costKopecks: Math.round((chars / 1e6) * perMillion * 100) };
  }
}

class SaluteSpeech implements TtsProvider {
  name = "salutespeech";
  async synth(parts: string[], voice: string): Promise<TtsResult> {
    const id = process.env.SALUTESPEECH_CLIENT_ID;
    const secret = process.env.SALUTESPEECH_CLIENT_SECRET;
    if (!id || !secret) throw new Error("SaluteSpeech: не заданы ключи");
    const auth = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        RqUID: crypto.randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "scope=SALUTE_SPEECH_PERS",
    });
    const { access_token } = (await auth.json()) as { access_token: string };
    const chunks: Buffer[] = [];
    for (const text of parts) {
      const r = await fetch(`https://smartspeech.sber.ru/rest/v1/text:synthesize?format=wav16&voice=${encodeURIComponent(voice || "Nec_24000")}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/text" },
        body: text,
      });
      if (!r.ok) throw new Error(`SaluteSpeech ${r.status}`);
      chunks.push(Buffer.from(await r.arrayBuffer()));
    }
    return { data: joinWav(chunks), ext: "wav", costKopecks: 0 };
  }
}

/** Демо: короткий мягкий сигнал и тишина на каждый разворот — проверка плеера без внешних сервисов. */
class DemoTts implements TtsProvider {
  name = "demo";
  async synth(parts: string[]): Promise<TtsResult> {
    const rate = 16000;
    const pcm: number[] = [];
    for (let p = 0; p < parts.length; p++) {
      for (let i = 0; i < rate * 0.25; i++) pcm.push(Math.sin((2 * Math.PI * 523 * i) / rate) * 3000 * (1 - i / (rate * 0.25)));
      for (let i = 0; i < rate * 1.25; i++) pcm.push(0);
    }
    const data = Buffer.alloc(pcm.length * 2);
    pcm.forEach((v, i) => data.writeInt16LE(Math.round(v), i * 2));
    return { data: wavFromPcm(data, rate), ext: "wav", costKopecks: 0 };
  }
}

/**
 * Демо-голос для мультфильма: «речь без слов» — формантный синтез по слогам текста (гласные с формантами,
 * шипящие — шум, паузы на знаках). Темп совпадает с оценкой estimateSpeechSec, поэтому тайминг сцен
 * в демо такой же, как с SpeechKit. Ничего не уходит наружу; это заглушка, а не TTS.
 * voice: «demo-male» — ниже тоном (используется и как «свой голос» в демо), иначе женский.
 */
export class DemoSpeechTts implements TtsProvider {
  name = "demo";
  async synth(parts: string[], voice: string): Promise<TtsResult> {
    const rate = 22050;
    const pcm = demoSpeechPcm(parts.join(" "), rate, voice);
    const data = Buffer.alloc(pcm.length * 2);
    for (let i = 0; i < pcm.length; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
    return { data: wavFromPcm(data, rate), ext: "wav", costKopecks: 0 };
  }
}

const FORMANTS: Record<string, [number, number, number]> = {
  а: [760, 1320, 2600], я: [720, 1500, 2600], о: [520, 900, 2500], ё: [520, 1100, 2500], у: [330, 760, 2400], ю: [330, 1250, 2400],
  э: [520, 1800, 2600], е: [480, 1950, 2650], и: [300, 2300, 3000], ы: [330, 1600, 2500],
};
const FRICATIVE: Record<string, number> = { с: 5200, з: 4800, ц: 5000, ш: 2600, щ: 3200, ж: 2400, ч: 3600, ф: 1600, в: 1300, х: 1800 };
const STOP = new Set(["п", "б", "т", "д", "к", "г"]);
const SONORANT = new Set(["м", "н", "л", "р", "й"]);

/** PCM −1..1 «речи без слов». Детерминированно: один и тот же текст — один и тот же звук. */
export function demoSpeechPcm(text: string, rate: number, voice = ""): Float32Array {
  type Seg = { kind: "v" | "n" | "s" | "z" | "p"; dur: number; f: [number, number, number]; amp: number; noiseF?: number; stress?: boolean; last?: boolean };
  const male = /male|муж|filipp|ermil|zahar/i.test(voice);
  const scaleF = male ? 0.88 : 1.08;
  const base = male ? 118 : 205;
  const segs: Seg[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const words = text.toLowerCase().replace(/ё/g, "ё").split(/(\s+|[,;:—–.!?…]+)/).filter((w) => w && w.trim());
  let lastF: [number, number, number] = FORMANTS.э;
  for (const w of words) {
    if (/^[,;:—–]+$/.test(w)) {
      segs.push({ kind: "p", dur: 0.2, f: lastF, amp: 0 });
      continue;
    }
    if (/^[.!?…]+$/.test(w)) {
      if (segs.length) segs[segs.length - 1].last = true;
      segs.push({ kind: "p", dur: 0.36, f: lastF, amp: 0 });
      continue;
    }
    const letters = [...w].filter((c) => /[а-яё]/.test(c));
    const vowels = letters.filter((c) => FORMANTS[c]).length;
    const stressAt = vowels ? Math.floor(rnd() * vowels) : -1;
    let vi = 0;
    for (const c of letters) {
      if (FORMANTS[c]) {
        lastF = FORMANTS[c].map((x) => x * scaleF) as [number, number, number];
        const stress = vi === stressAt;
        segs.push({ kind: "v", dur: stress ? 0.14 : 0.095, f: lastF, amp: stress ? 1 : 0.8, stress });
        vi++;
      } else if (FRICATIVE[c]) segs.push({ kind: "z", dur: 0.06, f: lastF, amp: 0.12, noiseF: FRICATIVE[c] });
      else if (STOP.has(c)) segs.push({ kind: "s", dur: 0.045, f: lastF, amp: 0 });
      else if (SONORANT.has(c)) segs.push({ kind: "n", dur: 0.05, f: [300 * scaleF, 1150 * scaleF, 2500], amp: 0.4 });
    }
    segs.push({ kind: "p", dur: 0.025, f: lastF, amp: 0 });
  }
  // Темп — как в оценке сценария: растягиваем/сжимаем звучащие сегменты, паузы не трогаем
  const pauses = segs.filter((s) => s.kind === "p").reduce((a, s) => a + s.dur, 0);
  const voiced = segs.filter((s) => s.kind !== "p").reduce((a, s) => a + s.dur, 0);
  const k = voiced > 0 ? Math.max(0.5, (estimateSpeechSec(text) - pauses) / voiced) : 1;
  for (const s of segs) if (s.kind !== "p") s.dur *= k;
  const total = Math.ceil(segs.reduce((a, s) => a + s.dur, 0.3) * rate);
  const out = new Float32Array(total);
  // Резонаторы (каскад Клатта), форманты сглаживаются между сегментами
  const res = [0, 1, 2].map(() => ({ y1: 0, y2: 0 }));
  const nres = { y1: 0, y2: 0 };
  const cur = [...segs[0]?.f ?? FORMANTS.э] as number[];
  const bw = [90, 110, 170];
  let phase = 0;
  let prevG = 0;
  let amp = 0;
  let n = 0;
  let phraseStart = 0;
  for (let si = 0; si < segs.length; si++) {
    const s = segs[si];
    const len = Math.round(s.dur * rate);
    if (s.kind === "p" && s.dur > 0.15) phraseStart = n + len;
    for (let k = 0; k < len && n < total; k++, n++) {
      for (let j = 0; j < 3; j++) cur[j] += (s.f[j] - cur[j]) * 0.004;
      const phr = Math.min(1, (n - phraseStart) / (rate * 2.6));
      let f0 = base * (1.1 - 0.2 * phr) * (s.stress ? 1.12 : 1) * (1 + 0.012 * Math.sin((2 * Math.PI * 5.2 * n) / rate));
      if (s.last) f0 *= 1 - 0.15 * (k / len);
      phase += f0 / rate;
      if (phase >= 1) phase -= 1;
      const g = phase < 0.6 ? Math.sin((Math.PI * phase) / 0.6) ** 2 : 0;
      const src = g - prevG;
      prevG = g;
      const targetAmp = s.kind === "v" || s.kind === "n" ? s.amp : 0;
      amp += (targetAmp - amp) * 0.006;
      let v = src * amp * 6;
      for (let j = 0; j < 3; j++) {
        const T = 1 / rate;
        const C = -Math.exp(-2 * Math.PI * bw[j] * T);
        const B = 2 * Math.exp(-Math.PI * bw[j] * T) * Math.cos(2 * Math.PI * cur[j] * T);
        const A = 1 - B - C;
        const y = A * v + B * res[j].y1 + C * res[j].y2;
        res[j].y2 = res[j].y1;
        res[j].y1 = y;
        v = y;
      }
      let noise = 0;
      if (s.kind === "z" && s.noiseF) {
        const T = 1 / rate;
        const f = Math.min(s.noiseF, rate * 0.45);
        const C = -Math.exp(-2 * Math.PI * 900 * T);
        const B = 2 * Math.exp(-Math.PI * 900 * T) * Math.cos(2 * Math.PI * f * T);
        // Усиление резонатора ≈ 1 на частоте шума (иначе шипящие громче гласных)
        const y = (1 - Math.exp(-Math.PI * 900 * T)) * 1.4 * (rnd() * 2 - 1) + B * nres.y1 + C * nres.y2;
        nres.y2 = nres.y1;
        nres.y1 = y;
        const env = Math.sin((Math.PI * k) / len);
        noise = y * s.amp * env * 0.9;
      }
      out[n] = v * 0.5 + noise;
    }
  }
  // Нормализация пика −3 дБ
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = peak ? 0.7 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}

function wavFromPcm(pcm: Buffer, rate: number) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function joinWav(parts: Buffer[]) {
  const pcm = Buffer.concat(parts.map((p) => p.subarray(44)));
  const rate = parts[0]?.readUInt32LE(24) ?? 24000;
  return wavFromPcm(pcm, rate);
}

export function ttsProvider(name: string): TtsProvider {
  if (name === "speechkit") return new SpeechKit();
  if (name === "salutespeech") return new SaluteSpeech();
  return new DemoTts();
}
