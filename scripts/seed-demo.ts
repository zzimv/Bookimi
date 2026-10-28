// ДЕМО-данные для показа и проверки всего пути покупателя без внешних сервисов.
// Только для демо-стенда (DEMO_MODE=1). На рабочем сайте не запускать: реквизиты и
// способы оплаты здесь — заглушки с пометкой «демо».
import { createPrisma } from "../src/lib/prisma-client";

const db = createPrisma();

async function set(key: string, value: object) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function main() {
  if (process.env.DEMO_MODE !== "1") throw new Error("seed-demo запускается только при DEMO_MODE=1");
  await set("seller", { fullName: "Иванова Анна Сергеевна (демо)", inn: "770012345606", status: "плательщик налога на профессиональный доход", email: "hello@bookimi.demo", phone: "+7 900 000-00-00" });
  await set("payments", {
    sbpQr: { enabled: true, provider: "demo", confirmMinutes: 60 },
    transfer: { enabled: true, phone: "+7 900 000-00-00", card: "", bank: "Демо-банк", holder: "Анна С. И. (демо)", cancelHours: 24 },
    yookassa: { enabled: false },
  });
  await set("flags", { printEnabled: true, photoUploadEnabled: true, demoMode: true });
  await set("alerts", { email: "owner@bookimi.demo", telegramChatId: "", spendPct: [80, 100], npdPct: [80, 95] });
  const ph = await db.printHouse.findFirst({ where: { isActive: true } });
  if (ph) {
    await db.printHouse.update({
      where: { id: ph.id },
      data: { email: "print@bookimi.demo", pickupAddress: "Москва, ул. Типографская, 1 (демо)", costs: { "mini-soft": 700, "mini-hard": 1100, "std-soft": 850, "std-hard": 1350, "album-hard": 1600, "big-hard": 2100, "height-chart": 250, stickers: 90, poster: 180, "gift-box": 160 } },
    });
  }
  for (const [email, role] of [["owner@bookimi.demo", "OWNER"], ["operator@bookimi.demo", "OPERATOR"], ["marketer@bookimi.demo", "MARKETER"]] as const) {
    await db.user.upsert({ where: { email }, update: { role }, create: { email, role, referralCode: `D${role.slice(0, 3)}` } });
  }
  await db.promoCode.upsert({ where: { code: "SKAZKA10" }, update: {}, create: { code: "SKAZKA10", percentOff: 10, source: "manual" } });
  console.log("демо-данные готовы: owner@bookimi.demo, operator@bookimi.demo, marketer@bookimi.demo (вход по коду, код показывается на экране)");
}

main().finally(() => db.$disconnect());
