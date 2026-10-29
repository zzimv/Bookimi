// Мини-рантайм вместо React для демо-стенда (несколько килобайт вместо ~190 КБ react-dom).
// JSX → HTML-строка; асинхронные серверные компоненты ждём; хуки useState/useEffect/useRef/useMemo/
// useCallback/useId; обновление — морфинг DOM (поле ввода не теряет фокус); события — делегированием.
// Серверные (async) компоненты, как в Next, рендерятся один раз на переход — до router.refresh().
/* eslint-disable @typescript-eslint/no-explicit-any */

export const Fragment = Symbol.for("demo.fragment");
export interface VNode {
  $$v: 1;
  type: any;
  props: any;
  key: any;
}
export type ReactNode = any;

export function jsx(type: any, props: any, key?: any): VNode {
  return { $$v: 1, type, props: props ?? {}, key: key ?? props?.key ?? null };
}
export const jsxs = jsx;
export const jsxDEV = jsx;
export function createElement(type: any, props: any, ...children: any[]) {
  const p = { ...(props ?? {}) };
  if (children.length) p.children = children.length === 1 ? children[0] : children;
  return jsx(type, p);
}

// ───────── хуки ─────────
interface Hook {
  v?: any;
  set?: (x: any) => void;
  deps?: any[];
  cleanup?: any;
  eff?: boolean;
  current?: any;
}
interface Inst {
  hooks: Hook[];
  seen: number;
  /** Кэш серверного (async) компонента на текущий переход. */
  server?: { props: any; out: any };
}
const insts = new Map<string, Inst>();
let cur: Inst | null = null;
let hi = 0;
let effectsQ: (() => void)[] = [];
let gen = 0;
let idc = 0;
let scheduler: () => void = () => {};
export function setScheduler(fn: () => void) {
  scheduler = fn;
}

function inst(): Inst {
  if (!cur) throw new Error("хук вызван вне компонента");
  return cur;
}
const changed = (a?: any[], b?: any[]) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

export function useState<T>(init: T | (() => T)): [T, (v: T | ((p: T) => T)) => void] {
  const i = hi++;
  const c = inst();
  let h = c.hooks[i];
  if (!h) {
    h = c.hooks[i] = { v: typeof init === "function" ? (init as () => T)() : init };
    const hook = h;
    hook.set = (nv: any) => {
      const v = typeof nv === "function" ? nv(hook.v) : nv;
      if (!Object.is(v, hook.v)) {
        hook.v = v;
        scheduler();
      }
    };
  }
  return [h.v, h.set!];
}
export function useRef<T>(init: T): { current: T } {
  const i = hi++;
  const c = inst();
  return (c.hooks[i] ??= { current: init }) as { current: T };
}
export function useMemo<T>(fn: () => T, deps: any[]): T {
  const i = hi++;
  const c = inst();
  const h = c.hooks[i];
  if (h && !changed(h.deps, deps)) return h.v;
  const v = fn();
  c.hooks[i] = { v, deps };
  return v;
}
export const useCallback = <T>(fn: T, deps: any[]): T => useMemo(() => fn, deps);
export function useId() {
  const i = hi++;
  const c = inst();
  return (c.hooks[i] ??= { v: `r${(idc++).toString(36)}` }).v as string;
}
export function useEffect(fn: () => any, deps?: any[]) {
  const i = hi++;
  const c = inst();
  const h = (c.hooks[i] ??= { eff: true });
  if (deps === undefined || changed(h.deps, deps)) {
    h.deps = deps ?? undefined;
    effectsQ.push(() => {
      if (typeof h.cleanup === "function") h.cleanup();
      h.cleanup = fn();
    });
  }
}
export const useLayoutEffect = useEffect;
export function useTransition(): [boolean, (f: () => void) => void] {
  return [false, (f) => f()];
}
const React = { createElement, Fragment, useState, useEffect, useRef, useMemo, useCallback, useId, useLayoutEffect };
export default React;

// ───────── HTML ─────────
const VOID = new Set("area base br col embed hr img input link meta source track wbr".split(" "));
const BOOL = new Set(["disabled", "checked", "selected", "hidden", "open", "required", "multiple", "readonly", "autofocus", "novalidate", "controls", "defer", "async", "playsinline", "muted"]);
const ATTR: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  readOnly: "readonly",
  noValidate: "novalidate",
  autoComplete: "autocomplete",
  inputMode: "inputmode",
  maxLength: "maxlength",
  minLength: "minlength",
  tabIndex: "tabindex",
  autoFocus: "autofocus",
  spellCheck: "spellcheck",
  crossOrigin: "crossorigin",
  encType: "enctype",
  dateTime: "datetime",
  colSpan: "colspan",
  rowSpan: "rowspan",
  enterKeyHint: "enterkeyhint",
};
const KEEP = new Set(["viewBox", "preserveAspectRatio", "gradientUnits", "gradientTransform", "patternUnits", "stdDeviation", "baseFrequency", "numOctaves", "pathLength", "clipPathUnits", "maskUnits", "filterUnits"]);
const UNITLESS = new Set(["opacity", "zIndex", "fontWeight", "lineHeight", "flex", "flexGrow", "flexShrink", "order", "zoom", "gridRow", "gridColumn", "aspectRatio"]);

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
function attrName(k: string) {
  if (ATTR[k]) return ATTR[k];
  if (k.startsWith("aria-") || k.startsWith("data-") || KEEP.has(k)) return k;
  return /[A-Z]/.test(k) ? kebab(k) : k;
}
function styleStr(o: Record<string, any>) {
  return Object.entries(o)
    .filter(([, v]) => v != null && v !== false && v !== "")
    .map(([k, v]) => `${k.startsWith("--") ? k : kebab(k)}:${typeof v === "number" && v !== 0 && !UNITLESS.has(k) ? `${v}px` : v}`)
    .join(";");
}
function evType(tag: string, k: string, props: any) {
  const n = k.slice(2).toLowerCase();
  if (n === "change") {
    const t = String(props.type ?? "").toLowerCase();
    return tag === "select" || t === "checkbox" || t === "radio" || t === "file" ? "change" : "input";
  }
  if (n === "focus") return "focusin";
  if (n === "blur") return "focusout";
  if (n === "doubleclick") return "dblclick";
  return n;
}

/** Хук для атрибутов: ссылки «/путь» → «#/путь», картинки /obrazec → готовые SVG и т. п. */
let attrHook: (tag: string, name: string, value: string) => string = (_t, _n, v) => v;
export function setAttrHook(fn: typeof attrHook) {
  attrHook = fn;
}

interface Ctx {
  h: ((e: Event) => void)[];
  refs: any[];
  sel: any[];
}

/** Ошибка серверного компонента (notFound/redirect) → что показать вместо него. */
let serverError: (e: unknown) => any = (e) => {
  throw e;
};
export function setServerErrorHandler(fn: typeof serverError) {
  serverError = fn;
}

const isAsync = (f: any) => f?.constructor?.name === "AsyncFunction";

async function node(n: any, path: string, ctx: Ctx): Promise<string> {
  if (n == null || n === false || n === true) return "";
  if (typeof n === "string") return esc(n);
  if (typeof n === "number") return String(n);
  if (n instanceof Promise) return node(await n, path, ctx);
  if (Array.isArray(n)) {
    let s = "";
    for (let i = 0; i < n.length; i++) s += await node(n[i], `${path}.${n[i]?.key ?? i}`, ctx);
    return s;
  }
  if (!n.$$v) return esc(String(n));
  const { type, props } = n as VNode;
  if (type === Fragment) return node(props.children, path, ctx);
  if (typeof type === "function") {
    const key = `${path}:${type.name || "C"}`;
    let c = insts.get(key);
    if (!c) insts.set(key, (c = { hooks: [], seen: gen }));
    c.seen = gen;
    let out: any;
    if (isAsync(type)) {
      // Серверный компонент: один раз на переход (как запрос к Next), пропсы-примитивы сравниваем
      if (!c.server) {
        let r: any;
        try {
          r = await type(props);
        } catch (e) {
          r = serverError(e);
        }
        c.server = { props, out: r };
      }
      out = c.server.out;
    } else {
      const prev = cur;
      const prevHi = hi;
      cur = c;
      hi = 0;
      try {
        out = type(props);
      } finally {
        cur = prev;
        hi = prevHi;
      }
      if (out instanceof Promise) out = await out;
    }
    return node(out, key, ctx);
  }
  if (typeof type !== "string") return "";
  return element(type, props, path, ctx);
}

async function element(tag: string, props: any, path: string, ctx: Ctx): Promise<string> {
  let s = `<${tag}`;
  let inner: string | null = null;
  let children = props.children;
  let selValue: any;
  let controlled = false;
  for (let k in props) {
    let v = props[k];
    if (k === "children" || k === "key" || k === "suppressHydrationWarning") continue;
    if (k === "dangerouslySetInnerHTML") {
      inner = v?.__html ?? "";
      continue;
    }
    if (k === "ref") {
      if (v) s += ` data-ref="${ctx.refs.push(v) - 1}"`;
      continue;
    }
    if (/^on[A-Z]/.test(k)) {
      if (typeof v === "function") s += ` data-on-${evType(tag, k, props)}="${ctx.h.push(v) - 1}"`;
      continue;
    }
    if (tag === "textarea" && (k === "value" || k === "defaultValue")) {
      children = v ?? "";
      if (k === "value") controlled = true;
      continue;
    }
    if (tag === "select" && (k === "value" || k === "defaultValue")) {
      selValue = v;
      if (k === "value") controlled = true;
      continue;
    }
    if (tag === "input" && (k === "value" || k === "checked")) controlled = true;
    if (k === "defaultValue") k = "value";
    if (k === "defaultChecked") k = "checked";
    if (k === "style" && v && typeof v === "object") v = styleStr(v);
    if (v == null || (v === false && !k.startsWith("aria-"))) continue;
    const name = attrName(k);
    if (v === true && BOOL.has(name)) {
      s += ` ${name}`;
      continue;
    }
    s += ` ${name}="${esc(attrHook(tag, name, String(v)))}"`;
  }
  if (tag === "option" && ctx.sel.length) {
    const sv = ctx.sel[ctx.sel.length - 1];
    if (sv !== undefined && String(props.value ?? "") === String(sv)) s += " selected";
  }
  if (controlled) s += ` data-ctl=""`;
  s += ">";
  if (VOID.has(tag)) return s;
  if (inner !== null) s += inner;
  else {
    if (tag === "select") ctx.sel.push(selValue);
    s += await node(children, `${path}/${tag}`, ctx);
    if (tag === "select") ctx.sel.pop();
  }
  return `${s}</${tag}>`;
}

// ───────── морфинг DOM ─────────
const same = (a: Node, b: Node) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && (a.nodeType !== 1 || (a as Element).getAttribute("data-k") === (b as Element).getAttribute("data-k"));

function morphAttrs(f: Element, t: Element) {
  for (const a of Array.from(t.attributes)) if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
  for (const a of Array.from(f.attributes)) {
    if (t.hasAttribute(a.name)) continue;
    if (a.name === "open" && f.nodeName === "DETAILS") continue; // раскрытие — за пользователем, как в React
    f.removeAttribute(a.name);
  }
}

function morphNode(f: Node, t: Node) {
  if (f.nodeType !== 1) {
    if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue;
    return;
  }
  const fe = f as HTMLElement;
  const te = t as HTMLElement;
  morphAttrs(fe, te);
  const ctl = te.hasAttribute("data-ctl");
  if (fe instanceof HTMLTextAreaElement) {
    if (ctl && fe.value !== te.textContent) fe.value = te.textContent ?? "";
    else if (!ctl && fe.defaultValue !== te.textContent) fe.defaultValue = te.textContent ?? "";
    return;
  }
  morphChildren(fe, te);
  if (fe instanceof HTMLInputElement && ctl && fe.type !== "file") {
    if (fe.type === "checkbox" || fe.type === "radio") fe.checked = te.hasAttribute("checked");
    else {
      const v = te.getAttribute("value") ?? "";
      if (fe.value !== v) fe.value = v;
    }
  }
  if (fe instanceof HTMLSelectElement && ctl) {
    const o = Array.from(te.querySelectorAll("option")).find((x) => x.hasAttribute("selected"));
    if (o) fe.value = o.getAttribute("value") ?? o.textContent ?? "";
  }
}

function morphChildren(fp: Node, tp: Node) {
  let f = fp.firstChild;
  let t = tp.firstChild;
  while (t) {
    const next = t.nextSibling;
    if (!f) fp.appendChild(t);
    else if (same(f, t)) {
      morphNode(f, t);
      f = f.nextSibling;
    } else {
      const nf = f.nextSibling;
      fp.replaceChild(t, f);
      f = nf;
    }
    t = next;
  }
  while (f) {
    const n = f.nextSibling;
    fp.removeChild(f);
    f = n;
  }
}

// ───────── корень ─────────
const EVENTS = ["click", "input", "change", "submit", "focusin", "focusout", "keydown"];

export function createRoot(container: HTMLElement, view: () => any, after?: () => void) {
  let ctx: Ctx = { h: [], refs: [], sel: [] };
  let busy = false;
  let again = false;
  let first = true;

  for (const type of EVENTS) {
    container.addEventListener(type, (e) => {
      let el = e.target as HTMLElement | null;
      while (el && el !== container.parentElement) {
        const id = el.getAttribute?.(`data-on-${type}`);
        if (id != null) {
          const fn = ctx.h[Number(id)];
          if (fn) fn(e);
          if ((e as Event & { cancelBubble: boolean }).cancelBubble) break;
        }
        el = el.parentElement;
      }
    });
  }

  async function render() {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    try {
      do {
        again = false;
        gen++;
        effectsQ = [];
        const next: Ctx = { h: [], refs: [], sel: [] };
        const html = await node(view(), "r", next);
        const tpl = document.createElement("template");
        tpl.innerHTML = html;
        if (first) {
          container.replaceChildren(tpl.content);
          first = false;
        } else morphChildren(container, tpl.content);
        ctx = next;
        container.querySelectorAll("[data-ref]").forEach((el) => {
          const r = ctx.refs[Number(el.getAttribute("data-ref"))];
          if (typeof r === "function") r(el);
          else if (r) r.current = el;
        });
        // Ушедшие со страницы компоненты: убираем эффекты
        for (const [k, c] of insts) {
          if (c.seen === gen) continue;
          for (const h of c.hooks) if (h?.eff && typeof h.cleanup === "function") h.cleanup();
          insts.delete(k);
        }
        const q = effectsQ;
        effectsQ = [];
        for (const f of q) {
          try {
            f();
          } catch (e) {
            console.error(e);
          }
        }
        after?.();
      } while (again);
    } finally {
      busy = false;
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      render().catch((e) => console.error(e));
    });
  };
  return {
    render,
    schedule,
    /** Новый «запрос»: серверные компоненты отрисуются заново. */
    refresh() {
      for (const c of insts.values()) delete c.server;
      schedule();
    },
    /** Переход на другую страницу: все компоненты — с нуля. */
    reset() {
      for (const c of insts.values()) for (const h of c.hooks) if (h?.eff && typeof h.cleanup === "function") h.cleanup();
      insts.clear();
    },
  };
}

/** Отрисовать дерево в строку (без хуков-состояния между вызовами) — для графиков и разметки. */
export async function renderToString(v: any) {
  return node(v, `s${Math.random()}`, { h: [], refs: [], sel: [] });
}
