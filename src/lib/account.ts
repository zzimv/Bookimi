// Удаление аккаунта по запросу покупателя (152-ФЗ, ст. 21): персональные данные удаляются или обезличиваются.
// Что остаётся (налоговый учёт, 54-ФЗ/422-ФЗ — 5 лет): заказы с суммами, датами, составом, чеками и платежами,
// но без контактов (имя/телефон/email/адрес → NULL), с названием книги без имён в строках заказа.
// Подробно — ASSUMPTIONS.md, «Удаление аккаунта».
import { db } from "./db";
import { deleteFile, deletePrefix } from "./storage";

const ACTIVE_PRINT = ["PAID", "IN_PRINT", "PACKED", "SHIPPED"] as const;

/** Имена из анкеты книги (герой, доп. герои, группа) — чтобы вычистить их из отзывов и тикетов. */
function namesOf(params: unknown): string[] {
  const p = (params ?? {}) as { hero?: { name?: string; nickname?: string }; extras?: { name?: string }[]; group?: { members?: { name?: string }[]; adults?: { name?: string }[] } };
  return [p.hero?.name, p.hero?.nickname, ...(p.extras ?? []).map((e) => e.name), ...(p.group?.members ?? []).map((m) => m.name), ...(p.group?.adults ?? []).map((m) => m.name)]
    .map((x) => (x ?? "").trim())
    .filter((x) => x.length >= 2);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Заменить имена (и их падежные формы — по основе без последней буквы) на «[имя]». */
export function scrubNames(text: string, names: string[]) {
  let out = text;
  for (const n of [...new Set(names)].sort((a, b) => b.length - a.length)) {
    const stem = n.length > 3 ? n.slice(0, -1) : n;
    out = out.replace(new RegExp(`(?<![\\p{L}])${esc(stem)}\\p{L}{0,2}(?![\\p{L}])`, "giu"), "[имя]");
  }
  return out;
}

export type DeleteResult = { ok: true; books: number; photos: number } | { ok: false; error: string };

/**
 * Удалить аккаунт: книги (тексты, страницы, иллюстрации, PDF, аудио, записи голоса, мультфильмы — из БД и
 * хранилища), фото и анкеты, коды входа, журнал отправленных писем, тикеты и отзывы (обезличиваются),
 * адреса и контакты в заказах. Заказы и чеки остаются для налогового учёта без ПДн.
 * Нельзя, пока печатный заказ в работе (оплачен, не доставлен) — его нужно довезти.
 */
export async function deleteAccount(userId: string): Promise<DeleteResult> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { notifyPrefs: true } });
  if (!user || user.deletedAt) return { ok: false, error: "Аккаунт не найден" };
  const active = await db.order.count({ where: { userId, whoPrints: "bookimi", status: { in: [...ACTIVE_PRINT] } } });
  if (active) return { ok: false, error: "Печатный заказ ещё в работе. Удалим аккаунт после доставки — или напишите в поддержку, отменим заказ." };

  const drafts = await db.quizDraft.findMany({ where: { userId }, select: { id: true, anonId: true } });
  const books = await db.book.findMany({ where: { userId }, select: { id: true, params: true, text: true } });
  // Анонимные книги того же браузера (до входа) — тоже его
  const anonIds = [...new Set(drafts.map((d) => d.anonId))];
  const anonBooks = anonIds.length ? await db.book.findMany({ where: { userId: null, anonId: { in: anonIds } }, select: { id: true, params: true, text: true } }) : [];
  const allBooks = [...books, ...anonBooks];
  const bookIds = allBooks.map((b) => b.id);
  const names = [...new Set(allBooks.flatMap((b) => namesOf(b.params)))];
  const heroNames = (await db.hero.findMany({ where: { userId }, select: { name: true } })).map((h) => h.name).filter((x) => x.length >= 2);
  names.push(...heroNames, ...(user.firstName ? [user.firstName] : []), ...(user.name ? user.name.split(/\s+/) : []));
  const contacts = [user.email, user.phone, ...user.notifyPrefs.map((p) => p.address)].filter(Boolean) as string[];
  // Заказы: коды, получатели и адреса — чтобы найти и обезличить письма типографии и алерты владельцу
  const userOrders = await db.order.findMany({ where: { userId }, select: { publicCode: true, contactName: true, contactPhone: true, contactEmail: true, shipment: { select: { address: true, pvzAddress: true } } } });
  const orderCodes = userOrders.map((o) => o.publicCode);
  for (const o of userOrders) {
    if (o.contactName) names.push(...o.contactName.split(/\s+/).filter((x) => x.length >= 2));
    for (const c of [o.contactPhone, o.contactEmail]) if (c && !contacts.includes(c)) contacts.push(c);
  }
  const addressBits = userOrders.flatMap((o) => {
    const a = (o.shipment?.address ?? {}) as Record<string, unknown>;
    return [a.street, a.flat && `кв. ${a.flat}`, a.comment, a.postalCode, o.shipment?.pvzAddress].filter((x): x is string => typeof x === "string" && x.trim().length >= 3);
  });
  const ticketTexts = (await db.supportTicket.findMany({ where: { OR: [{ userId }, ...(contacts.length ? [{ contact: { in: contacts } }] : [])] }, select: { message: true } })).map((t) => t.message.slice(0, 60)).filter((x) => x.length >= 10);

  // 1. Фото (портрет и исходник) — из хранилища, затем записи
  const photos = await db.photo.findMany({
    where: { OR: [{ hero: { userId } }, { hero: { bookId: { in: bookIds } } }, { hero: { draftId: { in: drafts.map((d) => d.id) } } }] },
  });
  for (const p of photos) {
    await deleteFile("photos", p.storageKey).catch(() => {});
    if (p.originalKey) await deleteFile("photos", p.originalKey).catch(() => {});
  }
  for (const id of bookIds) await deletePrefix("photos", `${id}/`).catch(() => {});
  for (const d of drafts) await deletePrefix("photos", `draft/${d.id}/`).catch(() => {});

  // 2. Файлы книг: иллюстрации, превью, PDF, аудио, записи голоса, мультфильмы, листы персонажа
  const files = await db.bookFile.findMany({ where: { bookId: { in: bookIds } }, select: { storageKey: true } });
  const pages = await db.bookPage.findMany({ where: { bookId: { in: bookIds } }, select: { imageKey: true, previewKey: true } });
  for (const k of [...files.map((f) => f.storageKey), ...pages.flatMap((p) => [p.imageKey, p.previewKey])]) if (k) await deleteFile("books", k).catch(() => {});
  for (const id of bookIds) await deletePrefix("books", `${id}/`).catch(() => {});

  await db.$transaction(async (tx) => {
    // 3. Герои, фото, черновики анкеты, книги (страницы, файлы, мультфильм — каскадом)
    await tx.hero.deleteMany({ where: { OR: [{ userId }, { bookId: { in: bookIds } }, { draftId: { in: drafts.map((d) => d.id) } }] } });
    await tx.quizDraft.deleteMany({ where: { OR: [{ userId }, { bookId: { in: bookIds } }] } });
    // Строки заказов: название книги с именем → обезличенное (чек в «Мой налог» имени не содержит)
    const items = await tx.orderItem.findMany({ where: { order: { userId } }, select: { id: true, title: true } });
    for (const i of items) {
      const title = i.title.replace(/«[^»]*»/g, "«персональная книга»");
      if (title !== i.title) await tx.orderItem.update({ where: { id: i.id }, data: { title } });
    }
    await tx.book.deleteMany({ where: { id: { in: bookIds } } });

    // 4. Заказы: суммы и чеки остаются (налоговый учёт), контакты и адрес — нет
    await tx.order.updateMany({ where: { userId }, data: { contactName: null, contactPhone: null, contactEmail: null, utm: undefined } });
    await tx.shipment.updateMany({ where: { order: { userId } }, data: { address: {}, pvzAddress: null } });
    await tx.order.updateMany({ where: { userId, status: { in: ["PENDING_PAYMENT", "AWAITING_CONFIRMATION"] } }, data: { status: "CANCELLED" } });

    // 5. Коды входа, журнал отправленных сообщений (адрес и текст с именами), сессии, каналы
    if (contacts.length) await tx.otpCode.deleteMany({ where: { target: { in: contacts.map((c) => c.toLowerCase()).concat(contacts) } } });
    for (const c of contacts) {
      await tx.auditLog.deleteMany({ where: { action: { startsWith: "outbox." }, details: { path: ["to"], equals: c } } });
    }
    // Письма и алерты другим адресатам (типография, владелица) о заказах и обращениях покупателя — обезличить
    const needles = [...orderCodes, ...contacts, ...ticketTexts];
    const seenRows = new Set<string>();
    for (const n of needles) {
      const rows = await tx.auditLog.findMany({
        where: { action: { startsWith: "outbox." }, OR: [{ details: { path: ["text"], string_contains: n } }, { details: { path: ["subject"], string_contains: n } }] },
        select: { id: true, details: true },
      });
      for (const r of rows) {
        if (seenRows.has(r.id)) continue;
        seenRows.add(r.id);
        const d = (r.details ?? {}) as { to?: string; subject?: string; text?: string };
        await tx.auditLog.update({ where: { id: r.id }, data: { details: { to: d.to ?? "", subject: anonymizeText(d.subject ?? "", names, contacts, addressBits), text: anonymizeText(d.text ?? "", names, contacts, addressBits), anonymized: true } } });
      }
    }
    await tx.notificationPref.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });

    // 6. Поддержка: обращения обезличиваются (история нужна, ПДн — нет)
    const tickets = await tx.supportTicket.findMany({ where: { OR: [{ userId }, ...(contacts.length ? [{ contact: { in: contacts } }] : [])] } });
    for (const t of tickets) {
      await tx.supportTicket.update({
        where: { id: t.id },
        data: { userId: null, contact: "удалён", message: scrubContacts(scrubNames(t.message, names), contacts), answer: t.answer ? scrubContacts(scrubNames(t.answer, names), contacts) : null },
      });
    }

    // 7. Отзывы: опубликованные — «Покупатель» и без имён в тексте; неопубликованные — удаляются
    await tx.review.deleteMany({ where: { userId, status: { not: "approved" } } });
    const reviews = await tx.review.findMany({ where: { userId } });
    for (const r of reviews) await tx.review.update({ where: { id: r.id }, data: { userId: null, authorName: "Покупатель", text: scrubNames(r.text, names) } });

    // 8. Сам аккаунт
    await tx.user.update({
      where: { id: userId },
      data: { email: null, phone: null, name: null, firstName: null, savedAddresses: [], deviceHashes: [], totpSecret: null, totpEnabled: false, totpRecovery: [], deletedAt: new Date(), marketingOk: false },
    });
    await tx.auditLog.create({ data: { action: "user.delete", entity: "user", entityId: userId, details: { books: bookIds.length, photos: photos.length } } });
  });
  // Отложенные уведомления в очереди pg-boss (данные письма: имена, название книги) — удалить
  for (const t of ["job", "archive"]) {
    await db.$executeRawUnsafe(`DELETE FROM pgboss.${t} WHERE name = 'send-notification' AND data->>'userId' = $1`, userId).catch(() => {});
  }
  return { ok: true, books: bookIds.length, photos: photos.length };
}

/** Текст письма/алерта без ПДн: строки получателя и адреса — прочь, имена, контакты и части адреса — заменены. */
export function anonymizeText(text: string, names: string[], contacts: string[], addressBits: string[] = []) {
  const lines = text
    .split("\n")
    .map((l) => (/^\s*(Получатель|Адрес|Телефон|Почта|Email|Контакт)\s*:/i.test(l) ? `${l.split(":")[0]}: [удалено]` : l));
  let out = lines.join("\n");
  for (const b of [...new Set(addressBits)].sort((x, y) => y.length - x.length)) out = out.split(b).join("[адрес]");
  return scrubContacts(scrubNames(out, names), contacts);
}

function scrubContacts(text: string, contacts: string[]) {
  return contacts.reduce((t, c) => t.split(c).join("[контакт]"), text).replace(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/g, "[email]").replace(/\+?[78][\s(-]*9\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]");
}

/**
 * «Мои данные» (152-ФЗ, ст. 14): всё, что хранится о покупателе, одним JSON — профиль и адресная книга, согласия,
 * герои (с анкетой внешности и ссылками на фото, пока фото не удалены), книги с анкетой (params) и текстом,
 * черновики анкеты, заказы (состав, доставка, чеки, трек), отзывы, обращения в поддержку, каналы уведомлений
 * с адресами. Без секретов (2FA, хэши устройств, коды входа). Ссылки на фото — подписанные, на 24 часа.
 */
export async function exportUserData(userId: string) {
  const { signedUrl } = await import("./storage");
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, phone: true, name: true, firstName: true, role: true, marketingOk: true, referralCode: true, savedAddresses: true, createdAt: true },
  });
  const drafts = await db.quizDraft.findMany({ where: { userId }, select: { id: true, anonId: true, step: true, answers: true, contact: true, bookId: true, createdAt: true, updatedAt: true } });
  const books = await db.book.findMany({ where: { userId }, select: { id: true, params: true, text: true, status: true, styleKey: true, withPhoto: true, createdAt: true } });
  const bookIds = books.map((b) => b.id);
  const heroes = await db.hero.findMany({
    where: { OR: [{ userId }, { bookId: { in: bookIds } }, { draftId: { in: drafts.map((d) => d.id) } }] },
    select: { id: true, bookId: true, draftId: true, role: true, name: true, nickname: true, gender: true, ageGroup: true, birthDate: true, appearance: true, interests: true, createdAt: true, userId: true, photos: { where: { deletedAt: null }, select: { id: true, storageKey: true, createdAt: true, expiresAt: true } } },
  });
  const link = async (key: string) => signedUrl("photos", key, 86400).catch(() => null);
  const heroesOut = await Promise.all(
    heroes.map(async ({ photos, userId: owner, ...h }) => ({
      ...h,
      inProfile: owner === userId,
      photos: await Promise.all(photos.map(async (p) => ({ id: p.id, uploadedAt: p.createdAt, deletedAfter: p.expiresAt, url: await link(p.storageKey) }))),
    })),
  );
  const orders = await db.order.findMany({
    where: { userId },
    select: {
      publicCode: true, status: true, whoPrints: true, subtotalRub: true, discountRub: true, shippingRub: true, totalRub: true, createdAt: true, paidAt: true,
      contactName: true, contactPhone: true, contactEmail: true, comment: true,
      items: { select: { title: true, kind: true, priceRub: true, qty: true } },
      receipts: { where: { status: "issued" }, select: { url: true, amountRub: true, createdAt: true } },
      shipment: { select: { method: true, address: true, pvzCode: true, pvzAddress: true, trackNumber: true, etaDate: true } },
    },
  });
  const [consents, reviews, tickets, channels] = await Promise.all([
    db.consent.findMany({ where: { userId }, select: { type: true, granted: true, docVersion: true, createdAt: true } }),
    db.review.findMany({ where: { userId }, select: { rating: true, text: true, authorName: true, storySlug: true, status: true, createdAt: true } }),
    db.supportTicket.findMany({ where: { OR: [{ userId }, ...(user.email ? [{ contact: user.email }] : []), ...(user.phone ? [{ contact: user.phone }] : [])] }, select: { contact: true, message: true, answer: true, status: true, createdAt: true } }),
    db.notificationPref.findMany({ where: { userId }, select: { channel: true, address: true, marketing: true, isActive: true } }),
  ]);
  return {
    exportedAt: new Date(),
    profile: user,
    consents,
    heroes: heroesOut,
    books: books.map((b) => ({ ...b, questionnaire: b.params, params: undefined })),
    drafts: drafts.map((d) => ({ ...d, questionnaire: d.answers, answers: undefined })),
    orders,
    reviews,
    supportTickets: tickets,
    notificationChannels: channels,
    // Совместимость со старой выгрузкой (ключи верхнего уровня)
    ...user,
  };
}
