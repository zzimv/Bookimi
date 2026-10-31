// Мини-zod для демо-стенда: только то, что использует src/content/answers.ts (≈2 КБ вместо ≈58 КБ).
// Поведение то же для анкеты: trim/max/min/email, default/optional, enum, object (лишние ключи отбрасываются),
// array, preprocess, transform/superRefine с addIssue, pipe. Сервер сайта по-прежнему проверяет настоящим zod.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Issue = { message: string; path: (string | number)[] };
class Fail extends Error {
  constructor(public issues: Issue[]) {
    super(issues[0]?.message ?? "Некорректные данные");
  }
}
const NEVER = Symbol("never") as any;

class Schema {
  constructor(protected run: (v: any, path: (string | number)[]) => any) {}
  _parse(v: any, path: (string | number)[] = []) {
    return this.run(v, path);
  }
  parse(v: any) {
    return this._parse(v);
  }
  safeParse(v: any): { success: true; data: any } | { success: false; error: { issues: Issue[] } } {
    try {
      return { success: true, data: this._parse(v) };
    } catch (e) {
      if (e instanceof Fail) return { success: false, error: { issues: e.issues } };
      throw e;
    }
  }
  optional(): any {
    return new Schema((v, p) => (v === undefined ? undefined : this._parse(v, p)));
  }
  default(d: any): any {
    return new Schema((v, p) => this._parse(v === undefined ? (typeof d === "function" ? d() : structuredClone(d)) : v, p));
  }
  transform(fn: (v: any, ctx: { addIssue: (i: { message: string }) => void }) => any): any {
    return new Schema((v, p) => {
      const issues: Issue[] = [];
      const out = fn(this._parse(v, p), { addIssue: (i) => issues.push({ message: i.message, path: p }) });
      if (issues.length) throw new Fail(issues);
      return out;
    });
  }
  superRefine(fn: (v: any, ctx: { addIssue: (i: { message: string }) => void }) => void): any {
    return new Schema((v, p) => {
      const issues: Issue[] = [];
      const out = this._parse(v, p);
      fn(out, { addIssue: (i) => issues.push({ message: i.message, path: p }) });
      if (issues.length) throw new Fail(issues);
      return out;
    });
  }
  pipe(next: Schema): any {
    return new Schema((v, p) => next._parse(this._parse(v, p), p));
  }
}
const fail = (message: string, path: (string | number)[]): never => {
  throw new Fail([{ message, path }]);
};

class Str extends Schema {
  constructor(private ops: ((v: string, p: (string | number)[]) => string)[] = []) {
    super((v, p) => {
      if (typeof v !== "string") fail("Ожидается строка", p);
      return this.ops.reduce((s, op) => op(s, p), v as string);
    });
  }
  private with(op: (v: string, p: (string | number)[]) => string) {
    return new Str([...this.ops, op]);
  }
  trim() {
    return this.with((s) => s.trim());
  }
  toLowerCase() {
    return this.with((s) => s.toLowerCase());
  }
  max(n: number, m?: string) {
    return this.with((s, p) => (s.length > n ? fail(m ?? `Не больше ${n} символов`, p) : s));
  }
  min(n: number, m?: string) {
    return this.with((s, p) => (s.length < n ? fail(m ?? `Не меньше ${n} символов`, p) : s));
  }
  email(m?: string) {
    return this.with((s, p) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : fail(m ?? "Некорректный email", p)));
  }
  uuid(m?: string) {
    return this.with((s, p) => (/^[0-9a-f-]{36}$/i.test(s) ? s : fail(m ?? "Некорректный id", p)));
  }
}
class Num extends Schema {
  constructor(private ops: ((v: number, p: (string | number)[]) => number)[] = []) {
    super((v, p) => {
      if (typeof v !== "number" || Number.isNaN(v)) fail("Ожидается число", p);
      return this.ops.reduce((s, op) => op(s, p), v as number);
    });
  }
  int() {
    return new Num([...this.ops, (v, p) => (Number.isInteger(v) ? v : fail("Ожидается целое число", p))]);
  }
  min(n: number) {
    return new Num([...this.ops, (v, p) => (v < n ? fail(`Не меньше ${n}`, p) : v)]);
  }
  max(n: number) {
    return new Num([...this.ops, (v, p) => (v > n ? fail(`Не больше ${n}`, p) : v)]);
  }
}
class Arr extends Schema {
  constructor(
    private item: Schema,
    private maxN = Infinity,
  ) {
    super((v, p) => {
      if (!Array.isArray(v)) fail("Ожидается список", p);
      if (v.length > this.maxN) fail(`Не больше ${this.maxN}`, p);
      return v.map((x: any, i: number) => this.item._parse(x, [...p, i]));
    });
  }
  max(n: number) {
    return new Arr(this.item, n);
  }
}

export const z = {
  string: () => new Str(),
  number: () => new Num(),
  boolean: () => new Schema((v, p) => (typeof v === "boolean" ? v : fail("Ожидается да/нет", p))),
  literal: (x: any) => new Schema((v, p) => (v === x ? v : fail("Некорректное значение", p))),
  enum: (xs: readonly string[]) => new Schema((v, p) => (xs.includes(v) ? v : fail("Выберите вариант из списка", p))),
  array: (item: Schema) => new Arr(item),
  object: (shape: Record<string, Schema>) =>
    new Schema((v, p) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) fail("Ожидается объект", p);
      const out: Record<string, any> = {};
      for (const [k, s] of Object.entries(shape)) {
        const r = s._parse(v[k], [...p, k]);
        if (r !== undefined) out[k] = r;
      }
      return out;
    }),
  preprocess: (fn: (v: any) => any, s: Schema) => new Schema((v, p) => s._parse(fn(v), p)),
  NEVER,
  ZodIssueCode: { custom: "custom" },
};
export namespace z {
  export type infer<T> = any;
  export type ZodTypeAny = any;
  export type RefinementCtx = any;
}
export type ZodTypeAny = any;
export default z;
