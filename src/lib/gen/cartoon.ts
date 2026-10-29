// Задача воркера generate-cartoon: «Мультфильм по книге».
//  1) сценарий: YandexGPT сжимает текст (имена → метки, подставляем у нас) или правила (демо, запасной путь)
//  2) голос: свой (записи покупателя, очистка и −16 LUFS) или диктор (SpeechKit по аудитории; демо-голос)
//  3) сцены: демо-SVG — слоями (параллакс), картинки GPU — целиком; рендер cartoon-render.ts
//  4) файлы в хранилище, письмо «Мультфильм готов», срок удаления записей голоса — 30 дней после выдачи
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../db";
import { cfg } from "../settings";
import { Answers, extraGender, type QuizAnswers } from "../quiz";
import { guessGender, fillTags } from "../declension";
import { getFile, putFile, deleteFile, fileExists } from "../storage";
import { alertOwner, notifyUser } from "../notify";
import { voicePurgeDate } from "../cartoon-guide";
import { bookText, bookTextHash, cueKind, renderedKeyOf } from "../cartoon";
import { dedicationText, tagContext, YandexGptProvider, type StoryText } from "./text";
import { personsOf, redactForText } from "./redact";
import { ttsProvider, DemoSpeechTts } from "./tts";
import { cartoonScript, estimateSpeechSec, particlesFor, validScript, wordBudget, CARTOON_TIMING, type CartoonScript, type Cue } from "./cartoon-script";
import { renderCartoon, type CartoonSceneInput } from "./cartoon-render";
import { prepareCues } from "./cartoon-voice";
import { demoLayers } from "./cartoon-demo";
import { plotInfo } from "./pipeline";

// ── Видео из картинки (задел): CARTOON_I2V=wan — оживление иллюстраций моделью на своём GPU ──

export interface ImageToVideo {
  name: string;
  /** Короткий ролик сцены (MP4) по иллюстрации; null — модель недоступна, рендер идёт без неё. */
  animate(image: Buffer, opts: { seconds: number; prompt: string }): Promise<Buffer | null>;
}

class DisabledI2V implements ImageToVideo {
  name = "off";
  async animate() {
    return null;
  }
}

/** Задел под Wan image-to-video на GPU-сервере (tools/gpu-server): эндпоинт /v1/i2v ещё не реализован. */
class WanI2V implements ImageToVideo {
  name = "wan";
  async animate(): Promise<Buffer | null> {
    // Включается, когда на GPU-сервере появится /v1/i2v (см. ASSUMPTIONS). До тех пор — без оживления.
    return null;
  }
}

export function i2vProvider(setting: string): ImageToVideo {
  const v = process.env.CARTOON_I2V || setting;
  return v === "wan" ? new WanI2V() : new DisabledI2V();
}

// ── Сценарий ──

export interface BookForScript {
  a: QuizAnswers;
  text: StoryText;
  dedication: string;
}

/**
 * YandexGPT: сократить книгу до сценария. В модель — только текст с метками ({ГЕРОЙ.дат}…), без имён и
 * посвящения; ответ — 12 реплик с теми же метками, имена подставляем у нас (fillTags). Неудача — правила.
 */
export async function condenseWithGpt(b: BookForScript, targetSec: number, gpt = new YandexGptProvider()): Promise<CartoonScript | null> {
  const persons = personsOf(b.a, (e) => extraGender(e as QuizAnswers["extras"][number], guessGender));
  const tagged = b.text.spreads.map((s) => redactForText(s.text, persons));
  const base = cartoonScript({ title: b.text.title, spreads: b.text.spreads, dedication: b.dedication }, { targetSec });
  const spreadWords = wordBudget(targetSec) - base.cues[0].text.split(/\s+/).length - base.cues.at(-1)!.text.split(/\s+/).length;
  const system =
    "Ты — редактор детских мультфильмов. Сократи текст книги до сценария озвучки: по одной реплике на каждый из 12 разворотов, " +
    `всего ${spreadWords} слов (±10%), примерно ${Math.round(spreadWords / 12)} слов на разворот. Сохрани ход событий, тон и стиль книги, ` +
    "не добавляй новых событий, героев и имён. Метки в фигурных скобках ({ГЕРОЙ.им}, {ГЕРОЙ.дат}, {ДОП1.им}…) оставляй как есть, в нужном падеже. " +
    'Ответ — только JSON: {"lines":["реплика 1", …, "реплика 12"]}.';
  const user = `Название: ${redactForText(b.text.title, persons)}\n` + tagged.map((t, i) => `${i + 1}. ${t.replace(/\n/g, " / ")}`).join("\n");
  try {
    const { text } = await gpt.chat(system, user, 0.4);
    const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { lines?: string[] };
    const ctx = tagContext(b.a);
    const lines = (j.lines ?? []).slice(0, 12).map((l) => fillTags(String(l), ctx).replace(/\s+/g, " ").trim());
    const cues: Cue[] = [base.cues[0], ...lines.map((t, i) => ({ n: i + 2, kind: "spread" as const, page: i + 1, text: t, targetSec: estimateSpeechSec(t) })), { ...base.cues.at(-1)!, n: 14 }];
    if (lines.length !== 12 || !validScript(cues, 14, wordBudget(targetSec))) return null;
    return { cues, words: cues.reduce((s, c) => s + c.text.split(/\s+/).length, 0), estSec: base.estSec, source: "yandexgpt" };
  } catch (e) {
    console.error("[cartoon] yandexgpt", (e as Error).message);
    return null;
  }
}

export async function makeScript(b: BookForScript, targetSec: number, textSetting: string): Promise<CartoonScript> {
  if (textSetting === "yandexgpt") {
    const r = await condenseWithGpt(b, targetSec);
    if (r) return r;
  }
  return cartoonScript({ title: b.text.title, spreads: b.text.spreads, dedication: b.dedication }, { targetSec });
}

// ── Задача ──

async function saveCartoonFile(bookId: string, kind: string, file: string, ext: string, type: string) {
  const key = `${bookId}/cartoon/${kind}-${Date.now().toString(36)}.${ext}`;
  await putFile("books", key, await readFile(file), type);
  const old = await db.bookFile.findMany({ where: { bookId, kind } });
  for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
  await db.bookFile.deleteMany({ where: { bookId, kind } });
  await db.bookFile.create({ data: { bookId, kind, storageKey: key } });
}

export async function runCartoon(bookId: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { pages: { orderBy: { index: "asc" } } } });
  let cartoon = await db.cartoon.findUniqueOrThrow({ where: { bookId } });
  const set = await cfg("cartoon");
  const ai = await cfg("ai");
  const a = Answers.parse(book.params);
  const text = await bookText(book);
  const dedication = dedicationText(a);
  const textHash = bookTextHash(text, dedication);
  await db.cartoon.update({ where: { bookId }, data: { status: "RENDERING", progress: 1, error: null } });
  const work = await mkdtemp(join(tmpdir(), "cartoon-"));
  try {
    // Сценарий: свой голос — сценарий не меняем (реплики уже записаны); иначе — по актуальному тексту
    const own = cartoon.voiceMode === "own";
    let script = cartoon.script as unknown as CartoonScript | null;
    if (!script || (!own && cartoon.textHash !== textHash)) {
      script = await makeScript({ a, text, dedication }, set.targetSec, ai.text);
      cartoon = await db.cartoon.update({ where: { bookId }, data: { script: script as object, textHash } });
    }
    const cues = script.cues;

    // Голос
    const raw: string[] = [];
    if (own) {
      for (const c of cues) {
        const f = await db.bookFile.findFirst({ where: { bookId, kind: cueKind(c.n) }, orderBy: { createdAt: "desc" } });
        if (!f) throw new Error(`нет записи реплики ${c.n}`);
        const p = join(work, `own-${c.n}`);
        await writeFile(p, await getFile("books", f.storageKey));
        raw.push(p);
      }
    } else {
      const voice = cartoon.voice ?? book.audioVoice ?? set.voiceByAudience[a.audience] ?? "alena";
      const tts = ai.tts === "demo" ? new DemoSpeechTts() : ttsProvider(ai.tts);
      let cost = 0;
      for (const c of cues) {
        const r = await tts.synth([c.text], voice);
        cost += r.costKopecks;
        const p = join(work, `tts-${c.n}.${r.ext}`);
        await writeFile(p, r.data);
        raw.push(p);
      }
      await db.generationCost.create({ data: { bookId, provider: tts.name, operation: "cartoon-tts", costKopecks: cost } });
    }
    await db.cartoon.update({ where: { bookId }, data: { progress: 8 } });
    const prepared = await prepareCues(raw, join(work, "voice"), { own });
    const voice = await Promise.all(prepared.files.map((f) => readFile(f)));

    // Сцены: обложка → развороты → финал
    const img = async (index: number) => {
      const p = book.pages.find((x) => x.index === index);
      if (!p?.imageKey) throw new Error(`нет иллюстрации ${index}`);
      return { key: p.imageKey, data: await getFile("books", p.imageKey), contentType: p.imageKey.endsWith(".svg") ? "image/svg+xml" : p.imageKey.endsWith(".jpg") ? "image/jpeg" : "image/png" };
    };
    const i2v = i2vProvider(set.i2v);
    const scenes: CartoonSceneInput[] = [];
    for (let index = 0; index <= 12; index++) {
      const im = await img(index);
      const svg = im.key.endsWith(".svg");
      // Демо-иллюстрации рисуем заново слоями (те же входные данные — та же картинка, но без подписей)
      const scene = index === 0 ? plotInfo(a).coverScene ?? text.spreads[0]?.scene : text.spreads[index - 1]?.scene;
      const layers = svg ? demoLayers(a, { style: book.styleKey, mood: book.mood, index, scene }) : undefined;
      const clip = !svg && i2v.name !== "off" ? await i2v.animate(im.data, { seconds: 8, prompt: text.spreads[index - 1]?.scene ?? "" }) : null;
      scenes.push({ kind: index === 0 ? "title" : "spread", image: layers ? { data: layers.full, contentType: "image/svg+xml" } : im, layers, clip: clip ?? undefined });
    }
    scenes.push({ kind: "end", image: scenes[0].image });

    let music: Buffer | null = null;
    if (set.music && set.music !== "synth" && (await fileExists("books", set.music))) music = await getFile("books", set.music);

    let last = 0;
    const out = await renderCartoon({
      title: text.title,
      dedication,
      cues,
      voice,
      scenes,
      particles: particlesFor(plotInfo(a).plot.theme, text.spreads.map((s) => s.text).join(" ")),
      subtitles: cartoon.subtitles,
      vertical: set.vertical,
      verticalHeight: set.verticalHeight,
      music,
      musicVolume: set.musicVolume,
      timing: { ...CARTOON_TIMING, minSec: set.minSec, maxSec: set.maxSec, targetSec: set.targetSec },
      workDir: join(work, "render"),
      onProgress: (pct) => {
        if (pct - last < 5 && pct < 100) return;
        last = pct;
        db.cartoon.update({ where: { bookId }, data: { progress: Math.max(10, pct) } }).catch(() => {});
      },
    });
    await saveCartoonFile(bookId, "cartoon", out.square, "mp4", "video/mp4");
    if (out.vertical) await saveCartoonFile(bookId, "cartoon-vertical", out.vertical, "mp4", "video/mp4");
    else {
      const old = await db.bookFile.findMany({ where: { bookId, kind: "cartoon-vertical" } });
      for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
      await db.bookFile.deleteMany({ where: { bookId, kind: "cartoon-vertical" } });
    }
    await saveCartoonFile(bookId, "cartoon-poster", out.poster, "jpg", "image/jpeg");
    const now = new Date();
    await db.cartoon.update({
      where: { bookId },
      data: {
        status: "READY",
        progress: 100,
        durationSec: out.durationSec,
        renderSeconds: out.renderSec,
        deliveredAt: now,
        renderedKey: renderedKeyOf(cartoon, textHash),
        // Записи голоса живут 30 дней после выдачи мультфильма своим голосом
        ...(own ? { voicePurgeAt: voicePurgeDate(now, set.voicePurgeDays), voicePurgedAt: null } : {}),
      },
    });
    if (book.userId) await notifyUser(book.userId, "cartoon_ready", { title: text.title, bookId, own: own ? 1 : undefined });
    return out;
  } catch (e) {
    await db.cartoon.update({ where: { bookId }, data: { status: "FAILED", error: (e as Error).message.slice(0, 300) } }).catch(() => {});
    await alertOwner("Мультфильм не собрался", `Книга ${bookId}: ${(e as Error).message.slice(0, 500)}`).catch(() => {});
    throw e;
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
