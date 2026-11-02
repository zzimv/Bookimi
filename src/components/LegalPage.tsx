import { og } from "@/lib/og";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "./Layout";
import { renderMarkdown } from "@/lib/markdown";
import { DOC_VERSION, LEGAL } from "@/lib/legal";
import { getSeller, getSetting, sellerIsComplete, type Seller } from "@/lib/settings";

export function legalMetadata(key: string, path: string): Metadata {
  const d = LEGAL[key];
  return d ? { title: d.title, description: d.description, alternates: { canonical: path }, ...og({ title: d.title, description: d.description, path }) } : {};
}

// Редакция из админки: настройка legal.<ключ> = { markdown, version }.
// Простая разметка: «## » — подзаголовок, «- » — пункт списка, пустая строка — новый абзац.
// Плейсхолдеры {ФИО}, {ИНН}, {email}, {телефон}, {домен} подставляются из реквизитов.
interface LegalOverride {
  markdown: string;
  version?: string;
}

function fill(text: string, seller: Seller, domain: string) {
  return text
    .replaceAll("{ФИО}", seller.fullName || "[ФИО продавца]")
    .replaceAll("{ИНН}", seller.inn || "[ИНН]")
    .replaceAll("{email}", seller.email || "[email]")
    .replaceAll("{телефон}", seller.phone || "[телефон]")
    .replaceAll("{домен}", domain);
}

export async function LegalPage({ docKey }: { docKey: string }) {
  const doc = LEGAL[docKey];
  if (!doc) notFound();
  const [seller, override] = await Promise.all([
    getSeller(),
    getSetting<LegalOverride | null>(`legal.${docKey}`, null),
  ]);
  const domain = process.env.DOMAIN ?? "bookimi.ru";
  const version = override?.version ?? DOC_VERSION;
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: doc.title }]} />
      <article className="wrap legal">
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>{doc.title}</h1>
        {!sellerIsComplete(seller) && (
          <p className="notice">Реквизиты продавца ещё не заполнены — приём оплаты выключен.</p>
        )}
        {override?.markdown ? renderMarkdown(fill(override.markdown, seller, domain)) : doc.body(seller, domain)}
        <p className="small muted">Редакция от {version.split("-").reverse().join(".")}.</p>
      </article>
    </>
  );
}
