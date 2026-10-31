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

/**
 * Можно ли передавать заказ в типографию: заказ с печатью, оплачен (или перепечатка уже напечатанного),
 * все книги заказа готовы (FULL_READY — не посреди генерации или смены настроения), блок и обложка есть.
 */
export async function printFilesReady(orderId: string, opts: { reprint?: boolean } = {}): Promise<{ ok: true; bookId: string } | { ok: false; error: string }> {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { book: { select: { id: true, status: true } } } } } });
  if (!order) return { ok: false, error: "Заказ не найден" };
  if (order.whoPrints !== "bookimi") return { ok: false, error: "Заказ без печати" };
  const allowed = opts.reprint ? ["PAID", "IN_PRINT", "PACKED", "SHIPPED", "DELIVERED"] : ["PAID"];
  if (!allowed.includes(order.status)) return { ok: false, error: "Передать в печать можно только оплаченный заказ" };
  const books = order.items.map((i) => i.book).filter(Boolean) as { id: string; status: string }[];
  if (!books.length) return { ok: false, error: "В заказе нет книги" };
  if (books.some((b) => b.status !== "FULL_READY")) return { ok: false, error: "Книга ещё готовится — передать в печать можно, когда она будет готова" };
  const bookId = books[0].id;
  const kinds = new Set((await db.bookFile.findMany({ where: { bookId, kind: { startsWith: "print-" } }, select: { kind: true } })).map((f) => f.kind));
  if (!kinds.has("print-block") || !kinds.has("print-cover")) return { ok: false, error: "Файлы для печати ещё не готовы" };
  // Допы, которые типография печатает по нашим файлам (постер, календарь, открытки…): без файла — не передаём
  const need = printAddonKinds(await printAddonKeys(order.items.filter((i) => !i.bookId || i.bookId === bookId)));
  const missing = need.filter((k) => !kinds.has(k));
  if (missing.length) return { ok: false, error: `Файлы допов ещё не готовы: ${missing.join(", ")}` };
  return { ok: true, bookId };
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
  const files = await db.bookFile.findMany({ where: { bookId, kind: { in: ["print-block", "print-cover"] } } });
  const links = await Promise.all(files.map(async (f) => `${f.kind === "print-block" ? "Блок" : "Обложка"}: ${await signedUrl("books", f.storageKey, WEEK)}`));
  const qty = 1 + (order.items.some((i) => i.refKey === "second-copy") ? 1 : 0);
  const format = order.items.find((i) => i.kind === "format")?.title ?? "";
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
    extras.length ? `Допы: ${extras.join("; ")}` : "Допы: нет",
    order.items.some((i) => i.refKey === "urgent") ? "СРОЧНО: изготовить в приоритете" : "",
    "",
    "Файлы (ссылки действуют 7 дней):",
    ...links.slice(0, files.length),
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
      body: JSON.stringify({ order: order.publicCode, format, qty, extras, files: links, shipment: ship, recipient: { name: normalizeName(order.contactName ?? ""), phone: order.contactPhone } }),
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
  await audit(operatorId ?? null, "print.send", "order", orderId, { printHouse: ph.name });
  return job;
}
