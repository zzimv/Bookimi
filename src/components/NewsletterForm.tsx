"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!ok) return setError("Отметьте согласие на рассылку");
    setBusy(true);
    try {
      const r = await api<{ code: string }>("/api/newsletter", { email, consent: true });
      setCode(r.code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (code)
    return (
      <div className="panel" role="status">
        <b>Готово!</b> Ваш промокод: <span className="copy">{code}</span>
        <p className="small muted" style={{ margin: "6px 0 0" }}>Сохраните его и введите при оформлении заказа.</p>
      </div>
    );

  return (
    <form className="nl__form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Почта</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@mail.ru" />
      </label>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          Согласен(на) получать письма — <Link href="/soglasie/rassylka" target="_blank">согласие на рассылку</Link>. Отписаться можно в один клик.
        </span>
      </label>
      <button className="btn btn--primary" disabled={busy || email.length < 5}>{busy ? "Подписываем…" : "Получить промокод"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
