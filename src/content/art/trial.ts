// ВЛАДЕЛЕЦ: агент «стили картинок» (пробные стили). Остальные агенты этот файл не меняют.
//
//  • TRIAL_ART_STYLES — стили с owner "trial" в ART_STYLE_OWNERS и status "trial" в ART_STYLE_IDS (profiles.ts).
//    Пробные: видны в демо-стенде со значком «пробный», на сайте скрыты (каталог, анкета, API),
//    пока владелец не включит настройку art.showTrialStyles.
//  • Сделаны по заметкам владельца о техниках. Юридические правила: в промптах только техника —
//    линия, заливки, палитра, композиция, фон, эпоха печати, настроение и юмор. Никаких имён художников,
//    студий, франшиз и брендов, никаких узнаваемых персонажей и их примет. Герой — всегда наш покупатель
//    с фото (или его питомец), а не существующий персонаж.
//  • Общая фраза о сохранении личности добавляется ко ВСЕМ стилям при сборке промпта (src/lib/gen/image.ts,
//    IDENTITY_CLAUSE). Здесь — только техника и, где техника склонна к карикатуре, анти-искажения в негативе.
//  • demo — облик в SVG-рендере без GPU (art/render.ts: backdrop, overlays, фильтры фигур).
//
// requests: —

import type { ArtStyle } from "../types";
import { ART_STYLE_IDS } from "../profiles";

/** Общий негатив пробных стилей: техника и безопасность. */
const TRIAL_NEGATIVE =
  "photo, photorealistic, 3d render, CGI, glossy plastic look, different person, altered facial features, changed age, changed hair color, changed skin tone, distorted face, asymmetrical eyes, cross-eyed, extra fingers, missing fingers, fused fingers, deformed hands, extra limbs, text, letters, words, numbers, captions, speech bubbles, watermark, logo, signature, brand characters, franchise characters, existing cartoon characters, cartoon mascots, celebrity likeness, multiple copies of the hero, duplicate hero, sexualized, revealing clothing, gore, blood, weapons, violence";

/**
 * Анти-искажения лица для техник, склонных к карикатуре и мультяшности. Для героя-питомца
 * src/lib/gen/image.ts убирает эти слова из негатива (у питомца морда и уши — свои).
 */
export const HUMAN_FACE_GUARD =
  "person turned into an animal, animal muzzle on a person, animal ears on a person, whiskers on a person, mascot costume, toy-like face, doll face, bulging eyes, dot eyes, oversized mouth, squash and stretch on the face, rubber face, melted features, exaggerated big nose, caricature of the face";

const neg = (extra: string, guard = true) => [TRIAL_NEGATIVE, guard ? HUMAN_FACE_GUARD : "", extra].filter(Boolean).join(", ");

/** Название, описание для покупателя и аудитории — из ART_STYLE_IDS (одно место правды, без дублей в демо-бандле). */
function meta(id: string) {
  const m = ART_STYLE_IDS.find((s) => s.id === id);
  if (!m) throw new Error(`art/trial: нет ${id} в ART_STYLE_IDS`);
  return { id, title: m.title, description: m.oneLine, audiences: m.audiences, status: "trial" as const };
}

export const TRIAL_ART_STYLES: ArtStyle[] = [
  {
    ...meta("farm-cutaway"),
    prompt:
      "Detailed storybook illustration in pen and ink with soft transparent watercolor wash. Fine warm brown contour lines, never hard black, that partly dissolve into the color, delicate cross-hatching in the shadows, textured cold-press paper. Muted warm palette of ochre, olive green, dusty red and faded blue. Cozy rural farmhouse shown as a cutaway cross-section: several rooms and a workshop, slightly crooked walls and beams, cluttered shelves with jars, tools, seed packets and pots, warm lamp light. Many tiny secondary stories in the background: small mice, birds and tiny folk house spirits peeking from corners. Gentle good-natured humor, the hero is the clear focal point.",
    negative: neg("hard black outlines, flat vector art, neon colors, empty background, glossy digital gradients, clean modern interior"),
    demo: {
      palette: { paper: "#f2e7cf", ink: "#6b4a2e", accents: ["#c99a3e", "#7f8a4a", "#b65a4a", "#7f9cb0"] },
      line: "thin",
      texture: "paper",
      filter: "wobble",
      overlays: ["cutaway", "hatch"],
    },
  },
  {
    ...meta("ink-satire"),
    prompt:
      "Black and white ink pen cartoon, wordless comic panel. Clean confident linework with varied thickness, pure black ink on white paper, no color, no gray tones, no shading and almost no hatching. Small solid black fills only on shoes and hair. Minimal background: just a few floor lines and one or two props, lots of white space. Expressive body language with slightly elongated limbs and lively gestures, small radiating lines and drops to show emotion, 1930s-inspired everyday clothing. The face keeps natural proportions and the exact likeness of the reference, the humor lives in the pose and the situation. Humorous gentle satirical tone.",
    negative: neg("color, gray wash, gradients, shading, cross-hatching, dense background, screen tone, speech balloons"),
    demo: {
      palette: { paper: "#ffffff", ink: "#111111", accents: ["#ffffff", "#f2f2f2", "#111111"] },
      line: "bold",
      texture: "none",
      filter: "ink",
      backdrop: "lines",
      overlays: ["floor"],
    },
  },
  {
    ...meta("town-panorama"),
    prompt:
      "Colorful panoramic children's book illustration, busy search-and-find town scene. Gouache and watercolor in flat clear color areas without complex gradients, thin hand-drawn brown outline over the color. Bird's-eye view of a small European town street: houses with many windows, market stalls, bicycles, a bakery, a fountain, people walking dogs, many small everyday stories happening at once. Simplified friendly figures with round shapes, the hero is placed prominently in the foreground and keeps natural recognizable eyes and face. Bright fresh palette of warm yellow, terracotta, turquoise, grass green and soft red, light paper background with plenty of white space, no heavy shadows, no cross-hatching, gentle humor.",
    negative: neg("heavy shadows, cross-hatching, dark palette, dramatic lighting, empty street, hero lost in the crowd, tiny unreadable hero"),
    demo: {
      palette: { paper: "#fbf6ea", ink: "#7a4b2e", accents: ["#f2c230", "#d9734e", "#2fb3a8", "#6cb84a", "#e65a5a"] },
      line: "thin",
      texture: "paper",
      filter: "posterize",
      overlays: ["town"],
    },
  },
  {
    ...meta("pen-vignette"),
    prompt:
      "Classic English storybook illustration, fine pen and ink drawing with delicate cross-hatching. Loose sketchy contour lines with small gaps, quick scribbled grass, no solid black fills. Vignette composition without a frame: the drawing fades into untouched white paper at the edges. Heathland landscape with oak trees, ferns and heather. Optional very light muted watercolor wash in pale green, ochre and dusty blue over parts of the drawing. Gentle melancholic humor, calm and intimate.",
    negative: neg("frame, border, full-bleed background, solid black fills, saturated colors, thick cartoon outlines, digital look, toy animals, stuffed animals"),
    demo: {
      palette: { paper: "#fffdf8", ink: "#3d3a36", accents: ["#b7c9a6", "#d9c48f", "#a9bccb", "#e0c2b5"] },
      line: "sketch",
      texture: "none",
      filter: "wobble",
      backdrop: "lines",
      overlays: ["vignette", "hatch"],
    },
  },
  {
    ...meta("storyboard-book"),
    prompt:
      "Mid-century children's book illustration with an animation storyboard feel: the page is arranged like two or three cartoon frames. Clean flowing black ink outline, flat bright transparent watercolor and gouache fills in warm yellow, orange, grass green and sky blue, applied cleanly like paint on an animation cel with only slight transitions. Round soft shapes, dynamic lively cartoon poses for the body, friendly small forest animals as side companions. Very simple background: a mushroom, a few grass blades and a bit of sky on white paper. Light cheerful mood, kind humor, no heavy shading, no cross-hatching.",
    negative: neg("heavy shading, cross-hatching, detailed background, dark palette, gritty texture, realistic animals"),
    demo: {
      palette: { paper: "#ffffff", ink: "#1c1c1c", accents: ["#f6c431", "#f28b2c", "#69b545", "#5db3e6"] },
      line: "bold",
      texture: "none",
      backdrop: "wash",
      overlays: ["panels"],
    },
  },
  {
    ...meta("desert-stars"),
    prompt:
      "Minimalist naive watercolor illustration. Loose wobbly pencil line and thin ink outline, transparent pale watercolor washes with uneven edges and bleeding, large areas of untouched white paper. A vast empty sand desert with soft low dunes under a wide night or dusk sky, a few scattered stars drawn as small crosses and dots, the hero small and alone in the big quiet space. Two-tone palette of warm pale sand and soft night blue with a touch of rose. Childlike simplicity, melancholic poetic mood, no heavy shading, no digital polish.",
    negative: neg("saturated colors, thick outlines, busy background, city, forest, dramatic lighting, digital gradients, glossy finish, round tiny planet, roses on a planet"),
    demo: {
      palette: { paper: "#fbf7ee", ink: "#7a7266", accents: ["#e6cc93", "#6f8fc4", "#e7b9b0", "#c9a877"] },
      line: "sketch",
      texture: "paper",
      filter: "soft",
      backdrop: "wash",
      overlays: ["crosses"],
    },
  },
  {
    ...meta("cel-70s"),
    prompt:
      "A lively 1970s hand-drawn cel animation frame. The figures have clean, smooth, closed black ink outlines with expressive but controlled linework and flat bright gouache fills without gradients or realistic shading, a hand-painted cel feel. The background is painted separately as a soft painterly gouache picture of a 1970s city park, courtyard or building site in warm, slightly muted colors, clearly contrasting with the more saturated figures. Dynamic diagonal composition, humorous energetic mood. The person stays a clearly human character with natural anatomy.",
    negative: neg("3d, digital gloss, gradients on figures, realistic shading, text, modern smartphones, neon colors, chase of animals, wolf, hare"),
    demo: {
      palette: { paper: "#f4ead6", ink: "#141414", accents: ["#e2452f", "#2f7fd1", "#f2c12e", "#3aa655"] },
      line: "bold",
      texture: "none",
      filter: "cel",
      backdrop: "blur",
    },
  },
  {
    ...meta("painterly-tale"),
    prompt:
      "Painterly fairy tale book illustration in gouache and digital paint that imitates gouache. Rich warm saturated colors, soft volumetric lighting with a golden glow, outlines almost dissolved in the color, visible brush texture. Friendly forest animals as companions with realistic textured fur and feathers, only slightly expressive. Dynamic cinematic composition with diagonals and close-ups, a detailed atmospheric old forest background with mist and light shafts. Adventurous magical mood, children's book quality. The hero is painted with natural human proportions and a faithful likeness.",
    negative: neg("flat vector colors, thick outlines, cel shading, washed-out pale colors, horror, menacing creatures, sharp teeth"),
    demo: {
      palette: { paper: "#f3e3c3", ink: "#4a3020", accents: ["#c9622f", "#2f6b4f", "#e2a73a", "#7a3e6b"] },
      line: "none",
      texture: "grain",
      filter: "soft",
      backdrop: "glow",
      overlays: ["shade"],
    },
  },
  {
    ...meta("fable-ink"),
    prompt:
      "Satirical fable book illustration. Confident black ink outline with quick witty lines, transparent bright watercolor fills in clean red, yellow, green and blue, light sparse hatching. Expressive comic pose and gesture, lively emotion, while the face keeps natural human eyes and real facial features of the reference, not dot eyes and not a toy-like face. Minimal background with lots of white paper, a few loose watercolor splashes. Witty ironic humor.",
    negative: neg("dense background, muted dull colors, heavy shading, gradients, digital painting, grotesque, mean caricature"),
    demo: {
      palette: { paper: "#ffffff", ink: "#161616", accents: ["#e03a3a", "#f5c518", "#3aa64a", "#2f6fd6"] },
      line: "bold",
      texture: "none",
      filter: "wobble",
      backdrop: "wash",
      overlays: ["splash"],
    },
  },
  {
    ...meta("mystery-toon"),
    prompt:
      "2010s TV animated mystery cartoon look. Clean closed dark outlines, flat bright colors with soft cel shading, simple geometric shape design and expressive faces that stay true to the reference: natural eye shape, only slightly stylized. Painterly misty pine forest background with fog and sunbeams, an old cabin or a trail sign in the distance. Mysterious cryptic atmosphere with a few invented glyphs carved on trees, nothing readable. Humor with a light spooky edge, safe for teens.",
    negative: neg("gore, horror, scary monsters, blood, one-eyed triangle, pine tree cap, real cipher text, readable symbols, 3d"),
    demo: {
      palette: { paper: "#e8efe9", ink: "#1f2430", accents: ["#e0603a", "#3aa6a0", "#f2c94c", "#7b5ea7"] },
      line: "bold",
      texture: "none",
      filter: "cel",
      backdrop: "blur",
      overlays: ["fog"],
    },
  },
  {
    ...meta("field-journal"),
    prompt:
      "Illustrated page from an old explorer's field journal. Aged yellowed paper with coffee stains, creases and tape marks, fine ink pen sketches with cross-hatching, naturalist encyclopedia style studies of strange invented plants and creatures around the hero, illegible handwritten-looking scribbles in the margins, red and blue pencil arrows and circles, a glued snapshot frame and a small paper clipping. Sepia and ochre palette with small red and blue accents, a few invented cipher-like marks. Mysterious investigative mood, never scary.",
    negative: neg("readable text, real words, six fingers, clean white paper, bright saturated colors, gore, horror, scary monsters"),
    demo: {
      palette: { paper: "#eadbb5", ink: "#5a3f24", accents: ["#a8743c", "#c9a66b", "#8c6b4a", "#b5523a"] },
      line: "thin",
      texture: "paper",
      filter: "sepia",
      backdrop: "lines",
      overlays: ["aged", "hatch"],
    },
  },
  {
    ...meta("golden-animation"),
    prompt:
      "Classic hand-drawn feature animation look with a cel animation feel. Smooth flowing lines with varied thickness and colored self-toned outlines, soft rounded shapes, strong readable silhouette, flat rich colors with soft two-tone shading. Painterly watercolor background with warm golden light, graceful S-curve poses, a small cute generic animal companion such as a songbird or a field mouse. Charming fairytale mood. The hero keeps realistic proportions of the face and recognizable features, eyes only slightly enlarged.",
    negative: neg("3d, CGI, harsh black outlines, gritty texture, villain, dark purple and green palette"),
    demo: {
      palette: { paper: "#fbf1dc", ink: "#6a3b2a", accents: ["#2e6bb8", "#d9483b", "#f0b43c", "#4f9a5c", "#9b5fb5"] },
      line: "thin",
      texture: "none",
      backdrop: "dream",
      overlays: ["rays"],
    },
  },
  {
    ...meta("xerox-pencil"),
    prompt:
      "1960s photocopied pencil animation look. Scratchy hand-drawn black pencil outline transferred as a photocopy, loose sketchy linework with visible construction lines, flat bright colors slightly offset from the lines, simplified graphic backgrounds made of blocky color shapes with loose line overlays, humorous expressive characters, mid-century storybook look. The face keeps the real likeness of the reference with natural human eyes.",
    negative: neg("clean vector lines, gradients, 3d, glossy rendering, soft airbrush, realistic background"),
    demo: {
      palette: { paper: "#f7f1e3", ink: "#191919", accents: ["#e65d3a", "#3a8fd1", "#f2c43a", "#4aa65a"] },
      line: "sketch",
      texture: "grain",
      filter: "xerox",
      backdrop: "offset",
    },
  },
];
