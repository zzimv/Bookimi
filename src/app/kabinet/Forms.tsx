"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { checkFirstName, FIRST_NAME_ERROR, typeFirstName } from "@/lib/first-name";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="row">
        <input className="input" readOnly value={value} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn--ghost btn--sm" onClick={() => { navigator.clipboard?.writeText(value); setOk(true); }}>{ok ? "Скопировано" : "Копировать"}</button>
      </div>
    </label>
  );
}

export function Prefs({ prefs, telegramLink, marketingOk, hasEmail }: { prefs: { channel: string; isActive: boolean; marketing: boolean }[]; telegramLink: string | null; marketingOk: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [maxId, setMaxId] = useState("");
  const p = (c: string) => prefs.find((x) => x.channel === c);
  async function save(channel: string, active: boolean, marketing?: boolean) {
    try {
      await api("/api/me", { action: "prefs", channel, active, marketing });
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  const row = (c: "email" | "telegram" | "max", title: string, extra?: React.ReactNode) => (
    <div className="spread" key={c}>
      <header><b style={{ color: "var(--ink)", fontSize: 15 }}>{title}</b>{p(c)?.isActive ? <span className="badge">включено</span> : <span className="badge badge--gold">выключено</span>}</header>
      {p(c) ? (
        <div className="row">
          <label className="check"><input type="checkbox" checked={p(c)!.isActive} onChange={(e) => save(c, e.target.checked)} /> О заказах</label>
          <label className="check"><input type="checkbox" checked={p(c)!.marketing} onChange={(e) => save(c, p(c)!.isActive, e.target.checked)} /> Новости и скидки</label>
        </div>
      ) : (
        extra
      )}
    </div>
  );
  return (
    <>
      {hasEmail && row("email", "Email")}
      {row("telegram", "Telegram", telegramLink ? <a className="btn btn--ghost btn--sm" href={telegramLink} target="_blank" rel="noopener">Подключить Telegram</a> : <span className="small muted">Бот подключается в настройках сайта.</span>)}
      {row(
        "max",
        "MAX",
        <div className="row">
          <input className="input" style={{ maxWidth: 220 }} placeholder="ID чата из бота" value={maxId} onChange={(e) => setMaxId(e.target.value)} />
          <button className="btn btn--ghost btn--sm" onClick={async () => { try { await api("/api/me", { action: "maxChat", chatId: maxId }); router.refresh(); } catch (e) { setMsg((e as Error).message); } }}>Подключить</button>
        </div>,
      )}
      <p className="small muted">WhatsApp пока недоступен: сервис ограничивается в России, а передача номера за рубеж требует отдельного согласия.</p>
      {!marketingOk && <p className="small">Новости и скидки приходят только с вашего согласия — его можно дать выше, отметив «Новости и скидки».</p>}
      {msg && <p className="error">{msg}</p>}
    </>
  );
}

/** «Как к вам обращаться» — имя для приветствия в кабинете и получателя при оформлении (необязательно). */
export function NameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  async function save() {
    setMsg("");
    const name = checkFirstName(v);
    if (name === false) return setMsg(FIRST_NAME_ERROR);
    try {
      await api("/api/me", { action: "name", firstName: name ?? "" });
      setMsg(v.trim() ? "Сохранили." : "Имя убрали.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <b>Как к вам обращаться</b>
      <p className="small muted">Так поздороваемся в кабинете и подставим получателя при оформлении. Необязательно; буквы, пробел или дефис.</p>
      <div className="row">
        <input className="input" name="first-name" autoComplete="given-name" maxLength={40} value={v} onChange={(e) => setV(typeFirstName(e.target.value))} placeholder="Анна" style={{ flex: "1 1 200px", maxWidth: 320 }} />
        <button className="btn btn--ghost btn--sm">Сохранить</button>
      </div>
      {msg && <p className="small ok">{msg}</p>}
    </form>
  );
}

export function DataActions() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  async function revoke(type: string) {
    await api("/api/me", { action: "revoke", type });
    setMsg(type === "CHILD_PHOTO" ? "Согласие отозвано, фото удалены." : "Согласие отозвано.");
  }
  return (
    <>
      <div className="panel">
        <b>Выгрузка данных</b>
        <p className="small muted">Все данные, которые мы храним о вас и ваших книгах, одним файлом.</p>
        <a className="btn btn--ghost btn--sm" href="/api/me">Скачать мои данные</a>
      </div>
      <div className="panel">
        <b>Отзыв согласий</b>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => revoke("MARKETING")}>Отозвать согласие на рассылку</button>
          <button className="btn btn--ghost btn--sm" onClick={() => revoke("CHILD_PHOTO")}>Отозвать согласие на фото и удалить фото</button>
        </div>
      </div>
      <div className="panel">
        <b>Удалить аккаунт</b>
        <p className="small muted">Удалим анкеты, фото, контакты и книги из кабинета. Суммы и даты оплат останутся обезличенными — их нужно хранить для учёта дохода. Отменить нельзя.</p>
        <label className="field" style={{ maxWidth: 300 }}>
          <span>Напишите УДАЛИТЬ</span>
          <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button
          className="btn btn--sm"
          style={{ background: "var(--danger)", color: "#fff" }}
          disabled={confirm !== "УДАЛИТЬ"}
          onClick={async () => {
            await api("/api/me", { action: "delete", confirm });
            router.push("/");
            router.refresh();
          }}
        >
          Удалить навсегда
        </button>
      </div>
      {msg && <p className="ok">{msg}</p>}
    </>
  );
}

export function SupportForm({ orders, contact }: { orders: { id: string; code: string }[]; contact: string }) {
  const [c, setC] = useState(contact);
  const [m, setM] = useState("");
  const [orderId, setOrderId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="panel">
      <label className="field"><span>Контакт для ответа</span><input className="input" value={c} onChange={(e) => setC(e.target.value)} /></label>
      {orders.length > 0 && (
        <label className="field">
          <span>Заказ</span>
          <select className="select" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Без заказа</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
          </select>
        </label>
      )}
      <label className="field"><span>Сообщение</span><textarea className="textarea" value={m} maxLength={2000} onChange={(e) => setM(e.target.value)} /></label>
      <button
        className="btn btn--primary"
        disabled={m.length < 5}
        onClick={async () => {
          setError("");
          try {
            await api("/api/support", { contact: c, message: m, orderId: orderId || undefined });
            setMsg("Спасибо! Ответим в течение рабочего дня.");
            setM("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Отправить
      </button>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function ReviewForm({ orderId }: { orderId?: string }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  if (ok) return <p className="ok">Спасибо! Отзыв появится на сайте после проверки.</p>;
  return (
    <div className="panel">
      <div className="chips">{[5, 4, 3, 2, 1].map((r) => <button key={r} className="chip" aria-pressed={rating === r} onClick={() => setRating(r)}>{"★".repeat(r)}</button>)}</div>
      <label className="field"><span>Как подписать отзыв</span><input className="input" placeholder="Например, Ольга, мама Вари" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Отзыв</span><textarea className="textarea" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></label>
      <p className="small muted">Отправляя отзыв, вы разрешаете опубликовать его на сайте с этой подписью.</p>
      <button className="btn btn--primary" disabled={text.length < 10 || name.length < 2} onClick={async () => { try { await api("/api/reviews", { rating, text, authorName: name, orderId }); setOk(true); } catch (e) { setError((e as Error).message); } }}>Отправить отзыв</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
