// Данные для пути заказа: книга (готовность, имя героя) + доставка. Только сервер.
import "server-only";
import type { Order, Shipment } from "@prisma/client";
import { db } from "@/lib/db";
import { declineName, normalizeName } from "@/lib/declension";
import type { JourneyOrder } from "./journey";

export function heroOf(params: unknown): { name?: string; gender?: string } {
  const h = (params as { hero?: { name?: unknown; gender?: unknown } } | null)?.hero;
  return { name: typeof h?.name === "string" && h.name.trim() ? normalizeName(h.name) : undefined, gender: typeof h?.gender === "string" ? h.gender : undefined };
}

export function heroAcc(params: unknown): string | null {
  const h = heroOf(params);
  if (!h.name) return null;
  try {
    return declineName(h.name, "вин", h.gender);
  } catch {
    return h.name;
  }
}

/** Собирает JourneyOrder по заказу (одна книга на заказ — берём первую). */
export async function journeyOrder(order: Order & { shipment?: Shipment | null; items?: { bookId: string | null }[] }): Promise<JourneyOrder & { bookId?: string; heroName?: string }> {
  const items = order.items ?? (await db.orderItem.findMany({ where: { orderId: order.id }, select: { bookId: true } }));
  const bookId = items.find((i) => i.bookId)?.bookId ?? undefined;
  const book = bookId ? await db.book.findUnique({ where: { id: bookId }, select: { fullReadyAt: true, status: true, params: true } }) : null;
  const shipment = order.shipment === undefined ? await db.shipment.findUnique({ where: { orderId: order.id } }) : order.shipment;
  return {
    status: order.status,
    whoPrints: order.whoPrints,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    readyDate: order.readyDate,
    bookReadyAt: book?.status === "FULL_READY" ? (book.fullReadyAt ?? order.paidAt ?? order.createdAt) : null,
    heroAcc: book ? heroAcc(book.params) : null,
    heroName: book ? heroOf(book.params).name : undefined,
    shipment: shipment ? { method: shipment.method, etaDate: shipment.etaDate, trackNumber: shipment.trackNumber } : null,
    bookId,
  };
}
