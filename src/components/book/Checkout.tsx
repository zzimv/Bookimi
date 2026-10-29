"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, goal, rub } from "@/lib/client";
import { addressError, cleanAddress, type Prefill } from "@/lib/delivery";
import { CityInput } from "./CityInput";
import { PvzPicker } from "./PvzPicker";

export interface Fmt { key: string; kind: "PDF" | "PRINT"; title: string; priceRub: number; widthMm: number | null; heightMm: number | null; cover: string; pages: number }
export interface Add { key: string; kind: string; title: string; description: string; priceRub: number | null; percentOff: number | null; requiresPrint: boolean }
interface Quote {
  quote: { lines: { key: string; title: string; priceRub: number; kind: string }[]; subtotalRub: number; pdfCreditRub: number; discountRub: number; shippingRub: number; totalRub: number; errors: string[] };
  newbieApplied: boolean;
  promo: { code: string } | null;
  ship: { priceRub: number; daysMin: number; daysMax: number; source: string } | null;
  eta: { readyText: string; etaText: string } | null;
}

const PDF_FILES = [
  ["Для экрана", "чтение на телефоне и планшете"],
  ["А4, домашняя печать", "2 страницы на листе, обычный принтер"],
  ["Копицентр 21×21 см", "300 dpi, вылеты 3 мм"],
  ["Копицентр 15×15 см", "мини-формат"],
];

interface Addr {
  city: string;
  cityCode?: number;
  region?: string;
  postalCode: string;
  street: string;
  flat: string;
  comment: string;
  pvzCode: string;
  pvzAddress: string;
}
const EMPTY_ADDR: Addr = { city: "", postalCode: "", street: "", flat: "", comment: "", pvzCode: "", pvzAddress: "" };
const METHOD_LABEL: Record<string, string> = { cdek_pvz: "СДЭК до пункта", cdek_courier: "Курьер СДЭК", pochta: "Почта России", yandex: "Яндекс Доставка" };

const SIZES = [
  { id: "mini", label: "Мини 15×15 см" },
  { id: "std", label: "Стандарт 21×21 см" },
  { id: "album", label: "Альбом 28×21 см" },
  { id: "big", label: "Большой 30×30 см" },
];

export function Checkout(props: {
  bookId: string;
  coverUrl: string | null;
  initialWho: "self" | "bookimi";
  formats: Fmt[];
  addons: Add[];
  methods: { key: string; title: string }[];
  pickupAddress: string | null;
  voices: { key: string; title: string }[];
  canPay: boolean;
  printEnabled: boolean;
  contact: { name: string; phone: string; email: string };
  pdfPaid: number;
  /** Получатель и адрес «из прошлого раза» (src/lib/delivery.ts → pickPrefill). */
  prefill?: Prefill;
}) {
  const router = useRouter();
  const [who, setWho] = useState<"self" | "bookimi">(props.printEnabled ? props.initialWho : "self");
  const defaultFmt = props.formats.find((f) => f.key === "std-hard") ?? props.formats.find((f) => f.kind === "PRINT");
  const [size, setSize] = useState(defaultFmt?.key.split("-")[0] ?? "std");
  const [cover, setCover] = useState<"soft" | "hard">(defaultFmt?.key.endsWith("soft") ? "soft" : "hard");
  const [addons, setAddons] = useState<string[]>([]);
  const [showAllAddons, setShowAllAddons] = useState(false);
  const defaultMethod = props.methods.find((m) => m.key !== "pickup")?.key ?? props.methods[0]?.key ?? "cdek_pvz";
  const pre = props.prefill;
  const [method, setMethod] = useState(pre?.method && props.methods.some((m) => m.key === pre.method) ? pre.method : defaultMethod);
  const [addr, setAddr] = useState<Addr>({ ...EMPTY_ADDR, ...pre?.address });
  const [contact, setContact] = useState({ ...props.contact, name: pre?.contact.name || props.contact.name, phone: pre?.contact.phone || props.contact.phone });
  const [saveAddress, setSaveAddress] = useState(true);
  const [prefilled, setPrefilled] = useState(pre?.source === "saved" || pre?.source === "order");
  const [promo, setPromo] = useState("");
  const [voice, setVoice] = useState(props.voices[0]?.key ?? "alena");
  const [q, setQ] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const formatKey = useMemo(() => {
    const prefer = `${size}-${cover}`;
    if (props.formats.some((f) => f.key === prefer)) return prefer;
    return props.formats.find((f) => f.key.startsWith(size + "-"))?.key;
  }, [size, cover, props.formats]);
  const coverOptions = props.formats.filter((f) => f.key.startsWith(size + "-")).map((f) => (f.key.endsWith("soft") ? "soft" : "hard"));
  const availableAddons = props.addons.filter((a) => who === "bookimi" || !a.requiresPrint);
  // Не больше трёх допов за раз: показываем три, остальное — по кнопке
  const shownAddons = showAllAddons ? availableAddons : availableAddons.slice(0, 3);

  const payload = useMemo(
    () => ({
      bookId: props.bookId,
      whoPrints: who,
      formatKey: who === "bookimi" ? formatKey : undefined,
      addons: addons.filter((k) => availableAddons.some((a) => a.key === k)),
      shipping: who === "bookimi" ? { method, address: cleanAddress(method, addr) } : undefined,
      saveAddress,
      promo: promo || undefined,
      contact,
      voice,
    }),
    [props.bookId, who, formatKey, addons, method, addr, promo, contact, voice, availableAddons, saveAddress],
  );

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setQ(await api<Quote>("/api/checkout/quote", payload));
      } catch (e) {
        setError((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [payload]);

  async function order() {
    setError("");
    if (who === "bookimi") {
      const bad = addressError(method, cleanAddress(method, addr)) ?? (!contact.name.trim() || !contact.phone.trim() ? "Укажите имя и телефон получателя" : null);
      if (bad) {
        setError(bad);
        return;
      }
    }
    setBusy(true);
    try {
      const r = await api<{ orderId: string }>("/api/checkout", payload);
      goal("choose_print", { who });
      router.push(`/zakaz/${r.orderId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const sizeFmt = (id: string) => props.formats.find((f) => f.key.startsWith(id + "-"));

  return (
    <div className="buy">
      <div>
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Кто печатает книгу?</h1>
        <div className="choice-cards" style={{ marginBottom: 24 }}>
          <button className="big-choice" aria-pressed={who === "self"} onClick={() => setWho("self")}>
            <strong>Напечатаю сам</strong>
            PDF — {rub(props.formats.find((f) => f.kind === "PDF")?.priceRub ?? 990)}, все форматы файла входят
          </button>
          {props.printEnabled && (
            <button className="big-choice" aria-pressed={who === "bookimi"} onClick={() => setWho("bookimi")}>
              <strong>Напечатает БУКИМИ</strong>
              Печатная книга от {rub(Math.min(...props.formats.filter((f) => f.kind === "PRINT").map((f) => f.priceRub)))}, PDF в подарок
            </button>
          )}
        </div>

        {who === "self" ? (
          <div className="panel">
            <b>В PDF входят четыре файла</b>
            <table className="tbl" style={{ marginTop: 10 }}>
              <tbody>
                {PDF_FILES.map(([a, b]) => (
                  <tr key={a}><td><b>{a}</b></td><td>{b}</td></tr>
                ))}
              </tbody>
            </table>
            {props.pdfPaid > 0 && <p className="ok">PDF этой книги уже оплачен.</p>}
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: "var(--fs-lg)" }}>Формат</h2>
            <div className="formats">
              {SIZES.filter((s) => sizeFmt(s.id)).map((s) => {
                const f = sizeFmt(s.id)!;
                const w = (f.widthMm ?? 210) / 3;
                const h = (f.heightMm ?? 210) / 3;
                const min = Math.min(...props.formats.filter((x) => x.key.startsWith(s.id + "-")).map((x) => x.priceRub));
                return (
                  <button key={s.id} className="format" aria-pressed={size === s.id} onClick={() => { setSize(s.id); if (!props.formats.some((x) => x.key === `${s.id}-${cover}`)) setCover("hard"); }}>
                    <div className="mock"><div style={{ width: w, height: h, backgroundImage: props.coverUrl ? `url(${props.coverUrl})` : undefined, backgroundColor: "var(--sage)" }} /></div>
                    <b>{s.label}</b>
                    <span className="small muted">{f.pages} страницы · от {rub(min)}</span>
                  </button>
                );
              })}
            </div>
            <span className="label" style={{ display: "block", marginTop: 16 }}>Обложка</span>
            <div className="chips">
              {(["soft", "hard"] as const).map((c) => (
                <button key={c} className="chip" disabled={!coverOptions.includes(c)} aria-pressed={cover === c} onClick={() => setCover(c)}>
                  {c === "soft" ? "Мягкая" : "Твёрдая (7БЦ)"}
                  {props.formats.find((f) => f.key === `${size}-${c}`) && <small>{rub(props.formats.find((f) => f.key === `${size}-${c}`)!.priceRub)}</small>}
                </button>
              ))}
            </div>
          </>
        )}

        {availableAddons.length > 0 && (
          <>
            <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Добавить к книге</h2>
            <div className="choice-cards">
              {shownAddons.map((a) => (
                <button key={a.key} className="choice" aria-pressed={addons.includes(a.key)} onClick={() => setAddons(addons.includes(a.key) ? addons.filter((x) => x !== a.key) : [...addons, a.key])}>
                  <div>
                    <strong>{a.title}</strong>
                    <span>{a.percentOff ? `−${a.percentOff}% от цены книги` : a.priceRub ? `+${rub(a.priceRub)}` : ""}</span>
                  </div>
                </button>
              ))}
            </div>
            {availableAddons.length > 3 && (
              <button className="link-btn" onClick={() => setShowAllAddons(!showAllAddons)}>{showAllAddons ? "Свернуть" : `Ещё ${availableAddons.length - 3}`}</button>
            )}
            {addons.includes("audiobook") && (
              <label className="field" style={{ maxWidth: 320, marginTop: 10 }}>
                <span>Голос диктора</span>
                <select className="select" value={voice} onChange={(e) => setVoice(e.target.value)}>
                  {props.voices.map((v) => <option key={v.key} value={v.key}>{v.title}</option>)}
                </select>
              </label>
            )}
          </>
        )}

        {who === "bookimi" && (
          <>
            <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Доставка</h2>
            <div className="chips">
              {props.methods.map((m) => (
                <button key={m.key} className="chip" aria-pressed={method === m.key} onClick={() => setMethod(m.key)}>{m.title}</button>
              ))}
            </div>
            {prefilled && (
              <p className="small muted prefill-note">
                Подставили получателя и адрес из прошлого заказа — проверьте.{" "}
                <button type="button" className="link-btn" onClick={() => { setAddr(EMPTY_ADDR); setContact({ ...props.contact, name: "", phone: "" }); setPrefilled(false); }}>Очистить</button>
              </p>
            )}
            {method === "pickup" ? (
              <p className="muted-panel small">Заберёте сами: {props.pickupAddress}. Дата готовности — в кабинете.</p>
            ) : (
              <>
                <CityInput
                  required
                  value={{ city: addr.city, region: addr.region, cityCode: addr.cityCode }}
                  onChange={(v) => setAddr((a) => (a.city === v.city && a.region === v.region && a.cityCode === v.cityCode ? a : { ...a, city: v.city, region: v.region, cityCode: v.cityCode, pvzCode: "", pvzAddress: "" }))}
                />
                {method === "cdek_pvz" ? (
                  <PvzPicker
                    key={`${addr.city}|${addr.region ?? ""}`}
                    city={addr.region || addr.cityCode || addr.pvzCode ? addr.city : ""}
                    region={addr.region}
                    cityCode={addr.cityCode}
                    value={{ pvzCode: addr.pvzCode, pvzAddress: addr.pvzAddress }}
                    onChange={(v) => setAddr((a) => ({ ...a, ...v }))}
                  />
                ) : method === "pochta" ? (
                  <div className="grid2">
                    <label className="field"><span>Улица, дом, квартира <span className="req">*</span></span><input className="input ym-disable-keys" autoComplete="street-address" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></label>
                    <label className="field"><span>Индекс <span className="req">*</span></span><input className="input ym-disable-keys" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6 цифр" value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
                  </div>
                ) : (
                  <>
                    <div className="grid2">
                      <label className="field"><span>Улица и дом <span className="req">*</span></span><input className="input ym-disable-keys" autoComplete="address-line1" placeholder="ул. Ленина, 5к2" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} /></label>
                      <label className="field"><span>Квартира или офис</span><input className="input ym-disable-keys" autoComplete="address-line2" value={addr.flat} onChange={(e) => setAddr({ ...addr, flat: e.target.value })} /></label>
                    </div>
                    <label className="field"><span>Комментарий курьеру</span><input className="input ym-disable-keys" placeholder="Подъезд, этаж, домофон, когда удобно" maxLength={200} value={addr.comment} onChange={(e) => setAddr({ ...addr, comment: e.target.value })} /></label>
                  </>
                )}
                {q?.ship && addr.city && (
                  <p className="small ship-line" aria-live="polite">
                    {METHOD_LABEL[method] ?? "Доставка"} · {addr.city}: <b>{q.ship.priceRub ? rub(q.ship.priceRub) : "бесплатно"}</b>
                    {q.ship.daysMax > 0 && <>, {q.ship.daysMin === q.ship.daysMax ? q.ship.daysMax : `${q.ship.daysMin}–${q.ship.daysMax}`} дн. в пути</>}
                    {q.ship.source === "table" && <span className="muted"> · ориентир</span>}
                  </p>
                )}
              </>
            )}
            <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 8 }}>Получатель</h2>
            <div className="grid2">
              <label className="field"><span>Имя и фамилия <span className="req">*</span></span><input className="input ym-disable-keys" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
              <label className="field"><span>Телефон <span className="req">*</span></span><input className="input ym-disable-keys" inputMode="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
            </div>
            <label className="check">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              <span>Сохранить адрес для следующих заказов <span className="muted">— храним в профиле, изменить или удалить можно в «Мои данные»</span></span>
            </label>
          </>
        )}
      </div>

      <aside className="summary panel">
        <h2 style={{ fontSize: "var(--fs-lg)" }}>Ваш заказ</h2>
        {q ? (
          <table>
            <tbody>
              {q.quote.lines.map((l) => (
                <tr key={l.key}><td>{l.title}</td><td>{rub(l.priceRub)}</td></tr>
              ))}
              {q.quote.pdfCreditRub > 0 && <tr><td>Зачёт оплаченного PDF</td><td>−{rub(q.quote.pdfCreditRub)}</td></tr>}
              {q.quote.discountRub > 0 && <tr><td>Скидка{q.newbieApplied ? " по приглашению друга" : q.promo ? ` (${q.promo.code})` : ""}</td><td>−{rub(q.quote.discountRub)}</td></tr>}
              {who === "bookimi" && <tr><td>Доставка{q.ship?.source === "table" && method !== "pickup" ? " (ориентир)" : ""}</td><td>{q.quote.shippingRub ? rub(q.quote.shippingRub) : "0 ₽"}</td></tr>}
              <tr className="total"><td>Итого</td><td>{rub(q.quote.totalRub)}</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="spinner" />
        )}
        {q?.eta && <p className="small" style={{ marginTop: 10 }}>Изготовление — к {q.eta.readyText}. {method !== "pickup" && <>Доставка — ориентировочно к <b>{q.eta.etaText}</b>.</>}</p>}
        <label className="field" style={{ marginTop: 12 }}>
          <span>Промокод</span>
          <input className="input" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Если есть" />
          {promo && q && !q.promo && !q.newbieApplied && <small>Промокод не подошёл</small>}
        </label>
        {q?.quote.errors.map((e) => <p className="error" key={e}>{e}</p>)}
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--block" disabled={!props.canPay || busy || !q || q.quote.errors.length > 0} onClick={order}>
          {busy ? "Оформляем…" : "Перейти к оплате"}
        </button>
        {!props.canPay && <p className="small muted" style={{ marginTop: 8 }}>Оплата пока не принимается — превью и книга сохранены в кабинете. Мы сообщим, когда можно будет оформить заказ.</p>}
        <p className="small muted" style={{ marginTop: 10 }}>
          Книга делается специально для вашего ребёнка, поэтому возврат возможен только при браке — тогда перепечатаем или вернём деньги. <Link href="/vozvrat" target="_blank">Подробнее</Link>
        </p>
      </aside>
    </div>
  );
}
