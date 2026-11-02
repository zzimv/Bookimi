// Движок триггеров: событие → правило (условие, задержка, канал, текст, промокод) → действие.
// Правила в БД, редактируются в админке. Контрольная группа на каждое правило.
// Маркетинговые — только с согласием на рассылку и не чаще одного сообщения в сутки.
// Автоостановка правила, если после его рассылок растут отписки.
import { db } from "./db";
import { hmac } from "./crypto";
import { notifySafe, alertOwner } from "./notify";
import { birthdayReminders, fmtDay, BIRTHDAY_REMINDER_DAYS } from "./holidays-core";
import { declineName, guessGender, isFeminine, prepositionFor, type Case } from "./declension";
import { caseAfter } from "../content/title";
import { getLeadTimes } from "./holidays";

export const TRIGGER_EVENTS = {
  text_abandoned: "Сказка сочинена, но фото не загружено",
  preview_abandoned: "Превью готово, но заказа нет",
  pdf_only: "Куплен только PDF — предложить печать с зачётом",
  delivered: "Книга доставлена — отзыв и «Приведи друга»",
  birthday: "За месяц (30 дней) до дня рождения ребёнка (старое правило — то же, что «героя»)",
  hero_birthday: "За месяц (30 дней) до дня рождения сохранённого героя (любая аудитория)",
} as const;
export type TriggerEvent = keyof typeof TRIGGER_EVENTS;

export const DEFAULT_RULES: { name: string; event: TriggerEvent; delayMinutes: number; template: string; promoPercent?: number }[] = [
  { name: "Брошенная сказка, 1 час", event: "text_abandoned", delayMinutes: 60, template: "{Book} про {name} уже ждёт вас. Осталось добавить фото — и мы нарисуем обложку и первые развороты: {link}" },
  { name: "Брошенное превью, 1 час", event: "preview_abandoned", delayMinutes: 60, template: "Превью книги «{title}» готово. Посмотрите, как {name} выглядит на обложке: {link}" },
  { name: "Брошенное превью, 24 часа, промокод", event: "preview_abandoned", delayMinutes: 1440, template: "Книга «{title}» всё ещё ждёт. Дарим −10% по промокоду {promo} на 3 дня: {link}", promoPercent: 10 },
  { name: "Брошенное превью, 72 часа", event: "preview_abandoned", delayMinutes: 4320, template: "Напоминаем о книге «{title}». Превью сохранено ещё 4 дня: {link}" },
  { name: "Только PDF → печать", event: "pdf_only", delayMinutes: 1440, template: "Хотите книгу «{title}» в твёрдой обложке? Стоимость PDF зачтём — вы доплатите только разницу: {link}" },
  { name: "После доставки: отзыв и друг", event: "delivered", delayMinutes: 4320, template: "Как вам книга? Будем благодарны за отзыв: {review}. А друзья по вашей ссылке получат −10%: {ref}" },
  {
    name: "День рождения героя через месяц",
    event: "hero_birthday",
    delayMinutes: 0,
    template: "Ровно через месяц, {date}, день рождения у {name}. Новая книга, где {name} — {hero_role}, станет тёплым подарком. Печатную успеем, если заказать до {deadline}: {link}",
  },
];

const site = () => `https://${process.env.DOMAIN ?? "bookimi.ru"}`;

interface Candidate {
  userId: string;
  subjectId: string; // уникальность: одно сообщение правила на книгу/заказ/год
  vars: Record<string, string>;
  /** Уникальность по всем правилам (напоминание о дне рождения — одно, даже если правил два). */
  global?: boolean;
}

/**
 * Можно ли отправить маркетинговое сообщение: согласие на рассылку (отписка снимает его), аккаунт не удалён,
 * не больше одного маркетингового сообщения в сутки. Сервисные (isMarketing = false) — без согласия и лимита.
 */
export function canSendTrigger(rule: { isMarketing: boolean }, user: { marketingOk: boolean; deletedAt?: Date | null } | null, sentLast24h: boolean) {
  if (!user || user.deletedAt) return false;
  if (!rule.isMarketing) return true;
  return user.marketingOk && !sentLast24h;
}

async function candidates(event: TriggerEvent, delayMinutes: number): Promise<Candidate[]> {
  const before = new Date(Date.now() - delayMinutes * 60_000);
  const notOlder = new Date(Date.now() - (delayMinutes + 7 * 1440) * 60_000);
  const titleOf = (t: unknown) => (t as { title?: string } | null)?.title ?? "ваша книга";
  const nameOf = (p: unknown) => (p as { hero?: { name?: string } } | null)?.hero?.name ?? "героя";
  // Имя склоняется при подстановке (fill), слово «сказка/книга» — по аудитории книги
  const who = (p: unknown) => {
    const x = (p ?? {}) as { hero?: { gender?: string }; audience?: string };
    return { gender: x.hero?.gender ?? "", audience: x.audience ?? "CHILD" };
  };
  switch (event) {
    case "text_abandoned": {
      const books = await db.book.findMany({
        where: { userId: { not: null }, status: { in: ["TEXT_READY", "TEXT_APPROVED"] }, createdAt: { lte: before, gte: notOlder } },
        take: 200,
      });
      return books.map((b) => ({ userId: b.userId!, subjectId: `book:${b.id}`, vars: { name: nameOf(b.params), ...who(b.params), title: titleOf(b.text), link: `${site()}/kniga/${b.id}` } }));
    }
    case "preview_abandoned": {
      const books = await db.book.findMany({
        where: { userId: { not: null }, status: "PREVIEW_READY", previewReadyAt: { lte: before, gte: notOlder }, orderItems: { none: {} } },
        take: 200,
      });
      return books.map((b) => ({ userId: b.userId!, subjectId: `book:${b.id}`, vars: { name: nameOf(b.params), ...who(b.params), title: titleOf(b.text), link: `${site()}/kniga/${b.id}/kupit` } }));
    }
    case "pdf_only": {
      const orders = await db.order.findMany({
        where: { whoPrints: "self", status: "PAID", paidAt: { lte: before, gte: notOlder } },
        include: { items: { include: { book: true } } },
        take: 200,
      });
      return orders
        .filter((o) => o.items[0]?.book)
        .map((o) => ({ userId: o.userId, subjectId: `order:${o.id}`, vars: { title: titleOf(o.items[0].book!.text), link: `${site()}/kniga/${o.items[0].bookId}/kupit?pechat=1` } }));
    }
    case "delivered": {
      const all = await db.funnelEvent.findMany({ where: { name: "delivered", createdAt: { lte: before, gte: notOlder }, userId: { not: null } }, take: 200 });
      // Кому уже ушло «спасибо после доставки» (с просьбой об отзыве) — второй раз не просим
      const thanked = new Set(
        (await db.auditLog.findMany({ where: { action: "thanks.delivered", entityId: { in: all.map((e) => (e.props as { orderId?: string })?.orderId ?? "") } }, select: { entityId: true } })).map((a) => a.entityId),
      );
      const evs = all.filter((e) => !thanked.has((e.props as { orderId?: string })?.orderId ?? null));
      const users = await db.user.findMany({ where: { id: { in: evs.map((e) => e.userId!) } } });
      return evs.map((e) => {
        const u = users.find((x) => x.id === e.userId);
        return {
          userId: e.userId!,
          subjectId: `delivered:${(e.props as { orderId?: string })?.orderId ?? e.id}`,
          vars: { review: `${site()}/kabinet/otzyv`, ref: `${site()}/?ref=${u?.referralCode ?? ""}` },
        };
      });
    }
    case "birthday":
    case "hero_birthday": {
      // Сохранённые герои (кабинет → «Мои герои»): за месяц (BIRTHDAY_REMINDER_DAYS = 30) по Москве, окно 2 дня на случай лимита «1 в сутки»
      const heroes = await db.hero.findMany({
        where: { role: "main", birthDate: { not: null }, userId: { not: null }, user: { deletedAt: null, marketingOk: true } },
        select: { id: true, userId: true, name: true, birthDate: true, gender: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      const list = birthdayReminders(heroes.map((h) => ({ id: h.id, userId: h.userId, name: h.name, birthDate: h.birthDate! })), new Date(), BIRTHDAY_REMINDER_DAYS, 2, await getLeadTimes());
      const genderOf = new Map(heroes.map((h) => [h.id, h.gender ?? ""]));
      return list.map((b) => ({
        userId: b.userId!,
        subjectId: b.subjectId,
        global: true,
        vars: { name: b.name, gender: (b.id && genderOf.get(b.id)) || "", audience: "", date: fmtDay(b.date), deadline: fmtDay(b.deadline), link: `${site()}/sozdat?povod=den-rozhdeniya${b.id ? `&geroj=${b.id}` : ""}` },
      }));
    }
  }
}

/** «Сказка» — для детских книг, «книга» — для подростков, взрослых, питомцев и неизвестной аудитории. */
export const bookWord = (audience?: string) => (audience === "CHILD" ? "сказка" : "книга");

/**
 * Подстановка в текст правила: {name} склоняется по предлогу перед ним («про Машу», «у Маши», «о Льве»),
 * {name.род} — явный падеж; {book}/{Book} — «сказка»/«книга» по аудитории; {hero_role} — «главный герой» /
 * «главная героиня». Старые тексты правил («Сказка про {name}», «— главный герой») правятся на лету.
 */
export function fill(t: string, vars: Record<string, string>) {
  const gender = vars.gender || (vars.name ? guessGender(vars.name) : "");
  const word = bookWord(vars.audience);
  const tpl = t
    .replace(/(^|[.!?]\s+)Сказка про \{name\}/g, "$1{Book} про {name}")
    .replace(/— главный герой(?![а-яё])/g, "— {hero_role}");
  const extra: Record<string, string> = {
    book: word,
    Book: word[0].toUpperCase() + word.slice(1),
    hero_role: isFeminine(gender) ? "главная героиня" : "главный герой",
  };
  return tpl.replace(/(\S+\s+)?\{(\w+)(?:\.(им|род|дат|вин|тв|пр))?\}/g, (m, before: string | undefined, k: string, c?: Case) => {
    const prefix = before ?? "";
    if (k === "name" && vars.name) {
      const prev = prefix.trim().replace(/[^А-Яа-яЁё]/g, "");
      const cs = c ?? (caseAfter(prev) as Case);
      const n = declineName(vars.name, cs, gender);
      // «о Ане» → «об Ане», «с Львом» → «со Львом»
      const fixed = /^(о|об|с|со|к|ко)$/i.test(prev) ? prefix.replace(/(о|об|с|со|к|ко)(\s+)$/i, (_x, p: string, sp: string) => prepositionFor(p, n) + sp) : prefix;
      return fixed + n;
    }
    return prefix + (vars[k] ?? extra[k] ?? "");
  });
}

export const THANKS_PROMO_PCT = 10;
const THANKS_DELAY_DAYS = 3;

/**
 * Через 3 дня после доставки: спасибо + просьба об отзыве + подарок.
 * Сервисное сообщение (о заказе) — уходит всем. Подарок — раскраска по иллюстрациям книги (если её удаётся
 * сделать). Промокод на следующую книгу — только при согласии на рассылку (одноразовый, 60 дней).
 * Одно сообщение на заказ (журнал thanks.delivered).
 */
export async function sendDeliveredThanks(now = new Date()) {
  const evs = await db.funnelEvent.findMany({
    where: { name: "delivered", userId: { not: null }, createdAt: { lte: new Date(now.getTime() - THANKS_DELAY_DAYS * 86400_000), gte: new Date(now.getTime() - 14 * 86400_000) } },
    take: 100,
  });
  for (const e of evs) {
    const orderId = (e.props as { orderId?: string } | null)?.orderId;
    if (!orderId) continue;
    if (await db.auditLog.findFirst({ where: { action: "thanks.delivered", entityId: orderId } })) continue;
    const order = await db.order.findUnique({ where: { id: orderId }, include: { user: true, items: { include: { book: { include: { files: { select: { kind: true } } } } } } } });
    if (!order || order.status !== "DELIVERED" || !order.user || order.user.deletedAt) continue;
    // Сначала отмечаем, потом шлём: при сбое лучше не отправить, чем отправить дважды
    await db.auditLog.create({ data: { action: "thanks.delivered", entity: "order", entityId: orderId } });
    const book = order.items.find((i) => i.book)?.book;
    const title = (book?.text as { title?: string } | null)?.title ?? "ваша книга";

    let coloring: string | undefined;
    if (book) {
      let has = book.files.some((f) => f.kind === "coloring");
      if (!has) {
        try {
          const { renderColoring } = await import("./gen/pipeline");
          await renderColoring(book.id);
          has = true;
        } catch (err) {
          console.error("[thanks] раскраска:", (err as Error).message);
        }
      }
      if (has) coloring = `${site()}/api/books/${book.id}/download?kind=coloring`;
    }

    let promo: string | undefined;
    if (order.user.marketingOk) {
      const code = `SPASIBO-${hmac(`thanks:${orderId}`).replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase()}`;
      const validTo = new Date(now.getTime() + 60 * 86400_000);
      await db.promoCode.upsert({
        where: { code },
        update: {},
        create: { code, percentOff: THANKS_PROMO_PCT, ownerId: order.userId, source: "thanks", maxUses: 1, validTo },
      });
      promo = `И промокод ${code} — −${THANKS_PROMO_PCT}% на следующую книгу, действует до ${validTo.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" })}: ${site()}/sozdat`;
    }
    await notifySafe(order.userId, "thanks_delivered", { title, coloring, code: order.publicCode }, { promo });
  }
}

export async function runTriggers() {
  try {
    await sendDeliveredThanks();
  } catch (e) {
    console.error("[thanks]", (e as Error).message);
  }
  const rules = await db.triggerRule.findMany({ where: { isActive: true } });
  for (const rule of rules) {
    const list = await candidates(rule.event as TriggerEvent, rule.delayMinutes);
    for (const c of list) {
      const exists = await db.triggerRun.findFirst({ where: c.global ? { subjectId: c.subjectId } : { ruleId: rule.id, subjectId: c.subjectId } });
      if (exists) continue;
      const user = await db.user.findUnique({ where: { id: c.userId } });
      // не чаще одного маркетингового сообщения в сутки
      const lastToUser = await db.auditLog.findFirst({ where: { action: "trigger.sent", entityId: c.userId, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
      if (!canSendTrigger(rule, user, Boolean(lastToUser))) continue;
      const isControl = parseInt(hmac(`${rule.id}:${c.subjectId}`).replace(/[^0-9]/g, "").slice(0, 4) || "0", 10) % 100 < rule.controlPct;
      let vars = c.vars;
      if (!isControl && rule.promoPercent) {
        const code = `SKAZKA-${hmac(`${rule.id}${c.subjectId}`).replace(/[^A-Z0-9]/gi, "").slice(0, 5).toUpperCase()}`;
        await db.promoCode.upsert({
          where: { code },
          update: {},
          create: { code, percentOff: rule.promoPercent, ownerId: c.userId, source: "trigger", maxUses: 1, validTo: new Date(Date.now() + 3 * 86400_000) },
        });
        vars = { ...vars, promo: code };
      }
      await db.triggerRun.create({ data: { ruleId: rule.id, subjectId: c.subjectId, isControl, sentAt: isControl ? null : new Date() } });
      if (isControl) continue;
      await notifySafe(c.userId, "marketing", { subject: "БУКИМИ", text: fill(rule.template, vars) }, { marketing: rule.isMarketing });
      await db.auditLog.create({ data: { action: "trigger.sent", entity: "user", entityId: c.userId, details: { rule: rule.name } } });
    }
    await autoStop(rule.id, rule.name);
  }
}

/** Отписки после рассылок правила за сутки > 3% — правило выключается, владельцу алерт. */
async function autoStop(ruleId: string, name: string) {
  const since = new Date(Date.now() - 86400_000);
  const sent = await db.triggerRun.findMany({ where: { ruleId, sentAt: { gte: since } }, select: { subjectId: true } });
  if (sent.length < 30) return;
  const unsub = await db.auditLog.count({ where: { action: "unsubscribe", createdAt: { gte: since }, details: { path: ["ruleId"], equals: ruleId } } });
  if (unsub / sent.length > 0.03) {
    await db.triggerRule.update({ where: { id: ruleId }, data: { isActive: false } });
    await alertOwner("Триггер остановлен", `Правило «${name}»: отписок ${unsub} на ${sent.length} отправок за сутки.`);
  }
}

export async function sendTestTrigger(ruleId: string, userId: string) {
  const rule = await db.triggerRule.findUniqueOrThrow({ where: { id: ruleId } });
  await notifySafe(userId, "marketing", {
    subject: `[тест] ${rule.name}`,
    text: fill(rule.template, { name: "Маша", gender: "girl", audience: "CHILD", title: "Новогоднее путешествие с Дедом Морозом", link: site(), promo: "TEST-10", review: site(), ref: site(), date: "20 ноября", deadline: "6 ноября" }),
  });
}

export async function ruleStats() {
  const rules = await db.triggerRule.findMany({ orderBy: { createdAt: "asc" } });
  return Promise.all(
    rules.map(async (r) => {
      const runs = await db.triggerRun.findMany({ where: { ruleId: r.id } });
      const sent = runs.filter((x) => !x.isControl);
      const ctrl = runs.filter((x) => x.isControl);
      const conv = (xs: typeof runs) => (xs.length ? xs.filter((x) => x.converted).length / xs.length : 0);
      return {
        ...r,
        fired: runs.length,
        sent: sent.length,
        control: ctrl.length,
        convSent: conv(sent),
        convControl: conv(ctrl),
        revenue: sent.reduce((s, x) => s + x.revenueRub, 0),
      };
    }),
  );
}

/** Для тестов: кандидаты правила (без отправки). */
export const triggerCandidates = (event: TriggerEvent, delayMinutes = 0) => candidates(event, delayMinutes);
