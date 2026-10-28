import { z } from "zod";
import { db } from "@/lib/db";
import { body, err, json, ownBook, throttle } from "@/lib/api";
import { enqueue, QUEUES } from "@/lib/queue";
import { anonId, currentUser } from "@/lib/auth";
import { cfg } from "@/lib/settings";
import { hit } from "@/lib/limits";
import { track } from "@/lib/events";
import { DOC_VERSION } from "@/lib/legal";

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rewrite") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("consent"), pd: z.literal(true), photo: z.boolean() }),
  z.object({ action: z.literal("preview"), withPhoto: z.boolean(), marketing: z.boolean().optional() }),
  z.object({ action: z.literal("redraw"), index: z.number().int().min(0).max(12) }),
  z.object({ action: z.literal("retry") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("book-action", 30, 60_000);
  if (t) return t;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  const b = await body(req, Input);
  if (!b) return err("Некорректный запрос");
  const { book } = own;
  const anon = await anonId();

  switch (b.action) {
    case "rewrite": {
      if (book.rewritesLeft <= 0) return err("Сказку можно переписать не больше двух раз. Поправьте текст вручную.");
      if (!["TEXT_READY", "TEXT_APPROVED"].includes(book.status)) return err("Сейчас переписать нельзя");
      await db.book.update({ where: { id }, data: { rewritesLeft: { decrement: 1 }, status: "TEXT_QUEUED", progress: 0 } });
      await enqueue(QUEUES.generateText, { bookId: id });
      return json({ ok: true });
    }
    case "approve": {
      if (book.status !== "TEXT_READY" && book.status !== "TEXT_APPROVED") return err("Текст ещё не готов");
      await db.book.update({ where: { id }, data: { status: "TEXT_APPROVED", textApprovedAt: new Date() } });
      await track("text_approved", { anonId: anon, userId: own.user?.id, props: { bookId: id } });
      // Прогрев GPU-сервера, пока родитель загружает фото
      const ai = await cfg("ai");
      if (ai.image !== "demo") import("@/lib/gen/gpu").then((m) => m.ensureGpuUp()).catch(() => {});
      return json({ ok: true });
    }
    case "consent": {
      const user = await currentUser();
      const ua = req.headers.get("user-agent")?.slice(0, 300);
      await db.consent.create({ data: { userId: user?.id, anonId: anon, type: "PERSONAL_DATA", docVersion: DOC_VERSION, granted: true, userAgent: ua } });
      if (b.photo) {
        await db.consent.create({ data: { userId: user?.id, anonId: anon, type: "CHILD_PHOTO", docVersion: DOC_VERSION, granted: true, userAgent: ua } });
      }
      return json({ ok: true });
    }
    case "preview": {
      const user = await currentUser();
      if (!user) return err("Войдите по коду, чтобы мы прислали превью", 401);
      if (book.status !== "TEXT_APPROVED" && book.status !== "FAILED") return err("Сначала подтвердите текст сказки");
      if (b.withPhoto) {
        const n = await db.photo.count({ where: { hero: { bookId: id }, deletedAt: null } });
        if (n === 0) return err("Загрузите хотя бы одно фото или выберите «по описанию»");
      }
      const limits = await cfg("limits");
      const contact = user.email ?? user.phone ?? user.id;
      if (!(await hit(contact, "preview", limits.previewsPerContact))) {
        return err("Сегодня превью уже было. Новое можно сделать завтра — или купите эту книгу без ожидания.", 429);
      }
      if (b.marketing) {
        await db.user.update({ where: { id: user.id }, data: { marketingOk: true } });
        await db.consent.create({ data: { userId: user.id, type: "MARKETING", docVersion: DOC_VERSION, granted: true } });
      }
      await db.book.update({ where: { id }, data: { userId: user.id, withPhoto: b.withPhoto, contact, status: "PREVIEW_QUEUED", progress: 0, error: null } });
      await db.hero.updateMany({ where: { bookId: id }, data: { userId: user.id } });
      await enqueue(QUEUES.generatePreview, { bookId: id }, { singletonKey: `preview-${id}` });
      return json({ ok: true });
    }
    case "redraw": {
      if (!book.paidFull) return err("Перерисовка доступна после покупки");
      const limits = await cfg("limits");
      if (book.redrawsLeft <= 0) return err(`Бесплатные перерисовки закончились. Следующая — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
      await db.book.update({ where: { id }, data: { redrawsLeft: { decrement: 1 } } });
      await enqueue(QUEUES.redraw, { bookId: id, index: b.index });
      return json({ ok: true, redrawsLeft: book.redrawsLeft - 1 });
    }
    case "retry": {
      if (book.status !== "FAILED") return err("Повтор не нужен");
      const q = book.textApprovedAt ? (book.paidFull ? QUEUES.generateFull : QUEUES.generatePreview) : QUEUES.generateText;
      await db.book.update({ where: { id }, data: { status: book.textApprovedAt ? (book.paidFull ? "FULL_QUEUED" : "PREVIEW_QUEUED") : "TEXT_QUEUED", error: null } });
      await enqueue(q, { bookId: id });
      return json({ ok: true });
    }
  }
}
