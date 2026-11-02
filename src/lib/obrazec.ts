// Ссылка на демо-иллюстрацию /obrazec (см. src/app/obrazec/route.ts). Безопасно для клиента.
export interface SampleOpts {
  slug?: string;
  index?: number;
  style?: string;
  mood?: string;
  kind?: "child" | "teen" | "adult" | "pet";
  gender?: string;
  age?: number;
  hair?: string;
  hairstyle?: string;
  skin?: string;
  glasses?: boolean;
  freckles?: boolean;
  beard?: boolean;
  species?: string;
  fur?: string;
  /** Роли доп. героев; undefined — обязательные по сюжету, [] — никого. */
  extras?: string[];
  wide?: boolean;
  /** Портрет героя без сцены (выбор внешности в анкете). */
  portrait?: boolean;
}

export function sampleUrl(o: SampleOpts) {
  const q = new URLSearchParams();
  const put = (k: string, v: string | number | boolean | undefined) => {
    if (v === undefined || v === "" || v === false) return;
    q.set(k, v === true ? "1" : String(v));
  };
  put("s", o.slug);
  put("i", o.index || undefined);
  put("st", o.style);
  put("m", o.mood && o.mood !== "as-drawn" ? o.mood : undefined);
  put("k", o.kind);
  put("g", o.gender);
  put("a", o.age);
  put("h", o.hair);
  put("hs", o.hairstyle);
  put("sk", o.skin);
  put("gl", o.glasses);
  put("fr", o.freckles);
  put("b", o.beard);
  put("sp", o.species);
  put("fur", o.fur);
  if (o.extras) q.set("x", o.extras.join(","));
  put("w", o.wide);
  put("p", o.portrait);
  return `/obrazec?${q.toString()}`;
}
