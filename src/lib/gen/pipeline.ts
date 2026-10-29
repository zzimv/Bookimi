// Конвейер генерации (выполняется в воркере):
//  text    — сказка текстом (бесплатно, до 3 в сутки с устройства, переписать — до 2 раз)
//  preview — обложка + 2 разворота с водяным знаком (1 в сутки на контакт, суточный лимит расходов)
//  full    — после оплаты: остальные развороты, PDF всех форматов, аудио, файлы допов
//  redraw  — перерисовка одной иллюстрации (3 бесплатно, далее платно)
//  mood    — смена настроения: перерисовать все готовые иллюстрации книги с новым настроением
import sharp from "sharp";
import type { Book } from "@prisma/client";
import { db } from "../db";
import { cfg } from "../settings";
import { Answers, appearanceLine, extraGender, heroAge, type QuizAnswers } from "../quiz";
import { personalize, plotForAnswers, textProvider, dedicationText, type StoryText } from "./text";
import { imageProvider, type HeroRef, type ImageResult, type SceneJob } from "./image";
import { watermark } from "../../content/art/render";
import { mood as moodById } from "../../content/registry";
import { extraDrawKind } from "../../content/art/index";
import { HERO_KIND_BY_AUDIENCE, type DemoLook, type HeroKind } from "../../content/types";
import type { ExtraV2T } from "../../content/answers";
import { guessGender } from "../declension";
import { getFile, putFile, deleteFile } from "../storage";
import { renderPdf, type BookPageData } from "../pdf";
import { ttsProvider } from "./tts";
import { spentTodayRub } from "../limits";
import { alertOwner, notifyUser } from "../notify";
import { track } from "../events";
import { checkText } from "../moderation";
import { personsOf, redactForImage } from "./redact";

export class LimitReached extends Error {}

const answersOf = (b: Book) => Answers.parse(b.params);

async function cost(bookId: string, provider: string, operation: string, r: { gpuSeconds?: number; costKopecks: number }) {
  await db.generationCost.create({ data: { bookId, provider, operation, gpuSeconds: r.gpuSeconds ?? 0, costKopecks: r.costKopecks } });
}

// ── Текст ──
export async function runText(bookId: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { story: true } });
  const a = answersOf(book);
  const ai = await cfg("ai");
  const provider = textProvider(ai.text);
  // Суточный лимит расходов — как у превью (демо-текст бесплатен, оплаченные книги — всегда)
  if (provider.name !== "demo" && !book.paidFull) {
    const limits = await cfg("limits");
    if ((await spentTodayRub()) >= limits.dailySpendRub) {
      await db.book.update({ where: { id: bookId }, data: { error: "limit" } });
      throw new LimitReached("Суточный лимит расходов исчерпан");
    }
  }
  const variant = 2 - book.rewritesLeft;
  await db.book.update({ where: { id: bookId }, data: { status: "TEXT_QUEUED", progress: 20, error: null } });
  const r = await provider.write(a, plotForAnswers(a), Math.max(0, variant));
  const text = personalize(r.raw, a);
  const bad = checkText([text.title, ...text.spreads.map((s) => s.text)].join("\n"));
  if (bad) throw new Error(`модерация текста: ${bad}`);
  await cost(bookId, r.provider, "text", r);
  await db.book.update({ where: { id: bookId }, data: { status: "TEXT_READY", textRaw: r.raw as object, text: text as object, progress: 100 } });
  await track("text_ready", { anonId: book.anonId ?? undefined, userId: book.userId, props: { bookId } });
}

// ── Герои и фото ──
async function preparePhoto(key: string) {
  const buf = await getFile("photos", key);
  return sharp(buf).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

/** Внешность главного героя для демо-рисовальщика. */
function heroLook(a: QuizAnswers): DemoLook {
  const p = a.appearance;
  return {
    gender: a.hero.gender,
    age: heroAge(a),
    hair: p.hair,
    hairstyle: p.hairstyle,
    longHair: /длинн|хвост|косич|кудр|пучок|коса/i.test(p.hairstyle ?? ""),
    skin: p.skin,
    glasses: p.glasses,
    freckles: p.freckles,
    beard: p.beard,
    species: a.pet.species,
    breed: a.pet.breed,
    furColor: a.pet.furColor,
  };
}

const EXTRA_AGE: Record<string, number> = { mom: 35, dad: 37, grandma: 68, grandpa: 70, owner: 34, colleague: 38 };

/** Внешность доп. героя для демо: род, возраст по роли, питомец, «свой вариант». */
function extraLook(e: ExtraV2T, a: QuizAnswers): DemoLook {
  const g = extraGender(e, guessGender);
  const age = e.role === "partner" ? heroAge(a) : e.role === "child" || e.role === "grandchild" ? 7 : EXTRA_AGE[e.role];
  return { gender: g === "n" ? undefined : g, age, species: e.species, thing: e.what || (e.role === "toy" ? e.name : undefined), furColor: e.role === "pet" ? e.description : undefined };
}

async function heroesFor(book: Book, a: QuizAnswers): Promise<HeroRef[]> {
  const rows = await db.hero.findMany({ where: { bookId: book.id }, include: { photos: { where: { deletedAt: null } } }, orderBy: { createdAt: "asc" } });
  const main = rows.find((h) => h.role === "main");
  const refs: HeroRef[] = [];
  const mainPhotos = book.withPhoto && main ? await Promise.all(main.photos.slice(0, 3).map((p) => preparePhoto(p.storageKey).catch(() => null))) : [];
  const sheetKey = main?.characterSheetKey;
  // Свободный текст анкеты в промпт картинок — без имён (→ «the hero», «the friend») и контактов
  const persons = personsOf(a, (e) => extraGender(e as ExtraV2T, guessGender));
  const clean = (t: string) => redactForImage(t, persons);
  refs.push({
    role: "main",
    description: clean(appearanceLine(a)),
    photos: mainPhotos.filter(Boolean) as Buffer[],
    sheet: sheetKey ? await getFile("books", sheetKey).catch(() => null) : null,
    look: heroLook(a),
  });
  const kind = HERO_KIND_BY_AUDIENCE[a.audience];
  for (const e of a.extras) {
    const row = rows.find((h) => h.role === e.role && h.name === e.name);
    const photos = book.withPhoto && row ? await Promise.all(row.photos.slice(0, 1).map((p) => preparePhoto(p.storageKey).catch(() => null))) : [];
    refs.push({
      role: e.role === "custom" && e.what ? clean(e.what) || e.role : e.role,
      description: clean([e.what, e.description].filter(Boolean).join(", ")),
      photos: photos.filter(Boolean) as Buffer[],
      look: extraLook(e, a),
      drawKind: extraDrawKind(e.role, kind),
    });
  }
  return refs;
}

/** Тема «своей истории» (нет сюжета) — по аудитории. */
const IDEA_THEME: Record<string, string> = { CHILD: "dragon", TEEN: "city-night", ADULT: "home", PET: "pet-home" };

/** Что рисуем: сюжет (тема, вид героя) и обложка. Для своей идеи — тема аудитории. */
function plotInfo(a: QuizAnswers): { plot: SceneJob["plot"]; coverScene: string | null } {
  const plot = plotForAnswers(a);
  const heroKind: HeroKind = HERO_KIND_BY_AUDIENCE[a.audience];
  if (plot) return { plot: { slug: plot.slug, theme: plot.theme, heroKind: plot.heroKind }, coverScene: plot.coverScene };
  return { plot: { slug: "svoya-ideya", theme: IDEA_THEME[a.audience] ?? "meadow", heroKind }, coverScene: null };
}

// ── Иллюстрации ──
async function savePage(book: Book, index: number, img: ImageResult, text: string | null) {
  const key = `${book.id}/p${String(index).padStart(2, "0")}-v${Date.now().toString(36)}.${img.ext}`;
  await putFile("books", key, img.data, img.contentType);
  // Превью: водяной знак и низкое разрешение
  let previewKey: string;
  if (img.ext === "svg") {
    const svg = img.data.toString().replace("</svg>", `${watermark(index === 0 ? 1024 : 2048, 1024)}</svg>`);
    previewKey = key.replace(/\.svg$/, "-preview.svg");
    await putFile("books", previewKey, Buffer.from(svg), "image/svg+xml");
  } else {
    const meta = await sharp(img.data).metadata();
    const w = Math.min(900, meta.width ?? 900);
    const small = sharp(img.data).resize({ width: w });
    const h = Math.round(((meta.height ?? w) * w) / (meta.width ?? w));
    const mark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${watermark(w, h).replace('font-size="44"', 'font-size="28"')}</svg>`);
    const out = await small.composite([{ input: mark }]).jpeg({ quality: 70 }).toBuffer();
    previewKey = key.replace(/\.png$/, "-preview.jpg");
    await putFile("books", previewKey, out, "image/jpeg");
  }
  const prev = await db.bookPage.findUnique({ where: { bookId_index: { bookId: book.id, index } } });
  await db.bookPage.upsert({
    where: { bookId_index: { bookId: book.id, index } },
    update: { imageKey: key, previewKey, text, version: { increment: 1 }, moderation: "ok" },
    create: { bookId: book.id, index, imageKey: key, previewKey, text, moderation: "ok" },
  });
  if (prev?.imageKey) await deleteFile("books", prev.imageKey).catch(() => {});
  if (prev?.previewKey && prev.previewKey !== previewKey) await deleteFile("books", prev.previewKey).catch(() => {});
}

async function drawPages(book: Book, indices: number[], opts: { preview: boolean; variant?: number }) {
  const a = answersOf(book);
  const ai = await cfg("ai");
  const gpu = await cfg("gpu");
  const provider = imageProvider(ai.image, gpu.hourlyRub);
  const text = book.text as unknown as StoryText;
  const { plot, coverScene } = plotInfo(a);
  const heroes = await heroesFor(book, a);
  const age = heroAge(a);
  const mood = book.mood ? moodById(book.mood) : null;

  // Лист персонажа — один раз на книгу (только если есть фото и настоящий провайдер)
  if (heroes[0].photos.length && !heroes[0].sheet) {
    const sheet = await provider.sheet(heroes[0], { plot, style: book.styleKey, age, gender: a.hero.gender });
    if (sheet) {
      const key = `${book.id}/sheet-main.png`;
      await putFile("books", key, sheet.data, sheet.contentType);
      await db.hero.updateMany({ where: { bookId: book.id, role: "main" }, data: { characterSheetKey: key } });
      heroes[0].sheet = sheet.data;
      await cost(book.id, provider.name, "sheet", sheet);
    }
  }

  let done = 0;
  for (const index of indices) {
    const scene = index === 0 ? coverScene ?? text.spreads[0]?.scene ?? "the hero on an adventure" : text.spreads[index - 1]?.scene ?? "";
    const img = await provider.scene({
      plot,
      index,
      scene,
      style: book.styleKey,
      mood,
      heroes,
      age,
      gender: a.hero.gender,
      preview: opts.preview,
      title: text.title,
    });
    await cost(book.id, provider.name, index === 0 ? "cover" : "scene", img);
    await savePage(book, index, img, index === 0 ? text.title : text.spreads[index - 1]?.text ?? null);
    done++;
    await db.book.update({ where: { id: book.id }, data: { progress: Math.round((done / indices.length) * (opts.preview ? 100 : 70)) } });
  }
}

export async function runPreview(bookId: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId } });
  if (!book.paidFull) {
    const limits = await cfg("limits");
    const spent = await spentTodayRub();
    if (spent >= limits.dailySpendRub) {
      await db.book.update({ where: { id: bookId }, data: { error: "limit" } });
      const key = `spend-alert-${new Date().toISOString().slice(0, 10)}-100`;
      if (!(await db.auditLog.findFirst({ where: { action: key } }))) {
        await db.auditLog.create({ data: { action: key, entity: "alert" } });
        await alertOwner("Лимит расходов на генерацию исчерпан", `Потрачено ${spent} ₽ из ${limits.dailySpendRub} ₽. Новые превью ждут в очереди. Поднять лимит: админка → Настройки → Лимиты.`);
      }
      throw new LimitReached("Суточный лимит расходов исчерпан");
    }
  }
  await db.book.update({ where: { id: bookId }, data: { status: "PREVIEW_QUEUED", progress: 5, error: null } });
  await drawPages(book, [0, 1, 2], { preview: true });
  await db.book.update({ where: { id: bookId }, data: { status: "PREVIEW_READY", previewReadyAt: new Date(), progress: 100 } });
  await track("preview_ready", { anonId: book.anonId ?? undefined, userId: book.userId, props: { bookId } });
  if (book.userId) await notifyUser(book.userId, "preview_ready", { title: (book.text as unknown as StoryText).title, bookId });
  await spendAlerts();
}

async function spendAlerts() {
  const limits = await cfg("limits");
  const a = await cfg("alerts");
  const spent = await spentTodayRub();
  for (const pct of a.spendPct) {
    if (pct >= 100 || (spent / limits.dailySpendRub) * 100 < pct) continue;
    const key = `spend-alert-${new Date().toISOString().slice(0, 10)}-${pct}`;
    if (await db.auditLog.findFirst({ where: { action: key } })) continue;
    await db.auditLog.create({ data: { action: key, entity: "alert" } });
    await alertOwner(`Расходы на генерацию: ${pct}% лимита`, `Сегодня потрачено ${spent} ₽ из ${limits.dailySpendRub} ₽.`);
  }
}

// ── Полная книга ──
export async function bookPdfData(bookId: string, orderCode?: string): Promise<BookPageData> {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { pages: { orderBy: { index: "asc" } } } });
  const a = answersOf(book);
  const text = book.text as unknown as StoryText;
  const img = async (key: string | null) => {
    if (!key) return { data: Buffer.from(""), contentType: "image/png" };
    const data = await getFile("books", key);
    // Демо-SVG с фильтрами (фактура, настроение) Chromium растрирует в огромные PDF — переводим в JPEG заранее
    if (key.endsWith(".svg")) {
      const jpg = await sharp(data, { density: 72 }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer().catch(() => null);
      if (jpg) return { data: jpg, contentType: "image/jpeg" };
      return { data, contentType: "image/svg+xml" };
    }
    return { data, contentType: "image/png" };
  };
  const cover = book.pages.find((p) => p.index === 0);
  return {
    title: text.title,
    dedication: dedicationText(a),
    heroName: a.hero.name,
    audience: a.audience,
    heroGender: a.hero.gender,
    cover: await img(cover?.imageKey ?? null),
    spreads: await Promise.all(
      text.spreads.map(async (s) => ({ text: book.pages.find((p) => p.index === s.index)?.text ?? s.text, image: await img(book.pages.find((p) => p.index === s.index)?.imageKey ?? null) })),
    ),
    orderCode,
  };
}

async function saveFile(bookId: string, kind: string, data: Buffer, ext: string, type: string) {
  const key = `${bookId}/files/${kind}-${Date.now().toString(36)}.${ext}`;
  await putFile("books", key, data, type);
  const old = await db.bookFile.findMany({ where: { bookId, kind } });
  for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
  await db.bookFile.deleteMany({ where: { bookId, kind } });
  await db.bookFile.create({ data: { bookId, kind, storageKey: key } });
}

export async function renderBookFiles(bookId: string, orderId?: string) {
  const order = orderId ? await db.order.findUnique({ where: { id: orderId }, include: { items: true } }) : null;
  const data = await bookPdfData(bookId, order?.publicCode);
  await saveFile(bookId, "pdf-screen", await renderPdf(data, { kind: "screen" }), "pdf", "application/pdf");
  await saveFile(bookId, "pdf-a4", await renderPdf(data, { kind: "a4" }), "pdf", "application/pdf");
  await saveFile(bookId, "pdf-print-210", await renderPdf(data, { kind: "print", wMm: 210, hMm: 210 }), "pdf", "application/pdf");
  await saveFile(bookId, "pdf-print-150", await renderPdf(data, { kind: "print", wMm: 150, hMm: 150 }), "pdf", "application/pdf");
  // Для печати в типографии — блок и обложка заказанного формата
  const fmtItem = order?.items.find((i) => i.kind === "format" && i.refKey !== "pdf");
  if (fmtItem) {
    const f = await db.productFormat.findUnique({ where: { key: fmtItem.refKey } });
    if (f?.widthMm && f.heightMm) {
      await saveFile(bookId, "print-block", await renderPdf(data, { kind: "print", wMm: f.widthMm, hMm: f.heightMm }), "pdf", "application/pdf");
      await saveFile(bookId, "print-cover", await renderPdf(data, { kind: "cover", wMm: f.widthMm, hMm: f.heightMm, hard: f.cover === "HARD", pages: 26 }), "pdf", "application/pdf");
    }
  }
}

export async function runFull(bookId: string, orderId?: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { pages: true } });
  await db.book.update({ where: { id: bookId }, data: { status: "FULL_QUEUED", progress: 5, error: null } });
  const have = new Set(book.pages.filter((p) => p.imageKey).map((p) => p.index));
  const need = Array.from({ length: 13 }, (_, i) => i).filter((i) => !have.has(i));
  await drawPages(book, need, { preview: false });
  await db.book.update({ where: { id: bookId }, data: { progress: 75 } });
  await renderBookFiles(bookId, orderId);
  await db.book.update({ where: { id: bookId }, data: { progress: 90 } });
  const order = orderId ? await db.order.findUnique({ where: { id: orderId }, include: { items: true } }) : null;
  if (order?.items.some((i) => i.refKey === "audiobook")) await runAudio(bookId);
  if (order?.items.some((i) => i.refKey === "coloring")) await renderColoring(bookId);
  await db.book.update({ where: { id: bookId }, data: { status: "FULL_READY", fullReadyAt: new Date(), progress: 100 } });
  if (book.userId) {
    await notifyUser(book.userId, "book_ready", { title: (book.text as unknown as StoryText).title, audio: order?.items.some((i) => i.refKey === "audiobook") ? 1 : undefined });
  }
  if (order?.whoPrints === "bookimi") {
    const { sendToPrint } = await import("../print");
    await sendToPrint(order.id).catch((e) => alertOwner("Не удалось передать заказ в печать", `${order.publicCode}: ${(e as Error).message}`));
  }
}

export async function runAudio(bookId: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId } });
  const ai = await cfg("ai");
  const text = book.text as unknown as StoryText;
  const tts = ttsProvider(ai.tts);
  const r = await tts.synth([text.title, ...text.spreads.map((s) => s.text)], book.audioVoice ?? "alena");
  await cost(bookId, tts.name, "tts", r);
  await saveFile(bookId, "audio", r.data, r.ext, r.ext === "mp3" ? "audio/mpeg" : "audio/wav");
}

/** Раскраска: иллюстрации, переведённые в контур (sharp: оттенки серого + выделение границ). */
export async function renderColoring(bookId: string) {
  const data = await bookPdfData(bookId);
  const toLines = async (img: { data: Buffer; contentType: string }) => {
    if (img.contentType === "image/svg+xml" || !img.data.length) return img;
    const out = await sharp(img.data)
      .greyscale()
      .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
      .negate()
      .threshold(200)
      .png()
      .toBuffer();
    return { data: out, contentType: "image/png" };
  };
  const lines = { ...data, cover: await toLines(data.cover), spreads: await Promise.all(data.spreads.map(async (s) => ({ ...s, image: await toLines(s.image) }))) };
  await saveFile(bookId, "coloring", await renderPdf(lines, { kind: "a4" }), "pdf", "application/pdf");
}

/**
 * Смена настроения: перерисовать все уже готовые иллюстрации (до оплаты — обложку и 2 разворота превью,
 * после — всю книгу) и пересобрать PDF. Цена и лимиты — в api/books/[id]/action (ASSUMPTIONS.md).
 */
export async function runMood(bookId: string) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, include: { pages: true } });
  const indices = book.pages.filter((p) => p.imageKey).map((p) => p.index).sort((x, y) => x - y);
  const full = book.paidFull;
  await db.book.update({ where: { id: bookId }, data: { status: full ? "FULL_QUEUED" : "PREVIEW_QUEUED", progress: 5, error: null } });
  await drawPages(book, indices.length ? indices : [0, 1, 2], { preview: !full });
  if (full) await renderBookFiles(bookId);
  await db.book.update({ where: { id: bookId }, data: { status: full ? "FULL_READY" : "PREVIEW_READY", progress: 100 } });
}

export async function runRedraw(bookId: string, index: number) {
  const book = await db.book.findUniqueOrThrow({ where: { id: bookId } });
  if (index < 0) return renderBookFiles(bookId); // правка текста — только перевёрстка PDF
  await drawPages(book, [index], { preview: !book.paidFull, variant: Date.now() % 1000 });
  if (book.paidFull) await renderBookFiles(bookId);
}
