"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { normalizePhone } from "@/content/answers";

// Вход по одноразовому коду без паролей: телефон (обязателен для покупателя, +7) и почта — код приходит письмом.
// withPhone=false — только почта (вход сотрудников и тех, у кого телефон уже сохранён).
export function OtpForm({
  onDone,
  submitLabel = "Получить код",
  withConsent = true,
  withPhone = true,
}: {
  onDone: (role: string) => void;
  submitLabel?: string;
  withConsent?: boolean;
  withPhone?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const phoneOk = !withPhone || !phone.trim() || Boolean(normalizePhone(phone));

  async function request() {
    setError("");
    if (withConsent && !consent) return setError("Нужно согласие на обработку персональных данных");
    if (!phoneOk) return setError("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    setBusy(true);
    try {
      const r = await api<{ demoCode?: string }>("/api/auth/request", { email, ...(withPhone && phone.trim() ? { phone } : {}) });
      setSent(true);
      setDemoCode(r.demoCode ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError("");
    setBusy(true);
    try {
      const r = await api<{ role: string }>("/api/auth/verify", { email, ...(withPhone && phone.trim() ? { phone } : {}), code, consentPd: withConsent && consent });
      onDone(r.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!sent ? (
        <>
          {withPhone && (
            <label className="field">
              <span>
                Телефон <span className="req">*</span>
              </span>
              <input className="input ym-disable-keys" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
              <small>Для связи по заказу и доставке.</small>
            </label>
          )}
          <label className="field">
            <span>
              Почта <span className="req">*</span>
            </span>
            <input className="input ym-disable-keys" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@mail.ru" />
            <small>Пришлём код для входа на почту. Пароль не нужен.</small>
          </label>
          {withConsent && (
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Даю <Link href="/soglasie/pd" target="_blank">согласие на обработку персональных данных</Link> и принимаю{" "}
                <Link href="/politika" target="_blank">политику</Link>
              </span>
            </label>
          )}
          <button className="btn btn--primary" disabled={busy || email.length < 5} onClick={request}>
            {busy ? "Отправляем…" : submitLabel}
          </button>
        </>
      ) : (
        <>
          <label className="field">
            <span>Код из письма</span>
            <input className="input" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <small>
              Отправили на {email}.{" "}
              <button className="link-btn" onClick={() => setSent(false)}>
                Изменить
              </button>
            </small>
          </label>
          {demoCode && (
            <p className="muted-panel small">
              Демо-режим: код — <b data-demo-code>{demoCode}</b>. В рабочем режиме код приходит письмом.
            </p>
          )}
          <button className="btn btn--primary" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
