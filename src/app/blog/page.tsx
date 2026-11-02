import { og } from "@/lib/og";
import type { Metadata } from "next";
import Link from "next/link";
import { db, hasDatabase } from "@/lib/db";
import { Breadcrumbs } from "@/components/Layout";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "Блог: идеи подарков и советы",
  description: "Как выбрать фото для персональной книги, что подарить ребёнку к празднику, как читать вместе.",
  alternates: { canonical: "/blog" },
  ...og({ title: "Блог БУКИМИ: идеи подарков и советы", description: "Как выбрать фото для персональной книги, что подарить ребёнку к празднику, как читать вместе.", path: "/blog" }),
};

export default async function Page() {
  const posts = hasDatabase ? await db.blogPost.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } }).catch(() => []) : [];
  return (
    <>
      <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Блог" }]} />
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <h1>Блог</h1>
          {posts.length === 0 && <p className="muted">Статьи скоро появятся.</p>}
          {posts.map((p) => (
            <article key={p.id} className="panel">
              <h2 style={{ fontSize: "var(--fs-lg)" }}><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
              <p className="muted" style={{ margin: 0 }}>{p.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
