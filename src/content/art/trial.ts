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
//  • Восемь стилей сверены с пробными картинками владельца (docs/content/STYLE-REFERENCES.md): промпт закрепляет
//    удачную технику, негатив — то, что генератор делал не так (костюм известного персонажа, злодей, выпученные
//    глаза и огромный рот, знаки-эмблемы). Сами картинки в репозиторий не кладём — только словесное описание.
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
      "Minimalist naive watercolor illustration. Loose wobbly thin pencil and gray ink line, transparent pale watercolor washes with uneven edges and bleeding, large areas of untouched white paper. A vast empty sand desert drawn as a few pale horizontal sand washes and a thin wobbly horizon under a wide pale night or dusk sky, small scattered stars drawn in ink as tiny crosses, dots and little outlined stars. The hero is small and alone in the big quiet space, in their own everyday clothing, with their own hair color and hairstyle from the reference. Pale palette of warm sand, soft gray blue and a touch of rose. Childlike simplicity, melancholic poetic mood, no heavy shading, no digital polish.",
    negative: neg("green coat, long scarf, flowing scarf, golden spiky hair, costume of a known character, round tiny planet, roses on a planet, circle frame around the hero, saturated colors, thick outlines, busy background, city, forest, dramatic lighting, digital gradients, glossy finish"),
    demo: {
      palette: { paper: "#fafaf5", ink: "#5c584e", accents: ["#efe2c2", "#d9e0ea", "#f1d9d0", "#e6d4a8"] },
      line: "thin",
      texture: "paper",
      filter: "palewash",
      backdrop: "wash",
      overlays: ["crosses"],
    },
  },
  {
    ...meta("cel-70s"),
    prompt:
      "A lively 1970s hand-drawn cel animation frame. The figures have clean, smooth, closed black ink outlines with expressive but controlled linework and flat bright gouache fills without gradients or realistic shading, a hand-painted cel feel. The face keeps the reference likeness with natural human eyes of natural size, small pupils and a natural, modestly open mouth; emotion is shown with the eyebrows and the pose, not by distorting the face. The background is painted separately as a soft painterly gouache picture of a 1970s city park, courtyard or building site with visible brush strokes in warm, slightly muted ochre, olive, sand and faded blue, clearly contrasting with the more saturated flat figures. Dynamic diagonal composition, humorous energetic mood. The person stays a clearly human character with natural anatomy.",
    negative: neg("3d, digital gloss, gradients on figures, realistic shading, text, modern smartphones, neon colors, chase of animals, wolf, hare, huge eyeballs, wide gaping mouth, stretched jaw, flared trousers"),
    demo: {
      palette: { paper: "#efe0b8", ink: "#141210", accents: ["#e2452f", "#2f7fd1", "#f2c12e", "#3aa655"] },
      line: "bold",
      texture: "none",
      filter: "cel",
      backdrop: "gouache",
    },
  },
  {
    ...meta("painterly-tale"),
    prompt:
      "Painterly fairy tale book illustration in gouache and digital paint that imitates gouache. Rich warm saturated colors, strong warm golden backlight from deep in the forest with soft volumetric light shafts, glowing dust and fireflies, a golden rim light on the hair and shoulders, outlines fully dissolved in the color, visible brush texture. Old forest of birch and pine trunks with ferns, mushrooms, mist and deep warm shadows at the edges. Friendly forest animals as companions only when the scene asks, with realistic textured fur and feathers, only slightly expressive. Dynamic cinematic composition with diagonals and close-ups. Adventurous magical mood, children's book quality. The hero is painted with natural human proportions, natural eye size and a faithful likeness.",
    negative: neg("flat vector colors, thick outlines, cel shading, washed-out pale colors, cold blue light, flat lighting, horror, menacing creatures, sharp teeth"),
    demo: {
      palette: { paper: "#f3dca8", ink: "#3a2414", accents: ["#c9622f", "#5d6b2f", "#e8b04f", "#8a3e22"] },
      line: "none",
      texture: "grain",
      filter: "warm",
      backdrop: "backlight",
      overlays: ["rays", "motes", "shade"],
    },
  },
  {
    ...meta("fable-ink"),
    prompt:
      "Satirical fable book illustration. Confident black ink outline with quick witty lines and light sparse hatching, transparent bright watercolor fills in clean red, yellow, green and blue that bleed slightly beyond the lines, rosy watercolor cheeks. Expressive comic pose and gesture, lively emotion, a few small ink flick marks around the head to show surprise, while the face keeps natural human eyes and real facial features of the reference with a natural mouth, not dot eyes and not a toy-like face. Clean white paper background with only a few loose watercolor splashes and quick ink sketch marks. The hero wears their own everyday clothing. Witty ironic humor.",
    negative: neg("uniform, red neckerchief, school uniform, random flying objects, dense background, muted dull colors, heavy shading, gradients, digital painting, grotesque, mean caricature, wide gaping mouth"),
    demo: {
      palette: { paper: "#fbfaf4", ink: "#1a1612", accents: ["#ee4a3c", "#f6c42a", "#4fae46", "#3d7fe0"] },
      line: "bold",
      texture: "none",
      filter: "bleed",
      backdrop: "sparse",
      overlays: ["splash", "flicks"],
    },
  },
  {
    ...meta("mystery-toon"),
    prompt:
      "2010s TV animated mystery cartoon look. Clean closed dark brown outlines of even weight, flat bright colors with simple soft two-tone cel shading, simple geometric shape design. The face stays true to the reference: natural eye shape and size with small pupils, a natural mouth, only slightly stylized. Very pale misty pine forest background with fog and soft sunbeams, light and desaturated, a soft pale glow behind the hero so the figure reads clearly; an old cabin or a trail sign far in the distance, nothing readable. The hero wears their own everyday clothing. Mysterious atmosphere, humor with a light spooky edge, safe for teens.",
    negative: neg("gore, horror, scary monsters, blood, one-eyed triangle, top hat creature, pine tree cap, cap with an emblem, knitted sweater with a picture, shooting star sweater, real cipher text, readable symbols, carved glyphs, huge round eyes, pinpoint pupils in huge eyes, 3d"),
    demo: {
      palette: { paper: "#f2f7f2", ink: "#3a2420", accents: ["#e46a45", "#3fa7a0", "#f2c94c", "#7b62b0"] },
      line: "bold",
      texture: "none",
      filter: "twotone",
      backdrop: "mist",
      overlays: ["halo"],
    },
  },
  {
    ...meta("field-journal"),
    prompt:
      "Illustrated page from an old explorer's field journal. Aged yellowed paper with brown coffee rings, darkened edges, creases and translucent tape strips at the corners. The hero is drawn in fine graphite and sepia ink with delicate cross-hatching, keeping the likeness of the reference and natural eyes. Around the hero: naturalist study sketches of strange invented plants and small harmless creatures with hatching, a glued sepia snapshot of a landscape, illegible scribbled handwriting lines in the margins without any readable letters, a red underline and a blue pencil arrow. Sepia and ochre palette with small red and blue accents. Mysterious investigative mood, never scary.",
    negative: neg("readable text, real words, letters, alphabet, cipher text, runes, symbols, insignia, emblems, hand symbol, symbol drawn on a palm, six fingers, eye in a triangle, newspaper headlines, newspaper clipping, portrait photos of other people, clean white paper, bright saturated colors, gore, horror, scary monsters"),
    demo: {
      palette: { paper: "#ecd6a4", ink: "#4a3522", accents: ["#a8743c", "#c9a66b", "#8c6b4a", "#b5523a"] },
      line: "thin",
      texture: "paper",
      filter: "sepia",
      backdrop: "journal",
      overlays: ["aged", "hatch"],
    },
  },
  {
    ...meta("golden-animation"),
    prompt:
      "Classic hand-drawn feature animation look with a cel animation feel. Smooth flowing lines with varied thickness and colored self-toned outlines in warm brown and rust instead of black, soft rounded shapes, strong readable silhouette, flat rich colors with soft two-tone cel shading and a light rosy blush on the cheeks. The background is a soft painterly watercolor wash in warm golden cream and pale amber with loose color blooms and lots of light, almost no detail behind the hero. Graceful S-curve poses, charming fairytale mood. Only the characters the scene asks for; when the scene has an animal friend, it is one small cute generic animal such as a songbird or a field mouse. The hero keeps realistic proportions of the face and recognizable features, eyes only slightly enlarged.",
    negative: neg("3d, CGI, harsh black outlines, gritty texture, villain, sinister grinning character, sorcerer, pointed elf ears, horns, dark purple and green costume, extra characters not in the scene, dark background"),
    demo: {
      palette: { paper: "#fbeec8", ink: "#8a4f35", accents: ["#d9603f", "#4f86c0", "#e9a93e", "#6a9f58", "#a0607a"] },
      line: "thin",
      texture: "none",
      filter: "twotone",
      backdrop: "golden",
      overlays: ["rays"],
    },
  },
  {
    ...meta("xerox-pencil"),
    prompt:
      "1960s photocopied pencil animation look on warm cream paper. Dark scratchy graphite outline transferred as a photocopy: loose sketchy linework with doubled strokes, visible construction lines and uneven, slightly broken line weight. Flat soft colored-pencil fills in warm skin tones, muted blue, coral, ochre and grass green, slightly offset from the lines, no gradients. Very simple background: mostly plain cream paper with a few flat pale color shapes and loose line overlays. Humorous expressive characters, mid-century storybook look. The face keeps the real likeness of the reference with natural human eyes of natural size and a natural mouth.",
    negative: neg("clean vector lines, gradients, 3d, glossy rendering, soft airbrush, realistic detailed background, dark background, heavy shadows, saturated neon colors"),
    demo: {
      palette: { paper: "#f6f1e0", ink: "#2f2822", accents: ["#e2735a", "#4f93bf", "#e8bd4a", "#7fae5a"] },
      line: "thin",
      texture: "grain",
      filter: "pencil",
      backdrop: "pencil",
    },
  },
];
