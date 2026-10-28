"""Подготовка фото ребёнка: проверка качества и мягкое улучшение без изменения черт лица.

Почему без ИИ-реставрации (GFPGAN, CodeFormer и т. п.): такие модели дорисовывают глаза, кожу и
форму лица — фото становится «красивее», но похоже меньше. Для узнаваемости это вредно. Поэтому
здесь только классическая обработка: шумоподавление, локальный контраст, резкость, кадрирование и
увеличение интерполяцией. ИИ-реставрация доступна флагом --restore только для экспериментов.

Использование:
  python preprocess.py photo.jpg out_dir/            # одно фото
  python preprocess.py data/mark/ out_dir/mark/      # все photo_* в папке

Результат: <имя>_prepared.jpg (1024×1024, голова и плечи), <имя>_report.json (метрики и вердикт).
"""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

OUT_SIZE = 1024

# Пороги проверки качества (подобраны для фото с телефона; уточняются по итогам теста)
MIN_FACE_OK = 256      # px — сторона лица в исходнике: хорошо
MIN_FACE_WARN = 160    # px — допустимо с предупреждением
MIN_SHARPNESS = 40.0   # дисперсия лапласиана на лице, приведённом к 256 px: ниже — предупреждение
REJECT_SHARPNESS = 15.0  # ниже — отказ (смаз, сильный расфокус)
MIN_BRIGHT, MAX_BRIGHT = 60, 200


@dataclass
class Report:
    file: str
    width: int
    height: int
    faces_found: int
    face_px: int
    sharpness: float
    brightness: float
    contrast: float
    verdict: str          # ok | warn | reject
    problems: list[str]
    hints: list[str]


def load_rgb(path: Path) -> np.ndarray:
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    return np.array(im)


def detect_faces(rgb: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Сначала insightface (точнее), если установлен; иначе каскад Хаара из OpenCV."""
    try:
        from insightface.app import FaceAnalysis  # type: ignore

        app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        faces = app.get(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        return [tuple(int(v) for v in (f.bbox[0], f.bbox[1], f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1])) for f in faces]
    except Exception:
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        min_side = max(48, min(gray.shape) // 10)
        found = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(min_side, min_side))
        return [tuple(int(v) for v in f) for f in found]


def measure(rgb: np.ndarray, face: tuple[int, int, int, int]) -> tuple[float, float, float]:
    x, y, w, h = face
    crop = cv2.cvtColor(rgb[y : y + h, x : x + w], cv2.COLOR_RGB2GRAY)
    crop = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_AREA)
    sharp = float(cv2.Laplacian(crop, cv2.CV_64F).var())
    return sharp, float(crop.mean()), float(crop.std())


def assess(path: Path, rgb: np.ndarray, faces) -> Report:
    h, w = rgb.shape[:2]
    problems: list[str] = []
    hints: list[str] = []
    if not faces:
        return Report(path.name, w, h, 0, 0, 0, 0, 0, "reject", ["лицо не найдено"],
                      ["Нужен снимок, где лицо крупно и смотрит в камеру."])
    faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
    main = faces[0]
    # «Другие люди в кадре»: второе лицо больше 35% площади главного
    if len(faces) > 1 and faces[1][2] * faces[1][3] > 0.35 * main[2] * main[3]:
        problems.append("в кадре несколько лиц")
        hints.append("Загрузите фото, где ребёнок один.")
    face_px = min(main[2], main[3])
    sharp, bright, contrast = measure(rgb, main)
    verdict = "ok"
    if face_px < MIN_FACE_WARN:
        verdict = "reject"
        problems.append(f"лицо слишком мелкое ({face_px}px)")
        hints.append("Снимите ближе: лицо должно занимать треть кадра.")
    elif face_px < MIN_FACE_OK:
        verdict = "warn"
        problems.append(f"лицо небольшое ({face_px}px)")
    if sharp < MIN_SHARPNESS:
        verdict = "reject" if sharp < REJECT_SHARPNESS else max(verdict, "warn", key=["ok", "warn", "reject"].index)
        problems.append(f"фото нерезкое (резкость {sharp:.0f})")
        hints.append("Снимите при хорошем свете, держите телефон неподвижно.")
    if not (MIN_BRIGHT <= bright <= MAX_BRIGHT):
        verdict = max(verdict, "warn", key=["ok", "warn", "reject"].index)
        problems.append("слишком темно" if bright < MIN_BRIGHT else "пересвет")
        hints.append("Встаньте лицом к окну, без вспышки.")
    if "в кадре несколько лиц" in problems:
        verdict = max(verdict, "warn", key=["ok", "warn", "reject"].index)
    return Report(path.name, w, h, len(faces), face_px, round(sharp, 1), round(bright, 1), round(contrast, 1),
                  verdict, problems, hints)


def enhance(rgb: np.ndarray, face: tuple[int, int, int, int]) -> np.ndarray:
    """Кадр «голова и плечи», шумоподавление, локальный контраст, резкость. Черты лица не меняются."""
    x, y, w, h = face
    cx, cy = x + w / 2, y + h * 0.62          # центр чуть ниже лица — чтобы вошли плечи
    side = int(max(w, h) * 2.3)
    H, W = rgb.shape[:2]
    side = min(side, W, H) if side > min(W, H) else side
    x0 = int(np.clip(cx - side / 2, 0, max(0, W - side)))
    y0 = int(np.clip(cy - side / 2, 0, max(0, H - side)))
    crop = rgb[y0 : y0 + side, x0 : x0 + side]

    bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
    bgr = cv2.fastNlMeansDenoisingColored(bgr, None, h=3, hColor=3, templateWindowSize=7, searchWindowSize=21)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.15, tileGridSize=(8, 8)).apply(l)
    bgr = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
    bgr = cv2.resize(bgr, (OUT_SIZE, OUT_SIZE), interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(bgr, (0, 0), sigmaX=1.4)
    bgr = cv2.addWeighted(bgr, 1.35, blur, -0.35, 0)   # нерезкое маскирование, мягко
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def process(path: Path, out_dir: Path, restore: bool = False) -> Report:
    rgb = load_rgb(path)
    faces = detect_faces(rgb)
    rep = assess(path, rgb, faces)
    out_dir.mkdir(parents=True, exist_ok=True)
    if faces:
        main = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
        out = enhance(rgb, main)
        if restore:
            out = optional_restore(out)
        Image.fromarray(out).save(out_dir / f"{path.stem}_prepared.jpg", quality=95)
    (out_dir / f"{path.stem}_report.json").write_text(json.dumps(asdict(rep), ensure_ascii=False, indent=2))
    return rep


def optional_restore(rgb: np.ndarray) -> np.ndarray:
    """Эксперимент: ИИ-реставрация. Сравнивайте ArcFace-сходство с исходником (score.py) до и после."""
    try:
        from gfpgan import GFPGANer  # type: ignore

        restorer = GFPGANer(model_path="weights/GFPGANv1.4.pth", upscale=1, arch="clean", channel_multiplier=2)
        _, _, out = restorer.enhance(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), paste_back=True, weight=0.3)
        return cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    except Exception as e:  # нет пакета или весов — оставляем как есть
        print(f"[restore] пропущено: {e}")
        return rgb


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--restore", action="store_true", help="ИИ-реставрация (только для экспериментов)")
    a = ap.parse_args()
    src = Path(a.src)
    files = sorted(src.glob("photo_*")) if src.is_dir() else [src]
    for f in files:
        r = process(f, Path(a.out), a.restore)
        print(f"{f.name}: {r.verdict} | лицо {r.face_px}px | резкость {r.sharpness} | яркость {r.brightness} | {', '.join(r.problems) or 'без замечаний'}")


if __name__ == "__main__":
    main()
