// Озвучка книги. SpeechKit — по умолчанию, SaluteSpeech — альтернатива, demo — без внешних сервисов.
// Цена за символ — из настроек/окружения; расход пишется в generation_costs.

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
