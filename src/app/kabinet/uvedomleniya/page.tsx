import { db } from "@/lib/db";
import { userOrLogin } from "@/lib/auth";
import { signToken } from "@/lib/crypto";
import { Prefs } from "../Forms";

export default async function Page() {
  const user = await userOrLogin();
  const prefs = await db.notificationPref.findMany({ where: { userId: user.id } });
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Уведомления</h1>
      <p className="muted">Выберите, куда присылать сообщения о книгах и заказах. Можно несколько каналов.</p>
      <Prefs
        prefs={prefs.map((p) => ({ channel: p.channel, isActive: p.isActive, marketing: p.marketing }))}
        telegramLink={bot ? `https://t.me/${bot}?start=${signToken(`tg:${user.id}`)}` : null}
        marketingOk={user.marketingOk}
        hasEmail={Boolean(user.email)}
      />
    </>
  );
}
