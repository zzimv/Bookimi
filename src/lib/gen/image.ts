// ImageProvider: лист персонажа → сцены. Провайдер меняется в админке.
//  demo      — SVG-иллюстрации без GPU (для разработки и показа)
//  qwen      — Qwen-Image-Edit-2511 на своём GPU в Yandex Cloud (фото не покидает РФ)
//  kandinsky — Kandinsky 5.0 I2I Lite на том же сервере (запасной)
import { demoSceneSvg, THEME_BY_STORY } from "./demo-art";
import { authHeader, ensureGpuUp, touchGpu } from "./gpu";

export interface HeroRef {
  role: string; // main | sibling | mom ...
  description: string; // внешность из анкеты (для промпта)
  photos: Buffer[]; // подготовленные фото (может быть пусто — тогда по описанию)
  sheet?: Buffer | null;
  demo?: { hair?: string; gender?: string; glasses?: boolean; longHair?: boolean };
}

export interface SceneJob {
  storySlug: string;
  index: number; // 0 — обложка, 1..12 — развороты
  scene: string;
  style: string;
  heroes: HeroRef[];
  age: number;
  gender?: string;
  preview: boolean;
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
  sheet(hero: HeroRef, style: string, age: number, gender?: string): Promise<ImageResult | null>;
  scene(job: SceneJob): Promise<ImageResult>;
}

export class DemoImageProvider implements ImageProvider {
  name = "demo";
  async sheet() {
    return null;
  }
  async scene(job: SceneJob): Promise<ImageResult> {
    const main = job.heroes[0];
    const svg = demoSceneSvg({
      theme: THEME_BY_STORY[job.storySlug] ?? "dragon",
      index: job.index,
      hero: main?.demo ?? {},
      extras: job.heroes.length - 1,
      caption: "демо-иллюстрация · подключите GPU в админке",
      watermark: false,
    });
    return { data: Buffer.from(svg), contentType: "image/svg+xml", ext: "svg", gpuSeconds: 0, costKopecks: 0 };
  }
}

const IDENTITY =
  "The child must look exactly like the child in the reference photo: same face shape, eyes and eye color, eyebrows, nose, mouth, cheeks, ears, hair color and haircut. Keep realistic child proportions. Do not beautify, do not change age, do not caricature the face.";
const NEGATIVE =
  "photo, photorealistic, 3d render, adult face, distorted face, extra fingers, deformed hands, text, letters, watermark, logo, signature, frame, multiple copies of the child";

export class GpuImageProvider implements ImageProvider {
  constructor(public name: "qwen" | "kandinsky", private hourlyRub: number, private styles: Record<string, string>) {}

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

  async sheet(hero: HeroRef, style: string, age: number, gender?: string) {
    if (!hero.photos.length) return null;
    const who = gender === "girl" ? "girl" : "boy";
    return this.call("/v1/edit", {
      images: hero.photos.map((p) => p.toString("base64")),
      prompt: `Character reference sheet of the child from the photo, drawn as ${this.styles[style] ?? style}. Four views on one plain light background: front view, three-quarter view, side profile, full body standing. The child is a ${age}-year-old ${who}. ${hero.description}. ${IDENTITY}`,
      negative: NEGATIVE,
      seed: 1,
    });
  }

  async scene(job: SceneJob) {
    const main = job.heroes[0];
    const images: string[] = [];
    let refs = "";
    for (const h of job.heroes) {
      for (const p of h.photos.slice(0, 1)) images.push(p.toString("base64"));
      if (h.sheet) images.push(h.sheet.toString("base64"));
    }
    if (main?.photos.length) refs = "The first images are references of the main child (photo and character sheet). Draw this same child. ";
    const who = job.gender === "girl" ? "girl" : "boy";
    const extras = job.heroes.slice(1).map((h) => `${h.role}: ${h.description}`).join("; ");
    return this.call("/v1/edit", {
      images,
      prompt: `${refs}Children's book illustration. Scene: ${job.scene}. Style: ${this.styles[job.style] ?? job.style}. The main child is a ${job.age}-year-old ${who}. ${main?.description ?? ""}. ${extras ? `Also in the scene: ${extras}.` : ""} ${main?.photos.length ? IDENTITY : ""} Leave calm space at the edges for page cropping.`,
      negative: NEGATIVE,
      width: job.index === 0 ? 1536 : 2048,
      height: job.index === 0 ? 1536 : 1024,
      steps: job.preview ? 30 : 40,
      seed: job.index + 11,
      text2img: images.length === 0,
    });
  }
}

export const STYLE_PROMPTS: Record<string, string> = {
  "watercolor-air":
    "delicate children's book illustration, thin slightly wobbly pen-and-ink outline, transparent watercolor washes, lots of untouched white paper, pale sky blue, butter yellow and soft green, naive simple shapes, quiet poetic mood",
  "kind-classic":
    "classic mid-century children's book illustration, confident clean black ink contour, flat soft colors with gentle shading, pale paper background, round friendly forms, expressive kind faces, subtle printed paper texture",
  "folk-lubok":
    "Russian folk naive painting for a children's book, matte gouache, bold flat decorative shapes, ornamental flowers and patterned borders, deep red, ochre, black, emerald and cream palette, cheerful festive mood",
  "ink-humor":
    "lively black ink line drawing for a children's book, expressive gesture, light cross-hatching, white background, one warm accent color, gentle humor, face drawn with careful realistic proportions",
  "cozy-detail":
    "richly detailed ink and watercolor children's book illustration, warm earthy palette, cozy scene full of tiny objects and small hidden creatures, soft daylight, careful fine linework",
};

export function imageProvider(name: string, hourlyRub: number): ImageProvider {
  if (name === "qwen" || name === "kandinsky") return new GpuImageProvider(name, hourlyRub, STYLE_PROMPTS);
  return new DemoImageProvider();
}
