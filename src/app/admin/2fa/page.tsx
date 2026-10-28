import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { totpSetupAction, totpVerifyAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Двухфакторный вход", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ setup?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await currentSession();
  if (!s || s.user.role === "CUSTOMER") redirect("/vhod?next=/admin");
  const secret = s.user.totpSecret ? decrypt(s.user.totpSecret) : null;
  const needSetup = !s.user.totpEnabled;
  const uri = secret ? `otpauth://totp/${encodeURIComponent(`БУКИМИ:${s.user.email ?? s.user.phone}`)}?secret=${secret}&issuer=${encodeURIComponent("БУКИМИ")}` : "";
  const qr = uri ? await QRCode.toString(uri, { type: "svg", width: 200, margin: 1 }) : "";
  return (
    <div className="flow" style={{ maxWidth: 480 }}>
      <h1>Двухфакторный вход</h1>
      {needSetup && !secret && (
        <div className="panel">
          <p>Для входа в админку нужен второй фактор: код из приложения-аутентификатора (Яндекс Ключ, Google Authenticator и др.).</p>
          <form action={totpSetupAction}>
            <button className="btn btn--primary">Настроить</button>
          </form>
        </div>
      )}
      {needSetup && secret && (
        <div className="panel">
          <p>Отсканируйте QR-код в приложении-аутентификаторе или введите ключ вручную.</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="small" style={{ wordBreak: "break-all" }}>Ключ: <b>{secret}</b></p>
        </div>
      )}
      {secret && (
        <form action={totpVerifyAction} className="panel">
          <label className="field">
            <span>Код из приложения</span>
            <input className="input" name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" required />
          </label>
          {sp.error && <p className="error">Неверный код. Проверьте время на телефоне.</p>}
          <button className="btn btn--primary">Подтвердить</button>
        </form>
      )}
    </div>
  );
}
