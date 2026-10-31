// Тестовые книги сотрудников (владелец, оператор, маркетолог): без лимитов покупателя (превью, сказки,
// переписывания, перерисовки, настроения), но расходы на сервисы — в отдельный суточный лимит
// limits.staffDailySpendRub и отдельной серией на дашборде. Лимит покупателей (dailySpendRub) их не видит.
import type { Role } from "@prisma/client";
import { db } from "./db";
import { cfg } from "./settings";
import { spentTodayRub } from "./limits";

export const STAFF_ROLES: Role[] = ["OWNER", "OPERATOR", "MARKETER"];
export const isStaff = (role: Role | string | null | undefined) => STAFF_ROLES.includes(role as Role);

/** Книга сотрудника: её владелец — сотрудник. Анонимная книга — покупательская. */
export async function bookIsStaff(bookId: string | null | undefined) {
  if (!bookId) return false;
  const b = await db.book.findUnique({ where: { id: bookId }, select: { user: { select: { role: true } } } });
  return isStaff(b?.user?.role);
}

/** Суточный лимит расходов исчерпан? Для книг сотрудников — свой лимит, для покупателей — общий. */
export async function spendLimitReached(staff: boolean) {
  const limits = await cfg("limits");
  const spent = await spentTodayRub({ staff });
  const limit = staff ? limits.staffDailySpendRub ?? 1000 : limits.dailySpendRub;
  return { over: spent >= limit, spent, limit, staff };
}
