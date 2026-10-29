import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";
import { err, json, ownBook, throttle } from "@/lib/api";
import { hasConsent } from "@/lib/consent";
import { deleteFile, putFile, signedUrl } from "@/lib/storage";
import { cueKind } from "@/lib/cartoon";
import { VOICE_LIMITS, sniffAudio } from "@/lib/cartoon-guide";
import { levels, splitUpload, validateVoiceFile } from "@/lib/gen/cartoon-voice";
import type { Cue } from "@/lib/gen/cartoon-script";

// «Озвучить своим голосом»: запись реплики в браузере или одна запись всего текста (режем по паузам).
// Только после покупки «Своим голосом» и отдельного согласия на обработку голоса. Формат — по сигнатуре файла.
// Записи — в приватном бакете, третьим лицам не передаются, удаляются через 30 дней после выдачи мультфильма.

async function access(id: string) {
  const own = await ownBook(id);
  if (!own || !own.user) return { error: err("Войдите в кабинет", 401) };
  const c = await db.cartoon.findUnique({ where: { bookId: id } });
  if (!c?.ownVoicePaid) return { error: err("Доступно после покупки «Мультфильм своим голосом»", 403) };
  if (!c) return { error: err("Мультфильм ещё не создан", 409) };
  if (!(await hasConsent("VOICE", { userId: own.user.id }))) return { error: err("Сначала отметьте согласие на обработку голоса", 403) };
  return { own, c };
}

type Rec = Record<string, { sec: number; peakDb: number; rmsDb: number; warnings: string[]; at: string }>;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const n = Number(new URL(req.url).searchParams.get("n"));
  const f = await db.bookFile.findFirst({ where: { bookId: id, kind: cueKind(n) }, orderBy: { createdAt: "desc" } });
  if (!f) return err("Нет записи", 404);
  return json({ url: await signedUrl("books", f.storageKey, 900) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("cartoon-voice", 60, 60_000);
  if (t) return t;
  const a = await access(id);
  if ("error" in a) return a.error;
  if (["QUEUED", "RENDERING"].includes(a.c.status)) return err("Мультфильм сейчас собирается — подождите пару минут");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const which = String(form?.get("cue") ?? "");
  if (!(file instanceof File)) return err("Нет файла");
  if (file.size > VOICE_LIMITS.maxFileBytes) return err("Файл больше 50 МБ");
  const buf = Buffer.from(await file.arrayBuffer());
  // Формат — по магическим байтам, расширение и тип из браузера не важны
  const s = sniffAudio(buf);
  if (!s.ok) return err(s.error ?? "Неподдерживаемый формат");
  const cues = ((a.c.script as { cues?: Cue[] } | null)?.cues ?? []) as Cue[];
  if (!cues.length) return err("Сценарий ещё готовится", 409);
  const work = await mkdtemp(join(tmpdir(), "voice-"));
  try {
    const v = await validateVoiceFile(buf, work, "in");
    if (!v.ok) return err(v.error);
    const rec: Rec = { ...((a.c.voiceCues ?? {}) as Rec) };
    const save = async (n: number, path: string, ext: string, type: string) => {
      const lv = await levels(path);
      const { probe } = await import("@/lib/gen/cartoon-render");
      const sec = (await probe(path)).duration;
      const kind = cueKind(n);
      const key = `${id}/cartoon-voice/${kind}-${Date.now().toString(36)}.${ext}`;
      await putFile("books", key, await readFile(path), type);
      const old = await db.bookFile.findMany({ where: { bookId: id, kind } });
      for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
      await db.bookFile.deleteMany({ where: { bookId: id, kind } });
      await db.bookFile.create({ data: { bookId: id, kind, storageKey: key } });
      rec[String(n)] = { sec: Math.round(sec * 10) / 10, peakDb: lv.peakDb, rmsDb: lv.rmsDb, warnings: lv.warnings, at: new Date().toISOString() };
    };
    if (which === "all") {
      // Одна запись всего текста: режем по паузам на реплики, оригинал не храним
      const parts = await splitUpload(v.file, cues.map((c) => c.targetSec), join(work, "parts"));
      for (let i = 0; i < cues.length; i++) await save(cues[i].n, parts[i], "wav", "audio/wav");
    } else {
      const n = Number(which);
      if (!cues.some((c) => c.n === n)) return err("Нет такой реплики");
      if (v.meta.duration > VOICE_LIMITS.maxCueSec) return err(`Реплика длиннее ${VOICE_LIMITS.maxCueSec} секунд — запишите её короче`);
      await save(n, v.file, s.ext!, file.type || "application/octet-stream");
    }
    const total = Object.values(rec).reduce((x, r) => x + r.sec, 0);
    await db.cartoon.update({ where: { bookId: id }, data: { voiceCues: rec, voicePurgedAt: null } });
    return json({ recorded: rec, totalSec: Math.round(total * 10) / 10, overLimit: total > VOICE_LIMITS.maxTotalSec });
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const n = Number(new URL(req.url).searchParams.get("n"));
  const kind = cueKind(n);
  const old = await db.bookFile.findMany({ where: { bookId: id, kind } });
  for (const o of old) await deleteFile("books", o.storageKey).catch(() => {});
  await db.bookFile.deleteMany({ where: { bookId: id, kind } });
  const rec = { ...((a.c.voiceCues ?? {}) as Rec) };
  delete rec[String(n)];
  await db.cartoon.update({ where: { bookId: id }, data: { voiceCues: rec } });
  return json({ recorded: rec });
}
