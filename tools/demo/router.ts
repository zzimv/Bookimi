// Маршрутизатор демо-стенда: адреса сайта живут в hash (#/skazki?dlya=detyam) — работает и с file://.
type Hooks = { refresh: () => void };
let hooks: Hooks = { refresh: () => {} };
export function bindRouter(h: Hooks) {
  hooks = h;
}

export function currentUrl(): string {
  const h = location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}
export function currentPath(): string {
  return currentUrl().split("?")[0];
}
export function currentQuery(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(currentUrl().split("?")[1] ?? ""));
}

/** Адрес сайта → адрес демо. Внешние ссылки и якоря не трогаем. */
export function demoHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") ? `#${href}` : href;
}

export function push(url: string) {
  if (!url.startsWith("/")) {
    location.href = url;
    return;
  }
  if (currentUrl() === url) hooks.refresh();
  else location.hash = url;
}
export function replace(url: string) {
  history.replaceState(null, "", `#${url}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
export function refresh() {
  hooks.refresh();
}

/** Ошибки «страницы нет» и «перейти на другой адрес» — как notFound()/redirect() в Next. */
export class NotFoundError extends Error {}
export class RedirectError extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
