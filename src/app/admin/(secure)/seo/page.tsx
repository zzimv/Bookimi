import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { blogAction, seoAction } from "../../actions";

export default async function Page() {
  await requireAdmin("seo");
  const [stories, occasions, posts] = await Promise.all([
    db.story.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.occasion.findMany({ orderBy: { sortOrder: "asc" } }),
    db.blogPost.findMany({ orderBy: { updatedAt: "desc" } }),
  ]);
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>SEO и блог</h1>
      <p className="muted">Пустые поля — сайт подставит заголовок и описание автоматически. /llms.txt, /catalog.json и /agents.md собираются из каталога сами.</p>

      <h2 style={{ fontSize: "var(--fs-lg)" }}>Страницы поводов</h2>
      {occasions.map((o) => (
        <details key={o.id} className="panel edit">
          <summary>/povod/{o.slug}</summary>
          <form action={seoAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={o.id} /><input type="hidden" name="kind" value="occasion" />
            <label className="field"><span>H1</span><input className="input" name="h1" defaultValue={o.h1} /></label>
            <label className="field"><span>Вступление (с фактами: цены, сроки)</span><textarea className="textarea" name="intro" defaultValue={o.intro} /></label>
            <label className="field"><span>Title</span><input className="input" name="seoTitle" defaultValue={o.seoTitle ?? ""} maxLength={70} /></label>
            <label className="field"><span>Description</span><textarea className="textarea" name="seoDescription" defaultValue={o.seoDescription ?? ""} maxLength={170} /></label>
            <button className="btn btn--primary btn--sm">Сохранить</button>
          </form>
        </details>
      ))}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 20 }}>Страницы сюжетов</h2>
      {stories.map((s) => (
        <details key={s.id} className="panel edit">
          <summary>/skazki/{s.slug}</summary>
          <form action={seoAction} style={{ marginTop: 10 }}>
            <input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="story" />
            <label className="field"><span>Title</span><input className="input" name="seoTitle" defaultValue={s.seoTitle ?? ""} maxLength={70} /></label>
            <label className="field"><span>Description</span><textarea className="textarea" name="seoDescription" defaultValue={s.seoDescription ?? ""} maxLength={170} /></label>
            <button className="btn btn--primary btn--sm">Сохранить</button>
          </form>
        </details>
      ))}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 20 }}>Блог</h2>
      {[...posts, null].map((p) => (
        <details key={p?.id ?? "new"} className="panel edit">
          <summary>{p ? `${p.title} ${p.publishedAt ? "" : "(черновик)"}` : "Новая статья"}</summary>
          <form action={blogAction} style={{ marginTop: 10 }}>
            {p && <input type="hidden" name="id" value={p.id} />}
            <div className="grid2">
              <label className="field"><span>Адрес (латиницей)</span><input className="input" name="slug" defaultValue={p?.slug} pattern="[a-z0-9-]+" required /></label>
              <label className="field"><span>Заголовок</span><input className="input" name="title" defaultValue={p?.title} required /></label>
            </div>
            <label className="field"><span>Описание</span><input className="input" name="description" defaultValue={p?.description} maxLength={170} /></label>
            <label className="field"><span>Текст (## подзаголовок, - пункт списка, пустая строка — новый абзац)</span><textarea className="textarea" name="body" defaultValue={p?.body} style={{ minHeight: 220 }} /></label>
            <label className="check"><input type="checkbox" name="published" defaultChecked={Boolean(p?.publishedAt)} /> Опубликовано</label>
            <button className="btn btn--primary btn--sm">Сохранить</button>
          </form>
        </details>
      ))}
    </>
  );
}
