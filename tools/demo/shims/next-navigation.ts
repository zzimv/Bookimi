// next/navigation для демо: переходы по hash-адресам (см. tools/demo/router.ts).
import { currentPath, currentQuery, NotFoundError, push, RedirectError, refresh, replace } from "../router";

export function useRouter() {
  return { push, replace, refresh, back: () => history.back(), forward: () => history.forward(), prefetch: () => {} };
}
export const usePathname = () => currentPath();
export const useSearchParams = () => new URLSearchParams(currentQuery());
export function notFound(): never {
  throw new NotFoundError("not found");
}
export function redirect(url: string): never {
  throw new RedirectError(url);
}
