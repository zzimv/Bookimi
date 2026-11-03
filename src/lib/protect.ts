// Защита от копирования — мягкая (rev 19). Честно: в браузере снимок экрана запретить нельзя (кнопка PrtScn,
// «Ножницы», камера телефона, системные снимки — вне власти страницы). Цель — сделать копирование неудобным, а
// утёкшие снимки — отслеживаемыми, не мешая покупателям и экранным дикторам:
//  • на страницах книги, обложках каталога и иллюстрациях — без контекстного меню «Сохранить картинку» и без
//    перетаскивания картинки (формы, поля и кнопки работают как обычно — их не трогаем);
//  • user-select: none и -webkit-touch-callout: none — в CSS (globals.css, блок rev 19), только на страницах книги и
//    обложках, не на формах;
//  • превью до оплаты и так с водяным знаком и в низком разрешении; к знаку добавлен бледный код сеанса
//    (wmCode: конец id книги + код сеанса + дата) — по снимку можно понять, чья это книга и когда снято;
//  • печать превью — вместо страниц текст «Печать превью недоступна — оформите книгу» (@media print в globals.css);
//  • превью до оплаты ненадолго размывается, пока вкладка скрыта или окно не в фокусе (visibilitychange / blur),
//    и сразу проясняется при возврате (focus, касание или щелчок).
// Чего НЕ делаем (сознательно): не перехватываем и не записываем нажатия клавиш, не блокируем обычные сочетания
// (копирование текста в полях, Tab, стрелки), не мешаем инструментам разработчика, не ломаем диктор
// (alt-тексты и подписи страниц на месте, декор — aria-hidden).
// Без React: вызывается из клиентского компонента сайта (CopyGuard) и из демо-стенда.

/** Что защищаем от меню и перетаскивания: книга в превью, обложки каталога и полок, иллюстрации. */
export const PROTECTED = "[data-book-preview] .bk__book, .bk-cover, .cover, .facecover, .book__cover, [data-protect]";
/** Где ничего не трогаем: поля и формы (вставка, проверка орфографии, меню поля — как обычно). */
const EDITABLE = "input, textarea, select, [contenteditable], form, .bk__panel";

function guarded(t: EventTarget | null): boolean {
  const el = t instanceof Element ? t : null;
  if (!el || el.closest(EDITABLE)) return false;
  return Boolean(el.closest(PROTECTED));
}

let installed = false;
/** Подключить защиту один раз на страницу. Возвращает функцию отключения (для тестов). */
export function installCopyGuard(doc: Document = document): () => void {
  if (installed) return () => {};
  installed = true;
  const win = doc.defaultView ?? window;
  const block = (e: Event) => {
    if (guarded(e.target)) e.preventDefault();
  };
  // Размытие превью до оплаты, пока окно не в фокусе
  const preview = () => doc.querySelector('[data-book-preview][data-paid="0"]');
  const veil = () => {
    if (preview()) doc.documentElement.classList.add("bk-veiled");
  };
  const unveil = () => doc.documentElement.classList.remove("bk-veiled");
  const vis = () => (doc.visibilityState === "hidden" ? veil() : unveil());
  doc.addEventListener("contextmenu", block);
  doc.addEventListener("dragstart", block);
  doc.addEventListener("visibilitychange", vis);
  win.addEventListener("blur", veil);
  win.addEventListener("focus", unveil);
  doc.addEventListener("pointerdown", unveil, { passive: true });
  return () => {
    installed = false;
    unveil();
    doc.removeEventListener("contextmenu", block);
    doc.removeEventListener("dragstart", block);
    doc.removeEventListener("visibilitychange", vis);
    win.removeEventListener("blur", veil);
    win.removeEventListener("focus", unveil);
    doc.removeEventListener("pointerdown", unveil);
  };
}

/** Код сеанса: 4 знака, живёт до закрытия вкладки (sessionStorage); без хранилища — новый на каждую загрузку. */
let mem = "";
export function sessionCode(): string {
  const make = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  try {
    let c = sessionStorage.getItem("bk_wm") ?? "";
    if (!/^[A-Z2-9]{4}$/.test(c)) {
      c = make();
      sessionStorage.setItem("bk_wm", c);
    }
    return c;
  } catch {
    return (mem ||= make());
  }
}

/** Код в водяном знаке превью: «конец id книги · код сеанса · дата» — бледно, для поиска источника утечки. */
export function wmCode(bookId: string, session: string, now = new Date()): string {
  const tail = bookId.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase();
  const d = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getFullYear()).slice(-2)}`;
  return `${tail}·${session}·${d}`;
}
