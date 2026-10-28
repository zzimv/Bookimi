"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";

// Вход по одноразовому коду (email или телефон). Без паролей.
export function OtpForm({ onDone, submitLabel = "Получить код", withConsent = true }: { onDone: (role: string) => void; submitLabel?: string; withConsent?: boolean }) {
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request() {
    setError("");
    if (withConsent && !consent) return setError("Нужно согласие на обработку персональных данных");
    setBusy(true);
    try {
      const r = await api<{ demoCode?: string }>("/api/auth/request", { target });
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
      const r = await api<{ role: string }>("/api/auth/verify", { target, code, consentPd: withConsent && consent });
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
          <label className="field">
            <span>Email или телефон</span>
            <input className="input ym-disable-keys" inputMode="email" autoComplete="email" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="anna@mail.ru или +7 900 000-00-00" />
            <small>Пришлём код для входа. Пароль не нужен.</small>
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
          <button className="btn btn--primary" disabled={busy || target.length < 5} onClick={request}>
            {busy ? "Отправляем…" : submitLabel}
          </button>
        </>
      ) : (
        <>
          <label className="field">
            <span>Код из сообщения</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <small>
              Отправили на {target}.{" "}
              <button className="link-btn" onClick={() => setSent(false)}>
                Изменить
              </button>
            </small>
          </label>
          {demoCode && <p className="muted-panel small">Демо-режим: код — <b>{demoCode}</b>. В рабочем режиме код приходит письмом или СМС.</p>}
          <button className="btn btn--primary" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
