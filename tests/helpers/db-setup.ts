// Общая подготовка тестов на БД: каждый файл сам задаёт реквизиты продавца и способы оплаты —
// тесты не зависят от порядка запуска (vitest --sequence.shuffle) и от того, что сделал другой файл.
export const TEST_SELLER = { fullName: "Тестов Тест Тестович", inn: "770012345606", status: "плательщик НПД", email: "", phone: "" };
export const TEST_PAYMENTS = {
  sbpQr: { enabled: true, provider: "demo" as const, confirmMinutes: 60 },
  transfer: { enabled: true, phone: "+79000000000", card: "", bank: "", holder: "", cancelHours: 24 },
  yookassa: { enabled: false },
};

/** Алерты владельцу — только в Telegram (seed-demo ставит почту): тесты считают алерты по outbox.telegram. */
export const TEST_ALERTS = { email: "", telegramChatId: "test-alerts", spendPct: [80, 100], npdPct: [80, 95] };

export async function setupSellerAndPayments() {
  const { saveSetting } = await import("@/lib/settings");
  await saveSetting("alerts", TEST_ALERTS);
  await saveSetting("seller", TEST_SELLER);
  await saveSetting("payments", TEST_PAYMENTS);
  // Самовывоз разрешён, только если у типографии есть адрес (проверка на сервере) — тесты с pickup его получают
  const { db } = await import("@/lib/db");
  await db.printHouse.updateMany({ where: { isActive: true, pickupAddress: null }, data: { pickupAddress: "Москва, ул. Типографская, 1" } });
}
