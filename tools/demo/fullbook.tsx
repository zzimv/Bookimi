// «Показать всю книгу (для админа)» — демо rev 10: на превью покупатель видит обложку и 2 разворота, а админу нужна
// вся сказка — обложка, 12 разворотов (демо-иллюстрации с водяным знаком) и полный текст. Кнопка видна в режиме
// админа (переключатель в полосе демо) и в админке → заказ. Сворачивается: «мы не всегда будем всё смотреть».
import { useState } from "react";
import { SpreadText } from "../../src/components/SpreadText";
import { dedicationText } from "../../src/lib/gen/text";
import { pageUrl, type DBook } from "./api";

export function DemoFullBook({ book, label = "Показать всю книгу (для админа)", startOpen = false }: { book: DBook; label?: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  if (!book.text) return null;
  const ded = dedicationText(book.params);
  return (
    <section className="wrap full-book" data-full-book={book.id} aria-label="Вся книга для админа">
      <button type="button" className="btn btn--ghost full-book__toggle" aria-expanded={open} data-full-book-toggle onClick={() => setOpen(!open)}>
        <span className="badge">админ</span> {open ? "Свернуть книгу" : label}
      </button>
      {open && (
        <div className="full-book__body">
          <p className="small muted">Обложка и 12 разворотов с водяным знаком (в демо — демо-иллюстрации) и весь текст. Покупатель до оплаты видит только обложку и 2 разворота.</p>
          <h2 className="full-book__title">{book.text.title}</h2>
          {ded && <p className="dedication" style={{ whiteSpace: "pre-line" }}>{ded}</p>}
          <ol className="full-book__pages">
            {Array.from({ length: 13 }, (_, i) => (
              <li key={i} data-full-page={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageUrl(book, i, { full: false })} alt={i === 0 ? "Обложка" : `Разворот ${i}`} loading="lazy" />
                <div className="full-book__text">
                  <b>{i === 0 ? "Обложка" : `Разворот ${i}`}</b>
                  {i > 0 && <p><SpreadText text={book.text!.spreads[i - 1]?.text ?? ""} /></p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
