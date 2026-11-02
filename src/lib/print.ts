// PrintProvider: передача заказа в типографию — email (по умолчанию) или API.
// Состав: PDF блока + PDF обложки (для твёрдой — с корешком) + файлы допов + данные отправления.
import { db } from "./db";
import { addressLine, type DeliveryAddress } from "./delivery";
import { signedUrl } from "./storage";
import { sendEmail } from "./notify";
import { audit, setStatus } from "./orders";
import { METHOD_TITLES } from "./shipping";
import { addonFileSpecs, printAddonKinds } from "./addon-files";
import { normalizeName } from "./names";

const WEEK = 7 * 86400; // максимальный срок подписанной ссылки S3

/** Книги заказа на печать: строка формата на каждую книгу («для каждого» — N книг), экземпляров — 1 + «второй экземпляр». */
export function printBooks(items: { kind: string; refKey: string; bookId: string | null }[]): { bookId: string; qty: number }[] {
  const out = new Map<string, number>();
  for (const i of items) if (i.kind === "format" && i.bookId && i.refKey !== "pdf") out.set(i.bookId, 1);
  // Обычный заказ без строки формата с bookId (старые заказы) — книга из любой строки
  if (!out.size) for (const i of items) if (i.bookId) { out.set(i.bookId, 1); break; }
  for (const i of items) if (i.refKey === "second-copy") {
    const id = i.bookId && out.has(i.bookId) ? i.bookId : [...out.keys()][0];
    if (id) out.set(id, (out.get(id) ?? 1) + 1);
  }
  return [...out].map(([bookId, qty]) => ({ bookId, qty }));
}

/**
 * Можно ли передавать заказ в типографию: заказ с печатью, оплачен (или перепечатка уже напечатанного),
 * ВСЕ книги заказа готовы (FULL_READY — не посреди генерации или смены настроения), у каждой — блок и обложка.
 */
export async function printFilesReady(
  orderId: string,
  opts: { reprint?: boolean } = {},
): Promise<{ ok: true; bookId: string; books: { bookId: string; qty: number }[] } | { ok: false; error: string; pending?: boolean }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { book: { select: { id: true, status: true } } } } } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.whoPrints !== "bookimi") return { ok: false, error: "Заказ без печати" };
  const allowed = opts.reprint ? ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"] : ["PAID"];
  if (!allowed.includes(order.status)) return { ok: false, error: "Передать в печать можно только оплаченный заказ" };
  const books = printBooks(order.items);
  if (!books.length) return { ok: false, error: "В заказе нет книги" };
  const status = new Map(order.items.filter((i) => i.book).map((i) => [i.book!.id, i.book!.status]));
  const notReady = books.filter((b) => status.get(b.bookId) !== "FULL_READY");
  if (notReady.length)
    return { ok: false, pending: true, error: books.length > 1 ? `Готовы ${books.length - notReady.length} из ${books.length} книг — передать в печать можно, когда будут готовы все` : "Книга ещё готовится — передать в печать можно, когда она будет готова" };
  const files = await db.bookFile.findMany({ where: { bookId: { in: books.map((b) => b.bookId) }, kind: { startsWith: "print-" } }, select: { kind: true, bookId: true } });
  const kindsOf = (id: string) => new Set(files.filter((f) => f.bookId === id).map((f) => f.kind));
  const noFiles = books.filter((b) => !kindsOf(b.bookId).has("print-block") || !kindsOf(b.bookId).has("print-cover"));
  if (noFiles.length) return { ok: false, pending: true, error: books.length > 1 ? `Файлы для печати готовы не у всех книг (нет у ${noFiles.length})` : "Файлы для печати ещё не готовы" };
  // Допы, которые типография печатает по нашим файлам (постер, календарь, открытки…): без файла — не передаём
  const bookId = books[0].bookId;
  const need = printAddonKinds(await printAddonKeys(order.items.filter((i) => !i.bookId || i.bookId === bookId)));
  const kinds = kindsOf(bookId);
  const missing = need.filter((k) => !kinds.has(k));
  if (missing.length) return { ok: false, error: `Файлы допов ещё не готовы: ${missing.join(", ")}` };
  return { ok: true, bookId, books };
}

/**
 * Передать в печать, если всё готово; книга группового заказа, готовая не последней, — тихо ждёт остальные
 * (без алерта владельцу). Ошибки, кроме «ещё готовится», — исключением.
 */
export async function sendToPrintWhenReady(orderId: string) {
  const ready = await printFilesReady(orderId);
  if (!ready.ok && ready.pending) return null;
  return sendToPrint(orderId);
}

/** Физические допы заказа, которые типография печатает по нашим файлам (не «другой подрядчик»). */
export async function printAddonKeys(items: { kind: string; refKey: string }[]) {
  const keys = [...new Set(items.filter((i) => i.kind === "addon" && addonFileSpecs(i.refKey).some((f) => f.type === "pdf")).map((i) => i.refKey))];
  if (!keys.length) return [];
  const other = new Set((await db.addon.findMany({ where: { key: { in: keys }, supplier: "other" }, select: { key: true } })).map((a) => a.key));
  return keys.filter((k) => !other.has(k));
}

export async function sendToPrint(orderId: string, operatorId?: string, opts: { reprint?: boolean } = {}) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, shipment: true, printJob: true } });
  if (order.whoPrints !== "bookimi") throw new Error("Заказ без печати");
  if (order.printJob) return order.printJob;
  const ready = await printFilesReady(orderId, opts);
  if (!ready.ok) throw new Error(ready.error);
  const ph = await db.printHouse.findFirst({ where: { isActive: true } });
  if (!ph) throw new Error("Нет активной типографии");
  const bookId = ready.bookId;
  const books = ready.books;
  const bookRows = await db.book.findMany({ where: { id: { in: books.map((x) => x.bookId) } }, select: { id: true, text: true, params: true } });
  const files = await db.bookFile.findMany({ where: { bookId: { in: books.map((x) => x.bookId) }, kind: { in: ["print-block", "print-cover"] } } });
  const qty = books.reduce((n, x) => n + x.qty, 0);
  const format = order.items.find((i) => i.kind === "format")?.title ?? "";
  // По каждой книге: название, герой, экземпляры и ссылки на блок и обложку
  const items: { book: number; bookId: string; title: string; hero: string; qty: number; block: string; cover: string }[] = [];
  for (const [n, x] of books.entries()) {
    const row = bookRows.find((r) => r.id === x.bookId);
    const f = (k: string) => files.find((ff) => ff.bookId === x.bookId && ff.kind === k);
    const block = f("print-block"), cover = f("print-cover");
    if (!block || !cover) throw new Error("Файлы для печати готовы не у всех книг");
    const heroName = ((row?.params as { hero?: { name?: string } } | null)?.hero?.name ?? "").trim();
    items.push({
      book: n + 1,
      bookId: x.bookId,
      title: (row?.text as { title?: string } | null)?.title ?? "Персональная книга",
      hero: heroName ? normalizeName(heroName) : "",
      qty: x.qty,
      block: await signedUrl("books", block.storageKey, WEEK),
      cover: await signedUrl("books", cover.storageKey, WEEK),
    });
  }
  const links = items.flatMap((it) => [`Блок: ${it.block}`, `Обложка: ${it.cover}`]);
  const bookLines = items.flatMap((it) => [
    `${items.length > 1 ? `Книга ${it.book} из ${items.length}` : "Книга"}: «${it.title}»${it.hero ? `, герой — ${it.hero}` : ""} — ${it.qty} экз.`,
    `   Блок: ${it.block}`,
    `   Обложка: ${it.cover}`,
  ]);
  // Допы: типографии — только её (supplier print) физические допы; «другой подрядчик» — оператору вручную
  const addonRows = await db.addon.findMany({ where: { key: { in: order.items.filter((i) => i.kind === "addon").map((i) => i.refKey) } }, select: { key: true, kind: true, supplier: true } });
  const rowOf = (k: string) => addonRows.find((a) => a.key === k);
  const physical = order.items.filter((i) => i.kind === "addon" && rowOf(i.refKey)?.kind === "PHYSICAL");
  const extras = physical.filter((i) => rowOf(i.refKey)?.supplier !== "other").map((i) => i.title.replace(/^Изготовление на заказ: /, ""));
  const other = physical.filter((i) => rowOf(i.refKey)?.supplier === "other").map((i) => i.title.replace(/^Изготовление на заказ: /, ""));
  // Файлы допов и требования к ним (src/lib/addon-files.ts)
  const addonFiles = await db.bookFile.findMany({ where: { bookId, kind: { startsWith: "print-addon-" } } });
  const specs = physical.filter((i) => rowOf(i.refKey)?.supplier !== "other").flatMap((i) => addonFileSpecs(i.refKey).filter((f) => f.type === "pdf"));
  const addonLinks: string[] = [];
  for (const spec of specs) {
    const f = addonFiles.find((x) => x.kind === spec.kind);
    if (!f) continue;
    addonLinks.push(`${spec.label} — ${spec.wMm}×${spec.hMm} мм + вылеты ${spec.bleedMm} мм, ${spec.pages} стр.: ${await signedUrl("books", f.storageKey, WEEK)}`, `   ${spec.note}`);
    links.push(`${spec.label}: ${await signedUrl("books", f.storageKey, WEEK)}`);
  }
  const ship = order.shipment;
  const addr = ship ? { ...(ship.address as DeliveryAddress), ...(ship.pvzCode ? { pvzCode: ship.pvzCode, pvzAddress: ship.pvzAddress ?? undefined } : {}) } : undefined;
  const body = [
    `Заказ ${order.publicCode}`,
    `Формат: ${format}`,
    `Количество: ${qty}`,
    items.length > 1 ? `Разных книг: ${items.length} (у каждой свой блок и обложка — список ниже)` : "",
    extras.length ? `Допы: ${extras.join("; ")}` : "Допы: нет",
    order.items.some((i) => i.refKey === "urgent") ? "СРОЧНО: изготовить в приоритете" : "",
    "",
    "Файлы (ссылки действуют 7 дней):",
    ...bookLines,
    ...(addonLinks.length ? ["", "Файлы допов:", ...addonLinks] : []),
    "",
    `Отправление: ${ship ? METHOD_TITLES[ship.method as keyof typeof METHOD_TITLES] ?? ship.method : "—"}`,
    ship?.method === "pickup" ? "Покупатель заберёт сам." : `Получатель: ${normalizeName(order.contactName ?? "")}, ${order.contactPhone}`,
    addr ? `Адрес: ${addressLine(addr)}` : "",
    "",
    "Требования: блок — мелованная 150–170 г/м², вылеты 3 мм; обложка — ламинация. Упакуйте и передайте в службу доставки.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  let externalId: string | undefined;
  if (ph.apiUrl) {
    const r = await fetch(ph.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.PRINT_API_KEY ?? ""}` },
      // Один многопозиционный заказ: items — каждая книга со своим тиражом и файлами; files/qty — для старых интеграций
      body: JSON.stringify({ order: order.publicCode, format, qty, items: items.map(({ book, title, hero, qty: q, block, cover }) => ({ book, title, hero, qty: q, files: { block, cover } })), extras, files: links, shipment: ship, recipient: { name: normalizeName(order.contactName ?? ""), phone: order.contactPhone } }),
    });
    if (!r.ok) throw new Error(`Типография API ${r.status}`);
    externalId = ((await r.json()) as { id?: string }).id;
  } else if (ph.email) {
    await sendEmail(ph.email, `Заказ на печать ${order.publicCode}`, body);
  } else {
    throw new Error("У типографии не указан email или API — передайте заказ вручную");
  }
  if (other.length) {
    await audit(operatorId ?? null, "print.other_supplier", "order", orderId, { items: other });
    const { alertOwner } = await import("./notify");
    await alertOwner(`Заказ ${order.publicCode}: доп у другого подрядчика`, `Типографии не передан, закажите вручную: ${other.join("; ")}. Отправить вместе с книгой или отдельно — по договорённости.`).catch(() => {});
  }
  const job = await db.printJob.create({ data: { orderId, printHouseId: ph.id, status: "sent", externalId, sentAt: new Date() } });
  if (order.status === "PAID") await setStatus(orderId, "IN_PRINT", operatorId);
  await audit(operatorId ?? null, "print.send", "order", orderId, { printHouse: ph.name, books: items.length, qty });
  return job;
}

/**
 * Типография сообщила «готово к отправке» (статус PACKED): заказ на доставку в СДЭК — автоматически, если подключены
 * ключи CDEK_*; номер отправления сохраняется в trackNumber (сразу или задачей cdek-track). Без ключей — ничего
 * (трек вносит оператор вручную). Повторный вызов не создаёт второй заказ в СДЭК.
 */
export async function createCdekShipment(orderId: string): Promise<{ uuid: string; track: string | null } | null> {
  const { hasCdek, createCdekOrder, cdekOrderInput, cdekTrackNumber } = await import("./shipping");
  if (!hasCdek()) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { shipment: true, items: true } });
  const sh = order?.shipment;
  if (!order || !sh || (sh.method !== "cdek_pvz" && sh.method !== "cdek_courier")) return null;
  if (sh.cdekUuid || sh.trackNumber) return sh.cdekUuid ? { uuid: sh.cdekUuid, track: sh.trackNumber } : null;
  const books = printBooks(order.items).reduce((n, b) => n + b.qty, 0) || 1;
  const input = cdekOrderInput({ ...order, books });
  if (!input) return null;
  const uuid = await createCdekOrder(input);
  if (!uuid) return null;
  await db.shipment.update({ where: { orderId }, data: { cdekUuid: uuid, status: "cdek_created" } });
  await audit(null, "cdek.order", "order", orderId, { uuid });
  const track = await cdekTrackNumber(uuid).catch(() => null);
  if (track) await saveCdekTrack(orderId, track);
  return { uuid, track };
}

/** Номер отправления СДЭК пришёл: сохранить и сообщить покупателю (один раз). */
export async function saveCdekTrack(orderId: string, track: string) {
  const r = await db.shipment.updateMany({ where: { orderId, trackNumber: null }, data: { trackNumber: track, status: "in_transit" } });
  if (!r.count) return;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipment: true } });
  const { notifySafe } = await import("./notify");
  await notifySafe(order.userId, "track", { code: order.publicCode, orderId, status: order.status, track, service: order.shipment?.method, eta: "", ready: "" });
}

/** Задача cdek-track: для заказов СДЭК без номера — спросить номер по uuid. */
export async function pollCdekTracks() {
  const { cdekTrackNumber } = await import("./shipping");
  const list = await db.shipment.findMany({ where: { cdekUuid: { not: null }, trackNumber: null }, take: 50 });
  for (const sh of list) {
    const track = await cdekTrackNumber(sh.cdekUuid!).catch(() => null);
    if (track) await saveCdekTrack(sh.orderId, track);
  }
}
