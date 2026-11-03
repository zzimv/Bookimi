// Причёски и одежда ребёнка (rev 15): у мальчиков и девочек свои наборы по 6 вариантов, никогда не смешиваются.
// Модуль общий для анкеты (браузер), маршрута /obrazec, рисовальщика (art/kids.ts) и конвейера книги.
// Хранение в ответах обратно совместимо: appearance.hairstyle — ключ причёски, appearance.clothes — ключ одежды;
// старые значения («длинные», «кудряшки», «футболка», «свитер»…) переводятся в новые по полу (normalize*).

export type KidGender = "boy" | "girl";

/** Как рисовать причёску (drawChild). */
export type KidHairCut = "short" | "spiky" | "fringe" | "curly" | "wavy" | "cap" | "pigtails" | "braids" | "ponytail" | "bob" | "long" | "curlyLong";

export const KID_HAIRSTYLES: Record<KidGender, readonly { key: string; cut: KidHairCut }[]> = {
  boy: [
    { key: "короткая стрижка", cut: "short" },
    { key: "ёжик", cut: "spiky" },
    { key: "с чёлкой", cut: "fringe" },
    { key: "кудрявые", cut: "curly" },
    { key: "волнистые до ушей", cut: "wavy" },
    { key: "шапочка", cut: "cap" },
  ],
  girl: [
    { key: "два хвостика", cut: "pigtails" },
    { key: "косички", cut: "braids" },
    { key: "хвост", cut: "ponytail" },
    { key: "каре", cut: "bob" },
    { key: "длинные распущенные", cut: "long" },
    { key: "длинные кудри", cut: "curlyLong" },
  ],
};
export const KID_HAIRSTYLE_KEYS: Record<KidGender, string[]> = {
  boy: KID_HAIRSTYLES.boy.map((x) => x.key),
  girl: KID_HAIRSTYLES.girl.map((x) => x.key),
};
export const KID_HAIRSTYLE_DEFAULT: Record<KidGender, string> = { boy: "короткая стрижка", girl: "длинные распущенные" };

/** Вид одежды: что рисовать. Цвет — отдельно (appearance.outfitColor → OUTFIT_COLORS). */
export type KidOutfitKind = "tee-shorts" | "sweater-pants" | "shirt-pants" | "overalls" | "hoodie-jeans" | "tracksuit" | "dress" | "sarafan" | "skirt-cardigan" | "sweater-jeans";

export const KID_OUTFITS: Record<KidGender, readonly { key: string; kind: KidOutfitKind }[]> = {
  boy: [
    { key: "футболка с шортами", kind: "tee-shorts" },
    { key: "свитер с брюками", kind: "sweater-pants" },
    { key: "рубашка с брюками", kind: "shirt-pants" },
    { key: "комбинезон", kind: "overalls" },
    { key: "худи с джинсами", kind: "hoodie-jeans" },
    { key: "спортивный костюм", kind: "tracksuit" },
  ],
  girl: [
    { key: "платье", kind: "dress" },
    { key: "сарафан", kind: "sarafan" },
    { key: "юбка с кофтой", kind: "skirt-cardigan" },
    { key: "комбинезон", kind: "overalls" },
    { key: "свитер с джинсами", kind: "sweater-jeans" },
    { key: "спортивный костюм", kind: "tracksuit" },
  ],
};
export const KID_OUTFIT_KEYS: Record<KidGender, string[]> = {
  boy: KID_OUTFITS.boy.map((x) => x.key),
  girl: KID_OUTFITS.girl.map((x) => x.key),
};
export const KID_OUTFIT_DEFAULT: Record<KidGender, string> = { boy: "свитер с брюками", girl: "платье" };

const kg = (g: string | undefined): KidGender => (g === "girl" ? "girl" : "boy");

/** Причёска ребёнка по полу: ключ своего набора; старое значение или чужой ключ → ближайший свой, иначе по умолчанию. */
export function normalizeKidHairstyle(value: string | undefined | null, gender: string | undefined): string {
  const g = kg(gender);
  const v = (value ?? "").trim().toLowerCase();
  if (KID_HAIRSTYLE_KEYS[g].includes(v)) return v;
  if (!v) return KID_HAIRSTYLE_DEFAULT[g];
  if (g === "boy") {
    if (/[её]жик|машинк|налыс|наголо|buzz|spik/.test(v)) return "ёжик";
    if (/шапоч|горшок|каре|боб|bowl/.test(v)) return "шапочка";
    if (/волнист|до ушей|длинн|распущ|wav/.test(v)) return "волнистые до ушей";
    if (/кудр|кучеряв|завит|локон|афро|curl/.test(v)) return "кудрявые";
    if (/ч[её]лк|fringe|bang/.test(v)) return "с чёлкой";
    return KID_HAIRSTYLE_DEFAULT.boy;
  }
  if (/два|хвостики|pigtail/.test(v)) return "два хвостика";
  if (/кос[аиыу]|косич|braid/.test(v)) return "косички";
  if (/хвост|pony|пуч|гульк|bun/.test(v)) return "хвост";
  if (/кудр|кучеряв|завит|локон|афро|curl/.test(v)) return "длинные кудри";
  if (/каре|боб|шапоч|коротк|ч[её]лк|до ушей|bob/.test(v)) return "каре";
  return KID_HAIRSTYLE_DEFAULT.girl;
}

/** Одежда ребёнка по полу (старые «футболка», «свитер», «толстовка с капюшоном» → свои наборы). */
export function normalizeKidOutfit(value: string | undefined | null, gender: string | undefined): string {
  const g = kg(gender);
  const v = (value ?? "").trim().toLowerCase();
  if (KID_OUTFIT_KEYS[g].includes(v)) return v;
  if (!v) return KID_OUTFIT_DEFAULT[g];
  if (/комбинез/.test(v)) return "комбинезон";
  if (/спорт/.test(v)) return "спортивный костюм";
  if (g === "boy") {
    if (/худи|толстовк|капюш/.test(v)) return "худи с джинсами";
    if (/рубаш/.test(v)) return "рубашка с брюками";
    if (/футбол|шорт/.test(v)) return "футболка с шортами";
    return KID_OUTFIT_DEFAULT.boy;
  }
  if (/сарафан/.test(v)) return "сарафан";
  if (/юбк|кофт/.test(v)) return "юбка с кофтой";
  if (/свитер|джинс|худи|толстовк/.test(v)) return "свитер с джинсами";
  return KID_OUTFIT_DEFAULT.girl;
}

/** Как рисовать: причёска по ключу (после normalizeKidHairstyle). */
export function kidHairCut(value: string | undefined, gender: string | undefined): KidHairCut {
  const g = kg(gender);
  const key = normalizeKidHairstyle(value, g);
  return KID_HAIRSTYLES[g].find((x) => x.key === key)!.cut;
}

/** Как рисовать: вид одежды по ключу (после normalizeKidOutfit). */
export function kidOutfitKind(value: string | undefined, gender: string | undefined): KidOutfitKind {
  const g = kg(gender);
  const key = normalizeKidOutfit(value, g);
  return KID_OUTFITS[g].find((x) => x.key === key)!.kind;
}

// ── rev 16: ямочки, щербинка, украшение для волос (только девочки), головной убор, рост ──
// Всё выбирается картинками; в ответах — appearance.dimples / toothGap / hairAcc / hairAccColor / hat / build
// (rev 17: + body — сложение)
// (необязательные, по умолчанию пусто). Рисует drawChild (art/kids.ts) — на живой обложке, страницах, превью и в PDF.

/** Украшение для волос (только девочки): ключ → как рисовать. Пусто — без украшения. */
export const KID_HAIR_ACCS = [
  { key: "бантик", kind: "bow", label: "Бантик", g: "m" },
  { key: "заколка", kind: "clip", label: "Заколка", g: "f" },
  { key: "ободок", kind: "band", label: "Ободок", g: "m" },
] as const;
export type KidHairAccKind = (typeof KID_HAIR_ACCS)[number]["kind"];

/** Цвет украшения: маленькая палитра (ключи OUTFIT_COLORS); пусто — как одежда. Слова — для подписей по роду. */
export const HAIR_ACC_COLOR_KEYS = ["красная", "розовая", "жёлтая", "голубая", "фиолетовая"] as const;
export const HAIR_ACC_COLOR_WORD: Record<string, { m: string; f: string }> = {
  красная: { m: "красный", f: "красная" },
  розовая: { m: "розовый", f: "розовая" },
  жёлтая: { m: "жёлтый", f: "жёлтая" },
  голубая: { m: "голубой", f: "голубая" },
  фиолетовая: { m: "фиолетовый", f: "фиолетовая" },
};

/** Головной убор (мальчики и девочки). Пусто — без головного убора. */
export const KID_HATS = [
  { key: "кепка", kind: "cap", label: "Кепка" },
  { key: "шапка с помпоном", kind: "beanie", label: "Шапка с помпоном" },
] as const;
export type KidHatKind = (typeof KID_HATS)[number]["kind"];

/** Рост (rev 17: заметно — ~13% роста): пониже / средний / повыше. Пусто или «обычный» — средний.
 *  Ключ в ответах — appearance.build (как в rev 16, старые ответы читаются). */
export const KID_BUILDS = [
  { key: "пониже", kind: "short", label: "Пониже" },
  { key: "обычный", kind: "normal", label: "Средний" },
  { key: "повыше", kind: "tall", label: "Повыше" },
] as const;
export type KidBuildKind = (typeof KID_BUILDS)[number]["kind"];

/** Сложение (rev 17): тоненький / обычный / плотненький (подписи по полу — бережные). Ключ — appearance.body. */
export const KID_BODIES = [
  { key: "тоненький", kind: "slim", label: { boy: "Тоненький", girl: "Тоненькая" } },
  { key: "обычный", kind: "normal", label: { boy: "Обычный", girl: "Обычная" } },
  { key: "плотненький", kind: "sturdy", label: { boy: "Плотненький", girl: "Плотненькая" } },
] as const;
export type KidBodyKind = (typeof KID_BODIES)[number]["kind"];

/** Украшение для волос: только у девочек и только из списка. */
export function kidHairAccKind(value: string | undefined | null, gender: string | undefined): KidHairAccKind | undefined {
  if (kg(gender) !== "girl") return undefined;
  return KID_HAIR_ACCS.find((x) => x.key === (value ?? "").trim().toLowerCase())?.kind;
}
export function kidHatKind(value: string | undefined | null): KidHatKind | undefined {
  const v = (value ?? "").trim().toLowerCase();
  return KID_HATS.find((x) => x.key === v)?.kind ?? (v === "шапка" ? "beanie" : undefined);
}
export function kidBuildKind(value: string | undefined | null): KidBuildKind {
  return KID_BUILDS.find((x) => x.key === (value ?? "").trim().toLowerCase())?.kind ?? "normal";
}
/** Сложение по ключу (и по женским словам: «тоненькая», «плотненькая»). */
export function kidBodyKind(value: string | undefined | null): KidBodyKind {
  const v = (value ?? "").trim().toLowerCase();
  if (/^тонень|^строй|^худ/.test(v)) return "slim";
  if (/^плотн|^крепы|^пухл|^круг/.test(v)) return "sturdy";
  return "normal";
}
/** Пропорции по росту (rev 17 — заметно, ~±13% роста): ноги, туловище, голова чуть-чуть. */
export const KID_BUILD_K: Record<KidBuildKind, { leg: number; torso: number; head: number }> = {
  short: { leg: 0.76, torso: 0.84, head: 0.96 },
  normal: { leg: 1, torso: 1, head: 1 },
  tall: { leg: 1.24, torso: 1.14, head: 1.03 },
};
/** Ширина по сложению: плечи и туловище, руки, ноги; плотненькому — круглые щёки и животик (рисует drawChild). */
export const KID_BODY_K: Record<KidBodyKind, { sw: number; arm: number; leg: number; cheeks: number; belly: number }> = {
  slim: { sw: 0.8, arm: 0.82, leg: 0.8, cheeks: 0, belly: 0 },
  normal: { sw: 1, arm: 1, leg: 1, cheeks: 0, belly: 0 },
  sturdy: { sw: 1.3, arm: 1.22, leg: 1.26, cheeks: 1, belly: 0.2 },
};

/** Новые приметы ребёнка (rev 16) из ответов — только известные значения; украшение — только девочке. */
export function kidLookExtras(p: { dimples?: boolean; toothGap?: boolean; hairAcc?: string; hairAccColor?: string; hat?: string; build?: string; body?: string } | undefined, gender: string | undefined) {
  const acc = kidHairAccKind(p?.hairAcc, gender) ? p!.hairAcc!.trim().toLowerCase() : undefined;
  const hat = kidHatKind(p?.hat) ? KID_HATS.find((x) => x.kind === kidHatKind(p?.hat))!.key : undefined;
  const build = kidBuildKind(p?.build);
  const body = kidBodyKind(p?.body);
  return {
    dimples: p?.dimples || undefined,
    toothGap: p?.toothGap || undefined,
    hairAcc: acc,
    hairAccColor: acc && (HAIR_ACC_COLOR_KEYS as readonly string[]).includes(p?.hairAccColor ?? "") ? p!.hairAccColor : undefined,
    hat,
    build: build === "normal" ? undefined : KID_BUILDS.find((x) => x.kind === build)!.key,
    body: body === "normal" ? undefined : KID_BODIES.find((x) => x.kind === body)!.key,
  };
}
