// Черновик анкеты на сервере: к нему привязаны фото, загруженные до создания книги (анонимная cookie или аккаунт).
// Без книги фото живут limits.photoTtlNoBookHours (24 ч), после создания книги — limits.photoTtlDays (7 дней от загрузки).
import { db } from "./db";
import { signedUrl } from "./storage";
import type { PhotoMeta } from "./photo-process";

export interface Who {
  anonId: string;
  userId?: string | null;
}

const anonOk = (a: string) => Boolean(a) && a !== "no-anon";

/** Открытый (без книги) черновик этого браузера/аккаунта — создаётся при первой загрузке фото. */
export async function openDraft(who: Who) {
  const or = [...(anonOk(who.anonId) ? [{ anonId: who.anonId }] : []), ...(who.userId ? [{ userId: who.userId }] : [])];
  if (!or.length) throw new Error("no-anon");
  const found = await db.quizDraft.findFirst({ where: { bookId: null, OR: or }, orderBy: { createdAt: "desc" } });
  return found ?? db.quizDraft.create({ data: { anonId: who.anonId, userId: who.userId ?? undefined, answers: {} } });
}

/** Фото, которыми этот покупатель может распоряжаться: из своих черновиков или своих книг. */
export async function ownedPhotos(who: Who, ids: string[]) {
  if (!ids.length) return [];
  const drafts = await db.quizDraft.findMany({
    where: { OR: [...(anonOk(who.anonId) ? [{ anonId: who.anonId }] : []), ...(who.userId ? [{ userId: who.userId }] : [])] },
    select: { id: true },
  });
  const draftIds = drafts.map((d) => d.id);
  const bookOr = [...(who.userId ? [{ userId: who.userId }] : []), ...(anonOk(who.anonId) ? [{ anonId: who.anonId, userId: null }] : [])];
  const bookIds = bookOr.length ? (await db.book.findMany({ where: { OR: bookOr }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 200 })).map((b) => b.id) : [];
  return db.photo.findMany({
    where: {
      id: { in: ids.filter((x) => /^[0-9a-f-]{36}$/.test(x)) },
      deletedAt: null,
      expiresAt: { gt: new Date() },
      hero: {
        OR: [
          { id: "00000000-0000-0000-0000-000000000000" },
          ...(draftIds.length ? [{ draftId: { in: draftIds }, bookId: null }] : []),
          ...(bookIds.length ? [{ bookId: { in: bookIds } }] : []),
        ],
      },
    },
    include: { hero: true },
  });
}

/** Что видит анкета: обработанный портрет, исходник (для выбора лица), подсказки и предложенные чипсы. */
export async function photoView(p: { id: string; storageKey: string; originalKey: string | null; meta: unknown; hero: { role: string } }) {
  const meta = (p.meta ?? {}) as Partial<PhotoMeta>;
  return {
    id: p.id,
    slot: p.hero.role,
    url: await signedUrl("photos", p.storageKey, 3600),
    originalUrl: p.originalKey && (meta.faces?.length ?? 0) > 1 ? await signedUrl("photos", p.originalKey, 3600) : null,
    faces: meta.faces ?? [],
    chosen: meta.chosen ?? 0,
    verdict: meta.verdict ?? "ok",
    hints: meta.hints ?? [],
    codes: meta.codes ?? [],
    hair: meta.hair,
    fur: meta.fur,
  };
}
export type PhotoView = Awaited<ReturnType<typeof photoView>>;

/**
 * Книга создана из анкеты: фото героев переезжают к героям книги и получают срок «с книгой» (7 дней от загрузки).
 * Фото, уже привязанное к другой книге покупателя (вторая книга с тем же героем), — новая запись на тот же файл.
 */
export async function attachPhotosToBook(who: Who, heroIdBy: (photoId: string) => string | undefined, ids: string[], ttlDays: number) {
  const rows = await ownedPhotos(who, ids);
  let moved = 0;
  for (const p of rows) {
    const heroId = heroIdBy(p.id);
    if (!heroId) continue;
    const expiresAt = new Date(p.createdAt.getTime() + ttlDays * 86400_000);
    if (p.hero.bookId) {
      await db.photo.create({ data: { heroId, storageKey: p.storageKey, originalKey: p.originalKey, meta: p.meta ?? undefined, moderation: p.moderation, expiresAt: p.expiresAt > expiresAt ? p.expiresAt : expiresAt, createdAt: p.createdAt } });
    } else {
      await db.photo.update({ where: { id: p.id }, data: { heroId, expiresAt } });
    }
    moved++;
  }
  return moved;
}
