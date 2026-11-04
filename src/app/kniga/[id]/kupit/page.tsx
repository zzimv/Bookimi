import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Checkout } from "@/components/book/Checkout";
import { ownBook } from "@/lib/api";
import { db } from "@/lib/db";
import { cfg, canAcceptPayments } from "@/lib/settings";
import { bookPlanById, catalogForPricing, checkoutAllowed, pdfPaidFor } from "@/lib/orders";
import { formatFitsGroup } from "@/lib/page-plan";
import { layoutOf } from "@/lib/book-layout";
import { availableMethods, METHOD_TITLES } from "@/lib/shipping";
import { signedUrl } from "@/lib/storage";
import { parseAddressBook, pickPrefill } from "@/lib/delivery";
import { bulkState } from "@/lib/bulk-server";
import { audienceOfParams } from "@/lib/addons-core";
import { canChangeOrder } from "@/lib/order-change";
import { normalizeName } from "@/lib/declension";

export const metadata: Metadata = { title: "Оформление", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ who?: string; pechat?: string; "dlya-vseh"?: string; izmenit?: string; chto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const own = await ownBook(id);
  if (!own) notFound();
  if (!own.user) redirect(`/vhod?next=/kniga/${id}/kupit`);
  // Без превью — только если текст утверждён и дневной лимит превью исчерпан (иллюстрации — после оплаты)
  const allowed = await checkoutAllowed(own.book, own.user);
  if (!allowed.ok) redirect(`/kniga/${id}`);
  // «Изменить заказ» (только до оплаты, rev 10): тот же экран с выбором из заказа
  const eo = sp.izmenit && /^[0-9a-f-]{36}$/.test(sp.izmenit) ? await db.order.findUnique({ where: { id: sp.izmenit }, include: { items: true, shipment: true } }) : null;
  if (sp.izmenit && (!eo || eo.userId !== own.user.id || !canChangeOrder(eo).ok)) redirect(`/zakaz/${sp.izmenit}`);

  // Допы — только для аудитории книги: у подростка, взрослого и питомца свои наборы (src/lib/addons-core.ts)
  const audience = audienceOfParams(own.book.params);
  const [{ formats, addons }, flags, audio, ph, canPay] = await Promise.all([
    catalogForPricing(audience),
    cfg("flags"),
    cfg("audio"),
    db.printHouse.findFirst({ where: { isActive: true } }),
    canAcceptPayments(),
  ]);
  // rev 20: форматы — по плану страниц книги (картонная 0–3 — только картонные; остальные — обычные, 30 / 40 страниц)
  const { plan } = await bookPlanById(id);
  const full = (await db.productFormat.findMany({ where: { key: { in: formats.map((f) => f.key) } }, orderBy: { sortOrder: "asc" } })).filter((f) => formatFitsGroup(f.key, plan));
  const addonRows = await db.addon.findMany({ where: { key: { in: addons.map((a) => a.key) } }, orderBy: { sortOrder: "asc" } });
  const methods = await availableMethods(ph?.pickupAddress);
  const cover = await db.bookPage.findUnique({ where: { bookId_index: { bookId: id, index: 0 } } });
  const coverUrl = cover?.previewKey ? await signedUrl("books", cover.previewKey) : null;
  const user = own.user;
  const cartoonCfg = await cfg("cartoon");
  const eship = eo?.shipment as { method?: string; address?: Record<string, string> | null; pvzCode?: string | null; pvzAddress?: string | null } | null | undefined;
  // Получатель и адрес «из прошлого раза»: адресная книга → последний заказ → профиль → черновик анкеты
  const lastOrder = await db.order.findFirst({
    where: { userId: user.id, shipment: { isNot: null } },
    orderBy: { createdAt: "desc" },
    select: { contactName: true, contactPhone: true, shipment: { select: { method: true, address: true, pvzCode: true, pvzAddress: true, cityCode: true } } },
  });
  const draft = (own.book.params as { contact?: { phone?: string } } | null)?.contact;
  const prefill = pickPrefill({
    saved: parseAddressBook(user.savedAddresses),
    lastOrder,
    profile: { name: user.name || user.firstName, phone: user.phone },
    draft: { phone: draft?.phone },
    methods,
  });

  // «Книга для каждого в группе»: копии и скидки (книга о группе, не копия, функция включена)
  const bulkCfg = await cfg("bulk");
  const bs = bulkCfg.enabled && !own.book.parentBookId ? await bulkState(own.book).catch(() => null) : null;
  const bulk = bs?.available ? { count: bs.count, initialOn: sp["dlya-vseh"] === "1", dedication: bs.dedication, tiers: bs.tiers, previewCopies: bs.previewCopies, copies: bs.copies } : null;

  return (
    <div className="wrap" style={{ padding: "24px var(--gutter) 80px" }}>
      {allowed.withoutPreview && (
        <p className="muted-panel small" role="note" style={{ marginBottom: 16 }}>
          Оформляете без превью: текст сказки вы уже утвердили. Иллюстрации нарисуем сразу после оплаты — обычно за 1–2 часа — и пришлём письмо, когда книга будет готова. Если картинка не понравится, одну страницу перерисуем бесплатно.
        </p>
      )}
      <Checkout
        bookId={id}
        plan={{ id: plan.id, title: plan.title, innerPages: plan.innerPages, ...(plan.board ? { board: layoutOf(own.book.params).board ?? 12 } : {}) }}
        coverUrl={coverUrl}
        initialWho={sp.who === "bookimi" || sp.pechat ? "bookimi" : "self"}
        formats={full.map((f) => ({ key: f.key, kind: f.kind, title: f.title, priceRub: f.priceRub, widthMm: f.widthMm, heightMm: f.heightMm, cover: f.cover, pages: f.pages }))}
        addons={addonRows.map((a) => ({
          key: a.key,
          kind: a.kind,
          title: a.title,
          description: a.description,
          priceRub: addons.find((x) => x.key === a.key)?.priceRub ?? a.priceRub,
          percentOff: a.percentOff,
          requiresPrint: a.requiresPrint,
        }))}
        methods={methods.map((m) => ({ key: m, title: METHOD_TITLES[m] }))}
        pickupAddress={ph?.pickupAddress ?? null}
        voices={audio.voices}
        canPay={canPay}
        printEnabled={flags.printEnabled}
        contact={{ name: user.name || user.firstName || "", phone: user.phone ?? "", email: user.email ?? "" }}
        pdfPaid={await pdfPaidFor(id, user.id)}
        prefill={prefill}
        bulk={eo ? null : bulk}
        audience={audience}
        heroName={normalizeName((own.book.params as { hero?: { name?: string } } | null)?.hero?.name ?? "")}
        bookTitle={(own.book.text as { title?: string } | null)?.title ?? ""}
        cartoonSoon={!cartoonCfg.enabled}
        edit={
          eo
            ? {
                orderId: eo.id,
                publicCode: eo.publicCode,
                formatKey: eo.items.find((i) => i.kind === "format")?.refKey,
                addons: eo.items.filter((i) => i.kind === "addon").map((i) => i.refKey),
                method: eship?.method,
                address: eship ? { ...(eship.address ?? {}), pvzCode: eship.pvzCode ?? "", pvzAddress: eship.pvzAddress ?? "" } : undefined,
                contact: { name: eo.contactName ?? "", phone: eo.contactPhone ?? "" },
                focus: sp.chto === "dostavka" ? "delivery" : undefined,
              }
            : null
        }
      />
    </div>
  );
}
