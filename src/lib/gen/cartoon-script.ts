// «Мультфильм по книге»: сценарий озвучки, реплики и расчёт времени сцен.
// Чистые функции без Node API и без БД — модуль собирается и в демо-стенд (tools/demo):
//   cartoonScript(book)       — сжатие текста книги в сценарий ~2 минут (14 реплик: название, 12 разворотов, финал)
//   estimateSpeechSec(text)   — оценка длительности чтения по слогам и паузам
//   cartoonTimeline(voices)   — сцены по фактическим длительностям озвучки (растягиваются под голос)
//   subtitleChunks(text, sec) — разбивка реплики на субтитры (≤ 2 строк)
//   splitBySilences(...)      — разрезать одну загруженную запись на реплики по паузам

export type CueKind = "title" | "spread" | "end";

export interface Cue {
  /** Номер реплики для покупателя: 1..14. */
  n: number;
  kind: CueKind;
  /** Страница книги: 0 — обложка, 1..12 — развороты, 13 — финальная карточка. */
  page: number;
  text: string;
  /** Сколько секунд примерно занимает реплика (ориентир для записи своим голосом). */
  targetSec: number;
}

export interface CartoonScript {
  cues: Cue[];
  words: number;
  estSec: number;
  source: "demo" | "yandexgpt";
}

export interface ScriptBook {
  title: string;
  spreads: { index: number; text: string }[];
  dedication?: string;
}

/** Параметры по умолчанию (меняются в настройках `cartoon`). */
export const CARTOON_TIMING = {
  targetSec: 120,
  minSec: 90,
  maxSec: 150,
  /** Пауза перед репликой в сцене (после перехода). */
  lead: 0.6,
  /** Пауза после реплики до следующего перехода. */
  tail: 0.5,
  /** Длительность перехода (наплыв / через белое). */
  xfade: 0.8,
  titleMin: 3.5,
  spreadMin: 6,
  endMin: 5.5,
  /** Сколько держим финальную карточку после последней реплики. */
  endHold: 2.5,
  /** Средний темп чтения сказки вслух, слов в секунду (SpeechKit 0,95 и спокойный голос родителя). */
  wordsPerSec: 2.25,
};
export type CartoonTiming = typeof CARTOON_TIMING;

const VOWELS = /[аеёиоуыэюяaeiouy]/gi;
/** Темп спокойного чтения: секунд на слог и паузы на знаках (≈ 2,2 слова в секунду). Им же говорит демо-голос. */
export const SYLLABLE_SEC = 0.165;
export const COMMA_SEC = 0.2;
export const STOP_SEC = 0.36;

export const countWords = (t: string) => (t.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length;

/** Оценка длительности чтения: слоги + паузы на знаках препинания. */
export function estimateSpeechSec(text: string): number {
  const syl = (text.match(VOWELS) ?? []).length;
  const commas = (text.match(/[,;:—–]/g) ?? []).length;
  const stops = (text.match(/[.!?…]+/g) ?? []).length;
  return Math.round((syl * SYLLABLE_SEC + commas * COMMA_SEC + stops * STOP_SEC) * 10) / 10;
}

/** Предложения разворота. Реплика диалога «— Беда! — вздохнул Дед Мороз.» остаётся одним предложением. */
export function sentences(text: string): string[] {
  const raw = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?…»"])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of raw) {
    const prev = out.at(-1);
    // Продолжение после реплики: «— вздохнул…», «— сказал…», строчная буква в начале
    const continues = /^(?:[—–-]\s*)?[a-zа-яё]/u.test(s) && !/^[—–-]\s*[А-ЯЁA-Z]/u.test(s);
    // Не закрытые кавычки в предыдущем — тоже продолжение
    const openQuote = prev ? (prev.match(/«/g) ?? []).length > (prev.match(/»/g) ?? []).length : false;
    if (prev && (continues || openQuote)) out[out.length - 1] = `${prev} ${s}`;
    else out.push(s);
  }
  return out;
}

/** Закрыть кавычки и поставить точку, если реплика обрезана. */
function tidy(s: string): string {
  let t = s.trim().replace(/[,;:—–-]+$/u, "").trim();
  const open = (t.match(/«/g) ?? []).length - (t.match(/»/g) ?? []).length;
  if (!/[.!?…»"]$/.test(t)) t += ".";
  if (open > 0) t += "»".repeat(open);
  return t;
}

/** Слишком длинное предложение — обрезаем по границе части (запятая, тире, «и», «а», «но») ближе к бюджету. */
function trimSentence(s: string, budget: number): string {
  const words = s.split(/\s+/);
  if (words.length <= budget * 1.5) return s;
  let best = -1;
  for (let i = Math.max(4, Math.floor(budget * 0.55)); i < Math.min(words.length - 1, Math.ceil(budget * 1.4)); i++) {
    const w = words[i];
    const next = words[i + 1]?.toLowerCase();
    if (/[,;:]$/.test(w) || next === "—" || ["и", "а", "но", "чтобы", "когда"].includes(next ?? "")) {
      if (best < 0 || Math.abs(i + 1 - budget) < Math.abs(best - budget)) best = i + 1;
    }
  }
  return tidy(words.slice(0, best > 0 ? best : Math.round(budget)).join(" "));
}

/** Первые предложения в пределах бюджета слов (минимум одно, слишком длинное — обрезается). */
function pickSentences(list: string[], budget: number): string[] {
  const out: string[] = [];
  let w = 0;
  for (const s of list) {
    const n = countWords(s);
    if (!out.length) {
      const t = trimSentence(s, budget);
      out.push(t);
      w += countWords(t);
      if (t !== s) break;
      continue;
    }
    if (w + n <= budget * 1.25 && w < budget * 0.8) {
      out.push(s);
      w += n;
    } else break;
  }
  return out;
}

/** Бюджет слов под длительность: речь = длительность − паузы сцен − финальная карточка. */
export function wordBudget(targetSec = CARTOON_TIMING.targetSec, t: CartoonTiming = CARTOON_TIMING, cues = 14) {
  const speech = targetSec - cues * (t.lead + t.tail) - t.endHold;
  return Math.round(speech * t.wordsPerSec);
}

const DEDICATION_MAX_WORDS = 28;

/**
 * Демо-сценарий по правилам: из каждого разворота — первые предложения в пределах бюджета (~10 с на разворот),
 * затем добор/срезка до общего бюджета (220–260 слов при 2 минутах). Имена уже склонены (текст после personalize),
 * посвящение — в финальной реплике. Тон сохраняется, потому что берутся фразы самой книги.
 */
export function cartoonScript(book: ScriptBook, opts: { targetSec?: number; timing?: CartoonTiming } = {}): CartoonScript {
  const t = opts.timing ?? CARTOON_TIMING;
  const target = Math.min(t.maxSec, Math.max(t.minSec, opts.targetSec ?? t.targetSec));
  const total = wordBudget(target, t);
  const title = tidy(book.title.replace(/\s+/g, " "));
  const dedSentences = book.dedication ? sentences(book.dedication.replace(/\s+/g, " ")) : [];
  const ded = dedSentences.length ? pickSentences(dedSentences, DEDICATION_MAX_WORDS).join(" ") : "";
  const end = ded ? `Конец. ${ded}` : "Вот и сказке конец.";
  const spreads = [...book.spreads].sort((a, b) => a.index - b.index).slice(0, 12);
  const pools = spreads.map((s) => sentences(s.text));
  const per = Math.max(8, (total - countWords(title) - countWords(end)) / Math.max(1, spreads.length));
  const picked = pools.map((p) => pickSentences(p, per));
  const sum = () => picked.reduce((a, p) => a + countWords(p.join(" ")), 0) + countWords(title) + countWords(end);

  // Добор: разворотам с самым коротким текстом — следующее предложение, пока не наберём ~95% бюджета
  for (let guard = 0; guard < 40 && sum() < total * 0.95; guard++) {
    let best = -1;
    let bestW = Infinity;
    picked.forEach((p, i) => {
      const next = pools[i][p.length];
      if (!next || p.at(-1) !== pools[i][p.length - 1]) return; // обрезанное не продолжаем
      const w = countWords(p.join(" ")) + countWords(next);
      if (w < per * 1.9 && w < bestW) {
        bestW = w;
        best = i;
      }
    });
    if (best < 0) break;
    if (sum() + countWords(pools[best][picked[best].length]) > total * 1.08) break;
    picked[best].push(pools[best][picked[best].length]);
  }
  // Срезка: у самых длинных — последнее предложение (минимум одно остаётся), затем обрезка фразы
  for (let guard = 0; guard < 60 && sum() > total * 1.1; guard++) {
    let best = -1;
    let bestW = 0;
    picked.forEach((p, i) => {
      const w = countWords(p.join(" "));
      if (w > bestW && (p.length > 1 || w > per * 0.9)) {
        bestW = w;
        best = i;
      }
    });
    if (best < 0) break;
    if (picked[best].length > 1) picked[best].pop();
    else {
      const cut = trimSentence(picked[best][0], Math.max(8, Math.round(bestW * 0.7)));
      if (cut === picked[best][0]) break;
      picked[best][0] = cut;
    }
  }

  const cues: Cue[] = [{ n: 1, kind: "title", page: 0, text: title, targetSec: 0 }];
  picked.forEach((p, i) => cues.push({ n: i + 2, kind: "spread", page: spreads[i].index, text: p.join(" ").replace(/\s+/g, " ").trim(), targetSec: 0 }));
  cues.push({ n: cues.length + 1, kind: "end", page: 13, text: end, targetSec: 0 });
  for (const c of cues) c.targetSec = estimateSpeechSec(c.text);
  const words = cues.reduce((a, c) => a + countWords(c.text), 0);
  const tl = cartoonTimeline(
    cues.map((c) => c.targetSec),
    cues.map((c) => c.kind),
    t,
  );
  return { cues, words, estSec: tl.total, source: "demo" };
}

/** Проверка ответа модели: столько же реплик, без меток, в пределах бюджета ±25%. */
export function validScript(cues: { text: string }[], expected: number, budgetWords: number): boolean {
  if (cues.length !== expected) return false;
  if (cues.some((c) => !c.text.trim() || /[{}]/.test(c.text))) return false;
  const w = cues.reduce((a, c) => a + countWords(c.text), 0);
  return w >= budgetWords * 0.75 && w <= budgetWords * 1.25;
}

export interface Scene {
  kind: CueKind;
  /** Начало сцены на общей шкале (с учётом наплыва). */
  start: number;
  dur: number;
  /** Когда начинается реплика (абсолютное время). */
  voiceAt: number;
  voiceSec: number;
}

export interface Timeline {
  scenes: Scene[];
  total: number;
  /** Во сколько раз растянули паузы, чтобы дотянуть до минимума. */
  stretch: number;
  /** Длиннее максимума даже с короткими паузами (запись своим голосом — допускаем, это не ошибка). */
  over: boolean;
}

/**
 * Сцены по длительностям реплик: сцена = пауза + реплика + пауза + переход; не короче минимума своего вида.
 * Короче minSec — паузы растягиваются; длиннее maxSec — паузы сжимаются до 0,3 с.
 */
export function cartoonTimeline(voiceSec: number[], kinds: CueKind[], t: CartoonTiming = CARTOON_TIMING): Timeline {
  const build = (lead: number, tail: number, extra: number) => {
    const scenes: Scene[] = [];
    let start = 0;
    voiceSec.forEach((v, i) => {
      const kind = kinds[i] ?? "spread";
      const last = i === voiceSec.length - 1;
      const min = kind === "title" ? t.titleMin : kind === "end" ? t.endMin : t.spreadMin;
      const after = last ? Math.max(tail, t.endHold) : tail + t.xfade;
      const dur = Math.max(min + (last ? 0 : t.xfade), lead + v + after + (kind === "spread" ? extra : 0));
      // Первая реплика (название) — после появления заголовка; в остальных — после перехода
      const voiceAt = start + (i === 0 ? Math.max(lead, 0.9) : t.xfade * 0.5 + lead);
      scenes.push({ kind, start: round(start), dur: round(dur), voiceAt: round(voiceAt), voiceSec: round(v) });
      start += dur - (last ? 0 : t.xfade);
    });
    return { scenes, total: round(start) };
  };
  let lead = t.lead;
  let tail = t.tail;
  let r = build(lead, tail, 0);
  let stretch = 1;
  const spreads = kinds.filter((k) => k === "spread").length || 1;
  if (r.total < t.minSec) {
    // Растягиваем: добавляем «воздух» в каждую сцену разворота поровну (минимумы сцен уже учтены)
    let extra = (t.minSec - r.total) / spreads;
    for (let i = 0; i < 6 && r.total < t.minSec - 0.05; i++) {
      r = build(lead, tail, extra);
      extra += (t.minSec - r.total) / spreads;
    }
    stretch = round(r.total / build(lead, tail, 0).total);
  } else if (r.total > t.maxSec) {
    lead = tail = 0.3;
    r = build(lead, tail, 0);
  }
  return { ...r, stretch, over: r.total > t.maxSec + 0.05 };
}

const round = (x: number) => Math.round(x * 100) / 100;

/** Субтитры реплики: куски ≤ 2 строк по ~maxLine символов, время пропорционально слогам. */
export function subtitleChunks(text: string, sec: number, maxLine = 36): { text: string; from: number; to: number }[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxLine) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
    // Конец предложения — хорошая граница строки
    if (/[.!?…]$/.test(w) && cur.length > maxLine * 0.5) {
      lines.push(cur);
      cur = "";
    }
  }
  if (cur) lines.push(cur);
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 2) chunks.push(lines.slice(i, i + 2).join("\n"));
  const weight = chunks.map((c) => Math.max(1, (c.match(VOWELS) ?? []).length + 2));
  const all = weight.reduce((a, b) => a + b, 0);
  let at = 0;
  return chunks.map((c, i) => {
    const d = (sec * weight[i]) / all;
    const r = { text: c, from: round(at), to: round(at + d) };
    at += d;
    return r;
  });
}

/**
 * Одна запись на все реплики → границы по паузам. silences — найденные паузы [начало, конец] (ffmpeg silencedetect),
 * expected — ожидаемые длительности реплик. Граница i — ближайшая пауза к ожидаемой точке, по порядку.
 * Возвращает отрезки [from, to] для каждой реплики.
 */
export function splitBySilences(silences: [number, number][], total: number, expected: number[]): [number, number][] {
  const n = expected.length;
  const sum = expected.reduce((a, b) => a + b, 0) || 1;
  const mids = silences.filter(([a, b]) => b > a && a > 0.2 && b < total - 0.2).map(([a, b]) => ({ a, b, m: (a + b) / 2 }));
  const cuts: { a: number; b: number }[] = [];
  let acc = 0;
  let from = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += expected[i];
    const want = (acc / sum) * total;
    const left = n - 1 - i - 1; // сколько границ ещё нужно после этой
    const candidates = mids.filter((s) => s.m > from + 0.3 && mids.filter((x) => x.m > s.m).length >= Math.min(left, mids.length));
    let best = candidates.reduce<(typeof mids)[number] | null>((b, s) => (!b || Math.abs(s.m - want) < Math.abs(b.m - want) ? s : b), null);
    // Пауза слишком далеко от ожидаемого места (больше 35% реплики) — режем по ожидаемой точке
    if (!best || Math.abs(best.m - want) > Math.max(1.5, (expected[i] / sum) * total * 0.35)) best = { a: want, b: want, m: want };
    cuts.push({ a: best.a, b: best.b });
    from = best.m;
  }
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const end = i < n - 1 ? cuts[i].a : total;
    out.push([round(start), round(Math.max(start, end))]);
    if (i < n - 1) start = cuts[i].b;
  }
  return out;
}

/** Хэш текста реплик — понять, что текст поменялся после рендера (бесплатный перерендер). */
export function scriptHash(cues: { text: string }[]): string {
  let h = 2166136261;
  for (const ch of cues.map((c) => c.text).join("\u0001")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Частицы по теме сюжета и тексту: снег зимой, светлячки ночью, искорки на празднике, пылинки дома. */
export type Particles = "snow" | "sparkles" | "fireflies" | "dust" | "none";
export function particlesFor(theme: string, text: string): Particles {
  const t = `${theme} ${text}`.toLowerCase();
  if (/winter|snow|зим|снег|снеж|мороз|новогод|новый год|ёлк/.test(t)) return "snow";
  if (/night|moon|star|space|ноч|лун|звёзд|звезд|сон|сны|космос/.test(t)) return "fireflies";
  if (/birthday|party|праздн|день рождения|торт|салют|волшеб/.test(t)) return "sparkles";
  return "dust";
}
