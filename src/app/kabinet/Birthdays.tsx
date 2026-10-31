// «Ближайшие дни рождения ваших героев» в кабинете: сколько осталось, до какого дня успеет печать, кнопка книги.
// Данные — upcomingBirthdays (holidays-core) по сохранённым героям; компонент без БД, работает и в демо-стенде.
import Link from "next/link";
import { fmtDay, plural, type BirthdayCalc } from "@/lib/holidays-core";

/** Подсказка под списком — в тон правилу hero_birthday (BIRTHDAY_REMINDER_DAYS = 30). */
export const BIRTHDAY_HINT = "За месяц до дня рождения напомним письмом или в мессенджере — если вы подписаны на рассылку.";

export function HeroBirthdays({ list, hrefFor, title = "Ближайшие дни рождения ваших героев" }: { list: BirthdayCalc[]; hrefFor: (b: BirthdayCalc) => string; title?: string }) {
  if (!list.length) return null;
  return (
    <section className="bdays" aria-labelledby="bdays-h">
      <h2 id="bdays-h" className="cab-h2">{title}</h2>
      <ul className="bdays__list">
        {list.map((b) => (
          <li key={`${b.id ?? ""}${b.name}`} className="bdays__item">
            <span className="bdays__left" aria-hidden="true">
              {b.daysLeft === 0 ? "★" : b.daysLeft}
              <small>{b.daysLeft === 0 ? "сегодня" : plural(b.daysLeft, "день", "дня", "дней")}</small>
            </span>
            <div className="bdays__who">
              <b>
                {b.name}
                {b.turns ? ` — исполнится ${b.turns} ${plural(b.turns, "год", "года", "лет")}` : ""}
              </b>
              <span>
                {fmtDay(b.date)}
                {b.daysLeft === 0 ? " — сегодня! " : b.daysLeft === 1 ? " — завтра. " : `, через ${b.daysLeft} ${plural(b.daysLeft, "день", "дня", "дней")}. `}
                {b.printOk ? `Печатную книгу успеем, если заказать до ${fmtDay(b.deadline)}.` : "Печать уже не успеет — PDF будет готов в тот же день."}
              </span>
            </div>
            <Link className="btn btn--gold btn--sm" href={hrefFor(b)}>Создать книгу ко дню рождения</Link>
          </li>
        ))}
      </ul>
      <p className="small muted">{BIRTHDAY_HINT}</p>
    </section>
  );
}
