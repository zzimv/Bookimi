// Обработка фото героя сразу после загрузки (сервер, sharp). Проверки и кадр — src/lib/photo-check.ts (тот же код,
// что в демо-стенде). Фото во внешние сервисы здесь не уходит: только наш сервер; сервер иллюстраций получит готовый портрет на шаге превью.
//  1) тип — по первым байтам; 2) EXIF-поворот, до 2048 px, JPEG без метаданных (геометки удаляются) — «исходник»;
//  3) лица (кожа + глаза) на копии 160 px; 4) резкость, яркость, контраст — на лице 256×256;
//  5) портрет «голова и плечи» 1024×1024: мягкое шумоподавление (медиана 3), уровни 1–99%, лёгкая резкость.
import sharp, { type Sharp } from "sharp";
import { detectFaces, judgePhoto, laplacianVariance, mainFaces, meanStd, portraitCrop, sniffImage, suggestFur, suggestHair, type Box, type PhotoVerdict, type Px } from "./photo-check";

export class PhotoError extends Error {}

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export interface PhotoMeta extends PhotoVerdict {
  kind: "human" | "pet";
  width: number;
  height: number;
  /** Найденные лица (главное — первым) в долях кадра; при нескольких — покупатель выбирает. */
  faces: Box[];
  chosen: number;
  facePx: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  /** Подсказка чипса «цвет волос» / «окрас» — только предложение. */
  hair?: string;
  fur?: string;
}

export interface ProcessedPhoto {
  original: Buffer;
  portrait: Buffer;
  meta: PhotoMeta;
}

async function rawPx(img: Sharp): Promise<Px> {
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

const clampRegion = (b: Box, W: number, H: number) => {
  const left = Math.max(0, Math.floor(b.x * W));
  const top = Math.max(0, Math.floor(b.y * H));
  return { left, top, width: Math.max(8, Math.min(W - left, Math.round(b.w * W))), height: Math.max(8, Math.min(H - top, Math.round(b.h * H))) };
};

/** Метрики лица (или центра кадра, если лица нет): резкость, яркость, контраст на 256×256. */
async function faceMetrics(original: Buffer, W: number, H: number, face: Box | null) {
  const region = clampRegion(face ?? { x: 0.2, y: 0.15, w: 0.6, h: 0.6 }, W, H);
  const g = await sharp(original).extract(region).resize(256, 256, { fit: "fill" }).greyscale().raw().toBuffer();
  const { mean, std } = meanStd(g);
  return { sharpness: Math.round(laplacianVariance(g, 256, 256)), brightness: Math.round(mean), contrast: Math.round(std) };
}

/**
 * Автоуровни (1–99%) только для кадра с заметным разбросом яркости. Почти однотонный кадр (стена, туман,
 * засвет — СКО < 12 из 255 или 1–99% уже внутри 40 уровней) растягивать нельзя: шум становится контрастом, светлый
 * кадр темнеет. Тогда оставляем как есть.
 */
export const LEVELS_MIN_STD = 12;
export const LEVELS_MIN_RANGE = 40;
export function levelsWanted(grey: Uint8Array | Buffer): boolean {
  const { std } = meanStd(grey);
  if (std < LEVELS_MIN_STD) return false;
  const hist = new Uint32Array(256);
  for (const v of grey) hist[v]++;
  const n = grey.length;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= n * 0.01) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= n * 0.01) {
      hi = i;
      break;
    }
  }
  return hi - lo >= LEVELS_MIN_RANGE;
}

export async function makePortrait(original: Buffer, W: number, H: number, face: Box | null, kind: "human" | "pet") {
  const c = portraitCrop(face, W, H, kind);
  const base = sharp(original).extract({ left: c.left, top: c.top, width: c.side, height: c.side }).resize(1024, 1024, { kernel: "lanczos3" }).median(3);
  const grey = await sharp(original).extract({ left: c.left, top: c.top, width: c.side, height: c.side }).resize(128, 128, { fit: "fill" }).greyscale().raw().toBuffer();
  const img = levelsWanted(grey) ? base.normalise({ lower: 1, upper: 99 }) : base;
  return img.sharpen({ sigma: 0.8 }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/** Полная обработка загрузки. PhotoError — понятная покупателю причина отказа. */
export async function processPhoto(input: Buffer, opts: { kind: "human" | "pet"; adult?: boolean }): Promise<ProcessedPhoto> {
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError("Файл больше 15 МБ");
  const type = sniffImage(input.subarray(0, 16));
  if (!type) throw new PhotoError("Подойдёт фото JPG, PNG, WebP или HEIC");
  let original: Buffer;
  let W: number, H: number;
  try {
    const r = await sharp(input, { failOn: "error" }).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true });
    original = r.data;
    W = r.info.width;
    H = r.info.height;
  } catch {
    throw new PhotoError(type === "heic" ? "Фото HEIC не открылось — выберите в камере «Наиболее совместимый» формат или пришлите JPG" : "Не получилось открыть фото. Попробуйте другой файл.");
  }
  const small = await rawPx(sharp(original).resize(160, 160, { fit: "inside" }));
  const { list, others } = opts.kind === "human" ? mainFaces(detectFaces(small)) : { list: [], others: 0 };
  const main = list[0] ?? null;
  const facePx = main ? Math.round(Math.min(main.w * W, main.h * H)) : 0;
  const m = await faceMetrics(original, W, H, main);
  const v = judgePhoto({ kind: opts.kind, width: W, height: H, faces: list.length, otherFaces: others, facePx, ...m });
  if (v.verdict === "reject") throw new PhotoError(v.hints[0]);
  const meta: PhotoMeta = {
    ...v,
    kind: opts.kind,
    width: W,
    height: H,
    faces: list.map(({ x, y, w, h }) => ({ x: +x.toFixed(4), y: +y.toFixed(4), w: +w.toFixed(4), h: +h.toFixed(4) })),
    chosen: 0,
    facePx,
    ...m,
    hair: main ? suggestHair(small, main, opts.adult) : undefined,
    fur: opts.kind === "pet" ? suggestFur(small) : undefined,
  };
  return { original, portrait: await makePortrait(original, W, H, main, opts.kind), meta };
}

/** Выбрано другое лицо (в кадре несколько людей): новый портрет и метрики из сохранённого исходника. */
export async function recropPhoto(original: Buffer, meta: PhotoMeta, index: number): Promise<{ portrait: Buffer; meta: PhotoMeta }> {
  const face = meta.faces[index];
  if (!face) throw new PhotoError("Такого лица на фото нет");
  const facePx = Math.round(Math.min(face.w * meta.width, face.h * meta.height));
  const m = await faceMetrics(original, meta.width, meta.height, face);
  const small = await rawPx(sharp(original).resize(160, 160, { fit: "inside" }));
  // Выбор сделан — «несколько людей» больше не подсказываем
  const v = judgePhoto({ kind: meta.kind, width: meta.width, height: meta.height, faces: 1, otherFaces: 0, facePx, ...m });
  return {
    portrait: await makePortrait(original, meta.width, meta.height, face, meta.kind),
    meta: { ...meta, ...v, verdict: v.verdict === "reject" ? "warn" : v.verdict, chosen: index, facePx, ...m, hair: suggestHair(small, face) },
  };
}
