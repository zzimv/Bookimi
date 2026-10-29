// «Книга для каждого в группе» на сервере: копии книги (Book.parentBookId) — в каждой свой герой, остальные — в группе.
// Тексты копий сочиняются лениво: первые bulk.previewCopies (вместе с основной) — сразу, с превью; остальные —
// после оплаты (runFull сочинит текст, если его ещё нет). Посвящение — общий шаблон, имя подставляется в каждой.
import type { Book } from "@prisma/client";
import { db } from "./db";
import { cfg } from "./settings";
import { AnswersV2, type QuizAnswers } from "./quiz";
import { bulkCopyAnswers, DEFAULT_BULK_DEDICATION } from "./bulk";
import { plotBySlug } from "../content/registry";
import { enqueue, QUEUES } from "./queue";
import { signedUrl } from "./storage";
import { dedicationText } from "./gen/text";

/** Можно ли заказать «для каждого»: сюжет с группой и хотя бы один ребёнок в списке. */
export function bulkAvailable(a: QuizAnswers) {
  const plot = a.story.slug ? plotBySlug(a.story.slug) : null;
  return Boolean(plot?.group && (a.group?.members.length ?? 0) > 0);
}

/** Создать недостающие копии (идемпотентно) и поставить в очередь тексты первых. Возвращает копии по порядку. */
export async function ensureBulkCopies(parent: Book, opts: { dedication?: string } = {}) {
  const a = AnswersV2.parse(parent.params);
  if (!bulkAvailable(a)) throw new Error("Заказ «для каждого» — только для книг о группе или классе");
  const settings = await cfg("bulk");
  const dedication = (opts.dedication ?? (await currentTemplate(parent.id)) ?? DEFAULT_BULK_DEDICATION).trim().slice(0, 300);
  const existing = await db.book.findMany({ where: { parentBookId: parent.id }, orderBy: { createdAt: "asc" } });
  const members = a.group?.members ?? [];
  const out: Book[] = [];
  for (let i = 1; i <= members.length; i++) {
    const params = bulkCopyAnswers(a, i, dedication);
    let b = existing.find((x) => (x.params as { bulkIndex?: number }).bulkIndex === i);
    if (!b) {
      b = await db.book.create({
        data: {
          userId: parent.userId,
          anonId: parent.anonId,
          parentBookId: parent.id,
          storyId: parent.storyId,
          styleKey: parent.styleKey,
          mood: parent.mood,
          dedication,
          params: { ...params, bulkIndex: i } as object,
          status: "DRAFT",
        },
      });
      await db.hero.create({ data: { bookId: b.id, userId: parent.userId, role: "main", name: params.hero.name, gender: params.hero.gender, ageGroup: params.hero.ageGroup, appearance: params.appearance as object, interests: [] } });
      // Фото ребёнка (если загружено с согласия родителей) — герою его книги
      const member = members[i - 1];
      if (member.photoId) {
        const src = await db.photo.findFirst({ where: { id: member.photoId, deletedAt: null, hero: { bookId: parent.id } } });
        const hero = await db.hero.findFirst({ where: { bookId: b.id, role: "main" } });
        if (src && hero) {
          await db.photo.create({ data: { heroId: hero.id, storageKey: src.storageKey, originalKey: src.originalKey, meta: src.meta ?? undefined, expiresAt: src.expiresAt, createdAt: src.createdAt } });
          await db.book.update({ where: { id: b.id }, data: { withPhoto: true } });
        }
      }
    } else if (opts.dedication !== undefined && b.dedication !== dedication) {
      const p = { ...(b.params as object), dedication };
      b = await db.book.update({ where: { id: b.id }, data: { dedication, params: p } });
    }
    out.push(b);
  }
  // Ленивая генерация: тексты первых копий — сразу (до оплаты превью рисуем не больше previewCopies книг вместе с основной)
  for (const b of out.slice(0, Math.max(0, settings.previewCopies - 1))) {
    if (b.status === "DRAFT") {
      await db.book.update({ where: { id: b.id }, data: { status: "TEXT_QUEUED" } });
      await enqueue(QUEUES.generateText, { bookId: b.id, bulk: true });
    }
  }
  return out;
}

async function currentTemplate(parentId: string) {
  const first = await db.book.findFirst({ where: { parentBookId: parentId }, orderBy: { createdAt: "asc" }, select: { dedication: true } });
  return first?.dedication ?? null;
}

const STATUS_RU: Record<string, string> = {
  DRAFT: "сочиним после оплаты",
  TEXT_QUEUED: "сочиняем текст",
  TEXT_READY: "текст готов",
  TEXT_APPROVED: "текст готов",
  PREVIEW_QUEUED: "рисуем превью",
  PREVIEW_READY: "превью готово",
  FULL_QUEUED: "рисуем книгу",
  FULL_READY: "книга готова",
  FAILED: "ошибка — повторим",
};

/** Состояние заказа «для каждого»: основная книга + копии, обложки превью (первые), шаблон посвящения. */
export async function bulkState(parent: Book) {
  const a = AnswersV2.parse(parent.params);
  const copies = await db.book.findMany({ where: { parentBookId: parent.id }, orderBy: { createdAt: "asc" }, include: { pages: { where: { index: 0 } } } });
  const all = [{ ...parent, pages: await db.bookPage.findMany({ where: { bookId: parent.id, index: 0 } }) }, ...copies];
  const settings = await cfg("bulk");
  return {
    available: bulkAvailable(a),
    created: copies.length > 0,
    count: 1 + (a.group?.members.length ?? 0),
    dedication: copies[0]?.dedication ?? DEFAULT_BULK_DEDICATION,
    tiers: settings.tiers,
    previewCopies: settings.previewCopies,
    copies: await Promise.all(
      all.map(async (b, i) => {
        const p = AnswersV2.parse(b.params);
        const cover = b.pages[0];
        return {
          id: b.id,
          name: p.hero.name,
          status: b.status,
          statusText: STATUS_RU[b.status] ?? b.status,
          title: (b.text as { title?: string } | null)?.title ?? null,
          dedication: i === 0 ? null : dedicationText(p),
          cover: cover?.previewKey ? await signedUrl("books", b.paidFull && cover.imageKey ? cover.imageKey : cover.previewKey) : null,
        };
      }),
    ),
  };
}

/** После превью основной книги — превью первых копий (без лимита «1 превью на контакт»: это один заказ). */
export async function previewBulkCopies(parentId: string) {
  const settings = await cfg("bulk");
  const copies = await db.book.findMany({ where: { parentBookId: parentId }, orderBy: { createdAt: "asc" }, take: Math.max(0, settings.previewCopies - 1) });
  for (const b of copies) {
    if (b.status === "TEXT_READY" || b.status === "TEXT_APPROVED") {
      await db.book.update({ where: { id: b.id }, data: { status: "PREVIEW_QUEUED", textApprovedAt: new Date() } });
      await enqueue(QUEUES.generatePreview, { bookId: b.id }, { singletonKey: `preview-${b.id}` });
    }
  }
}

export const isBulkCopy = (b: Pick<Book, "parentBookId">) => Boolean(b.parentBookId);
