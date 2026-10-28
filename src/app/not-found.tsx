import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: "var(--fs-2xl)" }}>Такой страницы нет</h1>
        <p className="lead">Возможно, ссылка устарела. Все сказки собраны в каталоге.</p>
        <Link href="/skazki" className="btn btn--primary">
          Открыть каталог
        </Link>
      </div>
    </section>
  );
}
