// «Ближайшие праздники» в демо-стенде: список праздников — в хранилище браузера (на сайте — настройка `holidays`
// в базе), редактор админки — настоящий компонент (src/components/admin/HolidaysAdmin), «Мои герои» с днями рождения.
// Страница /prazdniki — настоящая (src/app/prazdniki/page.tsx): без базы она читает HOLIDAY_STORE.
import Link from "next/link";
import { HolidaysAdmin, type HolidayResult } from "../../src/components/admin/HolidaysAdmin";
import { HeroBirthdays } from "../../src/app/kabinet/Birthdays";
import { HOLIDAY_STORE, DEFAULT_HOLIDAYS, moveHoliday, newHolidayId, parseHoliday, ruleLabel, upcomingBirthdays, type Holiday } from "../../src/lib/holidays-core";
import { getLeadTimes } from "../../src/lib/holidays";
import { getStories, displayTitle } from "../../src/lib/catalog";
import { OCCASIONS } from "../../src/content/profiles";
import { log, S, save } from "./api";

const KEY = "bookimi.demo.holidays.v1";

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw)) {
      const items = raw.map((x) => parseHoliday(x)).filter((r) => r.ok).map((r) => (r as { holiday: Holiday }).holiday);
      HOLIDAY_STORE.items = items;
      return;
    }
  } catch {}
  HOLIDAY_STORE.items = DEFAULT_HOLIDAYS;
}
load();

export function resetHolidays() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  HOLIDAY_STORE.items = DEFAULT_HOLIDAYS;
}

function commit(items: Holiday[], text: string): HolidayResult {
  HOLIDAY_STORE.items = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  try {
    localStorage.setItem(KEY, JSON.stringify(HOLIDAY_STORE.items));
  } catch {}
  log(`Журнал: ${text} (owner@bookimi.demo)`);
  save();
  return { ok: true, items: HOLIDAY_STORE.items };
}

const actions = {
  async onSave(input: unknown): Promise<HolidayResult> {
    const r = parseHoliday(input);
    if (!r.ok) return r;
    const items = HOLIDAY_STORE.items;
    const h = r.holiday;
    const existing = h.id ? items.find((x) => x.id === h.id) : undefined;
    if (!existing) h.id = newHolidayId(h.occasionKey, items.map((x) => x.id));
    return commit(existing ? items.map((x) => (x.id === h.id ? h : x)) : [...items, h], `${existing ? "изменён" : "добавлен"} праздник «${h.title}» — ${ruleLabel(h.rule)}`);
  },
  async onDelete(id: string): Promise<HolidayResult> {
    const h = HOLIDAY_STORE.items.find((x) => x.id === id);
    return commit(HOLIDAY_STORE.items.filter((x) => x.id !== id), `удалён праздник «${h?.title ?? id}»`);
  },
  async onMove(id: string, dir: number): Promise<HolidayResult> {
    return commit(moveHoliday(HOLIDAY_STORE.items, id, dir < 0 ? -1 : 1), `изменён порядок праздников`);
  },
  async onToggle(id: string): Promise<HolidayResult> {
    const h = HOLIDAY_STORE.items.find((x) => x.id === id);
    return commit(HOLIDAY_STORE.items.map((x) => (x.id === id ? { ...x, active: !x.active } : x)), `праздник «${h?.title ?? id}» ${h?.active ? "выключен" : "включён"}`);
  },
};

export async function AdminHolidays() {
  const [lead, stories] = await Promise.all([getLeadTimes(), getStories()]);
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Праздники</h1>
      <p className="muted">
        Вкладка «Ближайшие праздники» на сайте (<Link href="/prazdniki">/prazdniki</Link>), кнопка на главной и полоса промо. Праздник
        появляется за «показывать за» дней до даты; «заказать до» считается по сроку типографии и доставки СДЭК — или вручную.
      </p>
      <HolidaysAdmin
        initial={HOLIDAY_STORE.items}
        books={stories.filter((s) => s.slug !== "svoya-ideya").map((s) => ({ slug: s.slug, title: displayTitle(s.title, s.audience), audience: s.audience }))}
        occasions={OCCASIONS.filter((o) => o.key !== "svoj" && o.key !== "bez").map((o) => ({ key: o.key, label: o.label }))}
        lead={lead}
        canEdit={true}
        {...actions}
      />
      <p className="small muted demo-note" style={{ marginTop: 12 }}>Демо: праздники хранятся в этом браузере. На сайте — в настройке <code>holidays</code>, изменения пишутся в журнал.</p>
    </>
  );
}

/** Герои демо — из анкет книг этого окна (на сайте — сохранённые «Мои герои»). */
function demoHeroes() {
  const seen = new Set<string>();
  const out: { name: string; gender?: string; birthDate?: string; age?: string }[] = [];
  for (const b of [...S.books].sort((x, y) => y.createdAt - x.createdAt)) {
    const h = b.params.hero as { name?: string; gender?: string; birthDate?: string; ageGroup?: string };
    if (!h?.name || seen.has(h.name)) continue;
    seen.add(h.name);
    out.push({ name: h.name, gender: h.gender, birthDate: h.birthDate || undefined, age: h.ageGroup });
  }
  return out;
}

export async function demoBirthdays(withinDays: number) {
  const list = demoHeroes().filter((h) => h.birthDate) as { name: string; gender?: string; birthDate: string }[];
  return upcomingBirthdays(list, new Date(), withinDays, await getLeadTimes());
}

export async function DemoGeroi() {
  const heroes = demoHeroes();
  const birthdays = await demoBirthdays(366);
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои герои</h1>
      <p className="muted">Анкеты сохраняются, чтобы следующую книгу было сделать быстрее. Фото хранятся только 7 дней.</p>
      <HeroBirthdays list={birthdays} hrefFor={() => "/sozdat?povod=den-rozhdeniya"} />
      <div className="cards">
        {heroes.map((h) => (
          <div className="panel" key={h.name}>
            <h3>{h.name}</h3>
            <p className="small muted">
              {h.gender === "girl" ? "Девочка" : h.gender === "boy" ? "Мальчик" : "Герой"}
              {h.birthDate ? ` · день рождения ${new Date(`${h.birthDate}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}` : h.age ? `, ${h.age} лет` : ""}
            </p>
            <Link className="btn btn--primary btn--sm" href="/sozdat">Новая книга с этим героем</Link>
          </div>
        ))}
        {heroes.length === 0 && <p className="muted">Пока пусто — герой появится после первой анкеты. Укажите дату рождения — за месяц до праздника напомним.</p>}
      </div>
    </>
  );
}
