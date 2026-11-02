// Яндекс Метрика и 152-ФЗ: где её нет совсем и какие поля маскируются (клиент и сервер, без зависимостей).

/** Страницы с ПДн и личными данными: Метрика не загружается (переход сюда после загрузки — перезагрузка без неё). */
export const METRIKA_OFF = ["/admin", "/kabinet", "/kniga", "/zakaz", "/chek", "/mult", "/vhod", "/otpiska"];

export function metrikaAllowed(pathname: string, host?: string): boolean {
  if (host && /^admin\./i.test(host)) return false;
  return !METRIKA_OFF.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Анкета (/sozdat): весь контент скрыт от Вебвизора — имена, описания, фото. */
export const hideContentPath = (pathname: string) => pathname === "/sozdat" || pathname.startsWith("/sozdat/");

/** Поля ввода: в Вебвизор не попадают нажатия (ym-disable-keys) — во всех input/textarea, кроме кнопок и флажков. */
export const PD_FIELD_SELECTOR = "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=hidden]), textarea, select, [contenteditable=true]";
