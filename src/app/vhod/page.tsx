import type { Metadata } from "next";
import { LoginBox } from "./LoginBox";
import { anonId } from "@/lib/auth";
import { hasConsent } from "@/lib/consent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  // Согласие уже дано с этого устройства — не спрашиваем; иначе сервер скажет после отправки кода, нужно ли оно
  const given = await hasConsent("PERSONAL_DATA", { anonId: await anonId() }).catch(() => false);
  return (
    <div className="flow" style={{ maxWidth: 460 }}>
      <h1>Вход в личный кабинет</h1>
      <p className="muted">Ваши книги, заказы и чеки. Вход по коду — без пароля.</p>
      <div className="panel">
        <LoginBox next={safe} consentGiven={given ? true : undefined} />
      </div>
    </div>
  );
}
