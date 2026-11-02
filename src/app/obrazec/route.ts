// Демо-иллюстрации для витрины, каталога и «живой» обложки в анкете: SVG без GPU (renderDemoSpread).
// Это не книга покупателя — образец стиля. Параметры строго из белых списков, имя в картинку не попадает.
//   /obrazec?s=<сюжет>&i=<0..12>&st=<стиль>&m=<настроение>&k=<child|teen|adult|pet>&g=<boy|girl>&a=<возраст>
//            &h=<волосы>&hs=<причёска>&sk=<кожа>&gl=1&fr=1&b=1&sp=<dog|cat>&br=<порода>&fur=<окрас>&x=<роли через запятую>&w=1
//   &p=1 — портрет героя без сцены (выбор внешности картинкой в анкете, rev 13)
//   rev 14: &f=1 — крупно лицо, &f=2 — по пояс (к p=1 / pr=); &ey=<глаза>&sm=<smile|wide|calm>&bl=1&oc=<цвет одежды>&wm=1 (водяной знак эскиза);
//   x1..x3 — внешность доп. героев («g:girl;h:седые;gl:1;sp:cat;fur:рыжий;t:робот», src/lib/obrazec.ts):
//   мама — женщина, бабушка — седая, дедушка — с усами, кошка — кошка. Всё — по белым спискам.
import { plotBySlug, PLOTS } from "@/content/registry";
import { renderDemoCharacter, renderDemoSpread } from "@/content/art/render";
import { extraDrawKind } from "@/content/art/index";
import { ART_STYLE_IDS } from "@/content/profiles";
import { MOODS } from "@/content/moods";
import { EXTRA_ROLES, HERO_KIND_BY_AUDIENCE, type DemoExtra, type DemoLook, type HeroKind } from "@/content/types";
import { ADULT_HAIRSTYLE_F, ADULT_HAIRSTYLE_M, EYES, FUR, HAIR_ADULT, HAIRSTYLE, OUTFIT_COLOR_KEYS, SKIN, SMILES, TOYS } from "@/lib/quiz";
import { OUTFIT_COLORS } from "@/content/art/shared";
import { decodeSampleExtra } from "@/lib/obrazec";
import { extraDemoLook } from "@/lib/gen/extras";

const STYLES_ALL = [...new Set([...HAIRSTYLE, ...ADULT_HAIRSTYLE_F, ...ADULT_HAIRSTYLE_M])];

const KINDS: HeroKind[] = ["child", "teen", "adult", "pet"];
const DEFAULT_AGE: Record<HeroKind, number> = { child: 5, teen: 14, adult: 35, pet: 3 };

function pickFrom(v: string | null, list: readonly string[]) {
  return v && list.includes(v) ? v : undefined;
}

/** Внешность по умолчанию для витрины: разная по сюжету, чтобы каталог не выглядел одинаково. */
function defaultLook(kind: HeroKind, seed: number, segments: string[]): DemoLook {
  const girl = seed % 2 === 0;
  if (kind === "pet") {
    const cat = segments.includes("pet-cat") && !segments.includes("pet-dog");
    return { species: cat ? "cat" : "dog", gender: girl ? "girl" : "boy", furColor: ["рыжий", "палевый", "серый", "чёрный"][seed % 4] };
  }
  return {
    gender: girl ? "girl" : "boy",
    age: DEFAULT_AGE[kind],
    hair: ["русые", "светлые", "каштановые", "рыжие", "тёмные"][seed % 5],
    hairstyle: girl ? (seed % 4 === 0 ? "косички" : "длинные") : "короткая стрижка",
  };
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const plot = plotBySlug(q.get("s") ?? "") ?? PLOTS.find((p) => p.heroKind === q.get("k")) ?? PLOTS[0];
  const idx = Math.max(0, Math.min(12, Math.trunc(Number(q.get("i") ?? 0)) || 0));
  const kind = (KINDS.includes(q.get("k") as HeroKind) ? q.get("k") : plot.heroKind ?? HERO_KIND_BY_AUDIENCE[plot.audience]) as HeroKind;
  const style = pickFrom(q.get("st"), ART_STYLE_IDS.map((s) => s.id)) ?? plot.artStyles[0];
  const mood = pickFrom(q.get("m"), MOODS.map((m) => m.id)) ?? null;
  const seed = hash(plot.slug);
  const base = defaultLook(kind, seed, plot.segments);
  const age = Number(q.get("a"));
  const look: DemoLook = {
    ...base,
    ...(q.get("g") === "boy" || q.get("g") === "girl" ? { gender: q.get("g")! } : {}),
    ...(Number.isFinite(age) && age > 0 && age < 120 ? { age } : {}),
    ...(pickFrom(q.get("h"), HAIR_ADULT) ? { hair: q.get("h")! } : {}),
    ...(pickFrom(q.get("hs"), HAIRSTYLE) ? { hairstyle: q.get("hs")!, longHair: ["длинные", "косички", "хвостик"].includes(q.get("hs")!) } : {}),
    ...(pickFrom(q.get("sk"), SKIN) ? { skin: q.get("sk")! } : {}),
    ...(q.get("gl") === "1" ? { glasses: true } : {}),
    ...(q.get("fr") === "1" ? { freckles: true } : {}),
    ...(q.get("b") === "1" ? { beard: true } : {}),
    ...(q.get("sp") === "dog" || q.get("sp") === "cat" ? { species: q.get("sp")! } : {}),
    ...(q.get("fur") ? { furColor: pickFrom(q.get("fur"), FUR) ?? base.furColor } : {}),
    ...(pickFrom(q.get("ey"), EYES) ? { eyes: q.get("ey")! } : {}),
    ...(pickFrom(q.get("sm"), SMILES.map((x) => x.key)) ? { smile: q.get("sm")! } : {}),
    ...(q.get("bl") === "1" ? { blush: true } : {}),
    ...(pickFrom(q.get("oc"), OUTFIT_COLOR_KEYS) ? { outfit: OUTFIT_COLORS[q.get("oc")!] } : {}),
  };
  // Если пол выбран, а причёска нет — длинные волосы только у девочек
  if (q.get("g") && !q.get("hs") && kind !== "pet") {
    look.hairstyle = look.gender === "girl" ? "длинные" : "короткая стрижка";
    look.longHair = look.gender === "girl";
  }
  // Доп. герои: явный список ролей или обязательные по сюжету (пара, хозяева питомца)
  const xParam = q.get("x");
  const roles = xParam !== null ? xParam.split(",").filter((r) => (EXTRA_ROLES as readonly string[]).includes(r)).slice(0, 3) : plot.extras.min > 0 ? Array(plot.extras.min).fill(plot.extras.roles[0]) : [];
  // Внешность доп. героев — та же extraDemoLook, что у страниц книги: по роли (мама — женщина, бабушка — седая,
  // дедушка — с усами), выбор картинками (x1..x3) и вид питомца. Раньше пол брался по номеру, а вид не передавался.
  const extras: DemoExtra[] = roles.map((role, i) => {
    const d = decodeSampleExtra(role, q.get(`x${i + 1}`));
    const lk = d.look ?? {};
    const e = {
      role: role as never,
      name: "",
      gender: (["boy", "girl", "n"] as const).find((g) => g === d.gender) ?? (role === "partner" ? (look.gender === "girl" ? "boy" : "girl") : role === "owner" || role === "colleague" ? ((seed + i) % 2 ? "boy" : "girl") : undefined),
      species: (["cat", "dog", "other"] as const).find((x) => x === d.species),
      what: (d.what ?? "").replace(/[^а-яёa-z -]/gi, "").slice(0, 40),
      description: "",
      look: {
        hair: pickFrom(lk.hair ?? null, HAIR_ADULT),
        hairstyle: pickFrom(lk.hairstyle ?? null, STYLES_ALL),
        skin: pickFrom(lk.skin ?? null, SKIN),
        glasses: lk.glasses,
        beard: lk.beard,
        moustache: lk.moustache,
        fur: pickFrom(lk.fur ?? null, FUR),
        toy: pickFrom(lk.toy ?? null, TOYS),
      },
    };
    // Цвет одежды — свой у каждого доп. героя и не меняется от выбора причёски или очков
    return { role, look: extraDemoLook(e, { heroAge: look.age, partnerAge: look.age, outfit: ["#5b8fd6", "#d9734f", "#6aa86f"][i] }) };
  });

  // Портрет доп. героя (rev 14: выбор внешности мамы, бабушки, питомца, игрушки картинками): &pr=<роль>&x=<роль>&x1=…
  const pr = q.get("pr");
  const prKind = pr && (EXTRA_ROLES as readonly string[]).includes(pr) && extras[0] ? extraDrawKind(pr, kind) : null;
  const svg = prKind && prKind !== "custom"
    ? renderDemoCharacter({ kind: prKind, look: extras[0].look, artStyle: style, bg: "#e3ecd9", face: q.get("f") === "2" ? "bust" : q.get("f") === "1" })
    : q.get("p") === "1"
    ? renderDemoCharacter({ kind, look, artStyle: style, face: q.get("f") === "2" ? "bust" : q.get("f") === "1" })
    : renderDemoSpread({
    plot: { slug: plot.slug, theme: plot.theme, heroKind: kind },
    spreadIndex: idx,
    artStyle: style,
    mood,
    hero: { ...look, kind },
    extras,
    wide: q.get("w") === "1" || idx > 0,
    watermark: q.get("wm") === "1",
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "noindex",
    },
  });
}
