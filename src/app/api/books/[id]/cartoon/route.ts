import { z } from "zod";
import { db } from "@/lib/db";
import { body, err, json, ownBook, throttle } from "@/lib/api";
import { cfg } from "@/lib/settings";
import { createOrder } from "@/lib/orders";
import { hasConsent } from "@/lib/consent";
import { notifySafe } from "@/lib/notify";
import { signedUrl } from "@/lib/storage";
import { bookText, bookTextHash, cartoonPurchase, cartoonView, createShare, deleteVoiceFiles, enqueueCartoon, renderedKeyOf, revokeShare } from "@/lib/cartoon";
import { CARTOON_VOICE_DOC_VERSION, VOICE_LIMITS } from "@/lib/cartoon-guide";
import { dedicationText } from "@/lib/gen/text";
import { Answers } from "@/lib/quiz";

// «Мультфильм по книге» в кабинете: состояние, покупка (докупка к оплаченной книге), голос и субтитры,
// пересборка (одна бесплатная), свой голос, ссылка «Поделиться», согласие на голос и удаление записей.

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) return err("Не найдено", 404);
  const [view, bought, set, audio] = await Promise.all([cartoonView(id), cartoonPurchase(id), cfg("cartoon"), cfg("audio")]);
  const consent = own.user ? await hasConsent("VOICE", { userId: own.user.id }) : false;
  // Плеер в кабинете: подписанные ссылки на час
  const files = view.status === "READY" ? await db.bookFile.findMany({ where: { bookId: id, kind: { in: ["cartoon", "cartoon-vertical", "cartoon-poster"] } } }) : [];
  const url = async (kind: string) => {
    const f = files.find((x) => x.kind === kind);
    return f ? signedUrl("books", f.storageKey, 3600) : null;
  };
  return json({
    ...view,
    bought,
    consent,
    urls: { video: await url("cartoon"), poster: await url("cartoon-poster"), vertical: await url("cartoon-vertical") },
    prices: { cartoon: set.priceRub, ownVoice: set.ownVoiceRub },
    voices: audio.voices,
    enabled: set.enabled,
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("buy"), ownVoice: z.boolean().default(false) }),
  z.object({ action: z.literal("settings"), voice: z.string().max(40).optional(), subtitles: z.boolean().optional(), voiceMode: z.enum(["auto", "own"]).optional() }),
  z.object({ action: z.literal("rerender") }),
  z.object({ action: z.literal("submitOwn") }),
  z.object({ action: z.literal("share") }),
  z.object({ action: z.literal("unshare") }),
  z.object({ action: z.literal("consent"), granted: z.boolean() }),
  z.object({ action: z.literal("deleteVoice") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await throttle("cartoon", 30, 60_000);
  if (t) return t;
  const own = await ownBook(id);
  if (!own || !own.user) return err("Войдите в кабинет", 401);
  const b = await body(req, Action);
  if (!b) return err("Некорректный запрос");
  const bought = await cartoonPurchase(id);
  const set = await cfg("cartoon");

  if (b.action === "buy") {
    if (!set.enabled) return err("Мультфильмы пока не продаются");
    if (!own.book.paidFull) return err("Сначала оформите книгу — мультфильм можно добавить при покупке");
    const addons = [...(bought.cartoon ? [] : ["cartoon"]), ...(b.ownVoice && !bought.ownVoice ? ["cartoon-own-voice"] : [])];
    if (!addons.length) return err("Уже куплено");
    try {
      const order = await createOrder(own.user.id, {
        bookId: id,
        whoPrints: "self",
        addons,
        addonsOnly: true,
        contact: { name: own.user.name ?? "", email: own.user.email ?? undefined, phone: own.user.phone ?? undefined },
      });
      await notifySafe(own.user.id, "order_created", { code: order.publicCode, total: order.totalRub, orderId: order.id });
      return json({ orderId: order.id });
    } catch (e) {
      return err((e as Error).message);
    }
  }

  if (!bought.cartoon) return err("Мультфильм к этой книге не куплен", 403);
  const c = await db.cartoon.findUnique({ where: { bookId: id } });
  if (!c) return err("Мультфильм ещё не создан — он появится после готовности книги", 409);

  switch (b.action) {
    case "settings": {
      if (b.voiceMode === "own" && !c.ownVoicePaid) return err("«Своим голосом» не куплено", 403);
      if (b.voice) {
        const audio = await cfg("audio");
        if (!audio.voices.some((v) => v.key === b.voice)) return err("Нет такого голоса");
      }
      await db.cartoon.update({ where: { bookId: id }, data: { voice: b.voice ?? undefined, subtitles: b.subtitles ?? undefined, voiceMode: b.voiceMode ?? undefined } });
      return json(await cartoonView(id));
    }
    case "rerender": {
      if (["QUEUED", "RENDERING"].includes(c.status)) return err("Мультфильм уже собирается");
      if (c.voiceMode === "own") return err("Для своего голоса нажмите «Собрать мультфильм с моим голосом»");
      // Не получилось — повторяем бесплатно; иначе — только если что-то поменялось, и одна бесплатная пересборка
      if (c.status !== "FAILED") {
        const a = Answers.parse(own.book.params);
        const text = await bookText(own.book);
        const hash = bookTextHash(text, dedicationText(a));
        if (c.renderedKey === renderedKeyOf(c, hash)) return err("Ничего не изменилось: смените голос, субтитры или текст книги");
        const r = await db.cartoon.updateMany({ where: { bookId: id, rerendersLeft: { gt: 0 } }, data: { rerendersLeft: { decrement: 1 } } });
        if (!r.count) return err("Бесплатная пересборка уже использована — напишите в поддержку");
      }
      await enqueueCartoon(id);
      return json(await cartoonView(id));
    }
    case "submitOwn": {
      if (!c.ownVoicePaid) return err("«Своим голосом» не куплено", 403);
      if (!(await hasConsent("VOICE", { userId: own.user.id }))) return err("Нужно согласие на обработку голоса", 403);
      if (["QUEUED", "RENDERING"].includes(c.status)) return err("Мультфильм уже собирается");
      const cues = ((c.script as { cues?: { n: number }[] } | null)?.cues ?? []).map((x) => x.n);
      const rec = (c.voiceCues ?? {}) as Record<string, { sec: number }>;
      const missing = cues.filter((n) => !rec[String(n)]);
      if (!cues.length || missing.length) return err(`Не записаны реплики: ${missing.join(", ")}`);
      const total = cues.reduce((s, n) => s + (rec[String(n)]?.sec ?? 0), 0);
      if (total > VOICE_LIMITS.maxTotalSec) return err("Вся озвучка — не дольше 3 минут: перезапишите самые длинные реплики короче");
      const r = await db.cartoon.updateMany({ where: { bookId: id, ownBuildsLeft: { gt: 0 } }, data: { ownBuildsLeft: { decrement: 1 }, voiceMode: "own" } });
      if (!r.count) return err("Сборки своим голосом закончились — напишите в поддержку");
      await enqueueCartoon(id);
      return json(await cartoonView(id));
    }
    case "share": {
      if (c.status !== "READY") return err("Мультфильм ещё не готов");
      const s = await createShare(id);
      return json({ token: s.token, expiresAt: s.expiresAt.toISOString() });
    }
    case "unshare":
      await revokeShare(id);
      return json({ ok: true });
    case "consent": {
      await db.consent.create({ data: { userId: own.user.id, type: "VOICE", docVersion: CARTOON_VOICE_DOC_VERSION, granted: b.granted, userAgent: req.headers.get("user-agent")?.slice(0, 300) } });
      // Отзыв согласия — записи удаляются сразу
      if (!b.granted) {
        await deleteVoiceFiles(id);
        await db.cartoon.update({ where: { bookId: id }, data: { voiceCues: {}, voicePurgedAt: new Date() } });
      }
      return json({ ok: true, consent: b.granted });
    }
    case "deleteVoice": {
      await deleteVoiceFiles(id);
      await db.cartoon.update({ where: { bookId: id }, data: { voiceCues: {} } });
      return json(await cartoonView(id));
    }
  }
}
