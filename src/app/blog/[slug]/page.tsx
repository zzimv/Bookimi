import type { Metadata } from "next";
import { og } from "@/lib/og";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, hasDatabase } from "@/lib/db";
import { Breadcrumbs, JsonLd } from "@/components/Layout";
import { renderMarkdown } from "@/lib/markdown";

export const revalidate = 600;

async function post(slug: string) {
  if (!hasDatabase) return null;
  return db.blogPost.findFirst({ where: { slug, publishedAt: { not: null } } }).catch(() => null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await post((await params).slug);
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/blog/${p.slug}` }, ...og({ type: "article", title: p.title, description: p.description, path: `/blog/${p.slug}` }) } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const p = await post((await params).slug);
  if (!p) notFound();
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/blog", label: "Блог" }, { label: p.title }]} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.description, datePublished: p.publishedAt, dateModified: p.updatedAt, publisher: { "@type": "Organization", name: "БУКИМИ" } }} />
      <article className="wrap legal">
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>{p.title}</h1>
        {renderMarkdown(p.body)}
        <p style={{ marginTop: 32 }}><Link className="btn btn--primary" href="/sozdat">Создать книгу</Link></p>
      </article>
    </>
  );
}
