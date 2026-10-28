"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, goal, rub } from "@/lib/client";

type View =
  | { type: "qr"; qrSvg: string; payUrl: string; expiresAt: string; demo: boolean }
  | { type: "transfer"; phone: string; card: string; bank: string; holder: string; code: string; amountRub: number; expiresAt: string }
  | { type: "redirect"; url: string };

export function PayBox({ orderId, total, methods, initialStatus, demo }: { orderId: string; total: number; methods: { key: string; title: string; note: string }[]; initialStatus: string; demo: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [longWait, setLongWait] = useState(false);

  // Долго на оплате → показываем гарантии
  useEffect(() => {
    const t = setTimeout(() => setLongWait(true), 45_000);
    return () => clearTimeout(t);
  }, []);

  // Ждём подтверждения оплаты
  useEffect(() => {
    if (!view && status !== "AWAITING_CONFIRMATION") return;
    const t = setInterval(async () => {
      const r = await api<{ status: string }>(`/api/orders/${orderId}`).catch(() => null);
      if (r && r.status !== status) {
        setStatus(r.status);
        if (r.status === "PAID") {
          goal("pay", { total });
          router.refresh();
        }
      }
    }, 3000);
    return () => clearInterval(t);
  }, [view, status, orderId, total, router]);

  async function pay(method: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ view: View }>(`/api/orders/${orderId}`, { action: "pay", method });
      if (r.view.type === "redirect") window.location.href = r.view.url;
      else setView(r.view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    try {
      await api(`/api/orders/${orderId}`, { action: "claim" });
      setStatus("AWAITING_CONFIRMATION");
      setView(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === "AWAITING_CONFIRMATION") {
    return (
      <div className="panel">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Проверяем перевод</h2>
        <p>Как только деньги поступят, мы подтвердим оплату и сразу начнём делать книгу. Обычно до 2 часов в рабочее время. Сообщим, когда всё будет готово.</p>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="panel">
      {!view ? (
        <>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Как удобнее оплатить?</h2>
          {methods.length === 0 && <p className="muted">Оплата пока не принимается. Книга сохранена — мы сообщим, когда можно будет оплатить.</p>}
          <div className="choice-cards">
            {methods.map((m) => (
              <button key={m.key} className="big-choice" disabled={busy} onClick={() => pay(m.key)}>
                <strong>{m.title}</strong>
                {m.note}
              </button>
            ))}
          </div>
        </>
      ) : view.type === "qr" ? (
        <>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Оплата по QR-коду через СБП</h2>
          <p>Отсканируйте код камерой телефона или в приложении банка. Сумма — {rub(total)}.</p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: view.qrSvg }} />
          <p className="small muted" style={{ textAlign: "center" }}>Код действует до {new Date(view.expiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}. Страница обновится сама после оплаты.</p>
          {view.demo && demo && (
            <p style={{ textAlign: "center" }}>
              <a className="btn btn--gold" href={view.payUrl}>Оплатить (демо)</a>
            </p>
          )}
        </>
      ) : view.type === "transfer" ? (
        <>
          <h2 style={{ fontSize: "var(--fs-lg)" }}>Перевод по реквизитам</h2>
          <table className="req-table">
            <tbody>
              {view.phone && <tr><td>По номеру телефона (СБП)</td><td className="copy">{view.phone}</td></tr>}
              {view.card && <tr><td>Или на карту</td><td className="copy">{view.card}</td></tr>}
              {view.bank && <tr><td>Банк</td><td>{view.bank}</td></tr>}
              {view.holder && <tr><td>Получатель</td><td>{view.holder}</td></tr>}
              <tr><td>Сумма</td><td className="copy">{rub(view.amountRub)}</td></tr>
              <tr><td>Комментарий к переводу</td><td className="copy">{view.code}</td></tr>
            </tbody>
          </table>
          <p className="small">Обязательно укажите код заказа в комментарии — так мы быстро найдём ваш перевод. Подтверждение — обычно до 2 часов в рабочее время.</p>
          <button className="btn btn--primary" disabled={busy} onClick={claim}>Я оплатил(а)</button>
        </>
      ) : null}
      {error && <p className="error">{error}</p>}
      {longWait && status === "PENDING_PAYMENT" && (
        <div className="muted-panel small" style={{ marginTop: 16 }}>
          <b>Почему нам можно доверять</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>Чек из «Мой налог» приходит сразу после оплаты.</li>
            <li>Если в печати будет брак — перепечатаем бесплатно или вернём деньги.</li>
            <li>Превью и книга сохраняются в кабинете — ничего не потеряется.</li>
          </ul>
          <p style={{ margin: "6px 0 0" }}>Есть вопрос? <Link href="/kabinet/podderzhka">Напишите нам</Link>.</p>
        </div>
      )}
    </div>
  );
}
