import type { Metadata } from "next";
import { LoginBox } from "./LoginBox";
import { anonId } from "@/lib/auth";
import { hasConsent } from "@/lib/consent";
import { currentUser } from "@/lib/auth";

const OAUTH_MSG: Record<string, string> = {
  error: "Не получилось войти через внешний аккаунт. Попробуйте ещё раз или войдите по коду.",
  cancel: "Вход отменён. Можно войти по коду.",
  noemail: "Сервис не передал почту — войдите по коду, это быстро.",
  staff: "Сотрудники входят только по коду и второму фактору.",
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; oauth?: string }> }) {
  const { next, oauth } = await searchParams;
  // После входа через VK ID / Яндекс / Mail.ru / Google не хватает телефона — один шаг «телефон и как к вам обращаться»
  const user = oauth === "phone" ? await currentUser().catch(() => null) : null;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
  // Согласие уже дано с этого устройства — не спрашиваем; иначе сервер скажет после отправки кода, нужно ли оно
  const given = await hasConsent("PERSONAL_DATA", { anonId: await anonId() }).catch(() => false);
  return (
    <div className="flow" style={{ maxWidth: 460 }}>
      <h1>Вход в личный кабинет</h1>
      <p className="muted">Ваши книги, заказы и чеки. Вход по коду — без пароля.</p>
      {oauth && OAUTH_MSG[oauth] && <p className="error" role="alert">{OAUTH_MSG[oauth]}</p>}
      <div className="panel">
        <LoginBox next={safe} consentGiven={given ? true : undefined} complete={Boolean(user)} initialName={user?.firstName ?? ""} initialEmail={user?.email ?? ""} />
      </div>
    </div>
  );
}
