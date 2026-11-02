import Link from "next/link";

/**
 * Страницы создания книги (анкета, текст, вход, превью, оформление) — без большого подвала, только одна строка
 * со ссылками на оферту и политику (их нужно держать доступными). Подвал прячет CSS: body:has([data-flow-page]) .footer.
 */
export function FlowLegal() {
  return (
    <p className="flow-legal" data-flow-page>
      <Link href="/oferta" target="_blank">Оферта</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/politika" target="_blank">Политика конфиденциальности</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/vozvrat" target="_blank">Возврат</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/kontakty" target="_blank">Контакты</Link>
    </p>
  );
}
