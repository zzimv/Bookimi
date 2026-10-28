import { z } from "zod";

export const Checkout = z.object({
  bookId: z.string().uuid(),
  whoPrints: z.enum(["self", "bookimi"]),
  formatKey: z.string().max(40).optional(),
  addons: z.array(z.string().max(40)).max(8).default([]),
  shipping: z
    .object({
      method: z.enum(["pickup", "cdek_pvz", "cdek_courier", "pochta", "yandex"]),
      address: z.object({
        city: z.string().trim().max(80).default(""),
        postalCode: z.string().trim().max(10).optional(),
        street: z.string().trim().max(160).optional(),
        pvzCode: z.string().trim().max(40).optional(),
      }),
    })
    .optional(),
  promo: z.string().trim().max(30).optional(),
  voice: z.string().max(40).optional(),
  contact: z.object({ name: z.string().trim().max(80).default(""), phone: z.string().trim().max(20).optional(), email: z.string().trim().max(120).optional() }).default({ name: "" }),
});
