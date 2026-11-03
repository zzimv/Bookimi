// ВЛАДЕЛЕЦ: агент 10 (настроения иллюстраций). Никто другой этот файл не меняет.
//
// MOODS — настроения, которые покупатель выбирает для всех картинок книги. Первое — по умолчанию
// («как задумал художник», ничего не меняет). Для каждого: id (латиница, не совпадает со стилями картинок),
// title и oneLine (ru, для покупателя), audiences (кому подходит), promptAdd / negativeAdd (EN для Qwen:
// только свет, цвет, время суток и атмосфера — сюжет, композицию и лица не трогаем), demo — как applyMood
// меняет SVG демо (src/content/art/mood.ts).
//
// Анкета показывает moodsFor(audience, age): романтичное — только взрослым и подросткам 14+,
// сонное — детям и питомцам. Поля audiences/minAge — в типе Mood (types.ts).

import type { AudienceKey, Mood } from "./types";
import type { MoodDemo } from "./art/mood";

/** Настроение с обязательным списком аудиторий и расширенным демо-блоком. */
export interface MoodEx extends Omit<Mood, "demo" | "audiences"> {
  audiences: AudienceKey[];
  demo: MoodDemo;
  /** rev 17: скрыто от покупателей везде (код оставлен); сохранённое скрытое настроение → «как задумал художник». */
  hidden?: boolean;
}

/** Хвост каждой добавки: настроение меняет только свет и цвет. */
// Настроение не меняет время суток и место сцены: ночная сцена остаётся ночной, космос — космосом (54 ночные сцены)
const KEEP = "keep the scene's own time of day, weather and setting; keep the same characters, faces, outfits, poses and composition unchanged; only lighting, color and atmosphere change";
const ALL: AudienceKey[] = ["CHILD", "TEEN", "ADULT", "PET"];

export const MOODS: MoodEx[] = [
  {
    id: "as-drawn",
    title: "Как задумал художник",
    oneLine: "Цвета и свет стиля без изменений",
    audiences: ALL,
    promptAdd: "",
    negativeAdd: "",
    demo: { tint: "#ffffff", saturation: 1, brightness: 1 },
  },
  {
    id: "warm",
    hidden: true, // rev 17: скрыто от покупателей
    title: "Тёплое",
    oneLine: "Золотой вечерний свет, как в уютный летний вечер",
    audiences: ALL,
    promptAdd: `warm amber and honey light, peach color temperature, soft long shadows, cozy glowing atmosphere, ${KEEP}`,
    negativeAdd: "cold blue cast, harsh flash lighting, desaturated grey tones",
    demo: {
      tint: "#ffcf8f", tintStrength: 0.32, saturation: 1.08, brightness: 1.06, contrast: 1.02,
      light: { top: "#ffd89a", topOpacity: 0.32, bottom: "#c2602a", bottomOpacity: 0.16 },
      glow: { color: "#ffe2a8", x: 0.82, y: 0.14, r: 0.42, opacity: 0.55 },
      fx: ["sunrays"],
    },
  },
  {
    id: "magic",
    title: "Волшебное",
    oneLine: "Сияние, искорки и сказочные сиреневые сумерки",
    audiences: ALL,
    promptAdd: `magical enchanted atmosphere, soft violet and turquoise glow, gentle glowing sparkles and floating light motes in the air, luminous rim light, dreamy fairy-tale glow, ${KEEP}`,
    negativeAdd: "dull flat lighting, muddy colors, horror, dark menacing shadows",
    demo: {
      tint: "#c9b2ff", tintStrength: 0.34, saturation: 1.15, brightness: 1.0, contrast: 1.04,
      light: { top: "#6b4bc4", topOpacity: 0.32, bottom: "#2fb7c4", bottomOpacity: 0.18 },
      glow: { color: "#f1dcff", x: 0.5, y: 0.35, r: 0.4, opacity: 0.4 },
      extraDeco: "sparkles", decoCount: 30,
      fx: ["bokeh"], decoColor: "#e6d4ff",
    },
  },
  {
    id: "cheerful",
    title: "Весёлое",
    oneLine: "Яркий солнечный день, сочные краски",
    audiences: ALL,
    promptAdd: `bright cheerful light, vivid saturated playful colors, crisp clean light, high-key joyful atmosphere, ${KEEP}`,
    negativeAdd: "gloomy, muted palette, sad atmosphere",
    demo: {
      tint: "#fff1b8", tintStrength: 0.18, saturation: 1.35, brightness: 1.07, contrast: 1.06,
      light: { top: "#fff6c8", topOpacity: 0.22, bottom: "#ffffff", bottomOpacity: 0 },
      extraDeco: "bubbles", decoCount: 24,
    },
  },
  {
    id: "sleepy",
    hidden: true, // rev 17: скрыто от покупателей
    title: "Сонное",
    oneLine: "Тихий вечер, луна и светлячки — для книги на ночь",
    audiences: ["CHILD", "PET"],
    promptAdd: `calm sleepy hushed atmosphere, soft gentle light, deep blue and lavender palette, warm small glowing lights, gentle low contrast, ${KEEP}`,
    negativeAdd: "harsh light, neon colors, scary darkness, high contrast",
    demo: {
      tint: "#7f94d6", tintStrength: 0.42, saturation: 0.78, brightness: 0.93, contrast: 0.92,
      light: { top: "#1d2456", topOpacity: 0.55, bottom: "#1a1f40", bottomOpacity: 0.3 },
      glow: { color: "#fff6d2", x: 0.12, y: 0.12, r: 0.22, opacity: 0.55 },
      vignette: { color: "#141a3a", opacity: 0.45 },
      extraDeco: "stars", decoCount: 26,
      fx: ["fireflies"],
    },
  },
  {
    id: "festive",
    title: "Праздничное",
    oneLine: "Конфетти, огоньки и ощущение праздника",
    audiences: ALL,
    // rev 17: гирлянды и огоньки (не снег — снег у «Зимнего»)
    promptAdd: `festive celebration atmosphere, colorful garlands and paper bunting, warm sparkling string lights and bokeh, confetti, rich red gold and teal accents in the lighting, joyful glow, ${KEEP}`,
    negativeAdd: "dull, gloomy, empty, muted grey palette, rain, snowfall added to the scene",
    demo: {
      tint: "#ffd6cc", tintStrength: 0.2, saturation: 1.22, brightness: 1.04, contrast: 1.05,
      light: { top: "#ffcf6e", topOpacity: 0.18, bottom: "#b8325a", bottomOpacity: 0.14 },
      extraDeco: "confetti", decoCount: 46,
      fx: ["bokeh", "garland"], decoColor: "#ffd36e",
    },
  },
  {
    id: "adventure",
    title: "Приключенческое",
    oneLine: "Сочный контраст, ветер и закатное небо — как в кино",
    audiences: ALL,
    promptAdd: `cinematic adventurous lighting, contrast of warm orange highlights and cool teal shadows, crisp directional light, breezy energetic atmosphere, ${KEEP}`,
    negativeAdd: "flat lighting, washed out, boring composition changes, dull overcast",
    demo: {
      tint: "#ffbf80", tintStrength: 0.2, saturation: 1.12, brightness: 1.0, contrast: 1.16,
      light: { top: "#1f6f86", topOpacity: 0.32, bottom: "#ff8a3c", bottomOpacity: 0.2 },
      glow: { color: "#ffb36b", x: 0.92, y: 0.3, r: 0.38, opacity: 0.5 },
      vignette: { color: "#10262e", opacity: 0.3 },
      extraDeco: "leaves", decoCount: 16, decoColor: "#e2963c",
    },
  },
  {
    id: "tender",
    hidden: true, // rev 17: скрыто от покупателей
    title: "Нежное",
    oneLine: "Пастельные тона и мягкий утренний свет",
    audiences: ALL,
    promptAdd: `soft tender light, airy pastel palette of blush pink, cream and powder blue, gentle diffused glow, delicate low contrast, calm loving atmosphere, ${KEEP}`,
    negativeAdd: "harsh shadows, saturated neon colors, dark tones, gritty texture",
    demo: {
      tint: "#ffd2df", tintStrength: 0.28, saturation: 0.82, brightness: 1.08, contrast: 0.9,
      light: { top: "#fff4f7", topOpacity: 0.42, bottom: "#ffe1ea", bottomOpacity: 0.2 },
      glow: { color: "#fff7f0", x: 0.2, y: 0.1, r: 0.45, opacity: 0.45 },
      fx: ["bokeh"], decoColor: "#ffc4d6",
    },
  },
  {
    id: "retro",
    hidden: true, // rev 17: скрыто от покупателей
    title: "Ретро",
    oneLine: "Тёплая выцветшая плёнка, как старая открытка",
    audiences: ALL,
    promptAdd: `vintage retro look, faded warm film colors, sepia and mustard tones, soft paper grain, gentle vignette, nostalgic old postcard atmosphere, ${KEEP}`,
    negativeAdd: "modern glossy render, neon colors, oversaturated, digital sharpness",
    demo: {
      tint: "#e9c48f", tintStrength: 0.45, saturation: 0.55, brightness: 1.02, contrast: 0.92,
      light: { top: "#f6e3bb", topOpacity: 0.2, bottom: "#7a5232", bottomOpacity: 0.12 },
      vignette: { color: "#4a2f1a", opacity: 0.45 },
      fx: ["grain"],
    },
  },
  {
    id: "wintry",
    title: "Зимнее",
    oneLine: "Снег на земле и деревьях, снежинки и тёплые окна",
    audiences: ALL,
    // rev 17: зима видна сразу — снег на земле, ветках и крышах, снегопад, холодный бело-голубой свет и тёплые окна;
    // на улице герои в шапках и шарфах, пар изо рта. В помещении — снегопад за окном. Отличается от ночи и от «Праздничного».
    promptAdd: "snowy winter version of the same scene: fresh white snow covering the ground, snow caps on tree branches, roofs, fences and benches, gently falling snowflakes, cool blue-white winter light with warm glowing windows, outdoor characters dressed warmly in knitted hats, scarves and mittens with a little frosty breath; indoors show snow falling outside the window; keep the scene's own time of day and place; keep the same characters, faces, poses and composition unchanged; keep areas for text calm and readable",
    negativeAdd: "summer, green summer foliage, flowers in bloom, rain, puddles, bare dry ground, sunburnt warm orange cast, swimwear, holiday garlands as the main feature",
    demo: {
      tint: "#c4d8ff", tintStrength: 0.4, saturation: 0.78, brightness: 1.08, contrast: 1.0,
      light: { top: "#e6efff", topOpacity: 0.32, bottom: "#ffffff", bottomOpacity: 0.12 },
      glow: { color: "#ffc670", x: 0.1, y: 0.58, r: 0.18, opacity: 0.4 },
      extraDeco: "snow", decoCount: 110, decoColor: "#ffffff",
      fx: ["snowfall"],
    },
  },
  {
    id: "romantic",
    hidden: true, // rev 17: скрыто от покупателей
    title: "Романтичное",
    oneLine: "Розово-золотой закат и мягкие блики",
    audiences: ["ADULT", "TEEN"],
    minAge: 14,
    promptAdd: `romantic rose-gold light, soft coral glow, warm dreamy bokeh, gentle haze, tender intimate atmosphere, ${KEEP}`,
    negativeAdd: "harsh light, cold grey palette, gloomy, explicit content",
    demo: {
      tint: "#ffb8b0", tintStrength: 0.3, saturation: 1.05, brightness: 1.02, contrast: 0.98,
      light: { top: "#ff9e8a", topOpacity: 0.3, bottom: "#7b3a6a", bottomOpacity: 0.18 },
      glow: { color: "#ffd0a8", x: 0.72, y: 0.42, r: 0.42, opacity: 0.5 },
      extraDeco: "hearts", decoCount: 14, decoColor: "#ff8fa8",
      fx: ["bokeh"],
    },
  },
];

/** Настроения для аудитории (и возраста героя, если известен). Первое — всегда «как задумал художник». */
export function moodsFor(audience: AudienceKey, age?: number): MoodEx[] {
  return VISIBLE_MOODS.filter((m) => m.audiences.includes(audience) && (m.minAge === undefined || audience !== "TEEN" || (age !== undefined && age >= m.minAge)));
}

/** rev 17 (решение владельца): покупатель видит «Как задумал художник» и пять настроений — в этом порядке. */
export const LIVE_MOOD_IDS = ["as-drawn", "adventure", "festive", "cheerful", "wintry", "magic"] as const;
/** Видимые настроения в порядке LIVE_MOOD_IDS (скрытые — hidden — не показываются нигде). */
export const VISIBLE_MOODS: MoodEx[] = LIVE_MOOD_IDS.map((id) => MOODS.find((m) => m.id === id)!).filter((m) => m && !m.hidden);
/** Сохранённое настроение → видимое: скрытое или неизвестное → "" («как задумал художник»). */
export function liveMoodId(id: string | null | undefined): string {
  const v = (id ?? "").trim();
  return v && v !== "as-drawn" && VISIBLE_MOODS.some((m) => m.id === v) ? v : "";
}
