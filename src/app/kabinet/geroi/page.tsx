import Link from "next/link";
import { kidGroupByKey } from "@/content/ages";
import { db } from "@/lib/db";
import { userOrLogin } from "@/lib/auth";
import { upcomingBirthdays } from "@/lib/holidays-core";
import { getLeadTimes } from "@/lib/holidays";
import { HeroBirthdays } from "../Birthdays";
import { normalizeName } from "@/lib/declension";

export default async function Page() {
  const user = await userOrLogin();
  const heroes = await db.hero.findMany({ where: { userId: user.id, role: "main" }, orderBy: { createdAt: "desc" } });
  const uniq = heroes.filter((h, i) => heroes.findIndex((x) => x.name === h.name) === i);
  const birthdays = upcomingBirthdays(
    uniq.filter((h) => h.birthDate).map((h) => ({ id: h.id, name: h.name, gender: h.gender, birthDate: h.birthDate! })),
    new Date(),
    366,
    await getLeadTimes(),
  );
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои герои</h1>
      <p className="muted">Анкеты сохраняются, чтобы следующую книгу было сделать быстрее. Фото хранятся только 7 дней.</p>
      <HeroBirthdays list={birthdays} hrefFor={(b) => `/sozdat?povod=den-rozhdeniya&geroj=${b.id}`} />
      <div className="cards">
        {uniq.map((h) => (
          <div className="panel" key={h.id}>
            <h3>{normalizeName(h.name)}{h.nickname ? ` (${normalizeName(h.nickname)})` : ""}</h3>
            <p className="small muted">{h.gender === "girl" ? "Девочка" : "Мальчик"}{kidGroupByKey(h.ageGroup) ? `, ${kidGroupByKey(h.ageGroup)!.label}` : ""}{h.interests.length ? ` · ${h.interests.join(", ")}` : ""}</p>
            <Link className="btn btn--primary btn--sm" href={`/sozdat?geroj=${h.id}`}>Новая книга с этим героем</Link>
          </div>
        ))}
        {uniq.length === 0 && <p className="muted">Пока пусто.</p>}
      </div>
    </>
  );
}
