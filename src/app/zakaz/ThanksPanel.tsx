// Панель «спасибо» сразу после оплаты: на /zakaz/[id] и в PayBox, когда оплата прошла.
// Без серверных зависимостей — используется и в клиентском компоненте.
import Link from "next/link";
import "./journey.css";

export function ThanksPanel({ heroAcc, print, bookId, firstOrder = false, ready = false }: { heroAcc?: string | null; print: boolean; bookId?: string | null; firstOrder?: boolean; ready?: boolean }) {
  return (
    <section className="thanks" aria-labelledby="thanks-title">
      <div className="thanks__mark" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="48" height="48"><path d="M24 41s-15-8.6-15-20a8.5 8.5 0 0 1 15-5.5A8.5 8.5 0 0 1 39 21c0 11.4-15 20-15 20z" fill="currentColor" /></svg>
      </div>
      <div>
        <h2 id="thanks-title">Спасибо! Оплата получена</h2>
        <p>
          {firstOrder ? "Рады, что вы доверили нам свою первую книгу. " : "Рады, что вы снова с нами. "}
          {ready ? (
            <>Книга{heroAcc ? ` про ${heroAcc}` : ""} уже готова — её можно открыть в кабинете.{print ? " Печатную версию передадим в типографию и пришлём трек-номер." : ""}</>
          ) : (
            <>
              Мы уже рисуем книгу{heroAcc ? ` про ${heroAcc}` : ""} — обычно это меньше часа.
              {print ? " Потом проверим макет и передадим его в типографию." : " Как только она будет готова, пришлём сообщение."}
            </>
          )}
        </p>
        <ul className="thanks__next">
          <li>Чек из «Мой налог» придёт на почту или в мессенджер.</li>
          <li>{print ? "Трек-номер пришлём, когда книга поедет к вам." : ready ? "PDF, читалка и файлы для печати — в кабинете." : "PDF, читалка и файлы для печати появятся в кабинете."}</li>
        </ul>
        <div className="row">
          {bookId && <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${bookId}`}>Открыть книгу в кабинете</Link>}
          <Link className="btn btn--ghost btn--sm" href="/kabinet/drug">Подарить друзьям скидку</Link>
        </div>
      </div>
    </section>
  );
}
