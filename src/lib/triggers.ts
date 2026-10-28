// Движок триггеров: событие → правило (условие, задержка, канал, текст, промокод) → действие.
// Правила в БД, редактируются в админке. Контрольная группа на каждое правило.
// Маркетинговые — только с согласием на рассылку и не чаще одного сообщения в сутки.
// Автоостановка правила, если после его рассылок растут отписки.
import { db } from "./db";
import { hmac } from "./crypto";
import { notifyUser, alertOwner } from "./notify";

export const TRIGGER_EVENTS = {
  text_abandoned: "Сказка сочинена, но фото не загружено",
  preview_abandoned: "Превью готово, но заказа нет",
  pdf_only: "Куплен только PDF — предложить печать с зачётом",
  delivered: "Книга доставлена — отзыв и «Приведи друга»",
  birthday: "За 3 недели до дня рождения ребёнка",
} as const;
export type TriggerEvent = keyof typeof TRIGGER_EVENTS;

export const DEFAULT_RULES: { name: string; event: TriggerEvent; delayMinutes: number; template: string; promoPercent?: number }[] = [
  { name: "Брошенная сказка, 1 час", event: "text_abandoned", delayMinutes: 60, template: "Сказка про {name} уже ждёт вас. Осталось добавить фото — и мы нарисуем обложку и первые развороты: {link}" },
  { name: "Брошенное превью, 1 час", event: "preview_abandoned", delayMinutes: 60, template: "Превью книги «{title}» готово. Посмотрите, как {name} выглядит на обложке: {link}" },
  { name: "Брошенное превью, 24 часа, промокод", event: "preview_abandoned", delayMinutes: 1440, template: "Книга «{title}» всё ещё ждёт. Дарим −10% по промокоду {promo} на 3 дня: {link}", promoPercent: 10 },
  { name: "Брошенное превью, 72 часа", event: "preview_abandoned", delayMinutes: 4320, template: "Напоминаем о книге «{title}». Превью сохранено ещё 4 дня: {link}" },
  { name: "Только PDF → печать", event: "pdf_only", delayMinutes: 1440, template: "Хотите книгу «{title}» в твёрдой обложке? Стоимость PDF зачтём — вы доплатите только разницу: {link}" },
  { name: "После доставки: отзыв и друг", event: "delivered", delayMinutes: 4320, template: "Как вам книга? Будем благодарны за отзыв: {review}. А друзья по вашей ссылке получат −10%: {ref}" },
  { name: "День рождения через 3 недели", event: "birthday", delayMinutes: 0, template: "Через 3 недели день рождения у {name}. Новая сказка с героем-именинником — отличный подарок: {link}" },
];

const site = () => `https://${process.env.DOMAIN ?? "bookimi.ru"}`;

interface Candidate {
  userId: string;
  subjectId: string; // уникальность: одно сообщение правила на книгу/заказ/год
  vars: Record<string, string>;
}

async function candidates(event: TriggerEvent, delayMinutes: number): Promise<Candidate[]> {
  const before = new Date(Date.now() - delayMinutes * 60_000);
  const notOlder = new Date(Date.now() - (delayMinutes + 7 * 1440) * 60_000);
  const titleOf = (t: unknown) => (t as { title?: string } | null)?.title ?? "ваша книга";
  const nameOf = (p: unknown) => (p as { hero?: { name?: string } } | null)?.hero?.name ?? "героя";
  switch (event) {
    case "text_abandoned": {
      const books = await db.book.findMany({
        where: { userId: { not: null }, status: { in: ["TEXT_READY", "TEXT_APPROVED"] }, createdAt: { lte: before, gte: notOlder } },
        take: 200,
      });
      return books.map((b) => ({ userId: b.userId!, subjectId: `book:${b.id}`, vars: { name: nameOf(b.params), title: titleOf(b.text), link: `${site()}/kniga/${b.id}` } }));
    }
    case "preview_abandoned": {
      const books = await db.book.findMany({
        where: { userId: { not: null }, status: "PREVIEW_READY", previewReadyAt: { lte: before, gte: notOlder }, orderItems: { none: {} } },
        take: 200,
      });
      return books.map((b) => ({ userId: b.userId!, subjectId: `book:${b.id}`, vars: { name: nameOf(b.params), title: titleOf(b.text), link: `${site()}/kniga/${b.id}/kupit` } }));
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
      const evs = await db.funnelEvent.findMany({ where: { name: "delivered", createdAt: { lte: before, gte: notOlder }, userId: { not: null } }, take: 200 });
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
    case "birthday": {
      const heroes = await db.hero.findMany({ where: { role: "main", birthDate: { not: null }, userId: { not: null } }, take: 2000 });
      const out: Candidate[] = [];
      const now = new Date();
      for (const h of heroes) {
        const b = h.birthDate!;
        let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
        if (next < now) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
        const days = (next.getTime() - now.getTime()) / 86400_000;
        if (days <= 21 && days > 20) out.push({ userId: h.userId!, subjectId: `bday:${h.id}:${next.getFullYear()}`, vars: { name: h.name, link: `${site()}/povod/den-rozhdeniya` } });
      }
      return out;
    }
  }
}

function fill(t: string, vars: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export async function runTriggers() {
  const rules = await db.triggerRule.findMany({ where: { isActive: true } });
  for (const rule of rules) {
    const list = await candidates(rule.event as TriggerEvent, rule.delayMinutes);
    for (const c of list) {
      const exists = await db.triggerRun.findFirst({ where: { ruleId: rule.id, subjectId: c.subjectId } });
      if (exists) continue;
      const user = await db.user.findUnique({ where: { id: c.userId } });
      if (!user || user.deletedAt) continue;
      if (rule.isMarketing && !user.marketingOk) continue;
      // не чаще одного маркетингового сообщения в сутки
      const lastToUser = await db.auditLog.findFirst({ where: { action: "trigger.sent", entityId: c.userId, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
      if (rule.isMarketing && lastToUser) continue;
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
      await notifyUser(c.userId, "marketing", { subject: "БУКИМИ", text: fill(rule.template, vars) }, { marketing: rule.isMarketing });
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
  await notifyUser(userId, "marketing", {
    subject: `[тест] ${rule.name}`,
    text: fill(rule.template, { name: "Маша", title: "Новогоднее путешествие с Дедом Морозом", link: site(), promo: "TEST-10", review: site(), ref: site() }),
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
