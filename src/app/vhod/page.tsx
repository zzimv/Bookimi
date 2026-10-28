import type { Metadata } from "next";
import { LoginBox } from "./LoginBox";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  return (
    <div className="flow" style={{ maxWidth: 460 }}>
      <h1>Вход в личный кабинет</h1>
      <p className="muted">Ваши книги, заказы и чеки. Вход по коду — без пароля.</p>
      <div className="panel">
        <LoginBox next={safe} />
      </div>
    </div>
  );
}
