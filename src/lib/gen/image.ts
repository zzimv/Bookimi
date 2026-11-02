// ImageProvider: лист персонажа → сцены. Провайдер меняется в админке.
//  demo      — SVG-иллюстрации без GPU (art/render.ts: тема сюжета, герой по виду, доп. герои, стиль, настроение)
//  qwen      — Qwen-Image-Edit-2511 на своём GPU в Yandex Cloud (фото не покидает РФ)
//  kandinsky — Kandinsky 5.0 I2I Lite на том же сервере (запасной)
// Промпт = стиль картинок (art/*.ts) + сцена + герой по виду (ребёнок/подросток/взрослый/питомец) + настроение.
import { artStyle } from "../../content/art/index";
import { renderDemoSpread, type DemoCrowdMember } from "../../content/art/render";
import { moodPrompt } from "../../content/art/mood";
import { HUMAN_FACE_GUARD } from "../../content/art/trial";
import { ART_STYLE_OWNERS, type ArtStyle, type DemoExtra, type DemoLook, type HeroKind, type Mood } from "../../content/types";
import { authHeader, ensureGpuUp, touchGpu } from "./gpu";

export interface HeroRef {
  role: string; // main | sibling | mom | partner | owner ...
  description: string; // внешность из анкеты (для промпта)
  photos: Buffer[]; // подготовленные фото (может быть пусто — тогда по описанию)
  sheet?: Buffer | null;
  /** Внешность для демо-рисовальщика. */
  look?: DemoLook;
  /** Как рисовать доп. героя в демо (если не по роли). */
  drawKind?: DemoExtra["kind"];
}

export interface SceneJob {
  plot: { slug: string; theme: string; heroKind: HeroKind };
  index: number; // 0 — обложка, 1..12 — развороты
  scene: string;
  /** id стиля картинок (ART_STYLE_IDS). */
  style: string;
  /** Настроение (MOODS) или null. */
  mood: Mood | null;
  heroes: HeroRef[];
  age: number;
  gender?: string;
  preview: boolean;
  /** Заголовок обложки (демо). */
  title?: string;
  /** Группа на развороте (сцены с {GROUP}): демо рисует фигуры рядами; GPU получает группу словами в сцене. */
  crowd?: DemoCrowdMember[];
  /** photo — «общая фотография» (разворот с {ПЕРЕКЛИЧКА}): герой в центре первого ряда. */
  crowdLayout?: "around" | "photo";
}

export interface ImageResult {
  data: Buffer;
  contentType: string;
  ext: "png" | "svg";
  gpuSeconds: number;
  costKopecks: number;
}

export interface ImageProvider {
  name: string;
  sheet(hero: HeroRef, job: Pick<SceneJob, "plot" | "style" | "age" | "gender">): Promise<ImageResult | null>;
  scene(job: SceneJob): Promise<ImageResult>;
}

export class DemoImageProvider implements ImageProvider {
  name = "demo";
  async sheet() {
    return null;
  }
  async scene(job: SceneJob): Promise<ImageResult> {
    const [main, ...rest] = job.heroes;
    const svg = renderDemoSpread({
      plot: job.plot,
      spreadIndex: job.index,
      artStyle: job.style,
      mood: job.mood,
      hero: { ...(main?.look ?? {}), kind: job.plot.heroKind },
      extras: rest.map((h) => ({ role: h.role, kind: h.drawKind, look: h.look ?? {} })),
      caption: "демо-иллюстрация · подключите GPU в админке",
      crowd: job.crowd,
      crowdLayout: job.crowdLayout,
      // Название не рисуем в картинку: обложку подписывают сайт и PDF (как у иллюстраций GPU) — иначе оно дважды
      title: undefined,
      scene: job.scene,
    });
    return { data: Buffer.from(svg), contentType: "image/svg+xml", ext: "svg", gpuSeconds: 0, costKopecks: 0 };
  }
}

// ── Промпт для Qwen ──

const OWNER_KIND: Record<string, HeroKind> = { kids: "child", teens: "teen", adults: "adult", pets: "pet" };

/** Фразы «сохранения героя», которые художники вшили в промпт своих стилей (для чужой аудитории убираем). */
const OWN_IDENTITY: Record<HeroKind, RegExp> = {
  child: /\s*The child keeps the exact face[\s\S]*$/,
  teen: /,?\s*the main character is a teenager[\s\S]*?consistent/,
  adult: /,?\s*the adult faces keep the exact likeness[\s\S]*?tasteful adult proportions/,
  pet: /;?\s*the hero is the specific pet[\s\S]*?unless the scene asks for them/,
};

/** Кто герой — для стилей чужой аудитории (свой стиль уже содержит такую фразу). */
function identityFor(kind: HeroKind, age: number, gender: string | undefined, withPhoto: boolean): string {
  const ref = withPhoto ? "keeps the exact face from the reference photo, instantly recognizable" : "is drawn the same on every page, following the hero description";
  switch (kind) {
    case "child":
      return `The main hero is a ${age}-year-old ${gender === "girl" ? "girl" : "boy"} with child proportions who ${ref}.`;
    case "teen":
      return `The main hero is a ${age}-year-old teenage ${gender === "girl" ? "girl" : "boy"} with realistic teen proportions who ${ref}.`;
    case "adult":
      return `The main hero is an adult ${gender === "girl" ? "woman" : "man"} with natural adult proportions who ${ref}; when two people are shown, both are equally clear and recognizable.`;
    case "pet":
      return `The main hero is the specific pet ${withPhoto ? "from the reference photo" : "from the description"}: same species, breed traits, fur color and markings, natural four-legged anatomy, only lightly anthropomorphic.`;
  }
}

/**
 * Общая фраза «тот же человек — другая техника». Добавляется к промпту КАЖДОГО стиля (свои и чужие аудитории,
 * пробные) — и в сценах, и в листе персонажа. Для питомца — «то же животное».
 */
export const IDENTITY_CLAUSE =
  "Use the uploaded image as a strict reference for the person. Depict the same person as a clearly human character. Preserve their recognizable identity, facial features, age, hairstyle, expression and body proportions. Apply a visual style transformation only. Do not turn the person into an animal, mascot, toy or another character, and never replace them with an existing cartoon, film or book character. Keep natural human anatomy, natural human eyes and recognizable facial features.";
export const IDENTITY_CLAUSE_NO_PHOTO =
  "Follow the hero description strictly and draw the same person on every page. Depict them as a clearly human character with natural human anatomy and natural human eyes. Apply a visual style only; do not turn the person into an animal, mascot, toy or another character, and never replace them with an existing cartoon, film or book character.";
export const PET_IDENTITY_CLAUSE =
  "Use the uploaded image as a strict reference for the animal. Depict the same animal: same species, breed traits, fur color and markings, eye color and body proportions. Apply a visual style transformation only. Do not turn the pet into a different animal, a mascot, a toy, a human or another character, and never replace it with an existing cartoon character.";
export const PET_IDENTITY_CLAUSE_NO_PHOTO =
  "Follow the pet description strictly and draw the same animal on every page: same species, breed traits, fur color and markings. Apply a visual style only; do not turn the pet into a different animal, a mascot, a toy, a human or another character.";

/** Общий негатив сохранения личности (добавляется ко всем стилям). */
const IDENTITY_NEGATIVE: Record<"human" | "pet", string> = {
  human: "different person, another character, existing cartoon character, person turned into an animal, animal muzzle on a person, animal ears on a person, mascot costume, toy-like face",
  pet: "different animal, different breed, changed fur markings, human face on the animal, existing cartoon character, plush toy",
};

export function identityClause(kind: HeroKind, withPhoto: boolean) {
  if (kind === "pet") return withPhoto ? PET_IDENTITY_CLAUSE : PET_IDENTITY_CLAUSE_NO_PHOTO;
  return withPhoto ? IDENTITY_CLAUSE : IDENTITY_CLAUSE_NO_PHOTO;
}

/** Анти-искажения лица человека (HUMAN_FACE_GUARD пробных стилей) питомцу не нужны: у него свои морда и уши. */
const PET_FACE_GUARD_DROP = HUMAN_FACE_GUARD.split(",").map((t) => t.trim().toLowerCase());

/** Слова негатива, которые спорят с видом героя (стиль одной аудитории для героя другой). */
const NEG_CONFLICTS: Record<HeroKind, string[]> = {
  child: ["human body", "human hands", "animal standing upright like a person", "humanized clothing"],
  teen: ["adult proportions", "adult body", "aged-up face", "human body", "human hands", "animal standing upright like a person", "humanized clothing"],
  adult: ["adult proportions", "adult body", "aged-up face", "makeup", "human body", "human hands", "animal standing upright like a person", "humanized clothing"],
  pet: ["multiple copies of the child", "duplicate child", "different person"],
};

/** Сцена прямо просит костюм — тогда не запрещаем одежду и костюмы (просьба art/pets.ts). */
const COSTUME_SCENE = /costume|carnival|masquerade|fancy dress|dressed (up|as)|santa hat|party hat|festive hat|knitted (sweater|scarf)|bow tie|wearing a (scarf|sweater|hat|bow)/i;

/**
 * Без фото: в промпте стиля не должно быть «точное лицо с фото» — модель ищет несуществующую ссылку.
 * Фразы стилей (kids, teens, adults, pets) переводим на «как в описании, одинаково на каждой странице».
 */
export function noPhotoIdentity(prompt: string) {
  return prompt
    .replace(/keeps? the exact face from the reference photo/gi, "looks the same on every page, exactly as in the hero description")
    .replace(/keep the exact likeness of the people in the reference photos/gi, "stay the same people on every page, exactly as in the description")
    .replace(/keep the (facial features, face shape, skin tone and hairstyle) from the reference photo/gi, "keep the $1 from the hero description")
    .replace(/is the specific pet from the reference photo/gi, "is the specific pet from the description")
    .replace(/from the reference photos?/gi, "from the description");
}

export function stylePrompt(style: ArtStyle | null, styleId: string, kind: HeroKind, withPhoto = true) {
  if (!style) return { prompt: styleId, negative: "text, letters, watermark, logo, signature, photo, photorealistic", own: false };
  const ownerKind = OWNER_KIND[ART_STYLE_OWNERS[style.id] ?? ""];
  if (ownerKind === kind) return { prompt: withPhoto ? style.prompt : noPhotoIdentity(style.prompt), negative: style.negative, own: true };
  return { prompt: ownerKind ? style.prompt.replace(OWN_IDENTITY[ownerKind], "").trim() : style.prompt, negative: style.negative, own: false };
}

export function filterNegative(negative: string, kind: HeroKind, scene: string) {
  const drop = new Set(NEG_CONFLICTS[kind]);
  if (kind === "pet") for (const t of PET_FACE_GUARD_DROP) drop.add(t);
  if (COSTUME_SCENE.test(scene)) {
    drop.add("costumes");
    drop.add("humanized clothing");
    drop.add("superhero costumes");
  }
  const seen = new Set<string>();
  return [negative, IDENTITY_NEGATIVE[kind === "pet" ? "pet" : "human"]]
    .join(",")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      const k = t.toLowerCase();
      if (!t || drop.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(", ");
}

const SPECIES_EN: [RegExp, string][] = [
  [/^cat$/, "a pet cat (a real cat, not a dog)"],
  [/^dog$/, "a pet dog (a real dog, not a cat)"],
  [/крол|заяц|rabbit|bunny/i, "a pet rabbit"],
  [/хомя|морск|шиншил|крыс|мыш|hamster|guinea|rat|mouse/i, "a small pet rodent"],
  [/попуг|птиц|канар|parrot|bird/i, "a pet bird"],
  [/черепах|turtle|tortoise/i, "a pet turtle"],
];

/**
 * Кто доп. герой — по-английски, без имён (имена в промпт не уходят): роль, пол, возраст, вид питомца, предмет.
 * «the hero's mother, an adult woman», «a pet cat (a real cat, not a dog)», «the hero's favourite toy: …».
 */
export function extraPromptWho(h: HeroRef, heroKind: HeroKind): string {
  const look = h.look ?? {};
  const girl = look.gender === "girl";
  const kid = heroKind === "child" ? "child" : heroKind === "teen" ? "teenager" : "person";
  switch (h.role) {
    case "mom":
      return "the hero's mother, an adult woman";
    case "dad":
      return "the hero's father, an adult man";
    case "grandma":
      return "the hero's grandmother, an elderly woman";
    case "grandpa":
      return "the hero's grandfather, an elderly man";
    case "sibling":
      return `the hero's ${girl ? "sister" : "brother"}, a ${girl ? "girl" : "boy"} (${kid})`;
    case "friend":
      return `the hero's friend, a ${girl ? "girl" : "boy"} (${kid})`;
    case "pet": {
      const sp = String(look.species ?? "");
      return SPECIES_EN.find(([re]) => re.test(sp))?.[1] ?? "the family pet (a small animal)";
    }
    case "toy":
      return "the hero's favourite toy, drawn as a toy object";
  }
  if (h.drawKind === "custom") return `a friendly ${h.role}, drawn as an object, not a person`;
  return h.role;
}

/** Полный промпт сцены для GPU: стиль + сцена + герой + доп. герои + настроение. */
export function scenePrompt(job: SceneJob): { prompt: string; negative: string } {
  const kind = job.plot.heroKind;
  const main = job.heroes[0];
  const withPhoto = Boolean(main?.photos.length);
  const st = stylePrompt(artStyle(job.style), job.style, kind, withPhoto);
  const extras = job.heroes
    .slice(1)
    .map((h) => `${extraPromptWho(h, kind)}${h.description ? ` (${h.description})` : ""}`)
    .join("; ");
  const refs = withPhoto ? "The first images are references of the main hero (photo and character sheet). Draw this same hero. " : "";
  const prompt = [
    `${refs}Scene: ${job.scene}.`,
    st.own ? "" : identityFor(kind, job.age, job.gender, withPhoto),
    main?.description ? `Main hero details: ${main.description}.` : "",
    extras ? `Also in the scene, each clearly visible next to the main hero: ${extras}.` : "",
    `Style: ${st.prompt}`,
    identityClause(kind, withPhoto),
    "Leave calm space at the edges for page cropping.",
  ]
    .filter(Boolean)
    .join(" ");
  return moodPrompt(prompt, filterNegative(st.negative, kind, job.scene), job.mood);
}

export class GpuImageProvider implements ImageProvider {
  constructor(public name: "qwen" | "kandinsky", private hourlyRub: number) {}

  private async call(path: string, body: object) {
    await ensureGpuUp();
    const r = await fetch(`${process.env.GPU_SERVER_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ model: this.name, ...body }),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!r.ok) throw new Error(`GPU ${path} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { image: string; seconds: number; nsfw?: number };
    if ((j.nsfw ?? 0) > 0.5) throw new Error("модерация: иллюстрация отклонена");
    await touchGpu();
    const gpuSeconds = Math.round(j.seconds);
    return {
      data: Buffer.from(j.image, "base64"),
      contentType: "image/png",
      ext: "png" as const,
      gpuSeconds,
      costKopecks: Math.round((gpuSeconds / 3600) * this.hourlyRub * 100),
    };
  }

  async sheet(hero: HeroRef, job: Pick<SceneJob, "plot" | "style" | "age" | "gender">) {
    if (!hero.photos.length) return null;
    const kind = job.plot.heroKind;
    const st = stylePrompt(artStyle(job.style), job.style, kind);
    const views = kind === "pet" ? "front view, three-quarter view, side view, full body standing on four legs" : "front view, three-quarter view, side profile, full body standing";
    return this.call("/v1/edit", {
      images: hero.photos.map((p) => p.toString("base64")),
      prompt: `Character reference sheet of the hero from the photo. Four views on one plain light background: ${views}. ${identityFor(kind, job.age, job.gender, true)} ${hero.description}. Style: ${st.prompt} ${identityClause(kind, true)}`,
      negative: filterNegative(st.negative, kind, ""),
      seed: 1,
    });
  }

  async scene(job: SceneJob) {
    const images: string[] = [];
    for (const h of job.heroes) {
      for (const p of h.photos.slice(0, 1)) images.push(p.toString("base64"));
      if (h.sheet) images.push(h.sheet.toString("base64"));
    }
    const { prompt, negative } = scenePrompt(job);
    return this.call("/v1/edit", {
      images,
      prompt,
      negative,
      width: job.index === 0 ? 1536 : 2048,
      height: job.index === 0 ? 1536 : 1024,
      // Книга (не превью): сервер увеличивает до печатного размера — 300 dpi на 21×21 см + вылеты
      // (разворот 2 × 2551 px, обложка с загибом 2900 px); без апскейлера на сервере — Lanczos, и предупреждение в админке
      ...(job.preview ? {} : job.index === 0 ? { out_width: PRINT_COVER_PX, out_height: PRINT_COVER_PX } : { out_width: PRINT_SPREAD_PX[0], out_height: PRINT_SPREAD_PX[1] }),
      steps: job.preview ? 30 : 40,
      seed: job.index + 11,
      text2img: images.length === 0,
    });
  }
}

/** Печатный размер иллюстраций (300 dpi, самый большой формат 210×210 мм + вылеты 3 мм; обложка — с загибом 17 мм). */
export const PRINT_SPREAD_PX: [number, number] = [5102, 2551];
export const PRINT_COVER_PX = 2900;

export function imageProvider(name: string, hourlyRub: number): ImageProvider {
  if (name === "qwen" || name === "kandinsky") return new GpuImageProvider(name, hourlyRub);
  return new DemoImageProvider();
}
