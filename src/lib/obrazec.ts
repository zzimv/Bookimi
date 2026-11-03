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
  /**
   * Доп. герои с внешностью (rev 14): роль, пол, вид питомца и выбор картинками — по ним рисуются мама, бабушка,
   * дедушка, кошка… (раньше передавались только роли, и все взрослые выходили одним мужчиной, кошка — собакой).
   * Если задано — вместо extras.
   */
  extraLooks?: SampleExtra[];
  /** rev 14: цвет глаз, улыбка, румянец, цвет одежды (OUTFIT_COLORS). */
  eyes?: string;
  smile?: string;
  blush?: boolean;
  outfit?: string;
  /** rev 15: вид одежды ребёнка (KID_OUTFITS): «платье», «худи с джинсами»… */
  clothes?: string;
  /** rev 16: ямочки, щербинка, украшение для волос и его цвет, головной убор, рост (src/content/looks.ts). */
  dimples?: boolean;
  toothGap?: boolean;
  hairAcc?: string;
  hairAccColor?: string;
  hat?: string;
  build?: string;
  /** rev 17: сложение — «тоненький» | «плотненький» (KID_BODIES). */
  body?: string;
  /** Водяной знак превью (эскизы страниц до оплаты). */
  wm?: boolean;
  /** Крупно лицо (true) или по пояс ("bust") — к portrait / extraPortrait. */
  face?: boolean | "bust";
  /** Портрет доп. героя по роли (выбор его внешности картинками): берётся первый из extraLooks. */
  extraPortrait?: boolean;
  wide?: boolean;
  /** Портрет героя без сцены (выбор внешности в анкете). */
  portrait?: boolean;
}

/** Доп. герой для образца: роль и то, что видно на картинке. */
export interface SampleExtra {
  role: string;
  gender?: string;
  species?: string;
  what?: string;
  look?: { hair?: string; hairstyle?: string; skin?: string; glasses?: boolean; beard?: boolean; moustache?: boolean; fur?: string; toy?: string };
}

/** Короткие ключи внешности доп. героя в ссылке: x1=g:girl;h:седые;gl:1 */
const EXTRA_KEYS = { gender: "g", species: "sp", what: "w", hair: "h", hairstyle: "hs", skin: "sk", glasses: "gl", beard: "b", moustache: "mu", fur: "fur", toy: "t" } as const;

/** Внешность доп. героя → значение параметра xN (пусто — нечего передавать). */
export function encodeSampleExtra(e: SampleExtra): string {
  const all: Record<string, string | boolean | undefined> = { gender: e.gender, species: e.species, what: e.what, ...e.look };
  return Object.entries(EXTRA_KEYS)
    .map(([k, short]) => {
      const v = all[k];
      if (v === undefined || v === "") return "";
      return `${short}:${v === true ? "1" : v === false ? "0" : String(v).replace(/[;:]/g, " ").slice(0, 40)}`;
    })
    .filter(Boolean)
    .join(";");
}

/** Обратно: xN → поля (без проверки по белым спискам — это делает маршрут). */
export function decodeSampleExtra(role: string, v: string | null): SampleExtra {
  const out: SampleExtra = { role, look: {} };
  for (const part of (v ?? "").split(";")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const short = part.slice(0, i);
    const val = part.slice(i + 1);
    const key = (Object.keys(EXTRA_KEYS) as (keyof typeof EXTRA_KEYS)[]).find((k) => EXTRA_KEYS[k] === short);
    if (!key) continue;
    if (key === "gender" || key === "species" || key === "what") out[key] = val;
    else if (key === "glasses" || key === "beard" || key === "moustache") out.look![key] = val === "1";
    else out.look![key] = val;
  }
  return out;
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
  put("ey", o.eyes);
  put("sm", o.smile);
  put("bl", o.blush);
  put("oc", o.outfit);
  put("ot", o.clothes);
  put("dm", o.dimples);
  put("tg", o.toothGap);
  put("ha", o.hairAcc);
  put("hac", o.hairAccColor);
  put("hat", o.hat);
  put("bd", o.build);
  put("bo", o.body);
  if (o.extraLooks) {
    q.set("x", o.extraLooks.map((e) => e.role).join(","));
    o.extraLooks.slice(0, 3).forEach((e, i) => put(`x${i + 1}`, encodeSampleExtra(e)));
  } else if (o.extras) q.set("x", o.extras.join(","));
  put("wm", o.wm);
  put("f", o.face === "bust" ? 2 : o.face);
  if (o.extraPortrait && o.extraLooks?.[0]) q.set("pr", o.extraLooks[0].role);
  put("w", o.wide);
  put("p", o.portrait);
  return `/obrazec?${q.toString()}`;
}
