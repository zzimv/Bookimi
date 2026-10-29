import { z } from "zod";
import { ShipAddressSchema } from "./delivery";

export const Checkout = z.object({
  bookId: z.string().uuid(),
  whoPrints: z.enum(["self", "bookimi"]),
  formatKey: z.string().max(40).optional(),
  addons: z.array(z.string().max(40)).max(8).default([]),
  shipping: z
    .object({
      method: z.enum(["pickup", "cdek_pvz", "cdek_courier", "pochta", "yandex"]),
      address: ShipAddressSchema,
    })
    .optional(),
  /** «Сохранить адрес для следующих заказов» (адресная книга в профиле, последние 3). */
  saveAddress: z.boolean().default(true),
  promo: z.string().trim().max(30).optional(),
  voice: z.string().max(40).optional(),
  /** Докупка цифровых допов к оплаченной книге (кабинет → «Добавить мультфильм»). */
  addonsOnly: z.boolean().optional(),
  /** «Книга для каждого в группе» — одна книга на каждого ребёнка (src/lib/bulk.ts). */
  bulk: z.boolean().optional(),
  contact: z.object({ name: z.string().trim().max(80).default(""), phone: z.string().trim().max(20).optional(), email: z.string().trim().max(120).optional() }).default({ name: "" }),
});
