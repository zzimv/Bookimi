// ВЛАДЕЛЕЦ: агент 9 (художник книг о питомцах). Никто другой этот файл не меняет.
//
// Есть:
//  • PET_ART_STYLES — soft-gouache, pet-cartoon, vintage-postcard (owner "pets" в ART_STYLE_OWNERS).
//    Промпты держат конкретного питомца с фото узнаваемым (порода, окрас, приметы, уши, глаза),
//    зверь остаётся зверем — только лёгкая мимика.
//  • PET_THEMES — pet-home, park, yard, pet-night, seaside (свои фоны через scene).
//  • drawPet — собака (той/малая/средняя/крупная, уши висячие/стоячие/большие/полустоячие/длинные,
//    хвост бубликом/обрубком/пером) и кошка (обычные/вислоухие/с кисточками/большие уши, сфинкс);
//    окрасы: одноцветный, с белым (манишка, носочки), полосатый, трёхцветный, пятнистый, пойнт,
//    с подпалом, чепрак, маска; позы «стоит»/«сидит» и мимика по номеру разворота.
//    Для кролика, грызунов, птиц и черепах — свои простые рисунки, для прочих — милый зверёк.
//
// requests (просьбы к интегратору, агенту 11): —
//  (выполнено: gen/image.ts filterNegative убирает «humanized clothing, costumes», если сцена просит костюм)

import type { ArtStyle, ArtStyleDemo, DemoHeroDrawer, DemoHeroOpts, DemoSceneCtx, DemoTheme } from "../types";
import { drawDeco, pick, rnd, stroke } from "./shared";

// ---------------------------------------------------------------------------
// Стили картинок
// ---------------------------------------------------------------------------

const PET_IDENTITY =
  "the hero is the specific pet from the reference photo and must stay instantly recognizable to its owner: same species and breed traits, exact fur color, markings and patches, ear shape and carriage, eye color, muzzle shape, tail and body proportions; a real animal with natural four-legged anatomy, only lightly anthropomorphic: expressive eyes and a soft happy expression, no human clothes or costumes unless the scene asks for them";

const PET_NEGATIVE =
  "text, letters, words, captions, numbers, watermark, logo, signature, brand names, branded toys or food packages, extra legs, extra paws, extra tail, missing legs, fused or twisted limbs, deformed anatomy, two heads, duplicate pet, different breed, changed fur color, wrong markings, human body, animal standing upright like a person, human hands, humanized clothing, costumes, sunglasses, cage, chain leash, muzzle, injured or sick animal, blood, veterinary clinic, scary, aggressive bared teeth, photo, photorealistic, 3d render";

export const PET_ART_STYLES: ArtStyle[] = [
  {
    id: "soft-gouache",
    title: "Мягкая гуашь",
    description: "Плотная матовая гуашь: бархатная шерсть, тёплый свет и нежная пастель — уютно, как плед на диване.",
    audiences: ["PET", "CHILD"],
    prompt:
      "picture book illustration painted in soft opaque gouache, matte velvety brushstrokes that model the fur as soft tufts, warm golden afternoon light, gentle pastel palette of peach, cream, sage green and dusty lilac, rounded cozy shapes, subtle paper grain, calm affectionate mood; " +
      PET_IDENTITY,
    negative: `${PET_NEGATIVE}, harsh black outlines, neon colors, glossy digital look`,
    demo: { palette: { paper: "#f6eee2", ink: "#7a6150", accents: ["#e59f7d", "#b9a3cc", "#97c2a0", "#efcf86"] }, line: "thin", texture: "grain", filter: "soft" },
  },
  {
    id: "pet-cartoon",
    title: "Весёлый мультфильм",
    description: "Яркий мультяшный рисунок: чистый контур, сочные цвета, смешная мимика и движение — питомец как звезда мультфильма.",
    audiences: ["PET", "CHILD"],
    prompt:
      "bright modern cartoon illustration for a family picture book, clean confident dark outline, juicy saturated flat colors with simple cel shading, exaggerated but readable facial expression, dynamic playful pose with small motion lines, simple uncluttered background, joyful comedic energy, simplified shapes that still keep every marking of the pet; " +
      PET_IDENTITY,
    negative: `${PET_NEGATIVE}, muddy colors, sketchy rough lines, realistic fur rendering, dark gloomy lighting`,
    demo: { palette: { paper: "#ffffff", ink: "#221c2b", accents: ["#ff6b5b", "#ffc83d", "#33bfd6", "#7bd389"] }, line: "bold", texture: "none" },
  },
  {
    id: "vintage-postcard",
    title: "Винтажная открытка",
    description: "Как старинная открытка: мягкая литография, выцветшие тёплые тона, тонкие штрихи и лёгкое зерно бумаги.",
    audiences: ["PET", "ADULT"],
    prompt:
      "antique greeting postcard illustration, soft chromolithograph print look, faded warm colors of rose, ochre, sage and sepia, fine engraved line details, gentle halftone dots and aged paper grain, ornamental vignette border of flowers and ribbons left without any lettering, nostalgic tender mood; " +
      PET_IDENTITY,
    negative: `${PET_NEGATIVE}, modern digital gloss, neon colors, sharp vector look, greeting text on the card`,
    demo: { palette: { paper: "#efe2c6", ink: "#5b4633", accents: ["#c07560", "#86a08e", "#d6b267", "#94708f"] }, line: "thin", texture: "halftone", filter: "posterize" },
  },
];

// ---------------------------------------------------------------------------
// Цвет и геометрия
// ---------------------------------------------------------------------------

const f = (n: number) => +n.toFixed(1);
function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
const shade = (c: string, t: number) => mix(c, "#000000", t);
const tint = (c: string, t: number) => mix(c, "#ffffff", t);
const lum = (c: string) => {
  const [r, g, b] = rgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
/** Путь-эллипс (для clipPath и объединений). */
const E = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${extra}/>`;

type P = [number, number];
/** Точка кубической кривой и вторая половина кривой от t (для белого кончика хвоста). */
function cubicTail(p: P[], t: number): P[] {
  const l = (a: P, b: P): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = l(p[0], p[1]), b = l(p[1], p[2]), c = l(p[2], p[3]);
  const d = l(a, b), e = l(b, c);
  return [l(d, e), e, c, p[3]];
}
const cub = (p: P[]) => `M${f(p[0][0])} ${f(p[0][1])}C${p.slice(1).map((q) => `${f(q[0])} ${f(q[1])}`).join(" ")}`;

// ---------------------------------------------------------------------------
// Окрас и порода
// ---------------------------------------------------------------------------

const C = {
  white: "#f7f3ea",
  black: "#2f2926",
  ginger: "#dc8a3f",
  golden: "#e2aa5c",
  cream: "#ead3a6",
  brown: "#80553a",
  grey: "#9b9ba3",
  blue: "#8792a5",
  tan: "#c8823f",
  green: "#6dbb5a",
  yellow: "#f1cf4b",
  skin: "#efc6b2",
};

const COLOR_WORDS: [RegExp, string][] = [
  [/рыж|ginger|orange|\bred\b|медн|абрикос|apricot|персик/, C.ginger],
  [/золот|golden/, C.golden],
  [/палев|бежев|песоч|кремов|сливоч|fawn|cream|beige|sandy/, C.cream],
  [/шоколад|коричн|бур(ый|ая)|brown|chocolate|каштан|печен|liver/, C.brown],
  [/черн|black|угольн/, C.black],
  [/голуб|blue|блю|сиз/, C.blue],
  [/сер(ый|ая|ое|ые|о-|ого|ой|ен)|серебр|дымч|grey|gray|silver|smoke/, C.grey],
  [/бел|white|снеж/, C.white],
  [/зелен|green/, C.green],
  [/желт|yellow|лимон/, C.yellow],
];

interface Fur {
  base: string;
  /** Белая манишка, морда, носочки, кончик хвоста. */
  white: boolean;
  /** Пятна-заплатки (обычно на белом): цвета по очереди. */
  patches: string[];
  stripes?: string;
  spots?: string;
  /** Пойнт: морда, уши, лапы, хвост. */
  points?: string;
  /** Подпал: брови, морда, лапы. */
  tan?: string;
  saddle?: string;
  /** Тёмная маска на морде (мопс, овчарка). */
  mask?: string;
  eye: string;
  nose: string;
}

function parseFur(text: string, cat: boolean, hairless: boolean): Fur {
  const t = text.toLowerCase().replace(/ё/g, "е");
  const cols = COLOR_WORDS.map(([re, c]) => ({ i: t.search(re), c }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c)
    .filter((c, i, a) => a.indexOf(c) === i);
  let base = cols[0] ?? (cat ? C.grey : C.golden);
  const second = cols.find((c) => c !== base);
  const fur: Fur = { base, white: false, patches: [], eye: "#2a1f1a", nose: "#2b2220" };
  const has = (re: RegExp) => re.test(t);

  if (hairless) {
    fur.base = cols.length ? tint(base, 0.35) : C.skin;
  } else if (has(/трехцв|tricolou?r|калико|calico|черепах|черепаш|tortoise/)) {
    if (cat) {
      fur.base = C.white;
      fur.patches = [C.ginger, C.black];
    } else {
      fur.base = C.tan;
      fur.saddle = C.black;
      fur.white = true;
    }
  } else if (has(/пойнт|point|колорп|сиамск/)) {
    fur.points = cols.find((c) => c !== C.white && c !== C.cream) ?? "#4b382c";
    fur.base = cols.includes(C.white) ? C.white : C.cream;
  } else {
    if (has(/подпал|\btan\b/)) {
      if (!cols.length) base = C.black;
      fur.tan = second && second !== C.white ? second : C.tan;
      if (fur.tan === base) fur.tan = C.tan;
    } else if (has(/чепрак|saddle/)) {
      fur.saddle = cols.includes(C.black) && base !== C.black ? C.black : shade(base, 0.55);
      if (base === C.black) base = second ?? C.tan;
    }
    if (has(/маск|mask/)) {
      fur.mask = C.black;
      if (base === C.black) base = second ?? C.cream;
    }
    fur.base = base;
    if (has(/полос|тигр|табби|tabby|stripe|brindle|мрамор|marble/))
      fur.stripes = second && second !== C.white && second !== fur.saddle ? second : shade(base, base === C.white ? 0.3 : 0.38);
    if (has(/пятнист|крап|далмат|spotted|spots|леопард|розетк/))
      fur.spots = second && second !== C.white ? second : shade(base, base === C.white ? 0.75 : 0.45);
    else if (second && second !== C.white && !fur.tan && !fur.saddle && !fur.mask && !fur.stripes) fur.patches = [second];
    if (base !== C.white && (second === C.white || has(/с бел|белая груд|белой груд|белые лап|белыми лап|манишк|носоч|bicolou?r|tuxedo|смокинг|and white|-бел/)))
      fur.white = true;
  }
  if (cat) {
    fur.eye = fur.points || fur.base === C.white ? "#7cb2e2" : fur.base === C.black ? "#d6c142" : fur.base === C.grey || fur.base === C.blue ? "#e3a23a" : "#8fc25e";
    fur.nose = fur.base === C.black ? "#4a3a3a" : hairless ? "#d88c8c" : "#e8939d";
  } else if (fur.base === C.brown) fur.nose = "#5e3826";
  return fur;
}

type Ears = "floppy" | "long" | "pointy" | "big" | "button" | "fold" | "tufted" | "cat";
type Tail = "wag" | "curl" | "stub" | "plume" | "cat" | "fluffycat";
interface Breed {
  species?: "dog" | "cat";
  size?: number;
  ears?: Ears;
  tail?: Tail;
  fluffy?: boolean;
  long?: boolean;
  flat?: boolean;
  snout?: number;
  slim?: boolean;
  chunky?: boolean;
  hairless?: boolean;
  husky?: boolean;
  fur?: string;
}

const D = "dog" as const;
const K = "cat" as const;
// Порядок важен: более точные породы — раньше.
const BREEDS: [RegExp, Breed][] = [
  [/мейн|maine/, { species: K, size: 0.94, ears: "tufted", fluffy: true, tail: "fluffycat", fur: "коричневый полосатый" }],
  [/сибир|siberian|норвеж|norweg/, { species: K, size: 0.9, ears: "tufted", fluffy: true, tail: "fluffycat", fur: "серый полосатый с белым" }],
  [/британ|british/, { species: K, size: 0.84, chunky: true, fur: "голубой" }],
  [/шотланд|scottish|вислоух|fold/, { species: K, size: 0.82, ears: "fold", chunky: true, fur: "серый" }],
  [/сфинкс|sphynx|бамбино|bambino/, { species: K, size: 0.78, ears: "big", hairless: true, slim: true, fur: "телесный" }],
  [/перс|persian|экзот|exotic|гималай|himalay/, { species: K, size: 0.84, flat: true, fluffy: true, tail: "fluffycat", fur: "кремовый" }],
  [/сиам|siam|тайск|thai|ориентал|oriental/, { species: K, size: 0.78, ears: "big", slim: true, fur: "сил-пойнт" }],
  [/рэгдол|регдол|ragdoll|невск|neva|бирман|birman/, { species: K, size: 0.88, fluffy: true, tail: "fluffycat", fur: "блю-пойнт" }],
  [/бенгал|bengal|египет|\bмау|ocicat|оцикет/, { species: K, size: 0.82, fur: "золотистый пятнистый" }],
  [/абиссин|abyssin|сомали/, { species: K, size: 0.78, ears: "big", fur: "рыжий" }],
  [/русск.*голуб|russian blue|шартрез|chartreux/, { species: K, size: 0.8, fur: "голубой" }],
  [/бобтейл|bobtail|курил/, { species: K, size: 0.84, tail: "stub" }],
  [/чихуа|chihuahua/, { species: D, size: 0.56, ears: "big", fur: "палевый", snout: 0.8 }],
  [/йорк|york/, { species: D, size: 0.58, ears: "pointy", fluffy: true, fur: "серый с рыжим подпалом" }],
  [/шпиц|померан|spitz|pomeran/, { species: D, size: 0.62, ears: "pointy", tail: "curl", fluffy: true, fur: "рыжий" }],
  [/пудел|poodle/, { species: D, size: 0.78, ears: "long", fluffy: true, fur: "абрикосовый" }],
  [/папильон|papillon|той|toy|пражск/, { species: D, size: 0.56, ears: "big", fur: "белый с рыжим" }],
  [/мопс|pug/, { species: D, size: 0.68, ears: "button", tail: "curl", flat: true, chunky: true, fur: "палевый с черной маской" }],
  [/француз|french/, { species: D, size: 0.7, ears: "big", tail: "stub", flat: true, chunky: true, fur: "палевый" }],
  [/бульдог|bulldog|боксер|boxer/, { species: D, size: 0.82, ears: "button", tail: "stub", flat: true, chunky: true, fur: "палевый с белым" }],
  [/такс|dachs/, { species: D, size: 0.72, ears: "long", long: true, fur: "рыжий", snout: 1.25 }],
  [/бассет|basset/, { species: D, size: 0.78, ears: "long", long: true, fur: "трехцветный" }],
  [/корги|corgi/, { species: D, size: 0.74, ears: "big", long: true, tail: "stub", fur: "рыжий с белым" }],
  [/ши-?тцу|shih|мальт|maltese|бишон|bichon|пекин|pekin|болонк|бивер|havan/, { species: D, size: 0.6, ears: "long", fluffy: true, tail: "curl", fur: "белый" }],
  [/бигл|beagle|гонч/, { species: D, size: 0.82, ears: "long", fur: "трехцветный" }],
  [/спаниел|spaniel|кокер|cocker/, { species: D, size: 0.8, ears: "long", fluffy: true, fur: "рыжий" }],
  [/колли|collie|шелти|sheltie|австрал|aussie|бордер/, { species: D, size: 0.9, ears: "button", fluffy: true, tail: "plume", fur: "черный с белым", snout: 1.2 }],
  [/джек|jack|терьер|terrier|фокс|fox/, { species: D, size: 0.7, ears: "button", fur: "белый с рыжим" }],
  [/шиба|shiba|сиба/, { species: D, size: 0.8, ears: "pointy", tail: "curl", fur: "рыжий с белым" }],
  [/акита|akita/, { species: D, size: 1.0, ears: "pointy", tail: "curl", fur: "рыжий с белым" }],
  [/хаски|husky|маламут|malamute|лайк/, { species: D, size: 0.98, ears: "pointy", tail: "curl", fluffy: true, husky: true, fur: "серый с белым" }],
  [/самоед|samoyed/, { species: D, size: 0.98, ears: "pointy", tail: "curl", fluffy: true, fur: "белый" }],
  [/овчар|shepherd|малинуа|malinois/, { species: D, size: 1.02, ears: "pointy", tail: "plume", fur: "рыжий с черным чепраком и маской", snout: 1.2 }],
  [/лабрадор|labrador/, { species: D, size: 1.0, ears: "floppy", fur: "палевый" }],
  [/ретривер|retriever|голден|golden/, { species: D, size: 1.0, ears: "floppy", fluffy: true, tail: "plume", fur: "золотистый" }],
  [/доберман|doberman|пинчер|pinscher/, { species: D, size: 1.0, ears: "pointy", tail: "stub", slim: true, fur: "черный с подпалом", snout: 1.25 }],
  [/ротвейл|rottweil/, { species: D, size: 1.04, ears: "button", tail: "stub", chunky: true, fur: "черный с подпалом" }],
  [/далмат|dalmat/, { species: D, size: 1.0, ears: "floppy", fur: "белый в черный крап" }],
  [/сенбернар|bernard/, { species: D, size: 1.12, ears: "floppy", fluffy: true, chunky: true, fur: "белый с рыжим" }],
  [/бернск|bernese|зенненх/, { species: D, size: 1.08, ears: "floppy", fluffy: true, fur: "трехцветный" }],
  [/ньюф|newfound|водолаз/, { species: D, size: 1.12, ears: "floppy", fluffy: true, chunky: true, fur: "черный" }],
  [/алабай|азиат|кавказ|alabai/, { species: D, size: 1.12, ears: "button", fluffy: true, chunky: true, fur: "палевый с белым" }],
  [/борз|грейхаунд|greyhound|уиппет|whippet|левретк/, { species: D, size: 0.98, ears: "button", slim: true, snout: 1.35, fur: "палевый" }],
  [/(^|\s)дог|great dane|мастиф|mastiff|кане|cane corso/, { species: D, size: 1.12, ears: "floppy", chunky: true, fur: "палевый" }],
  [/дворн|метис|беспород|\bmix|mutt|двортерьер/, { species: D, size: 0.86, ears: "button", fur: "рыжий с белым" }],
];

type Species = "dog" | "cat" | "rabbit" | "rodent" | "bird" | "turtle" | "other";

function speciesOf(raw: string | undefined, breed: Breed | undefined): Species {
  const s = (raw ?? "").toLowerCase().replace(/ё/g, "е");
  if (/cat|кот|кош|kitten|кис/.test(s)) return "cat";
  if (/dog|соб|пес|щен|puppy/.test(s)) return "dog";
  if (/rabbit|bunny|крол|заяц|зайч/.test(s)) return "rabbit";
  if (/hamster|хомя|морск|guinea|шиншил|chinch|крыс|\brat|мыш|mouse|дегу|песчан|gerbil|ferret|хорек/.test(s)) return "rodent";
  if (/parrot|bird|попуг|птиц|канар|волнист|какаду|корел|budgie|cockatiel|амадин/.test(s)) return "bird";
  if (/turtle|tortoise|черепах/.test(s)) return "turtle";
  if (!s) return breed?.species ?? "dog";
  return "other";
}

interface Spec {
  cat: boolean;
  size: number;
  ears: Ears;
  tail: Tail;
  fluffy: boolean;
  long: boolean;
  flat: boolean;
  snout: number;
  slim: boolean;
  chunky: boolean;
  hairless: boolean;
  husky: boolean;
  fur: Fur;
}

// ---------------------------------------------------------------------------
// Собака и кошка
// ---------------------------------------------------------------------------

interface Ctx {
  sp: Spec;
  ol: string;
  olThin: string;
  idx: number;
  uid: string;
  accent: string;
}

const EYE_DARK = "#2a1f1a";

function earsSvg(c: Ctx, r: number, front: boolean) {
  const { sp } = c;
  const fu = sp.fur;
  const earCol = fu.points ?? (fu.patches.length ? fu.patches[fu.patches.length > 1 ? 1 : 0] : fu.saddle && !sp.cat ? shade(fu.base, 0.12) : fu.mask ?? (sp.cat ? fu.base : shade(fu.base, fu.base === C.white ? 0.06 : 0.14)));
  const leftCol = sp.cat && fu.patches.length > 1 ? fu.patches[0] : earCol;
  const inner = sp.hairless ? "#e9a9a0" : "#f2b5ad";
  const one = (sx: number, col: string) => {
    const m = (x: number) => f(sx * x * r);
    const y = (v: number) => f(v * r);
    switch (sp.ears) {
      case "floppy":
      case "long": {
        if (!front) return "";
        const lo = sp.ears === "long" ? 0.85 : 0.45;
        return `<path d="M${m(0.5)} ${y(-0.78)}C${m(1.2)} ${y(-0.82)} ${m(1.35)} ${y(lo - 0.1)} ${m(1.0)} ${y(lo + 0.05)}C${m(0.78)} ${y(lo + 0.12)} ${m(0.6)} ${y(lo - 0.3)} ${m(0.58)} ${y(-0.25)}Z" fill="${col}"${c.ol}/>`;
      }
      case "button":
        if (!front) return "";
        return `<path d="M${m(0.45)} ${y(-0.8)}Q${m(1.05)} ${y(-1.08)} ${m(1.02)} ${y(-0.42)}Q${m(0.86)} ${y(-0.3)} ${m(0.62)} ${y(-0.5)}Z" fill="${col}"${c.ol}/>`;
      case "fold":
        if (!front) return "";
        return `<path d="M${m(0.38)} ${y(-0.78)}Q${m(0.62)} ${y(-1.08)} ${m(0.86)} ${y(-0.62)}Q${m(0.66)} ${y(-0.66)} ${m(0.4)} ${y(-0.72)}Z" fill="${col}"${c.ol}/>`;
      default: {
        if (front) return "";
        const big = sp.ears === "big" ? 1.22 : 1;
        const tipX = (sp.cat ? 0.82 : 0.72) * big;
        const tipY = -(sp.cat ? 1.2 : 1.3) * (sp.ears === "big" ? 1.12 : 1);
        const out = `<path d="M${m(sp.cat ? 1.0 : 0.88)} ${y(-0.25)}Q${m(tipX + 0.12)} ${y(tipY * 0.6)} ${m(tipX)} ${y(tipY)}Q${m(0.45)} ${y(-1.0)} ${m(0.18)} ${y(-0.8)}Z" fill="${col}"${c.ol}/>`;
        const inn = `<path d="M${m(0.8)} ${y(-0.4)}Q${m(tipX + 0.02)} ${y(tipY * 0.62)} ${m(tipX - 0.04)} ${y(tipY * 0.85)}Q${m(0.48)} ${y(-0.9)} ${m(0.32)} ${y(-0.74)}Z" fill="${inner}" opacity=".85"/>`;
        const tuft = sp.ears === "tufted" ? `<path d="M${m(tipX)} ${y(tipY)}l${m(0.02)} ${y(-0.12)}M${m(tipX)} ${y(tipY)}l${m(0.07)} ${y(-0.09)}" stroke="${shade(col, 0.4)}" stroke-width="${f(r * 0.05)}" stroke-linecap="round"/>` : "";
        return out + inn + tuft;
      }
    }
  };
  return one(-1, leftCol) + one(1, earCol);
}

function headSvg(c: Ctx, r: number, happy: boolean, tongue: boolean) {
  const { sp } = c;
  const fu = sp.fur;
  const y = (v: number) => f(v * r);
  const x = (v: number) => f(v * r);
  const headD = sp.cat
    ? `M${x(-1.04)} ${y(0)}Q${x(-1.12)} ${y(0.74)} 0 ${y(0.82)}Q${x(1.12)} ${y(0.74)} ${x(1.04)} 0Q${x(0.98)} ${y(-0.86)} 0 ${y(-0.86)}Q${x(-0.98)} ${y(-0.86)} ${x(-1.04)} 0Z`
    : sp.flat
      ? E(0, r * 0.02, r * 1.04, r * 0.9)
      : `M${x(-0.98)} ${y(-0.05)}Q${x(-0.98)} ${y(-0.92)} 0 ${y(-0.92)}Q${x(0.98)} ${y(-0.92)} ${x(0.98)} ${y(-0.05)}Q${x(0.95)} ${y(0.72)} 0 ${y(0.8)}Q${x(-0.95)} ${y(0.72)} ${x(-0.98)} ${y(-0.05)}Z`;
  const clip = `${c.uid}h`;
  const light = fu.white || fu.base === C.white ? C.white : tint(fu.base, 0.45);
  let marks = "";
  // Маркировки головы (обрезаются по контуру головы)
  if (fu.patches.length && !sp.cat) marks += ell(r * 0.42, -r * 0.22, r * 0.42, r * 0.44, fu.patches[0]);
  if (sp.cat && fu.patches.length > 1) marks += ell(-r * 0.6, -r * 0.55, r * 0.62, r * 0.52, fu.patches[0]) + ell(r * 0.72, -r * 0.62, r * 0.45, r * 0.4, fu.patches[1]);
  else if (sp.cat && fu.patches.length) marks += ell(r * 0.55, -r * 0.6, r * 0.55, r * 0.45, fu.patches[0]);
  if (fu.stripes) {
    const w = f(r * 0.075);
    marks += `<path d="M${x(-0.24)} ${y(-0.86)}l${x(0.04)} ${y(0.32)}M0 ${y(-0.9)}v${y(0.36)}M${x(0.24)} ${y(-0.86)}l${x(-0.04)} ${y(0.32)}M${x(-1.05)} ${y(0.05)}l${x(0.32)} ${y(0.05)}M${x(-1.05)} ${y(0.26)}l${x(0.3)} ${y(0.02)}M${x(1.05)} ${y(0.05)}l${x(-0.32)} ${y(0.05)}M${x(1.05)} ${y(0.26)}l${x(-0.3)} ${y(0.02)}" stroke="${fu.stripes}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  }
  if (fu.spots) for (const [sx, sy, sr] of [[-0.62, -0.5, 0.07], [0.55, -0.62, 0.06], [-0.2, -0.72, 0.05], [0.78, -0.1, 0.06], [-0.8, 0.1, 0.05], [0.25, -0.45, 0.04]]) marks += ell(sx * r, sy * r, sr * r, sr * r * 0.85, fu.spots);
  if (fu.tan) marks += ell(-r * 0.36, -r * 0.4, r * 0.1, r * 0.07, fu.tan) + ell(r * 0.36, -r * 0.4, r * 0.1, r * 0.07, fu.tan);
  if (fu.points) marks += ell(0, r * 0.28, r * 0.58, r * 0.56, fu.points, ` opacity=".9"`);
  if (fu.white) {
    if (sp.husky)
      marks += ell(0, r * 0.5, r * 1.1, r * 0.55, C.white) + ell(-r * 0.36, -r * 0.4, r * 0.14, r * 0.09, C.white) + ell(r * 0.36, -r * 0.4, r * 0.14, r * 0.09, C.white) + `<path d="M${x(-0.12)} ${y(-0.95)}Q0 ${y(-0.3)} ${x(-0.32)} ${y(0.2)}H${x(0.32)}Q0 ${y(-0.3)} ${x(0.12)} ${y(-0.95)}Z" fill="${C.white}"/>`;
    else if (sp.cat)
      marks += `<path d="M${x(-1.2)} ${y(1)}Q${x(-0.42)} ${y(0.2)} ${x(-0.12)} ${y(-0.08)}Q0 ${y(-0.2)} ${x(0.12)} ${y(-0.08)}Q${x(0.42)} ${y(0.2)} ${x(1.2)} ${y(1)}Z" fill="${C.white}"/>`;
    else marks += `<path d="M${x(-0.1)} ${y(-0.95)}Q${x(-0.05)} ${y(-0.3)} ${x(-0.3)} ${y(0.1)}H${x(0.3)}Q${x(0.05)} ${y(-0.3)} ${x(0.1)} ${y(-0.95)}Z" fill="${C.white}"/>`;
  }
  if (sp.hairless) marks += `<path d="M${x(-0.3)} ${y(-0.6)}q${x(0.3)} ${y(-0.1)} ${x(0.6)} 0M${x(-0.22)} ${y(-0.45)}q${x(0.22)} ${y(-0.08)} ${x(0.44)} 0" stroke="${shade(fu.base, 0.25)}" stroke-width="${f(r * 0.03)}" fill="none"/>`;

  // Морда
  let face = "";
  if (sp.cat) {
    const pad = fu.white || fu.points ? (fu.points ? tint(fu.points, 0.15) : C.white) : sp.hairless ? tint(fu.base, 0.2) : tint(fu.base, 0.5);
    face += ell(-r * 0.13, r * 0.33, r * 0.17, r * 0.14, pad) + ell(r * 0.13, r * 0.33, r * 0.17, r * 0.14, pad);
    face += `<path d="M${x(-0.09)} ${y(0.16)}H${x(0.09)}L0 ${y(0.27)}Z" fill="${fu.nose}"/>`;
    face += `<path d="M0 ${y(0.27)}v${y(0.06)}M${x(-0.14)} ${y(0.36)}Q${x(-0.06)} ${y(0.42)} 0 ${y(0.33)}Q${x(0.06)} ${y(0.42)} ${x(0.14)} ${y(0.36)}" stroke="${EYE_DARK}" stroke-width="${f(r * 0.035)}" fill="none" stroke-linecap="round"/>`;
    const wk = `stroke="${lum(fu.base) < 0.3 ? "#e8e2d8" : "#5a4a42"}" stroke-width="${f(r * 0.022)}" opacity=".7" stroke-linecap="round"`;
    face += `<path d="M${x(-0.32)} ${y(0.3)}L${x(-1.2)} ${y(0.16)}M${x(-0.32)} ${y(0.36)}L${x(-1.22)} ${y(0.38)}M${x(-0.3)} ${y(0.42)}L${x(-1.12)} ${y(0.58)}M${x(0.32)} ${y(0.3)}L${x(1.2)} ${y(0.16)}M${x(0.32)} ${y(0.36)}L${x(1.22)} ${y(0.38)}M${x(0.3)} ${y(0.42)}L${x(1.12)} ${y(0.58)}" ${wk}/>`;
  } else {
    const muzzle = fu.mask ?? (fu.white || fu.patches.length ? C.white : fu.tan ?? light);
    const my = sp.flat ? 0.3 : 0.36 + (sp.snout - 1) * 0.15;
    const mrx = sp.flat ? 0.58 : 0.5 / Math.sqrt(sp.snout);
    const mry = sp.flat ? 0.28 : 0.34 * sp.snout;
    face += ell(0, r * my, r * mrx, r * mry, muzzle);
    const ny = my - mry * 0.55;
    const nose = fu.mask ? "#171211" : fu.nose;
    face += `<path d="M${x(-0.15)} ${y(ny)}Q0 ${y(ny - 0.07)} ${x(0.15)} ${y(ny)}Q${x(0.15)} ${y(ny + 0.13)} 0 ${y(ny + 0.17)}Q${x(-0.15)} ${y(ny + 0.13)} ${x(-0.15)} ${y(ny)}Z" fill="${nose}"/>` + ell(-r * 0.05, r * (ny + 0.02), r * 0.04, r * 0.025, "#ffffff", ` opacity=".55"`);
    const my2 = ny + 0.17;
    const mc = fu.mask ? "#5a4a42" : EYE_DARK;
    if (tongue) face += `<path d="M${x(-0.09)} ${y(my2 + 0.1)}Q${x(-0.1)} ${y(my2 + 0.32)} 0 ${y(my2 + 0.32)}Q${x(0.1)} ${y(my2 + 0.32)} ${x(0.09)} ${y(my2 + 0.1)}Z" fill="#f07f86" stroke="${shade("#f07f86", 0.3)}" stroke-width="${f(r * 0.02)}"/><path d="M0 ${y(my2 + 0.14)}v${y(0.1)}" stroke="#c95660" stroke-width="${f(r * 0.02)}"/>`;
    face += `<path d="M0 ${y(my2)}v${y(0.07)}M${x(-0.2)} ${y(my2 + 0.07)}Q${x(-0.1)} ${y(my2 + 0.18)} 0 ${y(my2 + 0.07)}Q${x(0.1)} ${y(my2 + 0.18)} ${x(0.2)} ${y(my2 + 0.07)}" stroke="${mc}" stroke-width="${f(r * 0.04)}" fill="none" stroke-linecap="round"/>`;
    if (sp.flat) face += `<path d="M${x(-0.2)} ${y(-0.5)}q${x(0.2)} ${y(-0.08)} ${x(0.4)} 0M${x(-0.14)} ${y(-0.38)}q${x(0.14)} ${y(-0.06)} ${x(0.28)} 0" stroke="${shade(fu.base, 0.3)}" stroke-width="${f(r * 0.03)}" fill="none" stroke-linecap="round"/>`;
  }

  // Глаза
  let eyes = "";
  const ex = sp.cat ? 0.4 : 0.36;
  const ey = sp.cat ? -0.1 : -0.14;
  for (const sx of [-1, 1]) {
    const cx = sx * ex * r;
    const cy = ey * r;
    if (happy) {
      eyes += `<path d="M${f(cx - r * 0.13)} ${f(cy + r * 0.03)}Q${f(cx)} ${f(cy - r * 0.14)} ${f(cx + r * 0.13)} ${f(cy + r * 0.03)}" stroke="${EYE_DARK}" stroke-width="${f(r * 0.055)}" fill="none" stroke-linecap="round"/>`;
    } else if (sp.cat) {
      eyes += ell(cx, cy, r * 0.16, r * 0.17, fu.eye, ` stroke="${EYE_DARK}" stroke-width="${f(r * 0.03)}"`);
      eyes += ell(cx, cy + r * 0.01, r * 0.07, r * 0.13, EYE_DARK);
      eyes += ell(cx + r * 0.05, cy - r * 0.06, r * 0.045, r * 0.045, "#ffffff") + ell(cx - r * 0.05, cy + r * 0.07, r * 0.02, r * 0.02, "#ffffff", ` opacity=".8"`);
    } else {
      const er = r * (sp.size < 0.7 ? 0.15 : 0.13);
      eyes += ell(cx, cy, er, er * 1.05, EYE_DARK);
      eyes += ell(cx + er * 0.35, cy - er * 0.38, er * 0.36, er * 0.36, "#ffffff") + ell(cx - er * 0.35, cy + er * 0.4, er * 0.15, er * 0.15, "#ffffff", ` opacity=".8"`);
    }
  }
  const blush = ell(-r * 0.62, r * 0.22, r * 0.14, r * 0.08, "#f39a9a", ` opacity=".4"`) + ell(r * 0.62, r * 0.22, r * 0.14, r * 0.08, "#f39a9a", ` opacity=".4"`);

  // Пушистые щёки
  let cheeks = "";
  if ((sp.fluffy || sp.cat) && !sp.hairless) {
    const col = fu.white && !sp.cat ? C.white : fu.base;
    const z = (sx: number) => {
      let d = `M${f(sx * r * 0.7)} ${f(-r * 0.1)}`;
      const n = sp.fluffy ? 4 : 3;
      for (let i = 1; i <= n; i++) {
        const a0 = (-0.05 + (i - 1) * 0.1) * Math.PI;
        const a1 = (-0.05 + i * 0.1) * Math.PI;
        const am = (a0 + a1) / 2;
        const out = sp.fluffy ? 1.2 : 1.12;
        const px = (a: number, k: number) => f(sx * Math.cos(a) * r * 1.02 * k);
        const py = (a: number, k: number) => f(Math.sin(a) * r * 0.82 * k + r * 0.05);
        if (i === 1) d += `L${px(a0, 1)} ${py(a0, 1)}`;
        d += `Q${px(am, out)} ${py(am, out)} ${px(a1, 1)} ${py(a1, 1)}`;
      }
      return `<path d="${d}L${f(sx * r * 0.3)} ${f(r * 0.6)}Z" fill="${col}"${c.ol}/>`;
    };
    if (sp.fluffy || sp.cat) cheeks = z(-1) + z(1);
  }

  // Ошейник
  const collar = sp.hairless && sp.cat
    ? ""
    : `<path d="M${x(-0.55)} ${y(0.62)}Q0 ${y(1.0)} ${x(0.55)} ${y(0.62)}" stroke="${c.accent}" stroke-width="${f(r * 0.14)}" fill="none" stroke-linecap="round"/>` +
      (sp.cat
        ? `<circle cx="0" cy="${y(0.94)}" r="${f(r * 0.1)}" fill="#e8c14f"${c.olThin}/><path d="M${x(-0.05)} ${y(0.96)}h${x(0.1)}" stroke="#7a5b1a" stroke-width="${f(r * 0.025)}"/>`
        : `<circle cx="0" cy="${y(0.97)}" r="${f(r * 0.11)}" fill="#e8c14f"${c.olThin}/>`);

  return `${collar}${earsSvg(c, r, false)}${cheeks}<clipPath id="${clip}"><path d="${headD}"/></clipPath>
    <path d="${headD}" fill="${fu.base}"/><g clip-path="url(#${clip})">${marks}</g><path d="${headD}" fill="none"${c.ol}/>
    ${earsSvg(c, r, true)}${face}${eyes}${blush}`;
}

function tailPts(sp: Spec, sx: number, sy: number, wag: number, sitting: boolean): P[] {
  if (sitting && sp.cat) return [[sx, sy], [sx + 44, sy + 8], [sx + 30, sy + 26], [sx - 20, sy + 18]];
  switch (sp.tail) {
    case "curl":
      return [[sx, sy], [sx + 34, sy - 34], [sx + 4, sy - 70], [sx - 22, sy - 34]];
    case "stub":
      return [[sx, sy], [sx + 6, sy - 3], [sx + 10, sy - 7], [sx + 13, sy - 11]];
    case "plume":
      return [[sx, sy], [sx + 30, sy + 6], [sx + 56, sy - 6], [sx + 62 + wag * 0.3, sy - 38 + wag * 0.5]];
    case "cat":
    case "fluffycat":
      return [[sx, sy], [sx + 40, sy - 6], [sx + 46, sy - 80], [sx + 18 + wag * 0.4, sy - 100]];
    default:
      return [[sx, sy], [sx + 26, sy - 4], [sx + 42, sy - 30], [sx + 40 + wag, sy - 62]];
  }
}

function tailSvg(c: Ctx, pts: P[], w: number) {
  const { sp } = c;
  const fu = sp.fur;
  const d = cub(pts);
  const col = fu.saddle && !sp.cat ? fu.saddle : fu.base;
  const lw = c.ol ? (c.ol.match(/stroke-width="([\d.]+)"/)?.[1] ?? "2") : "0";
  const inkM = c.ol.match(/stroke="(#[0-9a-fA-F]{6})"/);
  const ink = inkM ? inkM[1] : shade(col, 0.4);
  let s = `<path d="${d}" stroke="${ink}" stroke-width="${f(w + 2 * +lw)}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${col}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"/>`;
  if (fu.stripes) s += `<path d="${d}" stroke="${fu.stripes}" stroke-width="${f(w * 0.98)}" fill="none" stroke-dasharray="${f(w * 0.45)} ${f(w * 0.75)}"/>`;
  const tipCol = fu.points ?? (fu.white || (sp.cat && fu.patches.length > 1) ? C.white : fu.tan && !sp.cat ? null : null);
  if (tipCol && sp.tail !== "stub") s += `<path d="${cub(cubicTail(pts, fu.points ? 0.45 : 0.72))}" stroke="${tipCol}" stroke-width="${f(w * 0.98)}" fill="none" stroke-linecap="round"/>`;
  if (sp.fluffy && sp.tail !== "stub" && sp.tail !== "curl") {
    const m = cubicTail(pts, 0.5)[0];
    s += `<path d="M${f(m[0] - w * 0.4)} ${f(m[1])}l${f(-w * 0.5)} ${f(w * 0.25)}M${f(m[0] + w * 0.4)} ${f(m[1] + 4)}l${f(w * 0.45)} ${f(w * 0.3)}" stroke="${col}" stroke-width="${f(w * 0.35)}" stroke-linecap="round"/>`;
  }
  return s;
}

function petBody(o: DemoHeroOpts, sp: Spec) {
  const idx = o.index ?? 0;
  const base = stroke(o.style, 2.6);
  const ol = base || ` stroke="${shade(sp.fur.base, 0.4)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const olThin = stroke(o.style, 1.6) || ` stroke="${shade(sp.fur.base, 0.4)}" stroke-width="1.4"`;
  const uid = `pt${Math.abs(Math.round(o.x * 7 + o.y * 13 + idx * 101 + o.scale * 977))}`;
  const accents = o.style.palette.accents.length ? o.style.palette.accents : ["#d9534f"];
  const c: Ctx = { sp, ol, olThin, idx, uid, accent: sp.fur.base === C.ginger || lum(sp.fur.base) > 0.8 ? pick(accents, 2) : accents[0] };
  const fu = sp.fur;
  const sitting = idx === 0 || idx % 3 === 2;
  const happy = idx % 4 === 3;
  const tongue = !sp.cat && idx % 3 !== 1;
  const tilt = [0, -7, 5, -3, 6][idx % 5];
  const wag = [0, 14, -10, 8][idx % 4];
  const r = 44 * (sp.size < 0.75 ? 1.14 : 1) * (sp.cat ? 0.98 : 1);
  const legW = sp.cat ? 15 : sp.slim ? 15 : sp.chunky ? 22 : 18;
  const sock = fu.points ?? (fu.white ? C.white : fu.tan ?? null);
  const belly = fu.white || fu.base === C.white ? C.white : tint(fu.base, 0.28);
  const bodyClip = `${uid}b`;
  let out = `<ellipse cx="0" cy="190" rx="${sitting ? 70 : 100}" ry="11" fill="rgba(0,0,0,.16)"/>`;

  const marksFor = (cx: number, top: number, rx: number, ry: number, bot: number) => {
    let m = "";
    if (fu.saddle) m += ell(cx - rx * 0.1, top + ry * 0.1, rx * 0.85, ry * 0.65, fu.saddle);
    fu.patches.forEach((p, i) => {
      m += i === 0 ? ell(cx - rx * 0.35, top + ry * 0.35, rx * 0.4, ry * 0.6, p) : ell(cx + rx * 0.3, top + ry * 0.15, rx * 0.25, ry * 0.4, p);
    });
    if (sp.cat && fu.patches.length > 1) m += ell(cx + rx * 0.05, bot - ry * 0.3, rx * 0.18, ry * 0.25, fu.patches[1]);
    if (fu.stripes) {
      let d = "";
      for (let k = 0; k < 5; k++) {
        const sx = cx - rx * 0.62 + k * rx * 0.28;
        d += `M${f(sx)} ${f(top - 6)}q${f(-8)} ${f(ry * 0.5)} ${f(-3)} ${f(ry * 0.95)}`;
      }
      m += `<path d="${d}" stroke="${fu.stripes}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    }
    if (fu.spots) {
      const sr = rnd(fu.base.length * 31 + 7);
      for (let k = 0; k < 16; k++) m += ell(cx - rx + sr() * rx * 2, top + sr() * ry * 2, 4 + sr() * 4, 3.5 + sr() * 3, fu.spots);
    }
    m += ell(cx, bot + 2, rx * 0.75, ry * 0.42, belly);
    if (fu.tan) m += ell(cx + rx * 0.82, bot - ry * 0.3, rx * 0.25, ry * 0.5, fu.tan);
    if (fu.white) m += ell(cx + rx * 0.8, top + ry * 1.1, rx * 0.3, ry * 0.8, C.white);
    return m;
  };

  const legSvg = (lx: number, top: number, w: number, far: boolean) => {
    const col = far ? shade(fu.base, 0.14) : fu.base;
    const h = 190 - top - 6;
    let s = `<rect x="${f(lx - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="${col}"/>`;
    const sc = sock ? (far ? shade(sock, 0.1) : sock) : null;
    if (sc) s += `<rect x="${f(lx - w / 2)}" y="${f(top + h * (fu.points ? 0.35 : 0.6))}" width="${f(w)}" height="${f(h * (fu.points ? 0.65 : 0.4))}" rx="${f(w / 2)}" fill="${sc}"/>`;
    s += `<rect x="${f(lx - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="none"${ol}/>`;
    s += ell(lx + 3, 186, w * 0.68, w * 0.4, sc ?? col, ol);
    if (!far) s += `<path d="M${f(lx)} ${f(186 + w * 0.05)}v${f(-w * 0.28)}M${f(lx + w * 0.3)} ${f(186 + w * 0.05)}v${f(-w * 0.25)}" stroke="${shade(sc ?? col, 0.35)}" stroke-width="1.4" stroke-linecap="round"/>`;
    return s;
  };

  if (!sitting) {
    // Стоит боком, голова смотрит на зрителя; «вперёд» — +x
    const L = sp.cat ? 42 : sp.long ? 22 : sp.size < 0.62 ? 34 : sp.slim ? 60 : sp.size > 0.95 ? 52 : 44;
    const rx = (sp.cat ? 66 : 70) * (sp.long ? 1.35 : 1) * (sp.chunky ? 1.04 : 1);
    const ry = (sp.cat ? 32 : 38) * (sp.chunky ? 1.15 : sp.slim ? 0.85 : 1) * (sp.fluffy ? 1.08 : 1);
    const cx = -12;
    const cy = 190 - L - ry * 0.55;
    const top = cy - ry;
    const bot = cy + ry;
    const bx0 = cx - rx;
    const bx1 = cx + rx;
    const d = `M${f(bx0 + rx * 0.15)} ${f(top + ry * 0.25)}C${f(cx - rx * 0.4)} ${f(top - ry * (sp.cat ? 0.12 : 0.04))} ${f(cx + rx * 0.4)} ${f(top + ry * 0.06)} ${f(bx1 - rx * 0.1)} ${f(top + ry * 0.12)}C${f(bx1 + rx * 0.14)} ${f(top + ry * 0.35)} ${f(bx1 + rx * 0.1)} ${f(bot - ry * 0.1)} ${f(bx1 - rx * 0.22)} ${f(bot)}C${f(cx + rx * 0.2)} ${f(bot + ry * (sp.cat ? -0.12 : 0.04))} ${f(cx - rx * 0.2)} ${f(bot - ry * (sp.cat ? 0.25 : 0.1))} ${f(bx0 + rx * 0.3)} ${f(bot)}C${f(bx0 - rx * 0.05)} ${f(bot)} ${f(bx0 - rx * 0.1)} ${f(top + ry * 0.6)} ${f(bx0 + rx * 0.15)} ${f(top + ry * 0.25)}Z`;
    const step = (idx % 2 ? 1 : -1) * 4;
    out += legSvg(cx + rx * 0.4 - step, cy, legW, true) + legSvg(cx - rx * 0.72 + step, cy, legW, true);
    const tw = sp.tail === "plume" || sp.tail === "fluffycat" ? 20 : sp.cat ? 11 : sp.tail === "stub" ? 14 : 13;
    const tsx = bx0 + rx * 0.14;
    out += tailSvg(c, tailPts(sp, tsx, top + ry * 0.35, wag, false).map(([px, py]) => [2 * tsx - px, py] as P), tw);
    out += legSvg(cx + rx * 0.62 + step, cy, legW, false) + legSvg(cx - rx * 0.5 - step, cy, legW, false);
    out += `<clipPath id="${bodyClip}"><path d="${d}"/></clipPath><path d="${d}" fill="${fu.base}"/><g clip-path="url(#${bodyClip})">${marksFor(cx, top, rx, ry, bot)}</g><path d="${d}" fill="none"${ol}/>`;
    const hx = bx1 - rx * 0.12;
    const hy = top - r * 0.32;
    if (sp.fluffy) out += ruff(c, hx, hy + r * 0.72, r);
    out += `<g transform="translate(${f(hx)} ${f(hy)}) rotate(${tilt})">${headSvg(c, r, happy, tongue)}</g>`;
  } else {
    // Сидит анфас
    const rx = (sp.cat ? 36 : 42) * (sp.chunky ? 1.15 : sp.slim ? 0.9 : 1) * (sp.fluffy ? 1.08 : 1);
    const ry = sp.cat ? 56 : sp.long ? 44 : sp.size > 0.95 ? 62 : 54;
    const cy = 188 - ry;
    const y0 = cy - ry;
    const nw = rx * 0.6;
    const d = `M${f(-nw)} ${f(y0)}C${f(-rx * 0.95)} ${f(y0 + ry * 0.45)} ${f(-rx * 1.3)} ${f(160)} ${f(-rx * 1.12)} 188L${f(rx * 1.12)} 188C${f(rx * 1.3)} 160 ${f(rx * 0.95)} ${f(y0 + ry * 0.45)} ${f(nw)} ${f(y0)}Q0 ${f(y0 - 10)} ${f(-nw)} ${f(y0)}Z`;
    const tw = sp.tail === "plume" || sp.tail === "fluffycat" ? 20 : sp.cat ? 11 : 13;
    if (!sp.cat) out += tailSvg(c, tailPts(sp, rx * 0.9, 176, wag, true), tw);
    // Задние лапы-«пятки» по бокам
    out += ell(-rx * 1.05, 184, rx * 0.42, 9, shade(fu.base, 0.1), ol) + ell(rx * 1.05, 184, rx * 0.42, 9, shade(fu.base, 0.1), ol);
    let m = "";
    if (fu.saddle) m += ell(-rx * 1.05, cy + 10, rx * 0.45, ry * 0.9, fu.saddle) + ell(rx * 1.05, cy + 10, rx * 0.45, ry * 0.9, fu.saddle);
    fu.patches.forEach((p, i) => (m += i === 0 ? ell(-rx * 0.85, 160, rx * 0.5, ry * 0.45, p) : ell(rx * 0.8, y0 + ry * 0.7, rx * 0.4, ry * 0.4, p)));
    if (fu.stripes) {
      let sd = "";
      for (let k = 0; k < 4; k++) {
        const yy = y0 + ry * 0.45 + k * ry * 0.33;
        sd += `M${f(-rx * 1.3)} ${f(yy)}q${f(rx * 0.3)} ${f(-4)} ${f(rx * 0.5)} ${f(4)}M${f(rx * 1.3)} ${f(yy)}q${f(-rx * 0.3)} ${f(-4)} ${f(-rx * 0.5)} ${f(4)}`;
      }
      m += `<path d="${sd}" stroke="${fu.stripes}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    }
    if (fu.spots) {
      const sr = rnd(fu.base.length * 31 + 7);
      for (let k = 0; k < 14; k++) m += ell(-rx * 1.2 + sr() * rx * 2.4, y0 + sr() * ry * 2, 4 + sr() * 4, 3.5 + sr() * 3, fu.spots);
    }
    m += ell(0, cy + ry * 0.1, rx * 0.5, ry * 0.8, fu.white || fu.base === C.white ? C.white : fu.tan ?? belly);
    out += `<clipPath id="${bodyClip}"><path d="${d}"/></clipPath><path d="${d}" fill="${fu.base}"/><g clip-path="url(#${bodyClip})">${m}</g><path d="${d}" fill="none"${ol}/>`;
    // Передние лапы
    const lw = legW * 1.1;
    const sockCol = sock;
    for (const sx of [-1, 1]) {
      const lx = sx * rx * 0.3;
      const lt = cy - ry * 0.05;
      const h = 186 - lt;
      out += `<rect x="${f(lx - lw / 2)}" y="${f(lt)}" width="${f(lw)}" height="${f(h)}" rx="${f(lw / 2)}" fill="${fu.base}"/>`;
      if (sockCol) out += `<rect x="${f(lx - lw / 2)}" y="${f(lt + h * (fu.points ? 0.3 : 0.55))}" width="${f(lw)}" height="${f(h * (fu.points ? 0.7 : 0.45))}" rx="${f(lw / 2)}" fill="${sockCol}"/>`;
      out += `<path d="M${f(lx - lw / 2)} ${f(lt + 6)}V${f(184)}M${f(lx + lw / 2)} ${f(lt + 6)}V${f(184)}" fill="none"${ol}/>`;
      out += ell(lx, 186, lw * 0.72, lw * 0.42, sockCol ?? fu.base, ol);
      out += `<path d="M${f(lx - lw * 0.18)} 189v-6M${f(lx + lw * 0.18)} 189v-6" stroke="${shade(sockCol ?? fu.base, 0.35)}" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    if (sp.cat) out += tailSvg(c, tailPts(sp, rx * 0.95, 180, wag, true), tw);
    const hy = y0 - r * 0.5;
    if (sp.fluffy) out += ruff(c, 0, hy + r * 0.72, r);
    out += `<g transform="translate(0 ${f(hy)}) rotate(${tilt})">${headSvg(c, r, happy, tongue)}</g>`;
  }
  return out;
}

/** Пушистое «жабо» под головой. */
function ruff(c: Ctx, cx: number, cy: number, r: number) {
  const fu = c.sp.fur;
  const col = fu.white || fu.base === C.white ? C.white : tint(fu.base, 0.12);
  const n = 7;
  const pt = (a: number, k: number) => `${f(cx + Math.cos(a) * r * 0.85 * k)} ${f(cy + Math.sin(a) * r * 0.55 * k)}`;
  let d = `M${f(cx + r * 0.8)} ${f(cy - r * 0.1)}L${pt(0.05 * Math.PI, 1)}`;
  for (let i = 1; i <= n; i++) {
    const a0 = Math.PI * (0.05 + (0.9 * (i - 1)) / n);
    const a1 = Math.PI * (0.05 + (0.9 * i) / n);
    d += `Q${pt((a0 + a1) / 2, 1.28)} ${pt(a1, 1)}`;
  }
  return `<path d="${d}L${f(cx - r * 0.8)} ${f(cy - r * 0.1)}Z" fill="${col}"${c.ol}/>`;
}

// ---------------------------------------------------------------------------
// Другие питомцы
// ---------------------------------------------------------------------------

function faceBits(r: number, cy: number, nose: string, cheeks = true) {
  return (
    ell(-r * 0.36, cy - r * 0.1, r * 0.13, r * 0.14, EYE_DARK) +
    ell(r * 0.36, cy - r * 0.1, r * 0.13, r * 0.14, EYE_DARK) +
    ell(-r * 0.31, cy - r * 0.16, r * 0.05, r * 0.05, "#ffffff") +
    ell(r * 0.41, cy - r * 0.16, r * 0.05, r * 0.05, "#ffffff") +
    `<path d="M${f(-r * 0.08)} ${f(cy + r * 0.12)}h${f(r * 0.16)}l${f(-r * 0.08)} ${f(r * 0.09)}Z" fill="${nose}"/>` +
    `<path d="M0 ${f(cy + r * 0.21)}v${f(r * 0.06)}M${f(-r * 0.12)} ${f(cy + r * 0.3)}Q${f(-r * 0.06)} ${f(cy + r * 0.36)} 0 ${f(cy + r * 0.27)}Q${f(r * 0.06)} ${f(cy + r * 0.36)} ${f(r * 0.12)} ${f(cy + r * 0.3)}" stroke="${EYE_DARK}" stroke-width="${f(r * 0.04)}" fill="none" stroke-linecap="round"/>` +
    (cheeks ? ell(-r * 0.6, cy + r * 0.15, r * 0.13, r * 0.08, "#f39a9a", ` opacity=".45"`) + ell(r * 0.6, cy + r * 0.15, r * 0.13, r * 0.08, "#f39a9a", ` opacity=".45"`) : "")
  );
}

function drawOther(o: DemoHeroOpts, kind: Species, look: DemoHeroOpts["look"]) {
  const t = `${look.species ?? ""} ${look.breed ?? ""}`.toLowerCase();
  const furText = look.furColor ?? "";
  const def = kind === "bird" ? C.green : kind === "turtle" ? "#7fae5a" : kind === "rabbit" ? "#cdb69a" : kind === "rodent" ? "#e0b177" : "#b98a62";
  const fu = parseFur(furText || "", false, false);
  const base = furText ? fu.base : def;
  const ol = stroke(o.style, 2.6) || ` stroke="${shade(base, 0.4)}" stroke-width="2" stroke-linejoin="round"`;
  const light = fu.white || !furText ? tint(base, 0.6) : tint(base, 0.45);
  let s = `<ellipse cx="0" cy="190" rx="70" ry="10" fill="rgba(0,0,0,.16)"/>`;
  const idx = o.index ?? 0;
  const tilt = [0, -6, 5, -3][idx % 4];
  if (kind === "rabbit") {
    const lop = /вислоух|баран|lop/.test(t);
    const r = 42;
    s += ell(46, 178, 16, 14, C.white, ol);
    s += `<path d="M-34 70C-70 110 -66 188 -40 188H40C66 188 70 110 34 70Z" fill="${base}"${ol}/>`;
    s += ell(0, 140, 26, 36, light);
    s += ell(-46, 180, 26, 11, base, ol) + ell(46, 180, 26, 11, base, ol);
    s += ell(-16, 182, 11, 8, base, ol) + ell(16, 182, 11, 8, base, ol);
    const ears = lop
      ? `<path d="M-30 -20Q-70 0 -58 50Q-44 58 -36 10Z" fill="${shade(base, 0.08)}"${ol}/><path d="M30 -20Q70 0 58 50Q44 58 36 10Z" fill="${shade(base, 0.08)}"${ol}/>`
      : `<g transform="rotate(-10 -16 -30)">${ell(-16, -78, 13, 44, base, ol)}${ell(-16, -74, 6, 32, "#f2b5ad")}</g><g transform="rotate(10 16 -30)">${ell(16, -78, 13, 44, base, ol)}${ell(16, -74, 6, 32, "#f2b5ad")}</g>`;
    s += `<g transform="translate(0 30) rotate(${tilt})">${lop ? "" : ears}${ell(0, 0, r, r * 0.92, base, ol)}${lop ? ears : ""}${ell(-8, 18, 10, 9, light)}${ell(8, 18, 10, 9, light)}${faceBits(r, 6, "#e8939d")}<rect x="-6" y="${f(r * 0.38)}" width="12" height="9" rx="2" fill="#ffffff" stroke="#9a8a80" stroke-width="1.2"/></g>`;
  } else if (kind === "rodent") {
    const tailLong = /крыс|\brat|мыш|mouse|хорек|ferret|дегу|песчан|gerbil/.test(t);
    if (tailLong) s += `<path d="M50 172Q110 190 120 150" stroke="#e6a5a0" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    s += ell(0, 146, 64, 44, base, ol) + ell(0, 158, 40, 28, fu.white || !furText ? "#fbf4e8" : light);
    s += ell(-30, 186, 13, 7, "#f2b5ad", ol) + ell(30, 186, 13, 7, "#f2b5ad", ol);
    const r = 42;
    s += `<g transform="translate(0 92) rotate(${tilt})">${ell(-28, -30, 13, 13, base, ol)}${ell(28, -30, 13, 13, base, ol)}${ell(-28, -30, 7, 7, "#f2b5ad")}${ell(28, -30, 7, 7, "#f2b5ad")}${ell(0, 0, r, r * 0.9, base, ol)}${ell(-26, 18, 20, 15, light)}${ell(26, 18, 20, 15, light)}${faceBits(r, 4, "#e8939d")}<path d="M-14 22l-30 -4M-14 26l-28 6M14 22l30 -4M14 26l28 6" stroke="#5a4a42" stroke-width="1.2" opacity=".6"/></g>`;
    s += ell(-14, 136, 8, 6, "#f2b5ad", ol) + ell(14, 136, 8, 6, "#f2b5ad", ol);
  } else if (kind === "bird") {
    const head = fu.patches[0] ?? (furText ? tint(base, 0.3) : C.yellow);
    const wing = shade(base, 0.2);
    s += `<path d="M10 160L44 196L58 186Z" fill="${shade(base, 0.3)}"${ol}/>`;
    s += `<path d="M-14 172v16M14 172v16M-22 190h16M6 190h16" stroke="#8a8a8a" stroke-width="4" stroke-linecap="round"/>`;
    s += ell(0, 124, 46, 56, base, ol) + ell(0, 138, 28, 36, tint(base, 0.35));
    s += `<path d="M30 96Q66 130 40 170Q20 150 22 112Z" fill="${wing}"${ol}/><path d="M34 120q12 14 6 34M30 132q8 10 4 24" stroke="${shade(wing, 0.3)}" stroke-width="2" fill="none"/>`;
    const r = 36;
    s += `<g transform="translate(0 58) rotate(${tilt})">${ell(0, 0, r, r, head, ol)}${ell(-22, 10, 9, 7, "#f39a6a", ` opacity=".75"`)}${ell(22, 10, 9, 7, "#f39a6a", ` opacity=".75"`)}${ell(-14, -4, 7, 8, EYE_DARK)}${ell(14, -4, 7, 8, EYE_DARK)}${ell(-12, -7, 2.5, 2.5, "#fff")}${ell(16, -7, 2.5, 2.5, "#fff")}<path d="M-8 6Q0 0 8 6Q8 18 0 24Q-4 16 -8 6Z" fill="#f2c46a"${ol}/></g>`;
  } else if (kind === "turtle") {
    const shell = furText ? base : "#8b6b3e";
    const skin = "#9cc27a";
    s += ell(-50, 182, 14, 10, skin, ol) + ell(40, 182, 14, 10, skin, ol);
    s += `<path d="M64 158Q86 150 92 130" stroke="${shade(skin, 0.35)}" stroke-width="30" fill="none" stroke-linecap="round"/><path d="M64 158Q86 150 92 130" stroke="${skin}" stroke-width="25" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M-84 172Q-80 92 -6 90Q74 92 76 172Z" fill="${shell}"${ol}/><path d="M-84 172H76" stroke="${tint(shell, 0.4)}" stroke-width="8"/>`;
    s += `<path d="M-30 100L-46 132L-20 160H20L44 132L28 100M-46 132H-80M44 132H74M-20 160L-24 172M20 160L24 172" stroke="${shade(shell, 0.35)}" stroke-width="3" fill="none"/>`;
    s += `<g transform="translate(98 116) rotate(${tilt})">${ell(0, 0, 26, 23, skin, ol)}${ell(-8, -4, 5, 6, EYE_DARK)}${ell(9, -4, 5, 6, EYE_DARK)}${ell(-6, -6, 2, 2, "#fff")}${ell(11, -6, 2, 2, "#fff")}<path d="M-6 8Q0 13 6 8" stroke="${EYE_DARK}" stroke-width="2" fill="none" stroke-linecap="round"/>${ell(-14, 6, 5, 3, "#f39a9a", ` opacity=".5"`)}${ell(14, 6, 5, 3, "#f39a9a", ` opacity=".5"`)}</g>`;
  } else {
    // Милый зверёк по умолчанию
    s += `<path d="M-50 110C-70 150 -60 188 -30 188H30C60 188 70 150 50 110Z" fill="${base}"${ol}/>` + ell(0, 150, 30, 30, light);
    s += ell(-24, 184, 16, 9, base, ol) + ell(24, 184, 16, 9, base, ol);
    const r = 46;
    s += `<g transform="translate(0 70) rotate(${tilt})">${ell(-32, -34, 15, 15, base, ol)}${ell(32, -34, 15, 15, base, ol)}${ell(-32, -34, 8, 8, "#f2b5ad")}${ell(32, -34, 8, 8, "#f2b5ad")}${ell(0, 0, r, r * 0.92, base, ol)}${ell(0, 16, 20, 15, light)}${faceBits(r, 4, EYE_DARK)}</g>`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Рисовальщик героя-питомца
// ---------------------------------------------------------------------------

export function petSpec(look: DemoHeroOpts["look"]): { kind: Species; spec: Spec } {
  const breedText = (look.breed ?? "").toLowerCase().replace(/ё/g, "е");
  const found = breedText ? BREEDS.find(([re]) => re.test(breedText)) : undefined;
  let breed = found?.[1];
  const kind = speciesOf(look.species, breed);
  if (breed?.species && breed.species !== kind) breed = undefined;
  const cat = kind === "cat";
  const furText = look.furColor || breed?.fur || (cat ? "серый полосатый" : "золотистый");
  let size = breed?.size ?? (cat ? 0.8 : 0.86);
  if (typeof look.age === "number" && look.age < 1) size *= 0.8;
  const spec: Spec = {
    cat,
    size,
    ears: breed?.ears ?? (cat ? "cat" : "floppy"),
    tail: breed?.tail ?? (cat ? (breed?.fluffy ? "fluffycat" : "cat") : "wag"),
    fluffy: !!breed?.fluffy || /пушист|длинношерст|лохмат|fluffy|longhair/.test(`${furText} ${breedText}`),
    long: !!breed?.long,
    flat: !!breed?.flat,
    snout: breed?.snout ?? 1,
    slim: !!breed?.slim,
    chunky: !!breed?.chunky,
    hairless: !!breed?.hairless,
    husky: !!breed?.husky,
    fur: parseFur(furText, cat, !!breed?.hairless),
  };
  if (spec.fluffy && spec.cat && spec.tail === "cat") spec.tail = "fluffycat";
  return { kind, spec };
}

export const drawPet: DemoHeroDrawer = (o) => {
  const { kind, spec } = petSpec(o.look);
  const body = kind === "dog" || kind === "cat" ? petBody(o, spec) : drawOther(o, kind, o.look);
  const k = 1.18 * (kind === "dog" || kind === "cat" ? spec.size : kind === "turtle" ? 0.75 : kind === "bird" ? 0.7 : 0.72);
  const sx = o.flip ? -o.scale * k : o.scale * k;
  const gy = o.y + 190 * o.scale;
  return `<g data-species="${kind}" transform="translate(${f(o.x)} ${f(gy)}) scale(${f(sx * 1000) / 1000} ${f(o.scale * k * 1000) / 1000}) translate(0 -190)">${body}</g>`;
};

// ---------------------------------------------------------------------------
// Демо-темы
// ---------------------------------------------------------------------------

const lineOf = (style: ArtStyleDemo, w = 2) => stroke(style, w);

function petHome(ctx: DemoSceneCtx) {
  const { W, H, style, rnd: r, theme } = ctx;
  const s = lineOf(style, 1.6);
  const fy = H * 0.7;
  let o = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  for (let y = 40; y < fy - 20; y += 80) for (let x = (y / 80) % 2 ? 40 : 80; x < W; x += 80) o += `<path d="M${x} ${y - 7}l6 7-6 7-6-7z" fill="${theme.accent}" opacity=".13"/>`;
  // окно
  const wx = W > 1500 ? W * 0.06 : W * 0.04;
  const ww = W > 1500 ? 340 : 230;
  o += `<rect x="${wx}" y="${H * 0.1}" width="${ww}" height="${H * 0.38}" rx="8" fill="#cfe9f5"${s}/><rect x="${wx}" y="${H * 0.1 + H * 0.24}" width="${ww}" height="${H * 0.14}" fill="#a9d39a" opacity=".6"/><circle cx="${wx + ww * 0.7}" cy="${H * 0.18}" r="26" fill="#fff3c4"/><path d="M${wx + ww / 2} ${H * 0.1}V${H * 0.48}M${wx} ${H * 0.29}H${wx + ww}" stroke="#fffaf2" stroke-width="10"/><rect x="${wx}" y="${H * 0.1}" width="${ww}" height="${H * 0.38}" rx="8" fill="none" stroke="#fffaf2" stroke-width="12"/>`;
  o += `<path d="M${wx - 30} ${H * 0.07}h70v${H * 0.47}q-40 10 -70 0z" fill="#e7a08a"${s}/><path d="M${wx + ww - 40} ${H * 0.07}h70v${H * 0.47}q-30 10 -70 0z" fill="#e7a08a"${s}/><rect x="${wx - 50}" y="${H * 0.06}" width="${ww + 100}" height="12" rx="6" fill="#8a6a50"/>`;
  // картины
  const px = W - (W > 1500 ? 380 : 210);
  o += `<rect x="${px}" y="${H * 0.14}" width="150" height="120" fill="#fff8ec" stroke="#b08a5a" stroke-width="10"/><path d="M${px + 20} ${H * 0.14 + 100}l40-50 30 30 20-20 25 40z" fill="#9cc7a4"/><circle cx="${px + 110}" cy="${H * 0.14 + 34}" r="12" fill="#f2c46a"/>`;
  o += `<rect x="${px + 40}" y="${H * 0.33}" width="90" height="90" fill="#fff8ec" stroke="#b08a5a" stroke-width="8"/><g fill="${theme.accent}" transform="translate(${px + 85} ${H * 0.33 + 48})"><ellipse cx="0" cy="8" rx="13" ry="11"/><circle cx="-13" cy="-8" r="5.5"/><circle cx="0" cy="-13" r="5.5"/><circle cx="13" cy="-8" r="5.5"/></g>`;
  // пол
  o += `<rect y="${fy}" width="${W}" height="${H - fy}" fill="${theme.ground}"/><rect y="${fy - 16}" width="${W}" height="18" fill="#fbf3e6"/>`;
  for (let y = fy + 40; y < H; y += 46) {
    o += `<path d="M0 ${y}H${W}" stroke="${shade(theme.ground, 0.15)}" stroke-width="2"/>`;
    for (let k = 0; k < W / 260; k++) {
      const x = Math.round(r() * W);
      o += `<path d="M${x} ${y - 46}V${y}" stroke="${shade(theme.ground, 0.15)}" stroke-width="2"/>`;
    }
  }
  // диван
  const sw = W > 1500 ? W * 0.5 : W * 0.8;
  const sx = (W - sw) / 2;
  const sc = "#7fa39a";
  o += `<rect x="${sx + 40}" y="${H * 0.36}" width="${sw - 80}" height="${H * 0.24}" rx="40" fill="${shade(sc, 0.06)}"${s}/>`;
  o += `<rect x="${sx + 60}" y="${H * 0.55}" width="${sw - 120}" height="${H * 0.1}" rx="18" fill="${sc}"${s}/>`;
  o += `<rect x="${sx}" y="${H * 0.46}" width="90" height="${H * 0.24}" rx="36" fill="${tint(sc, 0.08)}"${s}/><rect x="${sx + sw - 90}" y="${H * 0.46}" width="90" height="${H * 0.24}" rx="36" fill="${tint(sc, 0.08)}"${s}/>`;
  o += `<rect x="${sx + 70}" y="${H * 0.64}" width="${sw - 140}" height="${H * 0.05}" fill="${shade(sc, 0.18)}"/>`;
  o += `<rect x="${sx + 110}" y="${H * 0.42}" width="110" height="100" rx="22" fill="#f2c46a" transform="rotate(-8 ${sx + 165} ${H * 0.47})"${s}/><rect x="${sx + sw - 220}" y="${H * 0.42}" width="110" height="100" rx="22" fill="#e59f9a" transform="rotate(7 ${sx + sw - 165} ${H * 0.47})"${s}/>`;
  // плед
  const plx = sx + sw - 120;
  o += `<path d="M${plx} ${H * 0.45}h110v${H * 0.24}h-110z" fill="#d9584a" opacity=".9"/><path d="M${plx + 28} ${H * 0.45}v${H * 0.24}M${plx + 72} ${H * 0.45}v${H * 0.24}M${plx} ${H * 0.52}h110M${plx} ${H * 0.61}h110" stroke="#f6e2c8" stroke-width="7" opacity=".8"/>`;
  // ковёр, миска, мяч
  o += `<ellipse cx="${W / 2}" cy="${H * 0.86}" rx="${W * (W > 1500 ? 0.32 : 0.46)}" ry="${H * 0.08}" fill="${theme.accent}" opacity=".35"/><ellipse cx="${W / 2}" cy="${H * 0.86}" rx="${W * (W > 1500 ? 0.29 : 0.42)}" ry="${H * 0.062}" fill="none" stroke="#fffaf2" stroke-width="6" stroke-dasharray="18 14" opacity=".7"/>`;
  const bx = W - (W > 1500 ? 150 : 90);
  o += `<path d="M${bx - 60} ${H * 0.9}h120l-14 34h-92z" fill="${theme.accent}"${s}/><ellipse cx="${bx}" cy="${H * 0.9}" rx="60" ry="10" fill="#8a5a3a"/><circle cx="${bx - 18}" cy="${H * 0.895}" r="5" fill="#b07a4a"/><circle cx="${bx + 12}" cy="${H * 0.893}" r="5" fill="#b07a4a"/>`;
  o += `<circle cx="${W > 1500 ? 140 : 80}" cy="${H * 0.93}" r="26" fill="#f2c46a"${s}/><path d="M${(W > 1500 ? 140 : 80) - 26} ${H * 0.93}q26 -18 52 0" stroke="#e05a4a" stroke-width="6" fill="none"/>`;
  return o;
}

function tree(x: number, y: number, k: number, crown: string, s: string) {
  return `<rect x="${x - 10 * k}" y="${y - 140 * k}" width="${20 * k}" height="${140 * k}" rx="${6 * k}" fill="#8a5a3a"${s}/><g fill="${crown}"${s}><circle cx="${x}" cy="${y - 190 * k}" r="${70 * k}"/><circle cx="${x - 55 * k}" cy="${y - 140 * k}" r="${50 * k}"/><circle cx="${x + 55 * k}" cy="${y - 145 * k}" r="${52 * k}"/></g>`;
}

function park(ctx: DemoSceneCtx) {
  const { W, H, style, rnd: r, theme } = ctx;
  const s = lineOf(style, 1.6);
  let o = `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${W * 0.82}" cy="150" r="64" fill="#fff1b8" opacity=".95"/>`;
  o += drawDeco("clouds", W, H * 0.5, r, theme.accent, 6);
  o += `<path d="M0 ${H * 0.58}${Array.from({ length: Math.ceil(W / 120) + 1 }, (_, i) => `Q${i * 120 + 60} ${H * 0.5 - (i % 2) * 30} ${i * 120 + 120} ${H * 0.58}`).join("")}V${H * 0.7}H0Z" fill="#9cc79a"/>`;
  o += `<path d="M0 ${H * 0.64}Q${W * 0.3} ${H * 0.6} ${W * 0.55} ${H * 0.64}T${W} ${H * 0.62}V${H}H0Z" fill="${theme.ground}"/>`;
  o += `<path d="M${W * 0.47} ${H * 0.63}Q${W * 0.42} ${H * 0.75} ${W * 0.3} ${H}H${W * 0.7}Q${W * 0.56} ${H * 0.75} ${W * 0.53} ${H * 0.63}Z" fill="#ead9b4"/>`;
  const xs = W > 1500 ? [0.04, 0.16, 0.86, 0.97] : [0.06, 0.95];
  const crowns = ["#6fae5f", "#e8a24a", "#88b85a", "#d9783f"];
  xs.forEach((p, i) => (o += tree(W * p, H * 0.7, 1.1 + (i % 2) * 0.2, crowns[i % 4], s)));
  // фонарь
  const lx = W > 1500 ? W * 0.27 : W * 0.2;
  o += `<rect x="${lx - 5}" y="${H * 0.36}" width="10" height="${H * 0.3}" fill="#3d4a52"/><path d="M${lx - 18} ${H * 0.36}h36l-8 -34h-20z" fill="#3d4a52"/><circle cx="${lx}" cy="${H * 0.34}" r="9" fill="#fff1b8"/>`;
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = H * 0.68 + r() * H * 0.3;
    o += `<path d="M${f(x)} ${f(y)}q8 -7 16 0q-8 7 -16 0z" fill="${pick(["#e8a24a", "#d9783f", "#f2c94c", "#b9562f"], i)}" opacity=".85" transform="rotate(${Math.round(r() * 360)} ${f(x)} ${f(y)})"/>`;
  }
  o += `<circle cx="${W * 0.5}" cy="${H * 0.92}" r="28" fill="${theme.accent}"${s}/><path d="M${W * 0.5 - 28} ${H * 0.92}q28 16 56 0" stroke="#fff6e0" stroke-width="6" fill="none"/>`;
  return o;
}

function bench(x: number, y: number, s: string) {
  return `<g><rect x="${x - 90}" y="${y - 70}" width="180" height="14" rx="4" fill="#b97a48"${s}/><rect x="${x - 90}" y="${y - 50}" width="180" height="14" rx="4" fill="#b97a48"${s}/><rect x="${x - 95}" y="${y - 26}" width="190" height="14" rx="4" fill="#c98a55"${s}/><path d="M${x - 75} ${y - 56}V${y}M${x + 75} ${y - 56}V${y}" stroke="#3d4a52" stroke-width="8"/></g>`;
}

function yard(ctx: DemoSceneCtx) {
  const { W, H, style, rnd: r, theme } = ctx;
  const s = lineOf(style, 1.6);
  let o = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  const blocks = W > 1500 ? [[0, 520, "#efd9bd"], [560, 420, "#e3c8c0"], [1020, 560, "#dfe2cf"], [1620, 430, "#efd9bd"]] : [[0, 470, "#efd9bd"], [520, 504, "#e3c8c0"]];
  for (const [bx, bw, col] of blocks as [number, number, string][]) {
    const top = H * (0.12 + ((bx / 100) % 3) * 0.04);
    o += `<rect x="${bx + 10}" y="${top}" width="${bw - 20}" height="${H * 0.62 - top}" fill="${col}"${s}/>`;
    for (let wy = top + 30; wy < H * 0.58; wy += 62)
      for (let wx = bx + 40; wx < bx + bw - 60; wx += 66) o += `<rect x="${wx}" y="${wy}" width="34" height="38" rx="3" fill="${r() < 0.25 ? "#f6d77a" : "#9fbfd6"}"/>`;
  }
  o += `<path d="M0 ${H * 0.62}H${W}V${H}H0Z" fill="${theme.ground}"/>`;
  // берёзы
  const bxs = W > 1500 ? [0.31, 0.7, 0.92] : [0.88];
  for (const p of bxs) {
    const x = W * p;
    o += `<rect x="${x - 9}" y="${H * 0.28}" width="18" height="${H * 0.36}" fill="#f4f1ea"${s}/>`;
    for (let k = 0; k < 6; k++) o += `<rect x="${x - 9 + (k % 2) * 8}" y="${H * 0.31 + k * 40}" width="10" height="4" fill="#3a3330"/>`;
    o += `<g fill="#8cc06a" opacity=".95"><ellipse cx="${x}" cy="${H * 0.25}" rx="70" ry="90"/><ellipse cx="${x - 40}" cy="${H * 0.33}" rx="44" ry="56"/><ellipse cx="${x + 44}" cy="${H * 0.32}" rx="44" ry="56"/></g>`;
  }
  // невысокий забор
  for (let x = 10; x < W; x += 36) o += `<rect x="${x}" y="${H * 0.6}" width="10" height="${H * 0.07}" rx="5" fill="#5f8f5a"/>`;
  o += `<rect x="0" y="${H * 0.62}" width="${W}" height="7" fill="#5f8f5a"/>`;
  // дорожка из плитки
  o += `<path d="M0 ${H * 0.78}Q${W * 0.5} ${H * 0.72} ${W} ${H * 0.8}V${H * 0.92}Q${W * 0.5} ${H * 0.84} 0 ${H * 0.9}Z" fill="#cfc6b8"/>`;
  // клумба
  const fx = W > 1500 ? W * 0.84 : W * 0.86;
  o += `<ellipse cx="${fx}" cy="${H * 0.9}" rx="120" ry="36" fill="#8a5a3a"/><ellipse cx="${fx}" cy="${H * 0.9}" rx="120" ry="36" fill="none" stroke="#f4f1ea" stroke-width="12" stroke-dasharray="26 8"/>`;
  for (let i = 0; i < 14; i++) {
    const x = fx - 90 + r() * 180;
    const y = H * 0.87 + r() * 26 - 20;
    o += `<path d="M${f(x)} ${f(y)}v24" stroke="#4f8a4a" stroke-width="3"/><circle cx="${f(x)}" cy="${f(y)}" r="9" fill="${pick([theme.accent, "#f2c94c", "#f4f1ea", "#c86aa0"], i)}"/>`;
  }
  o += bench(W > 1500 ? W * 0.1 : W * 0.12, H * 0.74, s);
  return o;
}

function petNight(ctx: DemoSceneCtx) {
  const { W, H, style, rnd: r, theme } = ctx;
  const s = lineOf(style, 1.6);
  const wx0 = W > 1500 ? W * 0.3 : W * 0.15;
  const wx1 = W > 1500 ? W * 0.7 : W * 0.85;
  const wy0 = H * 0.08;
  const wy1 = H * 0.56;
  let o = `<defs><radialGradient id="pn-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient><linearGradient id="pn-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101a3d"/><stop offset="1" stop-color="#2f3f78"/></linearGradient></defs>`;
  o += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  o += `<rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="url(#pn-win)"/>`;
  for (let i = 0; i < 30; i++) {
    const x = wx0 + r() * (wx1 - wx0);
    const y = wy0 + r() * (wy1 - wy0) * 0.6;
    o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + r() * 2.5)}" fill="#fff8d9" opacity="${f(0.5 + r() * 0.5)}"/>`;
  }
  const mx = wx1 - (wx1 - wx0) * 0.25;
  o += `<path d="M${f(mx)} ${f(wy0 + 60)}a58 58 0 1 0 46 92a46 46 0 1 1 -46 -92z" fill="#f6e7b8"/>`;
  // крыши
  let rx = wx0;
  let roofs = `M${f(wx0)} ${f(wy1)}`;
  while (rx < wx1) {
    const w = 60 + r() * 70;
    const h = 40 + r() * 70;
    roofs += `V${f(wy1 - h)}H${f(Math.min(rx + w, wx1))}`;
    rx += w;
  }
  o += `<path d="${roofs}V${f(wy1)}Z" fill="#1b2347"/>`;
  for (let i = 0; i < 14; i++) o += `<rect x="${f(wx0 + 10 + r() * (wx1 - wx0 - 30))}" y="${f(wy1 - 10 - r() * 40)}" width="8" height="10" fill="#f6d77a" opacity=".85"/>`;
  o += `<path d="M${f((wx0 + wx1) / 2)} ${f(wy0)}V${f(wy1)}" stroke="#5a6a9a" stroke-width="12"/><rect x="${f(wx0)}" y="${f(wy0)}" width="${f(wx1 - wx0)}" height="${f(wy1 - wy0)}" fill="none" stroke="#5a6a9a" stroke-width="16"/>`;
  // лунная дорожка
  o += `<path d="M${f(wx0 + 40)} ${f(wy1)}L${f(wx1 - 40)} ${f(wy1)}L${f(wx1 + 160)} ${H}L${f(wx0 - 160)} ${H}Z" fill="#dfe6ff" opacity=".07"/>`;
  // шторы
  o += `<path d="M${f(wx0 - 70)} ${f(wy0 - 30)}h110q-20 ${f((wy1 - wy0) * 0.6)} 10 ${f(wy1 - wy0 + 60)}h-120z" fill="#5b4a86"${s}/><path d="M${f(wx1 - 40)} ${f(wy0 - 30)}h110v${f(wy1 - wy0 + 60)}h-120q30 ${f(-(wy1 - wy0) * 0.4)} 10 ${f(-(wy1 - wy0 + 60))}z" fill="#5b4a86"${s}/>`;
  // пол и подоконник
  o += `<rect y="${H * 0.7}" width="${W}" height="${H * 0.3}" fill="${theme.ground}"/>`;
  o += `<rect x="${f(wx0 - 30)}" y="${f(wy1)}" width="${f(wx1 - wx0 + 60)}" height="22" rx="4" fill="#c9c3dc"${s}/>`;
  const pot = wx0 + 50;
  o += `<path d="M${f(pot - 22)} ${f(wy1)}l6 -40h32l6 40z" fill="#c9765a"/><g fill="#5f9a6a"><ellipse cx="${f(pot - 14)}" cy="${f(wy1 - 62)}" rx="12" ry="26" transform="rotate(-25 ${f(pot - 14)} ${f(wy1 - 62)})"/><ellipse cx="${f(pot + 12)}" cy="${f(wy1 - 66)}" rx="12" ry="28" transform="rotate(20 ${f(pot + 12)} ${f(wy1 - 66)})"/><ellipse cx="${f(pot)}" cy="${f(wy1 - 74)}" rx="10" ry="26"/></g>`;
  // лампа и тёплый свет
  const lx = W > 1500 ? W * 0.9 : W * 0.92;
  o += `<circle cx="${f(lx)}" cy="${H * 0.42}" r="260" fill="url(#pn-glow)"/><rect x="${f(lx - 4)}" y="${H * 0.42}" width="8" height="${H * 0.3}" fill="#2b2540"/><path d="M${f(lx - 46)} ${H * 0.43}l14 -64h64l14 64z" fill="#f2c46a"${s}/>`;
  // лежанка
  o += `<ellipse cx="${W / 2}" cy="${H * 0.86}" rx="${W > 1500 ? 380 : 300}" ry="${H * 0.07}" fill="${theme.accent}" opacity=".55"/><ellipse cx="${W / 2}" cy="${H * 0.86}" rx="${W > 1500 ? 340 : 260}" ry="${H * 0.05}" fill="${tint(theme.accent, 0.2)}" opacity=".5"/>`;
  return o;
}

function seaside(ctx: DemoSceneCtx) {
  const { W, H, style, rnd: r, theme } = ctx;
  const s = lineOf(style, 1.6);
  let o = `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${W * 0.8}" cy="160" r="70" fill="#fff1b8"/>`;
  o += drawDeco("clouds", W, H * 0.4, r, theme.accent, 4);
  for (let i = 0; i < 5; i++) {
    const x = r() * W * 0.7;
    const y = 90 + r() * 200;
    o += `<path d="M${f(x)} ${f(y)}q12 -12 24 0q12 -12 24 0" stroke="#5a6a7a" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
  o += `<rect y="${H * 0.44}" width="${W}" height="${H * 0.24}" fill="#3fa3bf"/><rect y="${H * 0.44}" width="${W}" height="${H * 0.06}" fill="#2f8aa8"/>`;
  for (let y = H * 0.5; y < H * 0.66; y += 26)
    for (let k = 0; k < W / 200; k++) {
      const x = r() * W;
      o += `<path d="M${f(x)} ${f(y)}q15 -8 30 0q15 -8 30 0" stroke="#e8f7fb" stroke-width="3" fill="none" opacity=".7"/>`;
    }
  // кораблик
  const bx = W * 0.62;
  o += `<path d="M${bx - 40} ${H * 0.47}h80l-14 16h-52z" fill="#b5654a"/><path d="M${bx} ${H * 0.47}V${H * 0.36}L${bx + 34} ${H * 0.46}Z" fill="#fff8ec"/>`;
  o += `<path d="M0 ${H * 0.66}Q${W * 0.25} ${H * 0.62} ${W * 0.5} ${H * 0.66}T${W} ${H * 0.65}V${H}H0Z" fill="${theme.ground}"/>`;
  o += `<path d="M0 ${H * 0.66}Q${W * 0.25} ${H * 0.62} ${W * 0.5} ${H * 0.66}T${W} ${H * 0.65}" stroke="#ffffff" stroke-width="10" fill="none" opacity=".8" stroke-dasharray="40 16"/>`;
  // зонтик и полотенце
  const ux = W > 1500 ? W * 0.9 : W * 0.86;
  o += `<path d="M${ux} ${H * 0.46}V${H * 0.84}" stroke="#6b5a4a" stroke-width="8"/><path d="M${ux - 150} ${H * 0.52}Q${ux} ${H * 0.3} ${ux + 150} ${H * 0.52}Z" fill="${theme.accent}"${s}/><path d="M${ux - 50} ${H * 0.52}Q${ux - 40} ${H * 0.38} ${ux} ${H * 0.385}Q${ux + 40} ${H * 0.38} ${ux + 50} ${H * 0.52}Z" fill="#fff8ec"/>`;
  if (W > 1500) o += `<rect x="${W * 0.06}" y="${H * 0.8}" width="200" height="90" rx="8" fill="#5fb0d0" transform="rotate(-6 ${W * 0.06} ${H * 0.8})"/><path d="M${W * 0.06} ${H * 0.82}h200M${W * 0.06} ${H * 0.86}h200" stroke="#fff8ec" stroke-width="10" transform="rotate(-6 ${W * 0.06} ${H * 0.8})"/>`;
  // ракушки и морские звёзды
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    const y = H * 0.75 + r() * H * 0.22;
    if (i % 3 === 0)
      o += `<path d="M0 -14l4 9 10 1-7 6 2 10-9-5-9 5 2-10-7-6 10-1z" fill="#f2955a" transform="translate(${f(x)} ${f(y)}) scale(1.4)"/>`;
    else o += `<path d="M${f(x - 14)} ${f(y)}Q${f(x)} ${f(y - 26)} ${f(x + 14)} ${f(y)}Z" fill="#f6dccb"${s}/><path d="M${f(x)} ${f(y)}V${f(y - 16)}M${f(x - 6)} ${f(y)}l-3 -12M${f(x + 6)} ${f(y)}l3 -12" stroke="#c99a84" stroke-width="1.5"/>`;
  }
  // следы лап
  for (let i = 0; i < 7; i++) {
    const x = W * 0.08 + i * (W * 0.06);
    const y = H * 0.94 - i * 10 + (i % 2) * 14;
    o += `<g fill="${shade(theme.ground, 0.18)}" transform="translate(${f(x)} ${f(y)}) rotate(70) scale(.8)"><ellipse cx="0" cy="6" rx="8" ry="7"/><circle cx="-8" cy="-5" r="3.5"/><circle cx="0" cy="-8" r="3.5"/><circle cx="8" cy="-5" r="3.5"/></g>`;
  }
  return o;
}

export const PET_THEMES: DemoTheme[] = [
  { key: "pet-home", sky: ["#f7e6cf", "#f3d9bd"], ground: "#c99a6b", accent: "#e07a5f", deco: "paws", scene: petHome },
  { key: "park", sky: ["#a9d8f0", "#e9f6fb"], ground: "#79b867", accent: "#e8533f", deco: "leaves", scene: park },
  { key: "yard", sky: ["#bfe0f5", "#f2f8fb"], ground: "#8fc47a", accent: "#e46a8a", deco: "clouds", scene: yard },
  { key: "pet-night", sky: ["#232a52", "#3a3f72"], ground: "#4a3f6b", accent: "#9b8ad1", deco: "moon", scene: petNight },
  { key: "seaside", sky: ["#8fd3ef", "#e6f7fd"], ground: "#f0d9a6", accent: "#ef6b57", deco: "bubbles", scene: seaside },
];
