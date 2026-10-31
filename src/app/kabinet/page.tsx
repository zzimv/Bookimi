import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { userOrLogin } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { cfg } from "@/lib/settings";
import { declineName, normalizeName } from "@/lib/declension";
import { CopyField } from "./Forms";
import { nextOccasion } from "./occasion";
import { HeroBirthdays } from "./Birthdays";
import { upcomingBirthdays } from "@/lib/holidays-core";
import { getLeadTimes } from "@/lib/holidays";
import { journeyLine } from "../zakaz/journey";
import { heroAcc, heroOf } from "../zakaz/journey-data";
import { greetName, greeting } from "@/lib/first-name";

const STATUS: Record<string, [string, string]> = {
  DRAFT: ["Черновик", ""],
  TEXT_QUEUED: ["Сочиняется", "badge--gold"],
  TEXT_READY: ["Сказка готова — посмотрите", "badge--gold"],
  TEXT_APPROVED: ["Ждёт фото", "badge--gold"],
  PREVIEW_QUEUED: ["Рисуется превью", "badge--gold"],
  PREVIEW_READY: ["Превью готово", ""],
  FULL_QUEUED: ["Рисуется полная книга", "badge--gold"],
  FULL_READY: ["Готова", ""],
  FAILED: ["Ошибка — повторите", "badge--red"],
};

const OPEN_ORDER: OrderStatus[] = ["PENDING_PAYMENT", "AWAITING_CONFIRMATION", "PAID", "IN_PRINT", "PACKED", "SHIPPED"];

export default async function Page() {
  const user = await userOrLogin();
  const [books, heroes, ref, orders] = await Promise.all([
    db.book.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { pages: { where: { index: 0 } }, story: { select: { coverUrl: true } } },
    }),
    db.hero.findMany({ where: { userId: user.id, role: "main", birthDate: { not: null } }, select: { id: true, name: true, gender: true, birthDate: true }, orderBy: { createdAt: "desc" } }),
    cfg("referral"),
    db.order.findMany({
      where: { userId: user.id, status: { in: OPEN_ORDER } },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { bookId: true } }, shipment: true },
    }),
  ]);

  // Только «Как к вам обращаться» (User.firstName): получатель заказа — часто другой человек (бабушка, подруга)
  const name = greetName(user.firstName);
  const paidCount = books.filter((b) => b.paidFull).length;

  // Ближайший повод: дни рождения героев (из «Моих героев» и анкет книг) + поводы прошлых книг
  const bdays = new Map<string, { name: string; nameGen?: string; date: Date }>();
  const gen = (n: string, g?: string | null) => {
    try {
      return declineName(n, "род", g ?? undefined);
    } catch {
      return n;
    }
  };
  for (const h of heroes) bdays.set(normalizeName(h.name), { name: normalizeName(h.name), nameGen: gen(h.name, h.gender), date: h.birthDate! });
  const past: string[] = [];
  for (const b of books) {
    const p = b.params as { hero?: { birthDate?: string }; occasion?: { key?: string } } | null;
    const h = heroOf(b.params);
    if (p?.occasion?.key) past.push(p.occasion.key);
    const bd = p?.hero?.birthDate ? new Date(p.hero.birthDate) : null;
    if (h.name && bd && !isNaN(+bd) && !bdays.has(h.name)) bdays.set(h.name, { name: h.name, nameGen: gen(h.name, h.gender), date: bd });
  }
  const hint = nextOccasion({ birthdays: [...bdays.values()], pastOccasions: past });
  // «Ближайшие дни рождения ваших героев» — сохранённые герои (с id — анкета подставит героя) и герои книг
  const heroIds = new Map(heroes.map((h) => [h.name, h.id]));
  const birthdays = upcomingBirthdays(
    [...bdays.values()].map((b) => ({ id: heroIds.get(b.name), name: b.name, birthDate: b.date })),
    new Date(),
    60,
    await getLeadTimes(),
  );

  // Строка «как идёт заказ» под книгой
  const orderLine = new Map<string, string>();
  for (const o of orders) {
    const bookId = o.items.find((i) => i.bookId)?.bookId;
    if (!bookId || orderLine.has(bookId)) continue;
    const book = books.find((b) => b.id === bookId);
    const line = journeyLine({
      status: o.status,
      whoPrints: o.whoPrints,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      readyDate: o.readyDate,
      bookReadyAt: book?.status === "FULL_READY" ? (book.fullReadyAt ?? o.paidAt) : null,
      heroAcc: book ? heroAcc(book.params) : null,
      shipment: o.shipment,
    });
    if (line) orderLine.set(bookId, `/zakaz/${o.id}|${line}`);
  }

  const link = `https://${process.env.DOMAIN ?? "bookimi.ru"}/?ref=${user.referralCode}`;

  return (
    <>
      <header className="cab-hello">
        <h1>{greeting(name)}</h1>
        <p className="muted">
          {paidCount > 0
            ? "Рады, что вы с нами. Здесь живут ваши книги — их можно читать, скачивать и заказывать в печать."
            : books.length > 0
              ? "Ваши черновики сохранены — можно продолжить с того же места."
              : "Здесь появятся ваши книги. Первая начинается с короткой анкеты — без фото и регистрации."}
        </p>
      </header>

      {hint && (
        <aside className="cab-hint" aria-label="Ближайший повод">
          <span className="cab-hint__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7c-2-4-6-4-6-1.5S10 7 12 7zm0 0c2-4 6-4 6-1.5S14 7 12 7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <b>{hint.title}</b>
            <p>{hint.text}</p>
          </div>
          <Link className="btn btn--gold btn--sm" href={hint.href}>Выбрать сказку</Link>
        </aside>
      )}

      <HeroBirthdays list={birthdays} hrefFor={(b) => `/sozdat?povod=den-rozhdeniya${b.id ? `&geroj=${b.id}` : ""}`} />

      <h2 className="cab-h2">Мои книги</h2>
      {books.length === 0 ? (
        <div className="panel">
          <Link className="btn btn--primary" href="/sozdat">Создать первую книгу</Link>
        </div>
      ) : (
        <div className="shelf">
          {await Promise.all(
            books.map(async (b) => {
              const cover = b.pages[0];
              const key = cover ? (b.paidFull && b.status === "FULL_READY" ? cover.imageKey : cover.previewKey) : null;
              const url = key ? await signedUrl("books", key) : (b.story?.coverUrl ?? null);
              const title = (b.text as { title?: string } | null)?.title ?? "Сказка сочиняется";
              const [label, cls] = STATUS[b.status] ?? [b.status, ""];
              const ol = orderLine.get(b.id)?.split("|");
              const hero = heroOf(b.params).name;
              return (
                <article key={b.id} className="shelf__book">
                  <Link href={b.paidFull ? `/kabinet/kniga/${b.id}` : `/kniga/${b.id}`} className="cover shelf__cover" aria-label={`Открыть «${title}»`}>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" loading="lazy" />
                    ) : (
                      <span className="shelf__blank" aria-hidden="true" />
                    )}
                    {hero && <span className="cover__name shelf__hero">{hero}</span>}
                    <span className="cover__title">{title}</span>
                  </Link>
                  <span className={`badge ${cls}`}>{label}</span>
                  {ol && (
                    <p className="shelf__line small">
                      {ol[1]} <Link href={ol[0]}>Заказ →</Link>
                    </p>
                  )}
                  <div className="row">
                    {b.paidFull ? (
                      <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${b.id}`}>Открыть</Link>
                    ) : (
                      <Link className="btn btn--primary btn--sm" href={b.status === "PREVIEW_READY" ? `/kniga/${b.id}/kupit` : `/kniga/${b.id}`}>
                        {b.status === "PREVIEW_READY" ? "Оформить" : "Продолжить"}
                      </Link>
                    )}
                    {b.paidFull && <Link className="btn btn--ghost btn--sm" href={`/kniga/${b.id}/kupit?pechat=1`}>В печать</Link>}
                  </div>
                </article>
              );
            }),
          )}
          <Link href="/sozdat" className="shelf__add">
            <span aria-hidden="true">+</span>
            Новая книга
          </Link>
        </div>
      )}

      <section className="panel cab-ref" aria-labelledby="ref-h">
        <h2 id="ref-h" className="cab-h2" style={{ marginTop: 0 }}>Приведи друга</h2>
        <p>Друг получит −{ref.newbiePct}% на первую книгу, а вы — промокод −{ref.bonusPct}% за каждого друга, который оплатит заказ.</p>
        <CopyField label="Ваша ссылка" value={link} />
        <p className="small" style={{ margin: "8px 0 0" }}><Link href="/kabinet/drug">Мои приглашения и промокоды →</Link></p>
      </section>
    </>
  );
}
