import { z } from "zod";
import { NextResponse } from "next/server";
import "@/lib/zod-ru";
import { db } from "@/lib/db";
import { body, err, json, ownBook, throttle } from "@/lib/api";
import { enqueue, QUEUES } from "@/lib/queue";
import { anonId, currentUser } from "@/lib/auth";
import { cfg } from "@/lib/settings";
import { hit } from "@/lib/limits";
import { track } from "@/lib/events";
import { DOC_VERSION } from "@/lib/legal";
import { isStaff, spendLimitReached } from "@/lib/staff";
import { AnswersV2, heroAge } from "@/lib/quiz";
import { moodsFor } from "@/content/moods";
import { hasConsent } from "@/lib/consent";
import { takeFullMood, takePreviewMood, takeRedraw, takeRewrite } from "@/lib/book-limits";
import { applyLayoutEdit, LayoutEdit, NAME_AFTER_PAY } from "@/lib/book-edit";
import { personalize, type StoryText } from "@/lib/gen/text";

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rewrite") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("consent"), pd: z.literal(true), photo: z.boolean() }),
  // pd: true — согласие на ПДн, если его ещё нет (старые аккаунты); marketing — только для совместимости, новая форма спрашивает на входе
  z.object({ action: z.literal("preview"), withPhoto: z.boolean(), marketing: z.boolean().optional(), pd: z.boolean().optional() }),
  z.object({ action: z.literal("redraw"), index: z.number().int().min(0).max(12) }),
  z.object({ action: z.literal("retry") }),
  // Смена настроения всех иллюстраций; "" — «как задумал художник»
  z.object({ action: z.literal("mood"), mood: z.string().trim().max(40) }),
  // Правки в превью (rev 13): имя, обложка, автор, фото, посвящение — src/lib/book-edit.ts
  LayoutEdit,
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
  // Сотрудник тестирует свою книгу: без лимитов покупателя; расходы на сервисы — в свой суточный лимит (src/lib/staff.ts)
  const staff = isStaff(own.user?.role);

  switch (b.action) {
    case "rewrite": {
      if (book.rewritesLeft <= 0 && !staff) return err("Сказку можно переписать не больше двух раз. Поправьте текст вручную.");
      if (!["TEXT_READY", "TEXT_APPROVED"].includes(book.status)) return err("Сейчас переписать нельзя");
      // Атомарно: параллельный запрос не спишет лишнее и не поставит вторую задачу
      const took = staff
        ? (await db.book.updateMany({ where: { id, status: { in: ["TEXT_READY", "TEXT_APPROVED"] } }, data: { status: "TEXT_QUEUED", progress: 0 } })).count === 1
        : await takeRewrite(id);
      if (!took) return err("Сейчас переписать нельзя", 409);
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
      // Согласия перед загрузкой фото — первая точка сбора данных. Уже данные не дублируем.
      const user = await currentUser();
      const who = { userId: user?.id, anonId: anon };
      const ua = req.headers.get("user-agent")?.slice(0, 300);
      if (!(await hasConsent("PERSONAL_DATA", who))) {
        await db.consent.create({ data: { userId: user?.id, anonId: anon, type: "PERSONAL_DATA", docVersion: DOC_VERSION, granted: true, userAgent: ua } });
      }
      // Тип CHILD_PHOTO — согласие на обработку фото; формулировка галочки зависит от аудитории книги (ребёнок / своё фото / питомец)
      if (b.photo && !(await hasConsent("CHILD_PHOTO", who))) {
        await db.consent.create({ data: { userId: user?.id, anonId: anon, type: "CHILD_PHOTO", docVersion: DOC_VERSION, granted: true, userAgent: ua } });
      }
      return json({ ok: true });
    }
    case "preview": {
      const user = await currentUser();
      if (!user) return err("Войдите по коду, чтобы мы прислали превью", 401);
      if ((await cfg("auth")).phoneRequired && !user.phone) return err("Укажите телефон при входе — он нужен для связи по заказу", 401);
      if (book.status !== "TEXT_APPROVED" && book.status !== "FAILED") return err("Сначала подтвердите текст сказки");
      if (!(await hasConsent("PERSONAL_DATA", { userId: user.id, anonId: anon }))) {
        if (!b.pd) return err("Отметьте согласие на обработку персональных данных");
        await db.consent.create({ data: { userId: user.id, type: "PERSONAL_DATA", docVersion: DOC_VERSION, granted: true, userAgent: req.headers.get("user-agent")?.slice(0, 300) } });
      }
      if (b.withPhoto) {
        const n = await db.photo.count({ where: { hero: { bookId: id }, deletedAt: null } });
        if (n === 0) return err("Загрузите хотя бы одно фото или выберите «по описанию»");
      }
      const limits = await cfg("limits");
      const contact = user.email ?? user.phone ?? user.id;
      if (!staff && !(await hit(contact, "preview", limits.previewsPerContact))) {
        // Книга переходит в аккаунт и запоминает «по фото / по описанию» — её можно оформить без превью (/kupit)
        await db.book.update({ where: { id }, data: { ...(book.userId ? {} : { userId: user.id }), withPhoto: b.withPhoto, contact } });
        if (!book.userId) await db.hero.updateMany({ where: { bookId: id, userId: null }, data: { userId: user.id } });
        return NextResponse.json(
          {
            error: "Сегодня превью уже было — новое можно сделать завтра. А эту книгу можно оформить сразу, без превью: текст вы утвердили, иллюстрации нарисуем после оплаты.",
            buyUrl: `/kniga/${id}/kupit`,
          },
          { status: 429 },
        );
      }
      if (b.marketing) {
        await db.user.update({ where: { id: user.id }, data: { marketingOk: true } });
        await db.consent.create({ data: { userId: user.id, type: "MARKETING", docVersion: DOC_VERSION, granted: true } });
      }
      // Анонимная книга этого браузера переходит в аккаунт; чужую книгу (уже с владельцем) не переписываем
      await db.book.update({ where: { id }, data: { ...(book.userId ? {} : { userId: user.id }), withPhoto: b.withPhoto, contact, status: "PREVIEW_QUEUED", progress: 0, error: null } });
      if (!book.userId) await db.hero.updateMany({ where: { bookId: id, userId: null }, data: { userId: user.id } });
      await enqueue(QUEUES.generatePreview, { bookId: id }, { singletonKey: `preview-${id}` });
      return json({ ok: true });
    }
    case "redraw": {
      if (!book.paidFull) return err("Перерисовка доступна после покупки");
      const limits = await cfg("limits");
      if (book.redrawsLeft <= 0 && !staff) return err(`Бесплатные перерисовки закончились. Следующая — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
      if (staff && (await spendLimitReached(true)).over) return err("Лимит расходов сотрудников на сегодня исчерпан (Настройки → Лимиты)", 429);
      if (!staff && !(await takeRedraw(id))) return err(`Бесплатные перерисовки закончились. Следующая — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
      await enqueue(QUEUES.redraw, { bookId: id, index: b.index });
      const left = (await db.book.findUnique({ where: { id }, select: { redrawsLeft: true } }))?.redrawsLeft ?? 0;
      return json({ ok: true, redrawsLeft: left });
    }
    case "mood": {
      const a = AnswersV2.safeParse(book.params);
      const audience = a.success ? a.data.audience : "CHILD";
      const moodId = b.mood === "as-drawn" ? "" : b.mood;
      if (moodId && !moodsFor(audience, a.success ? heroAge(a.data) : undefined).some((m) => m.id === moodId)) return err("Такого настроения нет");
      if ((book.mood ?? "") === moodId) return json({ ok: true, unchanged: true });
      const limits = await cfg("limits");
      // До картинок — просто запоминаем настроение
      if (["DRAFT", "TEXT_QUEUED", "TEXT_READY", "TEXT_APPROVED"].includes(book.status)) {
        await db.book.update({ where: { id }, data: { mood: moodId || null } });
        return json({ ok: true });
      }
      if (!book.paidFull) {
        if (book.status !== "PREVIEW_READY") return err("Подождите, пока превью дорисуется");
        const moodLimit = staff ? 1_000_000 : limits.moodChangesPreview;
        if (book.moodChangesPreview >= moodLimit) return err(`До оплаты настроение можно сменить ${limits.moodChangesPreview} раза. После покупки — ещё раз бесплатно для всей книги.`, 429);
        if ((await spendLimitReached(staff)).over) return err(staff ? "Лимит расходов сотрудников на сегодня исчерпан (Настройки → Лимиты)" : "Сейчас много заказов — попробуйте сменить настроение чуть позже", 429);
        // Атомарно: счётчик < лимита и превью готово — иначе параллельный запрос уже занял попытку
        if (!(await takePreviewMood(id, moodId || null, moodLimit))) {
          return err(`До оплаты настроение можно сменить ${limits.moodChangesPreview} раза. После покупки — ещё раз бесплатно для всей книги.`, 429);
        }
      } else {
        if (book.status !== "FULL_READY") return err("Подождите, пока книга будет готова");
        // Первая смена после оплаты — бесплатно (вся книга), дальше — одна перерисовка из лимита за смену
        const free = book.moodChangesFull === 0;
        if (!free && book.redrawsLeft <= 0 && !staff) return err(`Бесплатные перерисовки закончились. Смена настроения — ${limits.redrawPriceRub} ₽ (через поддержку).`, 402);
        const took = staff
          ? (await db.book.updateMany({ where: { id, paidFull: true, status: "FULL_READY" }, data: { mood: moodId || null, moodChangesFull: { increment: 1 }, status: "FULL_QUEUED", progress: 0 } })).count === 1
          : await takeFullMood(id, moodId || null, free);
        if (!took) return err("Настроение уже меняется — подождите, пока книга будет готова", 409);
      }
      await enqueue(QUEUES.mood, { bookId: id }, { singletonKey: `mood-${id}` });
      await track("mood_change", { anonId: anon, userId: own.user?.id, props: { bookId: id, mood: moodId || "as-drawn" } });
      return json({ ok: true });
    }
    case "layout": {
      const a = AnswersV2.safeParse(book.params);
      if (!a.success) return err("Ответы анкеты повреждены — напишите в поддержку");
      if (b.name !== undefined && book.paidFull && b.name.trim() && b.name.trim().toLowerCase() !== a.data.hero.name.toLowerCase()) return err(NAME_AFTER_PAY, 409);
      if (b.photoId) {
        // Фото — только этой книги и ещё не удалённое (удаляется по общим правилам: через 7 дней)
        const ph = await db.photo.findFirst({ where: { id: b.photoId, deletedAt: null, hero: { bookId: id } } });
        if (!ph) return err("Фото не найдено — загрузите ещё раз", 404);
      }
      const r = applyLayoutEdit(a.data, b);
      if (!r.ok) return err(r.error);
      const data: Record<string, unknown> = { params: r.answers as object, dedication: r.answers.dedication || null };
      if (r.nameChanged) {
        if (!["TEXT_READY", "TEXT_APPROVED", "PREVIEW_READY"].includes(book.status)) return err("Подождите, пока книга будет готова, — потом имя можно поменять");
        const raw = book.textRaw as unknown as StoryText | null;
        if (raw) {
          const text = personalize(raw, r.answers);
          data.text = text as object;
          await db.bookPage.updateMany({ where: { bookId: id, index: 0 }, data: { text: text.title } });
          for (const s of text.spreads) await db.bookPage.updateMany({ where: { bookId: id, index: s.index }, data: { text: s.text } });
        }
        await db.hero.updateMany({ where: { bookId: id, role: "main" }, data: { name: r.answers.hero.name, nickname: r.answers.hero.nickname || null } });
      }
      await db.book.update({ where: { id }, data });
      // Оплаченная книга: перевёрстка PDF (без перерисовки картинок)
      if (book.paidFull && book.status === "FULL_READY") await enqueue(QUEUES.redraw, { bookId: id, index: -1 });
      return json({ ok: true });
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
