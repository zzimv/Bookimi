// Приводит к виду «Анна» старые имена, сохранённые до единой нормализации (src/lib/names.ts):
//  • User.firstName («Как к вам обращаться») — «анна» → «Анна»;
//  • Order.contactName у заказов, ещё не переданных в типографию (PENDING_PAYMENT, AWAITING_CONFIRMATION, PAID) —
//    «анна петрова» → «Анна Петрова». История (отправленные, доставленные, отменённые) не меняется.
// Идемпотентно (повторный запуск ничего не меняет). По умолчанию — пробный прогон: только список изменений.
//   npx tsx scripts/normalize-names.ts           — показать, что изменится
//   npx tsx scripts/normalize-names.ts --apply   — записать (каждое изменение — в журнал аудита)
import { createPrisma } from "../src/lib/prisma-client";
import { nameFix } from "../src/lib/names";

const PENDING = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "PAID"] as const;

export async function normalizeNames(opts: { apply: boolean; log?: (s: string) => void }) {
  const db = createPrisma();
  const log = opts.log ?? ((s: string) => console.log(s));
  const out = { users: 0, orders: 0 };
  try {
    const users = await db.user.findMany({ where: { firstName: { not: null } }, select: { id: true, firstName: true } });
    for (const u of users) {
      const next = nameFix(u.firstName);
      if (!next) continue;
      out.users++;
      log(`User ${u.id}: «${u.firstName}» → «${next}»`);
      if (opts.apply) {
        await db.$transaction([
          db.user.update({ where: { id: u.id }, data: { firstName: next } }),
          db.auditLog.create({ data: { action: "names.normalize", entity: "user", entityId: u.id, details: { field: "firstName", from: u.firstName, to: next } } }),
        ]);
      }
    }
    const orders = await db.order.findMany({ where: { status: { in: [...PENDING] }, contactName: { not: null } }, select: { id: true, publicCode: true, contactName: true } });
    for (const o of orders) {
      const next = nameFix(o.contactName);
      if (!next) continue;
      out.orders++;
      log(`Order ${o.publicCode}: «${o.contactName}» → «${next}»`);
      if (opts.apply) {
        await db.$transaction([
          db.order.update({ where: { id: o.id }, data: { contactName: next } }),
          db.auditLog.create({ data: { action: "names.normalize", entity: "order", entityId: o.id, details: { field: "contactName", from: o.contactName, to: next } } }),
        ]);
      }
    }
  } finally {
    await db.$disconnect();
  }
  log(`${opts.apply ? "Изменено" : "Будет изменено (пробный прогон, --apply — записать)"}: пользователей ${out.users}, заказов ${out.orders}`);
  return out;
}

if (process.argv[1]?.includes("normalize-names")) {
  normalizeNames({ apply: process.argv.includes("--apply") }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
