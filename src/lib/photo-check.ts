// Проверка и кадрирование фото героя — чистые функции над пикселями. Один код для сервера (sharp → raw RGB,
// src/lib/photo-process.ts) и для демо-стенда (canvas → ImageData): поиск лица по цвету кожи (YCbCr) с проверкой
// «есть глаза/брови», резкость (дисперсия лапласиана на лице 256×256), яркость и контраст лица, кадр «голова и плечи»,
// подсказка цвета волос (полоса над лицом) и окраса питомца — только как предложение, покупатель подтверждает.
// Пороги — как в tools/recognition-test/preprocess.py (лицо 160/256 px, резкость 15/40, яркость 60…200).
// Это эвристика, не нейросеть: ошибается на бежевом фоне и светлых волосах — поэтому «лицо не нашли» —
// подсказка, а не отказ, и при нескольких лицах покупатель сам выбирает нужное.

export interface Px {
  data: ArrayLike<number>;
  width: number;
  height: number;
  /** 3 (RGB) или 4 (RGBA, canvas). */
  channels: number;
}

/** Прямоугольник в долях кадра (0..1). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceBox extends Box {
  /** Найдены признаки лица (глаза/брови) — а не просто пятно кожи. */
  features: boolean;
  score: number;
}

export const PHOTO_LIMITS = {
  minSide: 500,
  goodSide: 900,
  faceWarn: 160,
  faceOk: 256,
  sharpReject: 15,
  sharpWarn: 40,
  brightMin: 60,
  brightMax: 200,
  contrastMin: 28,
  /** Второе лицо больше этой доли площади главного — «в кадре несколько людей». */
  otherFace: 0.35,
} as const;

export function isSkin(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return y > 70 && y < 245 && cr >= 136 && cr <= 178 && cb >= 82 && cb <= 130 && r > b && r >= g && r - Math.min(g, b) > 12;
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

export function grayOf(px: Px): Float32Array {
  const n = px.width * px.height;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * px.channels;
    out[i] = lum(px.data[o], px.data[o + 1], px.data[o + 2]);
  }
  return out;
}

/** Лица по цвету кожи: связные пятна кожи нужной формы, с тёмными «глазами» в верхней половине. Сортировка — по score. */
export function detectFaces(px: Px): FaceBox[] {
  const { width: W, height: H, channels: C, data } = px;
  const raw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) raw[i] = isSkin(data[i * C], data[i * C + 1], data[i * C + 2]) ? 1 : 0;
  // Сглаживание: большинство в окне 3×3
  const mask = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += raw[(y + dy) * W + x + dx];
      mask[y * W + x] = s >= 5 ? 1 : 0;
    }
  const gray = grayOf(px);
  const seen = new Uint8Array(W * H);
  const faces: FaceBox[] = [];
  const minArea = Math.max(12, W * H * 0.003);
  const stack: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, sumY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % W, y = (i / W) | 0;
      area++;
      sumY += gray[i];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || seen[j] || !mask[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (area < minArea) continue;
    const bw = x1 - x0 + 1;
    let bh = y1 - y0 + 1;
    if (bh / bw < 0.65) continue; // рука, плечо, полоса фона
    if (bh / bw > 1.45) bh = Math.round(bw * 1.3); // лицо вместе с шеей — берём верх
    let skin = 0;
    for (let y = y0; y < y0 + bh; y++) for (let x = x0; x <= x1; x++) skin += mask[y * W + x];
    const fill = skin / (bw * bh);
    if (fill < 0.42) continue;
    // Признаки лица: в полосе 20–60% высоты есть заметно более тёмные пиксели (глаза, брови)
    const skinMean = sumY / area;
    let dark = 0, band = 0;
    for (let y = y0 + Math.round(bh * 0.2); y < y0 + Math.round(bh * 0.6); y++)
      for (let x = x0 + Math.round(bw * 0.12); x <= x1 - Math.round(bw * 0.12); x++) {
        band++;
        if (gray[y * W + x] < skinMean * 0.62) dark++;
      }
    const features = band > 0 && dark / band >= 0.015 && dark / band < 0.45;
    faces.push({ x: x0 / W, y: y0 / H, w: bw / W, h: bh / H, features, score: skin * fill * (features ? 1 : 0.25) });
  }
  return faces.sort((a, b) => b.score - a.score);
}

/**
 * Дисперсия лапласиана (4 соседа) — мера резкости. Считать на лице, приведённом к 256×256 в оттенках серого.
 * Нормируется на контраст (σ = 50), чтобы тёмное, но резкое фото не считалось смазанным.
 */
export function laplacianVariance(gray: ArrayLike<number>, w: number, h: number): number {
  const { std } = meanStd(gray);
  return rawLaplacianVariance(gray, w, h) * (std > 4 ? (50 / std) ** 2 : 1);
}

function rawLaplacianVariance(gray: ArrayLike<number>, w: number, h: number): number {
  let n = 0, sum = 0, sum2 = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      n++;
      sum += l;
      sum2 += l * l;
    }
  if (!n) return 0;
  const m = sum / n;
  return sum2 / n - m * m;
}

export function meanStd(gray: ArrayLike<number>): { mean: number; std: number } {
  let s = 0, s2 = 0;
  for (let i = 0; i < gray.length; i++) {
    s += gray[i];
    s2 += gray[i] * gray[i];
  }
  const mean = s / Math.max(1, gray.length);
  return { mean, std: Math.sqrt(Math.max(0, s2 / Math.max(1, gray.length) - mean * mean)) };
}

/** Квадрат «голова и плечи» в пикселях исходника: сторона 2,3 лица, центр чуть ниже лица (как preprocess.py). */
export function portraitCrop(face: Box | null, W: number, H: number, kind: "human" | "pet" = "human") {
  if (!face || kind === "pet") {
    const side = Math.round(Math.min(W, H) * (kind === "pet" ? 0.94 : 1));
    return { left: Math.round((W - side) / 2), top: Math.max(0, Math.round((H - side) * (kind === "pet" ? 0.4 : 0.3))), side };
  }
  const fw = face.w * W, fh = face.h * H;
  let side = Math.round(Math.max(fw, fh) * 2.3);
  side = Math.min(side, W, H);
  const cx = face.x * W + fw / 2;
  const cy = face.y * H + fh * 0.62;
  const left = Math.round(Math.min(Math.max(0, cx - side / 2), W - side));
  const top = Math.round(Math.min(Math.max(0, cy - side / 2), H - side));
  return { left, top, side };
}

function hsl(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function avgColor(px: Px, x0: number, y0: number, x1: number, y1: number, skip?: (r: number, g: number, b: number) => boolean, minShare = 0.35) {
  let r = 0, g = 0, b = 0, n = 0, all = 0;
  const C = px.channels;
  for (let y = Math.max(0, y0); y < Math.min(px.height, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(px.width, x1); x++) {
      const o = (y * px.width + x) * C;
      all++;
      if (skip?.(px.data[o], px.data[o + 1], px.data[o + 2])) continue;
      r += px.data[o];
      g += px.data[o + 1];
      b += px.data[o + 2];
      n++;
    }
  return n && n >= all * minShare ? { r: r / n, g: g / n, b: b / n } : null;
}

/** Цвет волос (чипс анкеты) по полосе у верхнего края лица, без кожи и без цвета фона. Только предложение. */
export function suggestHair(px: Px, face: Box, adult = false): string | undefined {
  const W = px.width, H = px.height;
  const x0 = Math.round((face.x + face.w * 0.25) * W), x1 = Math.round((face.x + face.w * 0.75) * W);
  const y0 = Math.round((face.y - face.h * 0.15) * H), y1 = Math.round((face.y + face.h * 0.08) * H);
  if (y1 - y0 < 2) return undefined;
  const k = Math.max(2, Math.round(Math.min(W, H) * 0.08));
  const bg = avgColor(px, 0, 0, k, k) ?? { r: 255, g: 255, b: 255 };
  const bg2 = avgColor(px, W - k, 0, W, k) ?? bg;
  const far = (r: number, g: number, b: number, c: { r: number; g: number; b: number }) => Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) > 60;
  const c = avgColor(px, x0, y0, x1, y1, (r, g, b) => isSkin(r, g, b) || !far(r, g, b, bg) || !far(r, g, b, bg2), 0.15);
  if (!c) return undefined;
  const { h, s, l } = hsl(c.r, c.g, c.b);
  if (adult && s < 0.12 && l > 0.55) return "седые";
  if (l < 0.13) return "чёрные";
  if (l < 0.24) return "тёмные";
  if (h >= 5 && h <= 32 && s > 0.5 && l > 0.3 && l < 0.62) return "рыжие";
  if (l > 0.58 && h >= 25 && h <= 65) return "светлые";
  if (l > 0.42) return "русые";
  return "каштановые";
}

/** Окрас питомца (чипс анкеты) по центру кадра. */
export function suggestFur(px: Px): string | undefined {
  const W = px.width, H = px.height;
  const c = avgColor(px, Math.round(W * 0.3), Math.round(H * 0.3), Math.round(W * 0.7), Math.round(H * 0.75));
  if (!c) return undefined;
  const { h, s, l } = hsl(c.r, c.g, c.b);
  if (l > 0.82) return "белый";
  if (l < 0.16) return "чёрный";
  if (s < 0.14) return "серый";
  if (h >= 15 && h <= 40 && s > 0.45 && l < 0.62) return "рыжий";
  if (l > 0.6) return "палевый";
  return "коричневый";
}

export type Verdict = "ok" | "warn" | "reject";

export interface PhotoMetrics {
  kind: "human" | "pet";
  width: number;
  height: number;
  /** Сколько лиц нашли и сколько «заметных» (больше 35% главного). */
  faces: number;
  otherFaces: number;
  /** Сторона главного лица в пикселях исходника (0 — не нашли). */
  facePx: number;
  sharpness: number;
  brightness: number;
  contrast: number;
}

export interface PhotoVerdict {
  verdict: Verdict;
  /** Коды проблем: small, small-face, tiny-face, no-face, many-faces, blur, dark, bright, flat. */
  codes: string[];
  hints: string[];
}

/** Вердикт и подсказки по метрикам. reject — только явно непригодное фото (меньше 500 px, сильный смаз). */
export function judgePhoto(m: PhotoMetrics): PhotoVerdict {
  const L = PHOTO_LIMITS;
  const codes: string[] = [];
  const hints: string[] = [];
  let verdict: Verdict = "ok";
  const warn = () => verdict === "ok" && (verdict = "warn");
  const minSide = Math.min(m.width, m.height);
  if (minSide < L.minSide) return { verdict: "reject", codes: ["small"], hints: ["Фото слишком маленькое: нужно хотя бы 500 пикселей по короткой стороне."] };
  if (m.sharpness < L.sharpReject) return { verdict: "reject", codes: ["blur"], hints: ["Фото смазано — загрузите более чёткое: при хорошем свете, телефон неподвижно."] };
  if (m.kind === "human") {
    if (!m.faces) {
      codes.push("no-face");
      hints.push("Лицо не нашли — лучше фото, где лицо крупно и смотрит в камеру. Можно оставить это: проверим ещё раз перед рисованием.");
      warn();
    } else {
      if (m.otherFaces > 0) {
        codes.push("many-faces");
        hints.push("В кадре несколько людей — выберите нужное лицо.");
        warn();
      }
      if (m.facePx < L.faceWarn) {
        codes.push("tiny-face");
        hints.push("Лицо слишком мелко — снимите ближе или выберите фото, где лицо крупнее.");
        warn();
      } else if (m.facePx < L.faceOk) {
        codes.push("small-face");
        hints.push("Лицо небольшое — иллюстрации будут чуть менее похожими.");
        warn();
      }
    }
  } else if (minSide < L.goodSide) {
    codes.push("small");
    hints.push("Фото небольшое — лучше снять ближе.");
    warn();
  }
  if (m.sharpness < L.sharpWarn) {
    codes.push("blur");
    hints.push("Фото нечёткое — при хорошем свете получится лучше.");
    warn();
  }
  if (m.brightness < L.brightMin) {
    codes.push("dark");
    hints.push("Темновато — встаньте лицом к окну.");
    warn();
  } else if (m.brightness > L.brightMax) {
    codes.push("bright");
    hints.push("Пересвет — снимите без вспышки и не против солнца.");
    warn();
  } else if (m.contrast < L.contrastMin) {
    codes.push("flat");
    hints.push("Блёкло — днём у окна черты будут видны лучше.");
    warn();
  }
  return { verdict, codes, hints };
}

/** Главное и «заметные другие» лица: второе лицо больше 35% площади главного. */
export function mainFaces(faces: FaceBox[]) {
  const withFeatures = faces.filter((f) => f.features);
  const list = withFeatures.length ? withFeatures : faces.slice(0, 1);
  const main = list[0] ?? null;
  const others = main ? list.slice(1).filter((f) => f.w * f.h > PHOTO_LIMITS.otherFace * main.w * main.h) : [];
  return { main, list: main ? [main, ...others] : [], others: others.length };
}

/** Тип файла по первым байтам (не по расширению и не по заголовку браузера). */
export function sniffImage(head: ArrayLike<number>): "jpeg" | "png" | "webp" | "heic" | null {
  const b = (i: number) => head[i] ?? -1;
  const ascii = (from: number, n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(b(from + i))).join("");
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  if (b(0) === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp" && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(ascii(8, 4))) return "heic";
  return null;
}
