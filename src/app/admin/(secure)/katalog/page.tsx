import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { addonAction, formatAction, storyAction, styleAction } from "../../actions";

export default async function Page() {
  await requireAdmin("catalog");
  const [stories, formats, addons, styles] = await Promise.all([
    db.story.findMany({ orderBy: { sortOrder: "asc" } }),
    db.productFormat.findMany({ orderBy: { sortOrder: "asc" } }),
    db.addon.findMany({ orderBy: { sortOrder: "asc" } }),
    db.illustrationStyle.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const hid = (v: string) => <input type="hidden" name="id" value={v} />;
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Каталог и цены</h1>
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
                    <button className="btn btn--ghost btn--sm">Сохранить</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Допы</h2>
      <p className="small muted">Выключите доп, если типография его не делает. Цены аудио — в Настройках → Аудио.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <tbody>
            {addons.map((a) => (
              <tr key={a.id}>
                <td>
                  <form action={addonAction} className="row">
                    {hid(a.id)}
                    <input className="input" name="title" defaultValue={a.title} style={{ flex: 1, minWidth: 220 }} />
                    {a.percentOff != null ? (
                      <label className="row small">−<input className="input" name="percentOff" type="number" defaultValue={a.percentOff} style={{ width: 80 }} />%</label>
                    ) : (
                      <label className="row small"><input className="input" name="priceRub" type="number" defaultValue={a.priceRub ?? 0} style={{ width: 100 }} />₽</label>
                    )}
                    <label className="check"><input type="checkbox" name="isActive" defaultChecked={a.isActive} /> вкл.</label>
                    <span className="badge">{a.requiresPrint ? "с печатью" : "цифровой"}</span>
                    <button className="btn btn--ghost btn--sm">Сохранить</button>
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
          <label className="check"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> показывать</label>
          <button className="btn btn--ghost btn--sm">Сохранить</button>
        </form>
      ))}

      <h2 style={{ fontSize: "var(--fs-lg)", marginTop: 24 }}>Сюжеты</h2>
      {stories.map((s) => (
        <details key={s.id} className="panel edit">
          <summary>{s.sortOrder + 1}. {s.title} {!s.isActive && <span className="badge badge--gold">скрыт</span>}</summary>
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
            <label className="field"><span>Указания для ИИ (шаблон сюжета)</span><textarea className="textarea" name="textTemplate" defaultValue={s.textTemplate} /></label>
            <button className="btn btn--primary btn--sm">Сохранить сюжет</button>
          </form>
        </details>
      ))}
    </>
  );
}
