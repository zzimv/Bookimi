import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { currentSession, isStaffRole } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { safeAdminNext } from "@/lib/admin";
import { recoveryAckAction, recoveryRegenerateAction, totpSetupAction, totpVerifyAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Двухфакторный вход", robots: { index: false } };

type SP = { setup?: string; error?: string; locked?: string; reauth?: string; next?: string; codes?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await currentSession();
  if (!s || !isStaffRole(s.user.role)) redirect("/vhod?next=/admin");
  const enabled = s.user.totpEnabled;
  const reauth = sp.reauth === "1" && enabled;

  // Коды восстановления — один раз, сразу после включения 2FA (или перевыпуска)
  if (sp.codes && s.recoveryShow) {
    const codes = decrypt(s.recoveryShow).split(" ");
    return (
      <div className="flow" style={{ maxWidth: 480 }}>
        <h1>Коды восстановления</h1>
        <div className="panel">
          <p>Если телефон с приложением потеряется, войти можно одним из этих кодов. Каждый срабатывает один раз. Сохраните их в менеджере паролей или распечатайте — больше мы их не покажем.</p>
          <ul className="small" style={{ columns: 2, fontFamily: "monospace", fontSize: 16, listStyle: "none", padding: 0 }}>
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <form action={recoveryAckAction}>
            <button className="btn btn--primary">Я сохранил(а) коды</button>
          </form>
        </div>
      </div>
    );
  }

  // Настройка — только пока 2FA не включена. Включена — только ввод кода (новый ключ из сессии без 2FA не выдаём).
  const secret = !enabled && s.user.totpSecret ? decrypt(s.user.totpSecret) : null;
  const uri = secret ? `otpauth://totp/${encodeURIComponent(`БУКИМИ:${s.user.email ?? s.user.phone}`)}?secret=${secret}&issuer=${encodeURIComponent("БУКИМИ")}` : "";
  const qr = uri ? await QRCode.toString(uri, { type: "svg", width: 200, margin: 1 }) : "";
  const showVerify = Boolean(s.user.totpSecret) && (!s.mfaPassed || reauth || !enabled);
  return (
    <div className="flow" style={{ maxWidth: 480 }}>
      <h1>{reauth ? "Подтвердите действие" : "Двухфакторный вход"}</h1>
      {reauth && <p className="muted">Для возвратов, реквизитов, цен, ролей и подтверждения оплаты нужен свежий код из приложения. Введите его — и повторите действие.</p>}
      {sp.locked && <p className="error" role="alert">Слишком много неверных кодов. Вход заблокирован на 15 минут, владелец получил уведомление.</p>}
      {!enabled && !secret && (
        <div className="panel">
          <p>Для входа в админку нужен второй фактор: код из приложения-аутентификатора (Яндекс Ключ, Google Authenticator и др.).</p>
          <form action={totpSetupAction}>
            <button className="btn btn--primary">Настроить</button>
          </form>
        </div>
      )}
      {secret && (
        <div className="panel">
          <p>Отсканируйте QR-код в приложении-аутентификаторе или введите ключ вручную.</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="small" style={{ wordBreak: "break-all" }}>Ключ: <b>{secret}</b></p>
        </div>
      )}
      {showVerify && (
        <form action={totpVerifyAction} className="panel">
          {reauth && <input type="hidden" name="reauth" value="1" />}
          {reauth && <input type="hidden" name="next" value={safeAdminNext(sp.next)} />}
          <label className="field">
            <span>{enabled ? "Код из приложения или код восстановления" : "Код из приложения"}</span>
            <input className="input" name="code" inputMode={enabled ? "text" : "numeric"} maxLength={enabled ? 9 : 6} autoComplete="one-time-code" required />
          </label>
          {sp.error && <p className="error" role="alert">Неверный код. Проверьте время на телефоне.</p>}
          <button className="btn btn--primary">Подтвердить</button>
        </form>
      )}
      {enabled && s.mfaPassed && !reauth && (
        <div className="panel">
          <p className="small">Двухфакторный вход включён. Осталось кодов восстановления: {s.user.totpRecovery.length}.</p>
          <form action={recoveryRegenerateAction}>
            <button className="btn btn--ghost btn--sm">Выпустить новые коды восстановления</button>
          </form>
        </div>
      )}
    </div>
  );
}
