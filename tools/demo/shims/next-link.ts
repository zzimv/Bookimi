// next/link для демо: обычная ссылка; «/путь» превращается в «#/путь» в рантайме (setAttrHook).
import { jsx } from "./react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Link({ href, children, prefetch: _p, replace: _r, scroll: _s, ...rest }: any) {
  return jsx("a", { href: typeof href === "string" ? href : String(href?.pathname ?? "/"), ...rest, children });
}
