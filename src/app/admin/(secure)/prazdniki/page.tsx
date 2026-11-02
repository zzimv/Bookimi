import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { can } from "@/lib/auth";
import { getStories, displayTitle } from "@/lib/catalog";
import { getHolidays, getLeadTimes } from "@/lib/holidays";
import { OCCASIONS } from "@/content/profiles";
import { HolidaysAdmin } from "@/components/admin/HolidaysAdmin";
import { deleteHolidayAction, moveHolidayAction, saveHolidayAction, toggleHolidayAction } from "../../holiday-actions";

export default async function Page() {
  const u = await requireAdmin("holidays");
  const [items, lead, stories] = await Promise.all([getHolidays(), getLeadTimes(), getStories({ includeSoon: true })]);
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Праздники</h1>
      <p className="muted">
        Вкладка «Ближайшие праздники» на сайте (<Link href="/prazdniki">/prazdniki</Link>), кнопка на главной и полоса промо. Праздник
        появляется за «показывать за» дней до даты; «заказать до» считается по сроку типографии и доставки СДЭК — или вручную.
      </p>
      <HolidaysAdmin
        initial={items}
        books={stories.filter((s) => s.slug !== "svoya-ideya").map((s) => ({ slug: s.slug, title: displayTitle(s.title, s.audience), audience: s.audience }))}
        occasions={OCCASIONS.filter((o) => o.key !== "svoj" && o.key !== "bez").map((o) => ({ key: o.key, label: o.label }))}
        lead={lead}
        canEdit={can(u.role, "holidaysEdit")}
        onSave={saveHolidayAction}
        onDelete={deleteHolidayAction}
        onMove={moveHolidayAction}
        onToggle={toggleHolidayAction}
      />
    </>
  );
}
