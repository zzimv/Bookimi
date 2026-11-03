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
