// «Мультфильм по книге» — состояние в БД: покупка, очередь рендера, пересборка, ссылка «Поделиться»,
// записи своего голоса и их удаление через 30 дней после выдачи. Рендер — src/lib/gen/cartoon.ts (воркер).
import { randomBytes } from "node:crypto";
import type { Book, Cartoon } from "@prisma/client";
import { db } from "./db";
import { cfg } from "./settings";
import { deleteFile } from "./storage";
import { voiceDueForPurge } from "./cartoon-guide";
import { scriptHash, type Cue } from "./gen/cartoon-script";
import type { StoryText } from "./gen/text";

/** Текст книги с правками покупателя (BookPage.text) — источник сценария. */
export async function bookText(book: Book): Promise<StoryText> {
  const text = book.text as unknown as StoryText;
  const pages = await db.bookPage.findMany({ where: { bookId: book.id }, select: { index: true, text: true } });
  return { title: text.title, spreads: text.spreads.map((s) => ({ ...s, text: pages.find((p) => p.index === s.index)?.text ?? s.text })) };
}

export const bookTextHash = (text: StoryText, dedication: string) => scriptHash([{ text: text.title }, ...text.spreads, { text: dedication }]);

/** Что собрано — чтобы понять, изменилось ли что-то для бесплатной пересборки. */
export const renderedKeyOf = (c: Pick<Cartoon, "voiceMode" | "voice" | "subtitles">, textHash: string) => `${c.voiceMode}|${c.voice ?? ""}|${c.subtitles ? 1 : 0}|${textHash}`;

export const CARTOON_KEYS = ["cartoon", "cartoon-own-voice"] as const;
const paidItem = { order: { paidAt: { not: null }, status: { notIn: ["REFUNDED", "CANCELLED"] as ("REFUNDED" | "CANCELLED")[] } } };

/** Что куплено к книге: мультфильм и «своим голосом». */
export async function cartoonPurchase(bookId: string) {
  const items = await db.orderItem.findMany({ where: { bookId, refKey: { in: [...CARTOON_KEYS] }, ...paidItem }, select: { refKey: true } });
  return { cartoon: items.some((i) => i.refKey === "cartoon"), ownVoice: items.some((i) => i.refKey === "cartoon-own-voice") };
}

export async function enqueueCartoon(bookId: string) {
  await db.cartoon.update({ where: { bookId }, data: { status: "QUEUED", progress: 0, error: null } });
  const { getBoss, QUEUES } = await import("./queue");
  const boss = await getBoss();
  await boss.send(QUEUES.generateCartoon, { bookId }, { retryLimit: 1, retryDelay: 120, singletonKey: `cartoon-${bookId}` });
}

/**
 * Оплачен заказ с мультфильмом. fromFull — вызов из runFull (книга только что готова).
 * Докупка из кабинета (без формата) обрабатывается здесь целиком: true — генерация книги не нужна.
 */
export async function onCartoonPaid(bookId: string, items: { refKey: string; bookId?: string | null }[], opts: { fromFull?: boolean } = {}): Promise<boolean> {
  const mine = items.filter((i) => !i.bookId || i.bookId === bookId);
  const hasCartoon = mine.some((i) => i.refKey === "cartoon");
  const hasOwn = mine.some((i) => i.refKey === "cartoon-own-voice");
  if (!hasCartoon && !hasOwn) return false;
  const book = await db.book.findUnique({ where: { id: bookId }, select: { paidFull: true, status: true } });
  if (!book) return false;
  // Докупка вместе с другими допами (аудио, раскраска) или к ещё не готовой книге — пусть идёт обычная генерация
  if (!opts.fromFull && (!book.paidFull || book.status !== "FULL_READY" || mine.some((i) => !(CARTOON_KEYS as readonly string[]).includes(i.refKey)))) return false;
  const c = await cfg("cartoon");
  const existing = await db.cartoon.findUnique({ where: { bookId } });
  const row = await db.cartoon.upsert({
    where: { bookId },
    update: hasOwn ? { ownVoicePaid: true } : {},
    create: { bookId, ownVoicePaid: hasOwn, subtitles: c.subtitles, rerendersLeft: c.freeRerenders, ownBuildsLeft: c.ownVoiceBuilds },
  });
  // Новый мультфильм — сразу собираем с диктором (свой голос — когда покупатель запишет реплики)
  if (hasCartoon && (!existing || existing.status === "PENDING" || existing.status === "FAILED")) await enqueueCartoon(bookId);
  else if (hasCartoon && row.status !== "READY") await enqueueCartoon(bookId);
  return true;
}

export interface CartoonView {
  status: Cartoon["status"] | "NONE";
  progress: number;
  error: string | null;
  voiceMode: string;
  voice: string | null;
  subtitles: boolean;
  ownVoicePaid: boolean;
  rerendersLeft: number;
  ownBuildsLeft: number;
  durationSec: number | null;
  cues: Cue[];
  recorded: Record<string, { sec: number; warnings: string[] }>;
  share: { token: string; expiresAt: string } | null;
  voicePurgeAt: string | null;
  voicePurged: boolean;
  files: string[];
}

export function viewOf(c: Cartoon | null, files: string[]): CartoonView {
  const script = (c?.script ?? null) as { cues?: Cue[] } | null;
  const rec = (c?.voiceCues ?? {}) as Record<string, { sec: number; warnings: string[] }>;
  const shareOk = c?.shareToken && c.shareExpiresAt && c.shareExpiresAt > new Date();
  return {
    status: c?.status ?? "NONE",
    progress: c?.progress ?? 0,
    error: c?.error ?? null,
    voiceMode: c?.voiceMode ?? "auto",
    voice: c?.voice ?? null,
    subtitles: c?.subtitles ?? true,
    ownVoicePaid: c?.ownVoicePaid ?? false,
    rerendersLeft: c?.rerendersLeft ?? 0,
    ownBuildsLeft: c?.ownBuildsLeft ?? 0,
    durationSec: c?.durationSec ?? null,
    cues: script?.cues ?? [],
    recorded: Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, { sec: v.sec, warnings: v.warnings ?? [] }])),
    share: shareOk ? { token: c!.shareToken!, expiresAt: c!.shareExpiresAt!.toISOString() } : null,
    voicePurgeAt: c?.voicePurgeAt?.toISOString() ?? null,
    voicePurged: Boolean(c?.voicePurgedAt),
    files,
  };
}

export async function cartoonView(bookId: string): Promise<CartoonView> {
  const [c, files] = await Promise.all([
    db.cartoon.findUnique({ where: { bookId } }),
    db.bookFile.findMany({ where: { bookId, kind: { in: ["cartoon", "cartoon-vertical", "cartoon-poster"] } }, select: { kind: true } }),
  ]);
  return viewOf(c, files.map((f) => f.kind));
}

// ── Ссылка «Поделиться»: случайный токен на 30 дней, можно отозвать; страница /mult/<токен> не индексируется ──

export const newShareToken = () => randomBytes(18).toString("base64url");

export async function createShare(bookId: string) {
  const c = await cfg("cartoon");
  const token = newShareToken();
  const expires = new Date(Date.now() + c.shareDays * 86400_000);
  await db.cartoon.update({ where: { bookId }, data: { shareToken: token, shareExpiresAt: expires } });
  return { token, expiresAt: expires };
}

export async function revokeShare(bookId: string) {
  await db.cartoon.update({ where: { bookId }, data: { shareToken: null, shareExpiresAt: null } });
}

export async function sharedCartoon(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const c = await db.cartoon.findUnique({ where: { shareToken: token }, include: { book: { select: { id: true, text: true } } } });
  if (!c || !c.shareExpiresAt || c.shareExpiresAt < new Date() || c.status !== "READY") return null;
  return c;
}

// ── Записи своего голоса ──

export const cueKind = (n: number) => `cartoon-cue-${String(n).padStart(2, "0")}`;
export const UPLOAD_KIND = "cartoon-voice-upload";

/** Удалить записи голоса книги (по сроку, по отзыву согласия или по кнопке). */
export async function deleteVoiceFiles(bookId: string) {
  const files = await db.bookFile.findMany({ where: { bookId, kind: { startsWith: "cartoon-cue-" } } });
  const up = await db.bookFile.findMany({ where: { bookId, kind: UPLOAD_KIND } });
  for (const f of [...files, ...up]) await deleteFile("books", f.storageKey).catch(() => {});
  await db.bookFile.deleteMany({ where: { id: { in: [...files, ...up].map((f) => f.id) } } });
  return files.length + up.length;
}

/** Плановое удаление: записи голоса через 30 дней после выдачи мультфильма. */
export async function purgeCartoonVoices(now = new Date()) {
  const due = await db.cartoon.findMany({ where: { voicePurgeAt: { lte: now }, voicePurgedAt: null } });
  let n = 0;
  for (const c of due) {
    if (!voiceDueForPurge(c, now)) continue;
    n += await deleteVoiceFiles(c.bookId);
    await db.cartoon.update({ where: { id: c.id }, data: { voicePurgedAt: now, voiceCues: {} } });
  }
  return n;
}
