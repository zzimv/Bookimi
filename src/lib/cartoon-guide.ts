// «Мультфильм по книге» — тексты и правила для покупателя (общие для сервера и браузера, без Node API):
// памятка «С чего начать», требования к формату, согласие на обработку голоса, проверка файла по сигнатуре,
// срок удаления записей. Меняя тексты, меняйте и CARTOON_VOICE_DOC_VERSION — так видно, на что дано согласие.

export const CARTOON_VOICE_DOC_VERSION = "voice-2026-10";

export const VOICE_LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalSec: 180,
  maxCueSec: 40,
  minSampleRate: 22050,
  /** Через сколько дней после выдачи мультфильма удаляем записи голоса. */
  purgeDays: 30,
};

/**
 * Тишина вместо голоса: пик ниже −40 dBFS или средний уровень ниже −55 dBFS — так звучит выключенный или
 * заглушённый микрофон (голос с 15–20 см даёт пик −20…−3 dBFS). Такую запись не принимаем — ни в браузере,
 * ни на сервере. «Тихо» (RMS ниже −38 dBFS) — по-прежнему только предупреждение.
 */
export const SILENCE = { peakDb: -40, rmsDb: -55 };
export const SILENT_ERROR = "Запись почти беззвучная — похоже, микрофон выключен или заглушён. Проверьте, что выбран нужный микрофон, поднесите телефон ближе (15–20 см) и запишите ещё раз.";
export const isSilent = (lv: { peakDb: number; rmsDb: number }) => !(lv.peakDb >= SILENCE.peakDb) || !(lv.rmsDb >= SILENCE.rmsDb);
/** dBFS из линейной амплитуды (0…1). */
export const toDb = (x: number) => 20 * Math.log10(Math.max(1e-5, x));

/** Накопитель уровня записи в браузере: кадры AnalyserNode → общий RMS и пик. */
export function levelMeter() {
  let sum = 0;
  let count = 0;
  let peak = 0;
  return {
    add(buf: ArrayLike<number>) {
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      count += buf.length;
    },
    result() {
      return { peakDb: toDb(peak), rmsDb: toDb(Math.sqrt(sum / Math.max(1, count))), frames: count };
    },
  };
}

/** «С чего начать» — показываем перед записью. */
export const OWN_VOICE_GUIDE: { title: string; text: string }[] = [
  { title: "Найдите тихое место без эха", text: "Лучше всего — комната с мягкой мебелью, коврами и шторами. Самая честная студия звукозаписи — шкаф с одеждой или большое одеяло над головой: смешно, но звучит отлично. Кухня и ванная гулкие — их лучше обойти." },
  { title: "Телефон — в 15–20 сантиметрах", text: "Держите телефон или ноутбук на расстоянии ладони с растопыренными пальцами, чуть сбоку от рта — так не будет «пух» на звуках «п» и «б»." },
  { title: "Читайте ровно и не торопитесь", text: "Как вечером перед сном: спокойно, с улыбкой. Не нужно играть голосами — тепло важнее артистизма. Под каждой репликой указано, сколько секунд она примерно займёт, но точно попадать не нужно: сцены подстроятся под ваш голос." },
  { title: "Делайте паузу между репликами", text: "Нажали «Записать» — вдохните, прочитайте, секунду помолчите и остановите запись. Любую реплику можно перезаписать сколько угодно раз — сохраняется последняя." },
  { title: "Можно всей семьёй", text: "Пусть ребёнок прочитает свою реплику или скажет «Конец!» — это самые дорогие секунды мультфильма. Главное — чтобы в записи были только ваши голоса, без телевизора и музыки." },
];

/** Требования к записи — дословно как на странице «Озвучить своим голосом». */
export const OWN_VOICE_FORMAT: string[] = [
  "Лучше всего — записать прямо здесь, в браузере, по одной реплике (кнопка «Записать» у каждой реплики).",
  "Или загрузите одну запись всего текста подряд — с паузой 1–2 секунды между репликами, мы разрежем её сами.",
  "Форматы: WAV, MP3, M4A/AAC, OGG/Opus, WebM. Моно или стерео.",
  "Частота — не ниже 22,05 кГц (идеально 44,1 или 48 кГц; запись с телефона подходит).",
  "Файл — до 50 МБ, вся озвучка — не дольше 3 минут.",
  "Без музыки и фонового шума, без чужих голосов — только вы и члены семьи, которые читают свои реплики.",
];

/** Как обрабатываем запись — коротко, для доверия. */
export const OWN_VOICE_PROCESSING =
  "Мы уберём гул и лёгкий шум, обрежем тишину, выровняем громкость всех реплик и подложим тихую музыку. Голос не меняем и не «клонируем».";

export const VOICE_CONSENT_TEXT =
  "Я даю согласие на обработку моего голоса (и голосов членов семьи, от имени которых я действую) для создания мультфильма по книге. Записи хранятся на серверах в России, не передаются третьим лицам, не используются для обучения и клонирования голоса и удаляются через 30 дней после готовности мультфильма. Согласие можно отозвать — записи удалятся сразу.";

export interface AudioSniff {
  ok: boolean;
  format?: "wav" | "mp3" | "m4a" | "aac" | "ogg" | "webm";
  ext?: string;
  error?: string;
}

/** Формат по сигнатуре (магическим байтам), а не по расширению или Content-Type. */
export function sniffAudio(b: Uint8Array): AudioSniff {
  const at = (o: number, s: string) => s.split("").every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b.length < 16) return { ok: false, error: "Файл пустой или повреждён" };
  if (b.length > 50 * 1024 * 1024) return { ok: false, error: "Файл больше 50 МБ" };
  if (at(0, "RIFF") && at(8, "WAVE")) return { ok: true, format: "wav", ext: "wav" };
  if (at(0, "OggS")) return { ok: true, format: "ogg", ext: "ogg" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ok: true, format: "webm", ext: "webm" };
  if (at(4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/^(M4A |M4B |mp42|mp41|isom|iso[2-9]|dash|3gp[0-9]|3g2a|qt  |MSNV|avc1)/.test(brand)) return { ok: true, format: "m4a", ext: "m4a" };
    return { ok: false, error: "Этот формат MP4 не поддерживается — сохраните запись как M4A или MP3" };
  }
  if (at(0, "ID3")) return { ok: true, format: "mp3", ext: "mp3" };
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { ok: true, format: "aac", ext: "aac" }; // ADTS
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { ok: true, format: "mp3", ext: "mp3" }; // кадр MPEG audio
  return { ok: false, error: "Это не похоже на аудиозапись. Подойдут WAV, MP3, M4A/AAC, OGG/Opus, WebM" };
}

/** Проверка параметров записи после ffprobe. Возвращает текст ошибки или null. */
export function checkVoiceMeta(m: { duration: number; sampleRate: number; channels: number }): string | null {
  if (!m.duration || m.duration < 0.3) return "Запись пустая — попробуйте ещё раз";
  if (m.duration > VOICE_LIMITS.maxTotalSec + 5) return "Запись длиннее 3 минут — сократите паузы или запишите по репликам";
  if (m.channels < 1 || m.channels > 2) return "Нужна моно- или стереозапись";
  if (m.sampleRate && m.sampleRate < VOICE_LIMITS.minSampleRate) return "Частота записи ниже 22 кГц — запишите в браузере или сохраните файл в лучшем качестве";
  return null;
}

/** Когда удалить записи голоса: через purgeDays после выдачи мультфильма. */
export function voicePurgeDate(deliveredAt: Date, days = VOICE_LIMITS.purgeDays): Date {
  return new Date(deliveredAt.getTime() + days * 86400_000);
}

/** Пора ли удалять записи: срок наступил и ещё не удалены. */
export function voiceDueForPurge(c: { voicePurgeAt: Date | null; voicePurgedAt: Date | null }, now = new Date()): boolean {
  return Boolean(c.voicePurgeAt && !c.voicePurgedAt && c.voicePurgeAt.getTime() <= now.getTime());
}

/** Подпись голоса на русском (для списка выбора). */
export const AUTO_VOICES_HINT = "Голос диктора можно сменить и пересобрать мультфильм — один раз бесплатно.";
