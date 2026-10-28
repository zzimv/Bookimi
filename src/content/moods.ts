// ВЛАДЕЛЕЦ: агент 10 (настроения иллюстраций). Никто другой этот файл не меняет.
//
// MOODS — настроения, которые покупатель выбирает для всех картинок книги. Первое — по умолчанию
// («как задумал художник», ничего не меняет). Для каждого: id (латиница, не совпадает со стилями картинок),
// title и oneLine (ru, для покупателя), audiences (кому подходит), promptAdd / negativeAdd (EN для Qwen:
// только свет, цвет, время суток и атмосфера — сюжет, композицию и лица не трогаем), demo — как applyMood
// меняет SVG демо (src/content/art/mood.ts).
//
// requests (просьбы к интегратору, агенту 11 / архитектору):
//  • types.ts → Mood: добавить `audiences?: AudienceKey[]`; пока поле есть в MoodEx ниже.
//  • анкета: список настроений — moodsFor(audience) (романтичное — только взрослым и подросткам 14+,
//    сонное — детям и питомцам).

import type { AudienceKey, Mood } from "./types";
import type { MoodDemo } from "./art/mood";

export interface MoodEx extends Omit<Mood, "demo"> {
  audiences: AudienceKey[];
  /** Минимальный возраст героя/читателя (для подростков). */
  minAge?: number;
  demo: MoodDemo;
}

/** Хвост каждой добавки: настроение меняет только свет и цвет. */
const KEEP = "keep the same characters, faces, outfits, poses and composition unchanged; only lighting, color and atmosphere change";
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
    title: "Тёплое",
    oneLine: "Золотой вечерний свет, как в уютный летний вечер",
    audiences: ALL,
    promptAdd: `warm golden-hour lighting, low amber sun, honey and peach color temperature, soft long shadows, cozy glowing atmosphere, ${KEEP}`,
    negativeAdd: "cold blue cast, harsh flash lighting, gloomy overcast, desaturated grey tones",
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
    promptAdd: `magical enchanted atmosphere, soft violet and turquoise twilight light, gentle glowing sparkles and floating light motes in the air, luminous rim light, dreamy fairy-tale glow, ${KEEP}`,
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
    promptAdd: `bright cheerful midday sunlight, vivid saturated playful colors, clear blue sky, crisp clean light, high-key joyful atmosphere, ${KEEP}`,
    negativeAdd: "dark, gloomy, muted palette, rain, night, sad atmosphere",
    demo: {
      tint: "#fff1b8", tintStrength: 0.18, saturation: 1.35, brightness: 1.07, contrast: 1.06,
      light: { top: "#fff6c8", topOpacity: 0.22, bottom: "#ffffff", bottomOpacity: 0 },
      extraDeco: "bubbles", decoCount: 24,
    },
  },
  {
    id: "sleepy",
    title: "Сонное",
    oneLine: "Тихий вечер, луна и светлячки — для книги на ночь",
    audiences: ["CHILD", "PET"],
    promptAdd: `calm sleepy bedtime evening, soft moonlight, deep blue and lavender dusk palette, warm small lights and fireflies, quiet hushed atmosphere, gentle low contrast, ${KEEP}`,
    negativeAdd: "bright noon sun, harsh light, neon colors, scary darkness, high contrast",
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
    promptAdd: `festive celebration atmosphere, warm sparkling party lights, bokeh of string lights, rich red gold and teal accents in the lighting, joyful glow, ${KEEP}`,
    negativeAdd: "dull, gloomy, empty, muted grey palette, rain",
    demo: {
      tint: "#ffd6cc", tintStrength: 0.2, saturation: 1.22, brightness: 1.04, contrast: 1.05,
      light: { top: "#ffcf6e", topOpacity: 0.18, bottom: "#b8325a", bottomOpacity: 0.14 },
      extraDeco: "confetti", decoCount: 46,
      fx: ["bokeh"], decoColor: "#ffd36e",
    },
  },
  {
    id: "adventure",
    title: "Приключенческое",
    oneLine: "Сочный контраст, ветер и закатное небо — как в кино",
    audiences: ALL,
    promptAdd: `cinematic adventurous lighting, dramatic sky, contrast of warm orange sunlight and cool teal shadows, crisp directional light, breezy energetic atmosphere, ${KEEP}`,
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
    title: "Нежное",
    oneLine: "Пастельные тона и мягкий утренний свет",
    audiences: ALL,
    promptAdd: `soft tender morning light, airy pastel palette of blush pink, cream and powder blue, gentle diffused glow, delicate low contrast, calm loving atmosphere, ${KEEP}`,
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
    oneLine: "Морозная свежесть и падающий снег",
    audiences: ALL,
    promptAdd: `crisp wintry atmosphere, cool clear daylight, icy blue and silver tones, gently falling snowflakes, frosty sparkle in the air, ${KEEP}`,
    negativeAdd: "summer heat, warm orange cast, green summer foliage glow, rain",
    demo: {
      tint: "#b4cdff", tintStrength: 0.5, saturation: 0.72, brightness: 1.12, contrast: 0.98,
      light: { top: "#cfe0ff", topOpacity: 0.45, bottom: "#f4f8ff", bottomOpacity: 0.4 },
      glow: { color: "#ffffff", x: 0.5, y: 0.0, r: 0.5, opacity: 0.35 },
      extraDeco: "snow", decoCount: 70,
    },
  },
  {
    id: "romantic",
    title: "Романтичное",
    oneLine: "Розово-золотой закат и мягкие блики",
    audiences: ["ADULT", "TEEN"],
    minAge: 14,
    promptAdd: `romantic sunset light, rose-gold and soft coral sky glow, warm dreamy bokeh, gentle haze, tender intimate atmosphere, ${KEEP}`,
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
  return MOODS.filter((m) => m.audiences.includes(audience) && (m.minAge === undefined || audience !== "TEEN" || (age !== undefined && age >= m.minAge)));
}
