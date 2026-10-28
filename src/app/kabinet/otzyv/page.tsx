import { ReviewForm } from "../Forms";

export default function Page() {
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Отзыв о книге</h1>
      <p className="muted">Расскажите, как ребёнок встретил книгу. Нам важна каждая деталь.</p>
      <ReviewForm />
      {process.env.YANDEX_MAPS_REVIEW_URL && (
        <p style={{ marginTop: 16 }}>Будем рады отзыву и на <a href={process.env.YANDEX_MAPS_REVIEW_URL} target="_blank" rel="noopener">Яндекс Картах</a>.</p>
      )}
    </>
  );
}
