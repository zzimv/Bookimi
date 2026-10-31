"use client";
// «Мои данные» → адреса доставки: последние 3 адреса из оформления (имя, телефон, город, пункт или улица).
// Изменение и удаление — POST /api/me (action: address / addressDelete). Хранится только на сервере.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { addressLine, type SavedAddress } from "@/lib/delivery";
import { normalizeName } from "@/lib/names";

const METHOD: Record<string, string> = { pickup: "Самовывоз", cdek_pvz: "СДЭК — пункт выдачи", cdek_courier: "СДЭК — курьером", pochta: "Почта России", yandex: "Яндекс Доставка" };

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  async function call(data: object, ok: string) {
    setMsg("");
    try {
      await api("/api/me", data);
      setEdit(null);
      setMsg(ok);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  const courier = (m: string) => m === "cdek_courier" || m === "yandex" || m === "pochta";
  return (
    <div className="panel">
      <b>Адреса доставки</b>
      <p className="small muted">До трёх последних адресов из оформления — первый подставляется в следующий заказ. Сохранение можно выключить галочкой при оформлении.</p>
      {addresses.length === 0 && <p className="small">Сохранённых адресов нет.</p>}
      {addresses.map((a) => (
        <div className="spread addr-item" key={a.id}>
          {edit === a.id ? (
            <div style={{ width: "100%" }}>
              <div className="grid2">
                <label className="field"><span>Получатель</span><input className="input" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => setForm({ ...form, name: normalizeName(form.name ?? "") })} /></label>
                <label className="field"><span>Телефон</span><input className="input" inputMode="tel" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                {courier(a.method) && <label className="field"><span>Улица и дом</span><input className="input" value={form.street ?? ""} onChange={(e) => setForm({ ...form, street: e.target.value })} /></label>}
                {courier(a.method) && <label className="field"><span>Квартира или офис</span><input className="input" value={form.flat ?? ""} onChange={(e) => setForm({ ...form, flat: e.target.value })} /></label>}
                {a.method === "pochta" && <label className="field"><span>Индекс</span><input className="input" inputMode="numeric" maxLength={6} value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, "") })} /></label>}
                {a.method !== "pochta" && courier(a.method) && <label className="field"><span>Комментарий курьеру</span><input className="input" value={form.comment ?? ""} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></label>}
              </div>
              <p className="small muted">Город и пункт выдачи меняются при оформлении заказа.</p>
              <div className="row">
                <button className="btn btn--primary btn--sm" onClick={() => call({ action: "address", id: a.id, patch: form }, "Адрес сохранён.")}>Сохранить</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <header>
                <b style={{ color: "var(--ink)", fontSize: 15 }}>{normalizeName(a.name) || "Без имени"}{a.phone ? `, ${a.phone}` : ""}</b>
                <span className="badge">{METHOD[a.method] ?? a.method}</span>
              </header>
              <p className="small" style={{ margin: "4px 0 8px" }}>{addressLine(a) || a.city}</p>
              <div className="row">
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setEdit(a.id);
                    setForm({ name: a.name, phone: a.phone, street: a.street ?? "", flat: a.flat ?? "", comment: a.comment ?? "", postalCode: a.postalCode ?? "" });
                  }}
                >
                  Изменить
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => call({ action: "addressDelete", id: a.id }, "Адрес удалён.")}>Удалить</button>
              </div>
            </>
          )}
        </div>
      ))}
      {msg && <p className="small ok">{msg}</p>}
    </div>
  );
}
