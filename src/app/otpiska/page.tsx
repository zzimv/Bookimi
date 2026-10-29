import { unsubscribeUser } from "@/lib/unsubscribe";
import { unsubscribeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Отписка", robots: { index: false } };

// Отписка из письма: ссылка открывает страницу с кнопкой (GET ничего не меняет), отписка — по нажатию.
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  if (done === "ok" || done === "already") {
    return (
      <div className="flow" style={{ maxWidth: 520 }}>
        <h1>Вы отписались</h1>
        <p>Больше не будем присылать новости и скидки. Сообщения о ваших заказах продолжат приходить.</p>
      </div>
    );
  }
  const valid = Boolean(unsubscribeUser(t)) && done !== "bad";
  return (
    <div className="flow" style={{ maxWidth: 520 }}>
      <h1>{valid ? "Отписаться от рассылки?" : "Ссылка устарела"}</h1>
      {valid ? (
        <form action={unsubscribeAction}>
          <input type="hidden" name="t" value={t} />
          <p>Перестанем присылать новости, идеи к праздникам и скидки. Сообщения о заказах останутся.</p>
          <button className="btn btn--primary">Отписаться</button>
        </form>
      ) : (
        <p>Отписаться можно в личном кабинете, в разделе «Уведомления».</p>
      )}
    </div>
  );
}
