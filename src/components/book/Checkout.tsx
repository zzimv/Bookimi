"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, goal, rub } from "@/lib/client";
import { toggleAddon } from "@/lib/pricing";
import { addressError, cleanAddress, type Prefill } from "@/lib/delivery";
import { fullNameError, normalizeName } from "@/lib/names";
import { CityInput } from "./CityInput";
import { PvzPicker } from "./PvzPicker";
import { AddonCards } from "./AddonCards";
import { FlowLegal } from "@/components/FlowLegal";

export interface Fmt { key: string; kind: "PDF" | "PRINT"; title: string; priceRub: number; widthMm: number | null; heightMm: number | null; cover: string; pages: number }
export interface Add { key: string; kind: string; title: string; description: string; priceRub: number | null; percentOff: number | null; requiresPrint: boolean }
interface Quote {
  quote: { lines: { key: string; title: string; priceRub: number; kind: string }[]; subtotalRub: number; pdfCreditRub: number; discountRub: number; shippingRub: number; totalRub: number; errors: string[]; bulkApplied?: boolean; bulkPct?: number };
  newbieApplied: boolean;
  promo: { code: string } | null;
  ship: { priceRub: number; daysMin: number; daysMax: number; source: string } | null;
  eta: { readyText: string; etaText: string } | null;
  /** Бонусы: списано в этот расчёт и максимум для заказа. */
  bonusRub?: number;
  bonusMax?: number;
}
/** «Книга для каждого в группе» (src/lib/bulk.ts): копии, скидки по количеству, общее посвящение. */
export interface CheckoutBulk {
  count: number;
  initialOn: boolean;
  dedication: string;
  tiers: { min: number; pct: number }[];
  previewCopies: number;
  copies: { id: string; name: string; statusText: string; cover: string | null; dedication?: string | null }[];
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

/** «Книга делается специально …» — по аудитории книги. */
const MADE_FOR: Record<string, string> = {
  CHILD: "специально для вашего ребёнка",
  TEEN: "специально для вашего подростка",
  ADULT: "специально под вашего героя",
  PET: "специально про вашего питомца",
};

const SIZES = [
  { id: "mini", label: "Мини 15×15 см" },
  { id: "std", label: "Стандарт 21×21 см" },
  { id: "album", label: "Альбом 28×21 см" },
  { id: "big", label: "Большой 30×30 см" },
];

/** Выбор на странице оформления, сохранённый на время «Редактировать книгу» (sessionStorage, только эта вкладка). */
interface CheckoutKeep {
  v: 1;
  who: "self" | "bookimi";
  size: string;
  cover: "soft" | "hard";
  addons: string[];
  method: string;
  addr: Addr;
  contact: { name: string; phone: string };
  promo: string;
  useBonus: boolean;
}

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
  bulk?: CheckoutBulk | null;
  /** Аудитория книги — для текста про возврат («для вашего ребёнка» / «для вас» / …). */
  audience?: string;
  /** Картинки для превью допов: развороты превью (обложка — coverUrl), имя героя и название книги. */
  previewUrls?: string[];
  heroName?: string;
  bookTitle?: string;
  /** «Оживление книги» пока не продаётся (cartoon.enabled = false): карточка «скоро» без цены. */
  cartoonSoon?: boolean;
  /** Бонусы покупателя (src/lib/bonuses.ts): остаток и доля заказа, которую можно ими оплатить. */
  bonus?: { balance: number; maxSharePct: number } | null;
  /**
   * «Изменить заказ» (src/lib/order-change.ts, только до оплаты): тот же экран с выбором из заказа; сумма
   * пересчитывается, кнопка — «Сохранить изменения».
   */
  edit?: { orderId: string; publicCode: string; formatKey?: string; addons: string[]; method?: string; address?: Partial<Addr>; contact?: { name: string; phone: string }; promo?: string; useBonus?: boolean; focus?: "delivery" } | null;
}) {
  const router = useRouter();
  const ed = props.edit ?? null;
  const [who, setWho] = useState<"self" | "bookimi">(ed ? "bookimi" : props.printEnabled ? props.initialWho : "self");
  const defaultFmt = props.formats.find((f) => f.key === (ed?.formatKey ?? "std-hard")) ?? props.formats.find((f) => f.kind === "PRINT");
  const [size, setSize] = useState(defaultFmt?.key.split("-")[0] ?? "std");
  const [cover, setCover] = useState<"soft" | "hard">(defaultFmt?.key.endsWith("soft") ? "soft" : "hard");
  const [addons, setAddons] = useState<string[]>(ed?.addons ?? []);
  const [showAllAddons, setShowAllAddons] = useState(false);
  const defaultMethod = props.methods.find((m) => m.key !== "pickup")?.key ?? props.methods[0]?.key ?? "cdek_pvz";
  const pre = props.prefill;
  const [method, setMethod] = useState(ed?.method ?? (pre?.method && props.methods.some((m) => m.key === pre.method) ? pre.method : defaultMethod));
  const [addr, setAddr] = useState<Addr>({ ...EMPTY_ADDR, ...(ed ? ed.address : pre?.address) });
  const [contact, setContact] = useState(ed?.contact ? { ...props.contact, ...ed.contact } : { ...props.contact, name: normalizeName(pre?.contact.name || props.contact.name || ""), phone: pre?.contact.phone || props.contact.phone });
  const [useBonus, setUseBonus] = useState(Boolean(ed?.useBonus));
  const [saveAddress, setSaveAddress] = useState(true);
  const [prefilled, setPrefilled] = useState(!ed && (pre?.source === "saved" || pre?.source === "order"));
  const [promo, setPromo] = useState(ed?.promo ?? "");
  const [voice, setVoice] = useState(props.voices[0]?.key ?? "alena");
  const [q, setQ] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkOn, setBulkOn] = useState(Boolean(props.bulk?.initialOn));
  const [bulkInfo, setBulkInfo] = useState(props.bulk ?? null);
  const [dedication, setDedication] = useState(props.bulk?.dedication ?? "");
  const [dedSaved, setDedSaved] = useState(true);

  // rev 19: «Редактировать книгу» — выбор оформления сохраняется в этой вкладке и возвращается после правок книги
  const keepKey = `bk_checkout_${props.bookId}`;
  useEffect(() => {
    if (ed) return;
    try {
      const k = JSON.parse(sessionStorage.getItem(keepKey) ?? "null") as Partial<CheckoutKeep> | null;
      if (!k || k.v !== 1) return;
      if (k.who && (k.who === "self" || props.printEnabled)) setWho(k.who);
      if (k.size) setSize(k.size);
      if (k.cover) setCover(k.cover);
      if (k.addons) setAddons(k.addons);
      if (k.method && props.methods.some((m) => m.key === k.method)) setMethod(k.method);
      if (k.addr) setAddr({ ...EMPTY_ADDR, ...k.addr });
      if (k.contact) setContact((c) => ({ ...c, ...k.contact }));
      if (k.promo) setPromo(k.promo);
      if (k.useBonus) setUseBonus(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function editBook() {
    const keep: CheckoutKeep = { v: 1, who, size, cover, addons, method, addr, contact: { name: contact.name, phone: contact.phone }, promo, useBonus };
    try {
      sessionStorage.setItem(keepKey, JSON.stringify(keep));
    } catch {}
    router.push(`/kniga/${props.bookId}`);
  }

  const formatKey = useMemo(() => {
    const prefer = `${size}-${cover}`;
    if (props.formats.some((f) => f.key === prefer)) return prefer;
    return props.formats.find((f) => f.key.startsWith(size + "-"))?.key;
  }, [size, cover, props.formats]);
  const coverOptions = props.formats.filter((f) => f.key.startsWith(size + "-")).map((f) => (f.key.endsWith("soft") ? "soft" : "hard"));
  // Мемоизация обязательна: новый массив на каждой отрисовке менял payload и запускал пересчёт цены по кругу
  const availableAddons = useMemo(() => props.addons.filter((a) => who === "bookimi" || !a.requiresPrint), [props.addons, who]);
  // Не больше трёх допов за раз: показываем три, остальное — по кнопке. «Оживление книги — скоро» — в конце, без цены
  const cards = useMemo(
    () => [
      ...availableAddons.map((a) => ({ key: a.key, title: a.title, description: a.description, priceRub: a.priceRub, percentOff: a.percentOff })),
      ...(props.cartoonSoon && !availableAddons.some((a) => a.key === "cartoon") ? [{ key: "cartoon", title: "Оживление книги", description: "Иллюстрации оживают, диктор читает сказку — 2 минуты для телевизора и сторис.", priceRub: null, soon: true }] : []),
    ],
    [availableAddons, props.cartoonSoon],
  );
  const shownAddons = showAllAddons ? cards : cards.slice(0, 3);
  const art = useMemo(() => ({ images: [props.coverUrl, ...(props.previewUrls ?? [])].filter(Boolean) as string[], name: props.heroName ?? "", title: props.bookTitle ?? "" }), [props.coverUrl, props.previewUrls, props.heroName, props.bookTitle]);

  const payload = useMemo(
    () => ({
      bookId: props.bookId,
      whoPrints: who,
      formatKey: who === "bookimi" ? formatKey : undefined,
      addons: bulkOn ? [] : addons.filter((k) => availableAddons.some((a) => a.key === k)),
      bulk: bulkOn || undefined,
      shipping: who === "bookimi" ? { method, address: cleanAddress(method, addr) } : undefined,
      saveAddress,
      promo: promo || undefined,
      contact,
      voice,
      useBonus: useBonus || undefined,
      changeOrderId: ed?.orderId,
    }),
    [props.bookId, who, formatKey, addons, method, addr, promo, contact, voice, availableAddons, saveAddress, bulkOn, useBonus, ed?.orderId],
  );

  // Пересчёт цены — только когда запрос по сути изменился (сравнение по содержимому), с паузой 300 мс после ввода
  const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);
  const quoted = useRef("");
  useEffect(() => {
    if (payloadKey === quoted.current) return;
    const t = setTimeout(async () => {
      quoted.current = payloadKey;
      try {
        const r = await api<Quote>("/api/checkout/quote", JSON.parse(payloadKey));
        if (quoted.current !== payloadKey) return; // пока считали, условия поменялись — ждём свежий ответ
        setQ(r);
        setError("");
      } catch (e) {
        if (quoted.current === payloadKey) quoted.current = ""; // ошибка — следующее изменение пересчитает
        setError((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [payloadKey]);

  // «Изменить адрес доставки» — сразу к блоку доставки
  useEffect(() => {
    if (ed?.focus === "delivery") setTimeout(() => document.getElementById("dostavka")?.scrollIntoView({ block: "start" }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function order() {
    setError("");
    if (who === "bookimi") {
      const bad = addressError(method, cleanAddress(method, addr)) ?? fullNameError(contact.name) ?? (!contact.phone.trim() ? "Укажите телефон получателя" : null);
      if (bad) {
        setError(bad);
        return;
      }
    }
    setBusy(true);
    try {
      if (bulkOn && !dedSaved) await saveDedication();
      if (ed) {
        // Изменение неоплаченного заказа — назад к оплате с новой суммой
        await api(`/api/orders/${ed.orderId}/change`, payload);
        router.push(`/zakaz/${ed.orderId}`);
        return;
      }
      const r = await api<{ orderId: string }>("/api/checkout", payload);
      goal("choose_print", { who });
      try {
        sessionStorage.removeItem(keepKey);
      } catch {}
      router.push(`/zakaz/${r.orderId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function saveDedication() {
    const r = await api<CheckoutBulk>(`/api/books/${props.bookId}/bulk`, { dedication });
    setBulkInfo((b) => (b ? { ...b, copies: r.copies } : b));
    setDedSaved(true);
  }
  async function toggleBulk(on: boolean) {
    setBulkOn(on);
    if (on && props.bulk && props.bulk.copies.length <= 1) {
      try {
        const r = await api<CheckoutBulk>(`/api/books/${props.bookId}/bulk`, {});
        setBulkInfo((b) => (b ? { ...b, copies: r.copies } : b));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  const tierNow = bulkInfo ? [...bulkInfo.tiers].sort((x, y) => x.min - y.min).reduce((p, t) => (bulkInfo.count >= t.min ? t.pct : p), 0) : 0;

  const sizeFmt = (id: string) => props.formats.find((f) => f.key.startsWith(id + "-"));

  return (
    <div className="buy">
      <div>
        {bulkInfo && (
          <section className={`panel bulk-cta ${bulkOn ? "bulk-cta--on" : ""}`} data-bulk-checkout style={{ marginBottom: 20 }}>
            <b>Книга для каждого ребёнка группы</b>
            <p className="small" style={{ margin: "4px 0 10px" }}>
              {bulkInfo.count} книг одним заказом: в каждой главный герой — свой ребёнок, остальные рядом.
              {tierNow > 0 ? <> Скидка за количество — <b>−{tierNow}%</b>.</> : null}{who === "bookimi" ? " Одна доставка на всех — в сад, школу или одному из родителей; до пункта СДЭК бесплатно." : ""}
            </p>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={!bulkOn} onClick={() => toggleBulk(false)}>Одна книга</button>
              <button type="button" className="chip" aria-pressed={bulkOn} data-bulk-on onClick={() => toggleBulk(true)}>Для каждого — {bulkInfo.count}</button>
            </div>
            {bulkOn && (
              <>
                <ol className="bulk-copies">
                  {bulkInfo.copies.slice(0, bulkInfo.previewCopies).map((c, i) => (
                    <li key={c.id} data-copy={i}>
                      {c.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.cover} alt={`Обложка: ${c.name}`} width={56} height={56} />
                      ) : (
                        <span className="bulk-copies__ph" aria-hidden="true">{c.name.slice(0, 1)}</span>
                      )}
                      <span><b>{c.name}</b><small className="muted">{c.statusText}</small></span>
                    </li>
                  ))}
                </ol>
                {bulkInfo.count > bulkInfo.previewCopies && (
                  <p className="small muted">И ещё {bulkInfo.count - bulkInfo.previewCopies}: {bulkInfo.copies.slice(bulkInfo.previewCopies, bulkInfo.previewCopies + 6).map((c) => c.name).join(", ")}{bulkInfo.count > bulkInfo.previewCopies + 6 ? "…" : ""} — нарисуем после оплаты.</p>
                )}
                <label className="field">
                  <span>Посвящение — одно на все книги</span>
                  <textarea className="textarea" name="bulk-dedication" maxLength={300} value={dedication} onChange={(e) => { setDedication(e.target.value); setDedSaved(false); }} />
                  <small>{"{ГЕРОЙ.дат}"} — имя ребёнка этой книги («Ане»), {"{Р:Дорогому|Дорогой}"} — по полу. {!dedSaved && <button type="button" className="link-btn" onClick={() => saveDedication().catch((e) => setError((e as Error).message))}>Сохранить</button>}</small>
                </label>
                {dedSaved && bulkInfo.copies[1]?.dedication && (
                  <p className="small dedication-sample">Так будет в книге, где герой — {bulkInfo.copies[1].name}: «{bulkInfo.copies[1].dedication}»</p>
                )}
              </>
            )}
          </section>
        )}
        {ed ? (
          <>
            <h1 style={{ fontSize: "var(--fs-xl)" }}>Изменить заказ {ed.publicCode}</h1>
            <p className="muted" data-edit-note>До оплаты можно поменять всё: формат, обложку, допы, способ доставки, адрес или пункт выдачи и получателя. Сумма пересчитается.</p>
          </>
        ) : (
          <h1 style={{ fontSize: "var(--fs-xl)" }}>Кто печатает книгу?</h1>
        )}
        {!ed && <div className="choice-cards" style={{ marginBottom: 24 }}>
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
        </div>}

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

        {availableAddons.length > 0 && !bulkOn && (
          <>
            <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Добавить к книге</h2>
            <AddonCards items={shownAddons} selected={addons} onToggle={(k) => setAddons(toggleAddon(addons, k))} art={art} />
            {cards.length > 3 && (
              <button className="btn btn--ghost btn--sm addon-more" data-addons-more onClick={() => setShowAllAddons(!showAllAddons)}>{showAllAddons ? "Свернуть" : `Показать все допы (${cards.length})`}</button>
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
            <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }} id="dostavka">Доставка</h2>
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
                {q?.ship && addr.city && (addr.region || addr.cityCode) && (
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
              <label className="field"><span>Имя и фамилия <span className="req">*</span></span><input className="input ym-disable-keys" name="recipient-name" autoComplete="name" value={contact.name} aria-invalid={who === "bookimi" && contact.name.trim() && fullNameError(contact.name) ? true : undefined} onChange={(e) => setContact({ ...contact, name: e.target.value })} onBlur={() => setContact({ ...contact, name: normalizeName(contact.name) })} placeholder="Анна Петрова" /><small>Имя и фамилия — так курьер и пункт выдачи найдут посылку</small></label>
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
        {!ed && (
          <p className="checkout-edit small" data-edit-book>
            До оплаты книгу можно поправить: имя, обложку, фото, посвящение, автора.{" "}
            <button type="button" className="link-btn" onClick={editBook} data-edit-book-btn>Редактировать книгу</button>
            <span className="muted"> — выбор здесь сохранится.</span>
          </p>
        )}
        {q ? (
          <table>
            <tbody>
              {bulkOn && q.quote.lines.length > 1 ? (
                <tr><td>{q.quote.lines.length} книг × {rub(q.quote.lines[0].priceRub)}</td><td>{rub(q.quote.subtotalRub)}</td></tr>
              ) : (
                q.quote.lines.map((l, i) => (
                  <tr key={`${l.key}-${i}`}><td>{l.title}</td><td>{rub(l.priceRub)}</td></tr>
                ))
              )}
              {q.quote.pdfCreditRub > 0 && <tr><td>Зачёт оплаченного PDF</td><td>−{rub(q.quote.pdfCreditRub)}</td></tr>}
              {q.quote.discountRub > 0 && <tr><td>Скидка{q.quote.bulkApplied ? ` за количество (−${q.quote.bulkPct}%)` : q.newbieApplied ? " по приглашению друга" : q.promo ? ` (${q.promo.code})` : ""}</td><td>−{rub(q.quote.discountRub)}</td></tr>}
              {who === "bookimi" && <tr><td>Доставка{q.ship?.source === "table" && method !== "pickup" ? " (ориентир)" : ""}</td><td>{q.quote.shippingRub ? rub(q.quote.shippingRub) : "0 ₽"}</td></tr>}
              {(q.bonusRub ?? 0) > 0 && <tr data-bonus-line><td>Бонусами</td><td>−{rub(q.bonusRub!)}</td></tr>}
              <tr className="total"><td>Итого</td><td>{rub(q.quote.totalRub - (q.bonusRub ?? 0))}</td></tr>
            </tbody>
          </table>
        ) : (
          <div className="spinner" />
        )}
        {props.bonus && props.bonus.balance > 0 && !bulkOn && (
          <label className="check bonus-check" data-bonus>
            <input type="checkbox" name="use-bonus" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
            <span>
              Списать бонусы — у вас {props.bonus.balance.toLocaleString("ru-RU")} ₽{q?.bonusMax ? <> (в этот заказ — до {rub(q.bonusMax)}, не больше {props.bonus.maxSharePct}% суммы)</> : null}
            </span>
          </label>
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
          {busy ? (ed ? "Сохраняем…" : "Оформляем…") : ed ? "Сохранить изменения" : "Перейти к оплате"}
        </button>
        {!props.canPay && <p className="small muted" style={{ marginTop: 8 }}>Оплата пока не принимается — превью и книга сохранены в кабинете. Мы сообщим, когда можно будет оформить заказ.</p>}
        <p className="small muted" style={{ marginTop: 10 }}>
          Книга делается {MADE_FOR[props.audience ?? "CHILD"] ?? MADE_FOR.CHILD}, поэтому возврат возможен только при браке — тогда перепечатаем или вернём деньги. <Link href="/vozvrat" target="_blank">Подробнее</Link>
        </p>
      </aside>
      <FlowLegal />
    </div>
  );
}
