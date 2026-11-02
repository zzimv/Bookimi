import sharp, { type Metadata } from "sharp";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { err, json, ownBook, throttle } from "@/lib/api";
import { anonId } from "@/lib/auth";
import { cfg } from "@/lib/settings";
import { putFile, deleteFile } from "@/lib/storage";
import { track } from "@/lib/events";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Загрузка фото ребёнка. Только после отдельного согласия на обработку фото.
 * Фото перекодируется в JPEG (EXIF и геометки удаляются), хранится в бакете photos 7 дней.
 * Быстрая проверка качества: размер, резкость; лицо проверяется на GPU перед генерацией.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("photo", 20, 60_000);
  if (t) return t;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  // Книга уже нарисована (или рисуется после оплаты) — новые фото ни на что не повлияют, а хранить их незачем
  if (own.book.paidFull || ["FULL_QUEUED", "FULL_READY"].includes(own.book.status)) return err("Книга уже нарисована — фото больше не нужны", 409);
  const flags = await cfg("flags");
  if (!flags.photoUploadEnabled) return err("Приём фото пока выключен — иллюстрации будут по описанию", 403);
  const anon = await anonId();
  const consent = await db.consent.findFirst({
    where: { type: "CHILD_PHOTO", granted: true, OR: [{ anonId: anon }, ...(own.user ? [{ userId: own.user.id }] : [])] },
    orderBy: { createdAt: "desc" },
  });
  if (!consent) return err("Сначала дайте согласие на обработку фото", 403);

  // Больше 16 МБ тело обрезается до разбора — сразу понятная ошибка, а не «выберите файл»
  if (Number(req.headers.get("content-length") ?? 0) > 16 * 1024 * 1024) return err("Файл больше 15 МБ — уменьшите фото или выберите другое", 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const role = String(form?.get("role") ?? "main");
  if (!(file instanceof File)) return err("Выберите файл");
  if (file.size > MAX_BYTES) return err("Файл больше 15 МБ");
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return err("Подойдёт JPG, PNG или WebP");

  // keepsake — фото для страницы «Фото и посвящение» (rev 13): встаёт в книгу как есть, в рисунки не идёт
  let hero = await db.hero.findFirst({ where: { bookId: id, role }, orderBy: { createdAt: "asc" } });
  if (!hero && role === "keepsake") {
    const main = await db.hero.findFirst({ where: { bookId: id, role: "main" }, orderBy: { createdAt: "asc" } });
    hero = await db.hero.create({ data: { bookId: id, userId: main?.userId ?? own.user?.id ?? null, role: "keepsake", name: main?.name ?? "Фото", appearance: {}, interests: [] } });
  }
  if (!hero) return err("Герой не найден");
  if (role === "keepsake") {
    // Одно фото на странице: новое заменяет старое (старое удаляем сразу)
    const old = await db.photo.findMany({ where: { heroId: hero.id, deletedAt: null } });
    for (const o of old) {
      await deleteFile("photos", o.storageKey).catch(() => {});
      if (o.originalKey) await deleteFile("photos", o.originalKey).catch(() => {});
      await db.photo.update({ where: { id: o.id }, data: { deletedAt: new Date() } });
    }
  }
  const count = await db.photo.count({ where: { heroId: hero.id, deletedAt: null } });
  if (count >= (role === "main" ? 3 : 1)) return err(role === "main" ? "Не больше 3 фото" : "Одно фото на героя");

  let img: Buffer;
  let meta: Metadata;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    img = await sharp(input).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
    meta = await sharp(img).metadata();
  } catch {
    return err("Не получилось открыть фото. Попробуйте другой файл.");
  }
  const hints: string[] = [];
  const minSide = Math.min(meta.width ?? 0, meta.height ?? 0);
  if (minSide < 500) return err("Фото слишком маленькое. Нужно хотя бы 500 пикселей по короткой стороне.");
  if (minSide < 900) hints.push("Фото небольшое — лучше снять ближе.");
  // Резкость: дисперсия лапласиана на уменьшенной копии
  const lap = await sharp(img)
    .greyscale()
    .resize(512, 512, { fit: "inside" })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
    .stats();
  const sharpness = Math.round((lap.channels[0].stdev ?? 0) ** 2);
  if (sharpness < 40) hints.push("Фото нечёткое — при хорошем свете получится лучше.");
  const bright = (await sharp(img).greyscale().stats()).channels[0].mean;
  if (bright < 60) hints.push("Темновато — встаньте лицом к окну.");

  const limits = await cfg("limits");
  const key = `${id}/${randomUUID()}.jpg`;
  await putFile("photos", key, img, "image/jpeg");
  const photo = await db.photo.create({
    data: { heroId: hero.id, storageKey: key, expiresAt: new Date(Date.now() + limits.photoTtlDays * 86400_000) },
  });
  await track("photo_upload", { anonId: anon, userId: own.user?.id, props: { bookId: id } });
  return json({ id: photo.id, hints });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  const photoId = new URL(req.url).searchParams.get("photo") ?? "";
  const p = await db.photo.findFirst({ where: { id: photoId, hero: { bookId: id } } });
  if (!p) return err("Не найдено", 404);
  await deleteFile("photos", p.storageKey).catch(() => {});
  await db.photo.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  return json({ ok: true });
}
