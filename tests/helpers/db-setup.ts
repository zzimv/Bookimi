// Общая подготовка тестов на БД: каждый файл сам задаёт реквизиты продавца и способы оплаты —
// тесты не зависят от порядка запуска (vitest --sequence.shuffle) и от того, что сделал другой файл.
export const TEST_SELLER = { fullName: "Тестов Тест Тестович", inn: "770012345606", status: "плательщик НПД", email: "", phone: "" };
export const TEST_PAYMENTS = {
  sbpQr: { enabled: true, provider: "demo" as const, confirmMinutes: 60 },
  transfer: { enabled: true, phone: "+79000000000", card: "", bank: "", holder: "", cancelHours: 24 },
  yookassa: { enabled: false },
};

export async function setupSellerAndPayments() {
  const { saveSetting } = await import("@/lib/settings");
  await saveSetting("seller", TEST_SELLER);
  await saveSetting("payments", TEST_PAYMENTS);
}
