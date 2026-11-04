// «Моя книга» (rev 20): последняя книга этого браузера — кнопка в шапке ведёт обратно к превью с любой страницы.
// Только удобство (localStorage, без сервера); пусто или недоступно — кнопки нет. Модуль безопасен для клиента и демо.
export const MY_BOOK_KEY = "bookimi.myBook";
export interface MyBook {
  id: string;
  title: string;
  at: number;
}

export function rememberBook(id: string, title: string) {
  try {
    localStorage.setItem(MY_BOOK_KEY, JSON.stringify({ id, title, at: Date.now() } satisfies MyBook));
    window.dispatchEvent(new Event("bookimi:mybook"));
  } catch {}
}

export function readMyBook(): MyBook | null {
  try {
    const v = JSON.parse(localStorage.getItem(MY_BOOK_KEY) ?? "null") as MyBook | null;
    return v && typeof v.id === "string" && /^[0-9a-f-]{36}$/.test(v.id) ? v : null;
  } catch {
    return null;
  }
}

export function forgetBook(id?: string) {
  try {
    if (!id || readMyBook()?.id === id) localStorage.removeItem(MY_BOOK_KEY);
  } catch {}
}
