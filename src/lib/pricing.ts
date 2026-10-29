// Расчёт суммы заказа. Только на сервере: клиент присылает выбор, сумму считает этот модуль.
// Правила: PDF входит в печатную книгу бесплатно; если PDF уже оплачен — печать со скидкой на его цену;
// второй экземпляр −30% от цены формата; физические допы — только при печати; промокоды не суммируются
// (берётся одна, самая выгодная скидка); бесплатная доставка СДЭК до ПВЗ от N книг.

export interface CatalogFormat {
  key: string;
  kind: "PDF" | "PRINT";
  title: string;
  priceRub: number;
}
export interface CatalogAddon {
  key: string;
  kind: "PHYSICAL" | "DIGITAL" | "MODIFIER";
  title: string;
  priceRub: number | null;
  percentOff: number | null;
  requiresPrint: boolean;
}

export interface QuoteInput {
  whoPrints: "self" | "bookimi";
  formatKey?: string;
  addons: string[];
  shippingMethod?: string;
  shippingRub?: number;
  pdfPaidRub?: number; // если PDF этой книги уже куплен
  discountPct?: number; // промокод или скидка новичка (не суммируются)
  discountRub?: number;
  freeShippingBooks?: number;
  /** Докупка цифровых допов к уже оплаченной книге (из кабинета): без формата, только цифровые допы. */
  addonsOnly?: boolean;
  /** Мультфильм этой книги уже оплачен (тогда «Своим голосом» можно докупить отдельно). */
  cartoonPaid?: boolean;
}

export interface QuoteLine {
  kind: "format" | "addon";
  key: string;
  title: string;
  priceRub: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalRub: number;
  pdfCreditRub: number;
  discountRub: number;
  shippingRub: number;
  totalRub: number;
  books: number;
  errors: string[];
}

export const MAX_ADDONS = 3;
export const CARTOON_ADDON = "cartoon";
export const CARTOON_OWN_VOICE = "cartoon-own-voice";

/** Выбор допа в корзине: «Своим голосом» добавляет мультфильм, снятый мультфильм снимает «Своим голосом». */
export function toggleAddon(list: string[], key: string, cartoonPaid = false): string[] {
  if (list.includes(key)) return list.filter((k) => k !== key && !(key === CARTOON_ADDON && k === CARTOON_OWN_VOICE && !cartoonPaid));
  const next = [...list, key];
  if (key === CARTOON_OWN_VOICE && !cartoonPaid && !next.includes(CARTOON_ADDON)) next.unshift(CARTOON_ADDON);
  return next;
}

export function quote(input: QuoteInput, formats: CatalogFormat[], addons: CatalogAddon[]): Quote {
  const errors: string[] = [];
  const lines: QuoteLine[] = [];
  const pdf = formats.find((f) => f.kind === "PDF");
  let books = 0;

  if (input.addonsOnly) {
    if (!input.addons.length) errors.push("Выберите, что добавить");
  } else if (input.whoPrints === "self") {
    if (!pdf) errors.push("PDF недоступен");
    else lines.push({ kind: "format", key: pdf.key, title: pdf.title, priceRub: pdf.priceRub });
  } else {
    const f = formats.find((x) => x.key === input.formatKey && x.kind === "PRINT");
    if (!f) errors.push("Выберите формат книги");
    else {
      lines.push({ kind: "format", key: f.key, title: f.title, priceRub: f.priceRub });
      books = 1;
    }
  }

  const chosen = [...new Set(input.addons)];
  if (chosen.length > MAX_ADDONS + 2) errors.push("Слишком много допов");
  for (const key of chosen) {
    const a = addons.find((x) => x.key === key);
    if (!a) {
      errors.push(`Доп «${key}» недоступен`);
      continue;
    }
    if (a.requiresPrint && (input.whoPrints !== "bookimi" || input.addonsOnly)) {
      errors.push(`«${a.title}» — только для печатной книги`);
      continue;
    }
    // Мультфильм: «Своим голосом» — только вместе с мультфильмом или к уже купленному; дважды не продаём
    if (key === CARTOON_ADDON && input.cartoonPaid) {
      errors.push("Мультфильм к этой книге уже куплен");
      continue;
    }
    if (key === CARTOON_OWN_VOICE && !chosen.includes(CARTOON_ADDON) && !input.cartoonPaid) {
      errors.push("«Своим голосом» — дополнение к мультфильму: добавьте мультфильм");
      continue;
    }
    if (key === "second-copy") {
      const base = lines.find((l) => l.kind === "format");
      if (base && input.whoPrints === "bookimi") {
        lines.push({ kind: "addon", key, title: a.title, priceRub: Math.round(base.priceRub * (1 - (a.percentOff ?? 30) / 100)) });
        books += 1;
      }
      continue;
    }
    lines.push({ kind: "addon", key, title: a.title, priceRub: a.priceRub ?? 0 });
  }

  const subtotalRub = lines.reduce((s, l) => s + l.priceRub, 0);
  const formatLine = lines.find((l) => l.kind === "format");
  const pdfCreditRub =
    input.whoPrints === "bookimi" && input.pdfPaidRub && formatLine ? Math.min(input.pdfPaidRub, formatLine.priceRub) : 0;

  const goods = subtotalRub - pdfCreditRub;
  const byPct = input.discountPct ? Math.round((goods * input.discountPct) / 100) : 0;
  const discountRub = Math.min(goods, Math.max(byPct, input.discountRub ?? 0));

  let shippingRub = input.whoPrints === "bookimi" ? Math.max(0, Math.round(input.shippingRub ?? 0)) : 0;
  if (input.shippingMethod === "cdek_pvz" && input.freeShippingBooks && books >= input.freeShippingBooks) shippingRub = 0;
  if (input.shippingMethod === "pickup") shippingRub = 0;

  return {
    lines,
    subtotalRub,
    pdfCreditRub,
    discountRub,
    shippingRub,
    totalRub: Math.max(0, goods - discountRub + shippingRub),
    books,
    errors,
  };
}

/** Рабочие дни (без выходных; праздники задаются в настройках типографии отдельно). */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function etaDate(now: Date, makeDaysMax: number, deliveryDaysMax: number, urgent = false) {
  const ready = addBusinessDays(now, Math.max(1, makeDaysMax - (urgent ? 2 : 0)));
  const eta = new Date(ready);
  eta.setDate(eta.getDate() + deliveryDaysMax);
  return { ready, eta };
}

export const ruDate = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

/**
 * Промокод или скидка новичка — не суммируются: побеждает та, что даёт больше рублей на этом заказе
 * (фиксированный промокод «−300 ₽» против «−10%» новичка). При равенстве — скидка новичка (промокод не тратится).
 */
export function pickDiscount(
  base: Omit<QuoteInput, "discountPct" | "discountRub">,
  promo: { percentOff?: number | null; amountOffRub?: number | null } | null,
  newbiePct: number,
  formats: CatalogFormat[],
  addons: CatalogAddon[],
) {
  const byNewbie = quote({ ...base, discountPct: newbiePct, discountRub: 0 }, formats, addons);
  const byPromo = promo ? quote({ ...base, discountPct: promo.percentOff ?? 0, discountRub: promo.amountOffRub ?? 0 }, formats, addons) : null;
  const promoWins = !!byPromo && byPromo.discountRub > 0 && byPromo.discountRub > byNewbie.discountRub;
  return {
    quote: promoWins ? byPromo! : byNewbie,
    promoApplied: promoWins,
    newbieApplied: !promoWins && newbiePct > 0 && byNewbie.discountRub > 0,
  };
}
