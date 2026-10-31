// «Следующий повод» для кабинета: ближайший день рождения героя, Новый год или праздник,
// под который покупатель уже делал книгу. Чистая функция — без БД, тестируется.
import { mskToday, orderDeadline } from "@/lib/holidays-core";
import { declineName, guessGender } from "@/lib/declension";

export interface OccasionHint {
  key: string;
  title: string; // «Новый год», «День рождения Маши»
  date: Date;
  deadline: Date; // до какого дня заказать печать, чтобы успеть
  text: string;
  href: string;
}

const DAY = 86400_000;
/** Последний день заказа печати — тот же расчёт, что на /prazdniki: доставка 7 дн. + печать 5 раб. дн. (праздники РФ не в счёт). */
const printDeadline = (date: Date) => new Date(orderDeadline(mskToday(date), null) * DAY + 6 * 3600_000); // 09:00 МСК

const mskDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 9 - 3)); // 09:00 МСК
const fmt = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

function lastSunday(y: number, m: number) {
  const d = new Date(Date.UTC(y, m, 0, 6)); // последний день месяца
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function nthSunday(y: number, m: number, n: number) {
  const d = new Date(Date.UTC(y, m - 1, 1, 6));
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7);
  return d;
}

/** Праздники года: ключ совпадает с ключами поводов в анкете. */
function holidays(y: number): { key: string; title: string; date: Date; deadline?: Date; window: number; universal?: boolean }[] {
  return [
    { key: "novyj-god", title: "Новый год", date: mskDate(y, 12, 31), window: 75, universal: true },
    { key: "23-fevralya", title: "23 Февраля", date: mskDate(y, 2, 23), window: 40 },
    { key: "8-marta", title: "8 Марта", date: mskDate(y, 3, 8), window: 40 },
    { key: "vypusknoj-v-sadu", title: "Выпускной в детском саду", date: mskDate(y, 5, 25), window: 45 },
    { key: "den-semi", title: "День семьи, любви и верности", date: mskDate(y, 7, 8), window: 40 },
    { key: "pervyj-klass", title: "1 сентября", date: mskDate(y, 9, 1), window: 45 },
    { key: "den-otca", title: "День отца", date: nthSunday(y, 10, 3), window: 40 },
    { key: "den-babushek-i-dedushek", title: "День бабушек и дедушек", date: mskDate(y, 10, 28), window: 40 },
    { key: "den-materi", title: "День матери", date: lastSunday(y, 11), window: 40 },
  ];
}

function weeksOrDays(days: number) {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 14) return `через ${days} ${plural(days, "день", "дня", "дней")}`;
  const w = Math.round(days / 7);
  return `через ${w} ${plural(w, "неделю", "недели", "недель")}`;
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

export function nextOccasion(opts: {
  now?: Date;
  birthdays?: { name: string; nameGen?: string; date: Date }[]; // nameGen — «Маши»
  pastOccasions?: string[]; // ключи поводов прошлых книг
}): OccasionHint | null {
  const now = opts.now ?? new Date();
  const past = new Set(opts.pastOccasions ?? []);
  const y = Number(new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 4));
  const out: OccasionHint[] = [];

  for (const b of opts.birthdays ?? []) {
    const m = b.date.getUTCMonth() + 1;
    const d = b.date.getUTCDate();
    let next = mskDate(y, m, d);
    if (next.getTime() < now.getTime() - DAY) next = mskDate(y + 1, m, d);
    const days = Math.ceil((next.getTime() - now.getTime()) / DAY);
    if (days < 0 || days > 60) continue;
    const deadline = printDeadline(next);
    // «день рождения Маши»: родительный падеж (без готовой формы — склоняем здесь)
    const who = b.nameGen ?? declineName(b.name, "род", guessGender(b.name));
    out.push({
      key: "den-rozhdeniya",
      title: `День рождения ${who}`,
      date: next,
      deadline,
      href: "/povod/den-rozhdeniya",
      text:
        deadline > now
          ? `${cap(weeksOrDays(days))} — ${fmt(next)} — день рождения ${who}. Новая сказка ко дню рождения будет тёплым подарком. Печатную книгу лучше оформить до ${fmt(deadline)}.`
          : `${cap(weeksOrDays(days))} день рождения ${who}. Печать уже не успеет, а PDF-книга будет готова в тот же день.`,
    });
  }

  for (const yy of [y, y + 1]) {
    for (const h of holidays(yy)) {
      if (!h.universal && !past.has(h.key)) continue;
      const days = Math.ceil((h.date.getTime() - now.getTime()) / DAY);
      if (days < 0 || days > h.window) continue;
      const deadline = h.deadline ?? printDeadline(h.date);
      out.push({
        key: h.key,
        title: h.title,
        date: h.date,
        deadline,
        href: h.key === "novyj-god" ? "/povod/novyj-god" : "/sozdat",
        text:
          deadline > now
            ? `${h.title} ${weeksOrDays(days)}. Чтобы печатная книга успела${h.key === "novyj-god" ? " под ёлку" : ""}, оформите её до ${fmt(deadline)}.`
            : `${h.title} ${weeksOrDays(days)}. Печать уже не успеет, а PDF-книга будет готова в тот же день.`,
      });
    }
  }

  // Сначала то, что ещё успевает в печать; среди них — ближайшее; дни рождения важнее праздников в тот же срок
  out.sort((a, b) => Number(b.deadline > now) - Number(a.deadline > now) || a.date.getTime() - b.date.getTime() || (a.key === "den-rozhdeniya" ? -1 : 1));
  return out[0] ?? null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
