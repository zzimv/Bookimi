import { db } from "@/lib/db";
import { isArchivedArtStyle } from "@/content/art/index";
import { requireAdmin } from "@/lib/admin";
import { addonAction, formatAction, storyAction, styleAction } from "../../actions";
import { ADDON_AUDIENCES, ADDON_AUDIENCE_LABEL } from "@/lib/addons-core";
import { getSoonAudiences } from "@/lib/catalog";
import type { AudienceKey } from "@/content/profiles";
import { BOARD_PRICE_TBD } from "@/lib/catalog-defaults";
import { plotBySlug, plotPlan, plotPalette } from "@/content/registry";
import { PLAN_FIT_NOTE, planFit } from "@/lib/page-plan";
import { bookAgeLabel } from "@/content/ages";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("catalog");
  const { error } = await searchParams;
  const [stories, formats, addons, styles, soon] = await Promise.all([
    db.story.findMany({ orderBy: { sortOrder: "asc" } }),
    db.productFormat.findMany({ orderBy: { sortOrder: "asc" } }),
    db.addon.findMany({ orderBy: { sortOrder: "asc" } }),
    db.illustrationStyle.findMany({ orderBy: { sortOrder: "asc" } }),
    getSoonAudiences(),
  ]);
  const hid = (v: string) => <input type="hidden" name="id" value={v} />;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Каталог и цены</h1>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted">Изменения появляются на сайте в течение 5 минут, без выкладки.</p>

      <h2 style={{ fontSize: "var(--fs-lg)" }}>Форматы</h2>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Название</th><th>Цена, ₽</th><th>Вкл.</th><th></th></tr></thead>
          <tbody>
            {formats.map((f) => (
              <tr key={f.id}>
                <td colSpan={4}>
                  <form action={formatAction} className="row">
                    {hid(f.id)}
                    <input className="input" name="title" defaultValue={f.title} style={{ flex: 1, minWidth: 220 }} />
                    <input className="input" name="priceRub" type="number" min={0} defaultValue={f.priceRub} style={{ width: 110 }} />
                    <label className="check"><input type="checkbox" name="isActive" defaultChecked={f.isActive} /> вкл.</label>
                    {(BOARD_PRICE_TBD as readonly string[]).includes(f.key) && <span className="badge badge--gold" data-price-tbd title="Картонная книга 0–3 (rev 20): цена — заглушка">уточнить у типографии</span>}
                    <button className="btn btn--ghost btn--sm">Сохранить</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Допы</h2>
      <p className="small muted">
        Выключите доп, если типография его не делает. Цены аудио — в Настройках → Аудио, «Оживления книги» — в Настройках → «Оживление книги».
        Галочки аудиторий — для каких книг доп показывается в оформлении, кабинете и catalog.json (все четыре — для всех книг).
        «Другой подрядчик» — типографии не передаётся: оператор заказывает его вручную по письму-напоминанию.
      </p>
      <div className="tbl-wrap">
        <table className="tbl">
          <tbody>
            {addons.map((a) => (
              <tr key={a.id} id={`addon-${a.key}`}>
                <td>
                  <form action={addonAction} className="addon-form" data-addon={a.key}>
                    {hid(a.id)}
                    <div className="row">
                      <input className="input" name="title" aria-label="Название" defaultValue={a.title} maxLength={120} style={{ flex: 1, minWidth: 220 }} />
                      {a.percentOff != null ? (
                        <label className="row small">−<input className="input" name="percentOff" type="number" defaultValue={a.percentOff} style={{ width: 80 }} />%</label>
                      ) : (
                        <label className="row small"><input className="input" name="priceRub" type="number" defaultValue={a.priceRub ?? 0} style={{ width: 100 }} />₽</label>
                      )}
                      <label className="check"><input type="checkbox" name="isActive" defaultChecked={a.isActive} /> вкл.</label>
                      <span className="badge">{a.kind === "PHYSICAL" ? "физический" : a.kind === "DIGITAL" ? "файл" : "к книге"}{a.requiresPrint ? " · с печатью" : ""}</span>
                      {a.supplier === "other" && <span className="badge badge--gold">другой подрядчик</span>}
                    </div>
                    <input className="input" name="description" aria-label="Описание для покупателя" placeholder="Коротко для покупателя" defaultValue={a.description === a.title ? "" : a.description} maxLength={240} style={{ width: "100%", marginTop: 6 }} />
                    <div className="row small" style={{ marginTop: 6 }}>
                      <span className="muted">Для книг:</span>
                      {ADDON_AUDIENCES.map((k) => (
                        <label key={k} className="check"><input type="checkbox" name="audiences" value={k} defaultChecked={!a.audiences.length || a.audiences.includes(k)} /> {ADDON_AUDIENCE_LABEL[k]}</label>
                      ))}
                      {a.kind === "PHYSICAL" && (
                        <select className="select" name="supplier" aria-label="Кто изготавливает" defaultValue={a.supplier} style={{ width: "auto" }}>
                          <option value="print">Типография (наши файлы)</option>
                          <option value="other">Другой подрядчик</option>
                        </select>
                      )}
                      <button className="btn btn--ghost btn--sm">Сохранить</button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Стили иллюстраций</h2>
      <p className="small muted">Покупателю показываются включённые. Итоговые 3 — по результатам теста узнаваемости.</p>
      {styles.map((s) => (
        <form key={s.id} action={styleAction} className="row panel" style={{ padding: 12 }}>
          {hid(s.id)}
          <input className="input" name="title" defaultValue={s.title} style={{ width: 200 }} />
          <input className="input" name="description" defaultValue={s.description} style={{ flex: 1, minWidth: 220 }} />
          {isArchivedArtStyle(s.key) ? <span className="badge badge--gold" title="rev 17: детям — 5 стилей; этот стиль скрыт от покупателей везде">скрыт</span> : <label className="check"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> показывать</label>}
          <button className="btn btn--ghost btn--sm">Сохранить</button>
        </form>
      ))}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Сюжеты</h2>
      <p className="small muted">
        rev 20: у каждой возрастной группы свой план страниц — 0–3: картонная книга (8 страниц сказки), 4–6: 30 страниц (11 разворотов
        и 4 страницы «Нарисуй…»), 7–9: 40 страниц (16 разворотов, заметки и рисунки). Книги со старым объёмом раскладываются с
        подгонкой — пометка «{PLAN_FIT_NOTE}».
      </p>
      {stories.map((s) => {
        const plot = plotBySlug(s.slug);
        const plan = plot ? plotPlan(plot) : null;
        const fit = plot && plan ? planFit(plan, plot.spreads.length) : "ok";
        return (
        <details key={s.id} className="panel edit" data-story={s.slug}>
          <summary>{s.sortOrder + 1}. {s.title} {plot?.audience === "CHILD" && <span className="badge">{bookAgeLabel({ audience: plot.audience, ageMin: plot.ageMin ?? 0, ageMax: plot.ageMax ?? 0, segments: plot.segments })}</span>}{plan && fit !== "ok" && <> <span className="badge badge--gold" data-plan-fit={fit} title={`План «${plan.title}»: нужно ${plan.story}, в тексте ${plot!.spreads.length}`}>{PLAN_FIT_NOTE}</span></>}{plot && <> <span className="badge" data-palette={plotPalette(plot).name} title="Палитра книги (src/content/palettes.ts)"><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: plotPalette(plot).cover, marginRight: 4, verticalAlign: "-1px" }} />{plotPalette(plot).title}</span></>} {!s.isActive && <span className="badge badge--gold">скрыт</span>}{soon.includes(s.audience as AudienceKey) && <> <span className="soon-badge" title="Аудитория «скоро» (Настройки → Витрина): покупатель книгу не видит">скоро</span></>}</summary>
          <form action={storyAction} style={{ marginTop: 12 }}>
            {hid(s.id)}
            <label className="field"><span>Название ([Имя] подставится)</span><input className="input" name="title" defaultValue={s.title} /></label>
            <label className="field"><span>Описание в одну строку</span><input className="input" name="tagline" defaultValue={s.tagline} /></label>
            <label className="field"><span>Описание</span><textarea className="textarea" name="description" defaultValue={s.description} /></label>
            <div className="row">
              <label className="field"><span>Возраст от</span><input className="input" type="number" name="ageMin" defaultValue={s.ageMin} style={{ width: 90 }} /></label>
              <label className="field"><span>до</span><input className="input" type="number" name="ageMax" defaultValue={s.ageMax} style={{ width: 90 }} /></label>
              <label className="field"><span>Порядок</span><input className="input" type="number" name="sortOrder" defaultValue={s.sortOrder} style={{ width: 90 }} /></label>
              <label className="check"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> показывать</label>
            </div>
            <label className="field"><span>Ссылка на обложку (из хранилища)</span><input className="input" name="coverUrl" defaultValue={s.coverUrl ?? ""} /></label>
            <label className="field"><span>Указания для сервиса текста (шаблон сюжета)</span><textarea className="textarea" name="textTemplate" defaultValue={s.textTemplate} /></label>
            <button className="btn btn--primary btn--sm">Сохранить сюжет</button>
          </form>
        </details>
        );
      })}
    </>
  );
}
