import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "./Layout";
import { DOC_VERSION, LEGAL } from "@/lib/legal";
import { getSeller, sellerIsComplete } from "@/lib/settings";

export function legalMetadata(key: string, path: string): Metadata {
  const d = LEGAL[key];
  return d ? { title: d.title, description: d.description, alternates: { canonical: path } } : {};
}

export async function LegalPage({ docKey }: { docKey: string }) {
  const doc = LEGAL[docKey];
  if (!doc) notFound();
  const seller = await getSeller();
  const domain = process.env.DOMAIN ?? "bookimi.ru";
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: doc.title }]} />
      <article className="wrap legal">
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>{doc.title}</h1>
        {!sellerIsComplete(seller) && (
          <p className="notice">Реквизиты продавца ещё не заполнены — приём оплаты выключен.</p>
        )}
        {doc.body(seller, domain)}
        <p className="small muted">Редакция от {DOC_VERSION.split("-").reverse().join(".")}.</p>
      </article>
    </>
  );
}
