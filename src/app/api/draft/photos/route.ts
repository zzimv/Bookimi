import { randomUUID } from "node:crypto";
import { z } from "zod";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { body, err, json, throttle } from "@/lib/api";
import { anonId, currentUser } from "@/lib/auth";
import { cfg } from "@/lib/settings";
import { hasConsent } from "@/lib/consent";
import { deleteFile, getFile, putFile } from "@/lib/storage";
import { track } from "@/lib/events";
import { openDraft, ownedPhotos, photoView } from "@/lib/draft";
import { PhotoError, processPhoto, recropPhoto, MAX_PHOTO_BYTES, type PhotoMeta } from "@/lib/photo-process";
import { photoExpiry } from "@/lib/photos";

export const dynamic = "force-dynamic";

const SLOTS = ["main", "extra", "member"] as const;
const MAX_PER_DRAFT = 60;

async function who() {
  const [user, anon] = await Promise.all([currentUser(), anonId()]);
  return { userId: user?.id, anonId: anon };
}

/**
 * Фото героя в анкете — до книги и до входа. Сразу обрабатывается на сервере (photo-process.ts): тип по байтам,
 * EXIF-поворот, лицо, резкость, свет, портрет «голова и плечи». В ИИ не уходит до шага превью.
 * Хранится в бакете photos: без книги — 24 часа, с книгой — 7 дней.
 */
export async function POST(req: Request) {
  const t = await throttle("photo", 20, 60_000);
  if (t) return t;
  if (!(await cfg("flags")).photoUploadEnabled) return err("Приём фото пока выключен — опишите героя словами", 403);
  const w = await who();
  if (w.anonId === "no-anon" && !w.userId) return err("Обновите страницу и попробуйте ещё раз", 400);
  // Больше 16 МБ тело обрезается до разбора — сразу понятная ошибка, а не «выберите файл»
  if (Number(req.headers.get("content-length") ?? 0) > 16 * 1024 * 1024) return err("Файл больше 15 МБ — уменьшите фото или выберите другое", 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const slot = String(form?.get("slot") ?? "main") as (typeof SLOTS)[number];
  const kind = form?.get("kind") === "pet" ? "pet" : "human";
  if (!SLOTS.includes(slot)) return err("Некорректный запрос");
  if (!(await hasConsent("CHILD_PHOTO", w))) return err("Сначала дайте согласие на обработку фото", 403);
  if (slot === "member" && !(await hasConsent("GROUP_PHOTO", w))) return err("Подтвердите, что родители детей согласны на фото", 403);
  if (!(file instanceof File)) return err("Выберите файл");
  if (file.size > MAX_PHOTO_BYTES) return err("Файл больше 15 МБ");

  const draft = await openDraft(w);
  const live = await db.photo.count({ where: { hero: { draftId: draft.id, bookId: null }, deletedAt: null } });
  if (live >= MAX_PER_DRAFT) return err("Слишком много фото в одной анкете — удалите лишние");

  let processed;
  try {
    processed = await processPhoto(Buffer.from(await file.arrayBuffer()), { kind, adult: form?.get("adult") === "1" });
  } catch (e) {
    if (e instanceof PhotoError) return err(e.message);
    console.error("[photo]", (e as Error).message);
    return err("Не получилось обработать фото. Попробуйте другой файл.");
  }
  const id = randomUUID();
  const key = `draft/${draft.id}/${id}.jpg`;
  const originalKey = `draft/${draft.id}/${id}-o.jpg`;
  await putFile("photos", key, processed.portrait, "image/jpeg");
  await putFile("photos", originalKey, processed.original, "image/jpeg");
  const hero = await db.hero.create({ data: { draftId: draft.id, userId: w.userId, role: slot, name: "", appearance: {}, interests: [] } });
  const now = new Date();
  const photo = await db.photo.create({
    data: { id, heroId: hero.id, storageKey: key, originalKey, meta: processed.meta as object, createdAt: now, expiresAt: photoExpiry(now, false, await cfg("limits")) },
    include: { hero: true },
  });
  await track("photo_upload", { anonId: w.anonId, userId: w.userId ?? undefined, props: { slot, verdict: processed.meta.verdict } });
  return json(await photoView(photo));
}

/** Обновить ссылки (после перезагрузки страницы черновик хранит только id фото). Удалённые и просроченные — не вернутся. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_PER_DRAFT);
  const rows = await ownedPhotos(await who(), ids);
  return json({ photos: await Promise.all(rows.map(photoView)) });
}

const Pick = z.object({ id: z.string().uuid(), face: z.number().int().min(0).max(9) });

/** В кадре несколько людей — покупатель выбрал нужное лицо: новый портрет из сохранённого исходника. */
export async function PATCH(req: Request) {
  const b = await body(req, Pick);
  if (!b) return err("Некорректный запрос");
  const [p] = await ownedPhotos(await who(), [b.id]);
  if (!p || !p.originalKey) return err("Фото не найдено", 404);
  try {
    const r = await recropPhoto(await getFile("photos", p.originalKey), p.meta as unknown as PhotoMeta, b.face);
    const key = p.storageKey.replace(/(-v\d+)?\.jpg$/, `-v${Date.now().toString(36)}.jpg`);
    await putFile("photos", key, r.portrait, "image/jpeg");
    await deleteFile("photos", p.storageKey).catch(() => {});
    const up = await db.photo.update({ where: { id: p.id }, data: { storageKey: key, meta: r.meta as object }, include: { hero: true } });
    return json(await photoView(up));
  } catch (e) {
    return err(e instanceof PhotoError ? e.message : "Не получилось перекадрировать фото");
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("photo") ?? "";
  const [p] = await ownedPhotos(await who(), [id]);
  if (!p) return err("Не найдено", 404);
  // Фото книги удаляет кабинет; здесь — только фото черновика
  if (p.hero.bookId) return json({ ok: true, kept: true });
  await deleteFile("photos", p.storageKey).catch(() => {});
  if (p.originalKey) await deleteFile("photos", p.originalKey).catch(() => {});
  await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  return json({ ok: true });
}
