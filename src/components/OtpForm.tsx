"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { normalizePhone } from "@/content/answers";
import { checkFirstName, FIRST_NAME_ERROR, typeFirstName } from "@/lib/first-name";

/** +7 912 345-67-89 по мере ввода (принимает 8…, +7…, 9…). */
export interface OAuthButton {
  key: string;
  title: string;
  short: string;
  color?: string;
  /** Демо-стенд: вход имитируется, без перехода к провайдеру. */
  demo?: boolean;
}

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

// Вход: круглые кнопки VK ID / Яндекс ID / Mail.ru / Google (если настроены, src/lib/oauth.ts), ниже — вкладки
// «Почта / Телефон» и вход по одноразовому коду без паролей: телефон (обязателен для покупателя, +7) и почта —
// код приходит письмом; вкладка «Телефон» — код по SMS (только если включён auth.smsLogin).
// После входа через внешний аккаунт — один короткий шаг: телефон (если его не дали), «Как к вам обращаться», согласие.
// Согласие на ПДн — один раз: если уже дано (consentGiven, например на шаге фото) — ничего не показываем.
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
  initialName = "",
  initialEmail = "",
  complete = false,
  next = "",
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
  /** Имя, если уже известно (прошлый вход, профиль) — подставляем в «Как к вам обращаться». */
  initialName?: string;
  initialEmail?: string;
  /** Уже вошли через внешний аккаунт, не хватает телефона / имени / согласия (/vhod?oauth=phone). */
  complete?: boolean;
  /** Куда вернуться после входа через внешний аккаунт. */
  next?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState(initialName);
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [providers, setProviders] = useState<{ oauth: OAuthButton[]; smsLogin: boolean }>({ oauth: [], smsLogin: false });
  const [oauthStep, setOauthStep] = useState<OAuthButton | null>(null);
  const [stage, setStage] = useState<"form" | "complete">(complete ? "complete" : "form");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [needConsent, setNeedConsent] = useState<boolean>(withConsent && (complete ? consentGiven === false : consentGiven !== true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!withPhone) return;
    api<{ oauth: OAuthButton[]; smsLogin: boolean; demo?: boolean }>("/api/auth/providers")
      .then((r) => setProviders({ oauth: r.oauth ?? [], smsLogin: Boolean(r.smsLogin) }))
      .catch(() => {});
  }, [withPhone]);
  useEffect(() => {
    if (initialName && !firstName) setFirstName(initialName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName]);

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
    const bySms = tab === "phone";
    if (withPhone && (phoneRequired || bySms || !phoneEmpty) && !phoneValid) return setError("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    if (!bySms && !emailValid) return setError("Проверьте адрес почты");
    if (withName && checkFirstName(firstName) === false) return setError(FIRST_NAME_ERROR);
    if (withConsent && consentGiven === false && !consent) return setError("Отметьте согласие на обработку персональных данных");
    setBusy(true);
    try {
      const withPh = withPhone && phoneValid;
      const r = await api<{ demoCode?: string; needsConsent?: boolean }>("/api/auth/request", bySms ? { target: phone } : { email, ...(withPh ? { phone } : {}) });
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
        ...(tab === "phone" ? { target: phone } : { email }),
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

  /** Кнопка внешнего аккаунта: на сайте — переход к провайдеру; в демо-стенде (demo: true) — имитация входа. */
  async function oauth(p: OAuthButton) {
    setError("");
    if (!p.demo) {
      window.location.href = `/api/auth/oauth/${p.key}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      return;
    }
    setOauthStep(p);
  }
  async function oauthDemoAllow(p: OAuthButton) {
    setBusy(true);
    try {
      const r = await api<{ firstName?: string; email?: string; needs: { phone: boolean; consent: boolean } }>("/api/auth/oauth-demo", { provider: p.key });
      setOauthStep(null);
      if (r.firstName) setFirstName(r.firstName);
      if (r.email) setEmail(r.email);
      if (withName || r.needs.phone || r.needs.consent) {
        setNeedConsent(r.needs.consent);
        setStage("complete");
      } else onDone("CUSTOMER");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setError("");
    if (withPhone && phoneRequired && !phoneValid) return setError("Укажите мобильный номер: +7 9XX XXX-XX-XX");
    if (checkFirstName(firstName) === false) return setError(FIRST_NAME_ERROR);
    if (needConsent && !consent) return setError("Отметьте согласие на обработку персональных данных");
    setBusy(true);
    try {
      const r = await api<{ role: string }>("/api/auth/complete", { ...(phoneValid ? { phone } : {}), firstName: checkFirstName(firstName) || undefined, consentPd: consent || undefined });
      onDone(r.role);
    } catch (e) {
      // Согласия в аккаунте нет — показываем галочку (до этого не знали)
      if (/согласие/i.test((e as Error).message)) setNeedConsent(true);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const nameField = withName && (
    <label className="field field--name">
      <span>
        Как к вам обращаться <span className="muted small">— необязательно</span>
      </span>
      <input className="input ym-disable-keys" name="first-name" autoComplete="given-name" maxLength={40} value={firstName} aria-invalid={checkFirstName(firstName) === false ? true : undefined} onChange={(e) => setFirstName(typeFirstName(e.target.value))} onBlur={() => { const n = checkFirstName(firstName); if (n) setFirstName(n); }} placeholder="Анна" />
      <small>Так поздороваемся в кабинете и подставим имя получателя при оформлении.</small>
    </label>
  );
  const phoneField = (required: boolean, hint: string) => (
    <label className="field">
      <span>
        Телефон {required && <span className="req" aria-hidden="true">*</span>}
      </span>
      <input
        className="input input--lg ym-disable-keys"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        aria-invalid={phone.length > 6 && !phoneValid ? true : undefined}
        value={phone}
        onChange={(e) => setPhone(formatPhone(e.target.value))}
        onFocus={() => !phone && setPhone("+7 ")}
        placeholder="+7 900 000-00-00"
      />
      <small>{hint}</small>
    </label>
  );

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
      {stage === "complete" ? (
        <form
          className="otp-complete"
          data-otp-complete
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
          noValidate
        >
          <p className="ok small" style={{ marginTop: 0 }}>Вы вошли{email ? <> как <b>{email}</b></> : null}. Остался один шаг.</p>
          {withPhone && phoneField(phoneRequired, "Для связи по заказу и доставке. Не звоним без повода и не передаём номер третьим лицам.")}
          {nameField}
          {needConsent && consentBox}
          <button className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Сохраняем…" : "Готово"}
          </button>
        </form>
      ) : oauthStep ? (
        <div className="oauth-demo" role="dialog" aria-labelledby="oauth-demo-h" data-oauth-demo={oauthStep.key}>
          <span className="oauth__btn oauth__btn--big" data-p={oauthStep.key} aria-hidden="true">{oauthStep.short}</span>
          <h2 id="oauth-demo-h">Вход через {oauthStep.title} <span className="badge">демо</span></h2>
          <p className="small">{oauthStep.title} передаст БУКИМИ ваше имя и почту. На сайте здесь откроется окно {oauthStep.title}; в демо вход имитируется — никуда ничего не отправляется.</p>
          <div className="row">
            <button type="button" className="btn btn--primary" data-oauth-allow disabled={busy} onClick={() => oauthDemoAllow(oauthStep)}>{busy ? "Входим…" : "Разрешить и войти"}</button>
            <button type="button" className="btn btn--ghost" onClick={() => setOauthStep(null)}>Отмена</button>
          </div>
        </div>
      ) : !sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request();
          }}
          noValidate
        >
          {withPhone && providers.oauth.length > 0 && (
            <div className="oauth" data-oauth>
              <p className="oauth__h">Войти через</p>
              <div className="oauth__row">
                {providers.oauth.map((p) => (
                  <button key={p.key} type="button" className="oauth__btn" data-p={p.key} aria-label={`Войти через ${p.title}`} title={p.title} onClick={() => oauth(p)}>
                    <span aria-hidden="true">{p.short}</span>
                  </button>
                ))}
              </div>
              <p className="oauth__or"><span>или по коду</span></p>
            </div>
          )}
          {withPhone && providers.smsLogin && (
            <div className="mode-tabs otp-tabs" role="tablist" aria-label="Как получить код">
              <button type="button" role="tab" aria-selected={tab === "email"} data-tab="email" onClick={() => setTab("email")}>Почта</button>
              <button type="button" role="tab" aria-selected={tab === "phone"} data-tab="phone" onClick={() => setTab("phone")}>Телефон</button>
            </div>
          )}
          {withPhone &&
            phoneField(
              phoneRequired || tab === "phone",
              tab === "phone"
                ? "Пришлём код в SMS — пароль не нужен."
                : phoneRequired
                  ? "Для связи по заказу и доставке. Не звоним без повода и не передаём номер третьим лицам."
                  : "Нужен для заказов. Если вы уже указывали телефон — можно не заполнять.",
            )}
          {tab === "email" && (
            <label className="field">
              <span>
                Почта <span className="req" aria-hidden="true">*</span>
              </span>
              <input className="input input--lg ym-disable-keys" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="anna@mail.ru" />
              <small>Сюда придёт код для входа — пароль не нужен. И ссылка на книгу.</small>
            </label>
          )}
          {nameField}
          {/* Согласие уже дано (на шаге фото) — второй раз не показываем ни галочку, ни «дано ✓» (решение владелицы, rev 10) */}
          {withConsent && consentGiven === false && consentBox}
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
            <span>{tab === "phone" ? "Код из SMS" : "Код из письма"}</span>
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
              Отправили на <b>{tab === "phone" ? phone : email}</b>.{tab === "phone" ? " " : " Не пришло — загляните в «Спам». "}
              <button type="button" className="link-btn" onClick={() => { setSent(false); setCode(""); }}>
                {tab === "phone" ? "Изменить номер" : "Изменить почту"}
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
