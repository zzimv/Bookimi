/** Небольшой LRU-кэш в памяти процесса со сроком жизни записи (подсказки городов, списки ПВЗ). */
export class Lru<V> {
  private m = new Map<string, { v: V; exp: number }>();
  constructor(
    private max: number,
    private ttlMs: number,
  ) {}
  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.m.delete(k);
      return undefined;
    }
    this.m.delete(k);
    this.m.set(k, e); // свежий — в конец
    return e.v;
  }
  set(k: string, v: V) {
    this.m.delete(k);
    this.m.set(k, { v, exp: Date.now() + this.ttlMs });
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
  }
  get size() {
    return this.m.size;
  }
  /** Значение из кэша или посчитать; одновременные запросы одного ключа ждут один промис. */
  async wrap(k: string, fn: () => Promise<V>): Promise<V> {
    const hit = this.get(k);
    if (hit !== undefined) return hit;
    const p = this.pending.get(k);
    if (p) return p;
    const run = fn()
      .then((v) => {
        this.set(k, v);
        return v;
      })
      .finally(() => this.pending.delete(k));
    this.pending.set(k, run);
    return run;
  }
  private pending = new Map<string, Promise<V>>();
}
