import type { Metadata } from "next";
import Link from "next/link";

// Квиз создания книги — шаг 4 «Порядка работы» (фото и ПДн, ждёт подтверждения владельца).
export const metadata: Metadata = { title: "Создать книгу", robots: { index: false } };

export default function Page() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>Создание книги скоро откроется</h1>
        <p className="lead">
          Мы готовим квиз: 7 коротких шагов, фото ребёнка и бесплатное превью за 2–5 минут.
        </p>
        <Link href="/skazki" className="btn btn--primary">
          Посмотреть сказки
        </Link>
      </div>
    </section>
  );
}
