"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { normalizePhone } from "@/content/answers";
import { checkFirstName, FIRST_NAME_ERROR, typeFirstName } from "@/lib/first-name";

/** +7 912 345-67-89 по мере ввода (принимает 8…, +7…, 9…). */
export function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+7")) d = d.slice(1);
  // Вставили «8 912…» или «+7 912…» поверх «+7 » — убираем лишний код страны
  while (d.length > 10 && /^[78]/.test(d)) d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return raw.trim() === "+" || raw.trim() === "+7" ? "+7 " : "";
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
  return `+7 ${p[0]}${p[1] ? ` ${p[1]}` : ""}${p[2] ? `-${p[2]}` : ""}${p[3] ? `-${p[3]}` : ""}`;
}

// Вход по одноразовому коду без паролей: телефон (обязателен для покупателя, +7) и почта — код приходит письмом.
// Согласие на ПДн — один раз: если уже дано (consentGiven, например на шаге фото) — показываем «дано ✓» со ссылкой.
// Рассылка — отдельная необязательная галочка, только здесь.
export function OtpForm({
  onDone,
  submitLabel = "Получить код",
  withConsent = true,
  withPhone = true,
  consentGiven,
  withMarketing = true,
  phoneRequired = true,
  withName = true,
}: {
  onDone: (role: string) => void;
  submitLabel?: string;
  withConsent?: boolean;
  withPhone?: boolean;
  /** true — согласие уже дано; false — нужно; undefined — неизвестно (спросим сервер при отправке кода). */
  consentGiven?: boolean;
  withMarketing?: boolean;
  /** false — вход в кабинет: телефон проверяет сервер (у сотрудников и тех, кто его уже указал, не нужен). */
  phoneRequired?: boolean;
  /** Необязательное поле «Как к вам обращаться» — приветствие в кабинете и получатель при оформлении. */
  withName?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [needConsent, setNeedConsent] = useState<boolean>(withConsent && consentGiven !== true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const phoneValid = Boolean(normalizePhone(phone));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function request() {
    setError("");
    const phoneEmpty = phone.replace(/\D/g, "").length <= 1;
    if (withPhone && (phoneRequired || !phoneEmpty) && !phoneValid) return setError("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    if (!emailValid) return setError("Проверьте адрес почты");
    if (withName && checkFirstName(firstName) === false) return setError(FIRST_NAME_ERROR);
    if (withConsent && consentGiven === false && !consent) return setError("Отметьте согласие на обработку персональных данных");
    setBusy(true);
    try {
      const withPh = withPhone && phoneValid;
      const r = await api<{ demoCode?: string; needsConsent?: boolean }>("/api/auth/request", { email, ...(withPh ? { phone } : {}) });
      setSent(true);
      setWait(60);
      setDemoCode(r.demoCode ?? null);
      if (withConsent && consentGiven !== true) setNeedConsent(r.needsConsent !== false);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(c = code) {
    setError("");
    if (needConsent && !consent) return setError("Отметьте согласие на обработку персональных данных");
    setBusy(true);
    try {
      const r = await api<{ role: string }>("/api/auth/verify", {
        email,
        ...(withPhone && phoneValid ? { phone } : {}),
        code: c,
        consentPd: withConsent && consent,
        marketing: withMarketing && marketing,
        ...(withName && checkFirstName(firstName) ? { firstName: checkFirstName(firstName) } : {}),
      });
      onDone(r.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const consentBox = (
    <label className="check">
      <input type="checkbox" name="consent-pd" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      <span>
        Даю <Link href="/soglasie/pd" target="_blank">согласие на обработку персональных данных</Link> и принимаю{" "}
        <Link href="/politika" target="_blank">политику конфиденциальности</Link>
      </span>
    </label>
  );

  return (
    <div className="otp">
      {!sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request();
          }}
          noValidate
        >
          {withPhone && (
            <label className="field">
              <span>
                Телефон {phoneRequired && <span className="req" aria-hidden="true">*</span>}
              </span>
              <input
                className="input input--lg ym-disable-keys"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required={phoneRequired}
                aria-invalid={phone.length > 6 && !phoneValid ? true : undefined}
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                onFocus={() => !phone && setPhone("+7 ")}
                placeholder="+7 900 000-00-00"
              />
              <small>
                {phoneRequired
                  ? "Для связи по заказу и доставке. Не звоним без повода и не передаём номер третьим лицам."
                  : "Нужен для заказов. Если вы уже указывали телефон — можно не заполнять."}
              </small>
            </label>
          )}
          <label className="field">
            <span>
              Почта <span className="req" aria-hidden="true">*</span>
            </span>
            <input className="input input--lg ym-disable-keys" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="anna@mail.ru" />
            <small>Сюда придёт код для входа — пароль не нужен. И ссылка на книгу.</small>
          </label>
          {withName && (
            <label className="field">
              <span>
                Как к вам обращаться <span className="muted small">— необязательно</span>
              </span>
              <input className="input ym-disable-keys" name="first-name" autoComplete="given-name" maxLength={40} value={firstName} aria-invalid={checkFirstName(firstName) === false ? true : undefined} onChange={(e) => setFirstName(typeFirstName(e.target.value))} onBlur={() => { const n = checkFirstName(firstName); if (n) setFirstName(n); }} placeholder="Анна" />
              <small>Так поздороваемся в кабинете и подставим имя получателя при оформлении. Буквы, пробел, дефис или апостроф.</small>
            </label>
          )}
          {withConsent &&
            (consentGiven ? (
              <p className="consent-done">
                <span aria-hidden="true">✓</span> Согласие на обработку персональных данных дано.{" "}
                <Link href="/soglasie/pd" target="_blank">Текст согласия</Link>
              </p>
            ) : consentGiven === false ? (
              consentBox
            ) : null)}
          {withMarketing && (
            <label className="check check--optional">
              <input type="checkbox" name="marketing" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>
                Присылать идеи к праздникам и скидки — <Link href="/soglasie/rassylka" target="_blank">согласие на рассылку</Link>. Необязательно, отписка в один клик.
              </span>
            </label>
          )}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Отправляем…" : submitLabel}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          noValidate
        >
          <label className="field">
            <span>Код из письма</span>
            <input
              ref={codeRef}
              className="input input--code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6 && (!needConsent || consent)) verify(v);
              }}
              placeholder="••••••"
            />
            <small>
              Отправили на <b>{email}</b>. Не пришло — загляните в «Спам».{" "}
              <button type="button" className="link-btn" onClick={() => { setSent(false); setCode(""); }}>
                Изменить почту
              </button>
              {" · "}
              <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={request}>
                {wait > 0 ? `Отправить ещё раз через ${wait} с` : "Отправить ещё раз"}
              </button>
            </small>
          </label>
          {needConsent && consentGiven === undefined && consentBox}
          {demoCode && (
            <p className="muted-panel small">
              Демо-режим: код — <b data-demo-code>{demoCode}</b>. В рабочем режиме код приходит письмом.
            </p>
          )}
          <button className="btn btn--primary btn--block" disabled={busy || code.length !== 6}>
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
