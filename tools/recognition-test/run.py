"""Генерация иллюстраций для теста узнаваемости.

Конвейер (тот же, что будет в продукте):
  1. подготовленное фото (preprocess.py) + описание из анкеты (meta.json)
  2. лист персонажа: анфас, три четверти, профиль, в полный рост — в выбранном стиле
  3. сцена: фото + лист персонажа + промпт сцены и стиля

Модели:
  qwen       Qwen/Qwen-Image-Edit-2511, diffusers QwenImageEditPlusPipeline (принимает несколько картинок)
  kandinsky  kandinskylab/Kandinsky-5.0-I2I-Lite-sft-Diffusers, Kandinsky5I2IPipeline (одна картинка)
  mock       без GPU: фильтры PIL — только для проверки, что весь конвейер стыкуется

Примеры:
  python run.py --model qwen --children prepared/ --out results/
  python run.py --model qwen --children prepared/ --out tune/ --tune      # подбор параметров
  python run.py --model kandinsky --children prepared/ --out results/ --params results/best_params_kandinsky.json
  python run.py --model mock --children prepared/ --out results/ --scenes s01-portrait,s03-sub-profile

Структура children/: <id>/photo_1_prepared.jpg (+ photo_2…), <id>/meta.json
  meta.json: {"name": "Марк", "gender": "boy", "age": 5, "description": "светло-русые волосы с чёлкой, голубые глаза"}
"""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import os
import time
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).parent
STYLES = json.loads((HERE / "styles.json").read_text())
SCENES = json.loads((HERE / "scenes.json").read_text())["scenes"]

DEFAULTS = {
    "qwen": {"steps": 40, "cfg": 4.0, "use_sheet": True},
    "kandinsky": {"steps": 50, "cfg": 3.5, "use_sheet": False},
    "mock": {"steps": 1, "cfg": 1.0, "use_sheet": True},
}
TUNE_GRID = {
    "qwen": {"steps": [30, 50], "cfg": [3.0, 4.0, 5.5], "use_sheet": [True, False]},
    "kandinsky": {"steps": [40, 60], "cfg": [3.5, 5.0], "use_sheet": [True, False]},
    "mock": {"steps": [1], "cfg": [1.0, 2.0], "use_sheet": [True, False]},
}
TUNE_SCENES = ["s01-portrait", "s03-sub-profile", "s07-castle-far"]


def seed_for(*parts: str) -> int:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:8], 16)


# ───────────── модели ─────────────

class Backend:
    name = "base"

    def edit(self, images: list[Image.Image], prompt: str, negative: str, steps: int, cfg: float, seed: int) -> Image.Image:
        raise NotImplementedError


class QwenBackend(Backend):
    name = "qwen"

    def __init__(self):
        import torch  # type: ignore
        from diffusers import QwenImageEditPlusPipeline  # type: ignore

        self.torch = torch
        model_id = os.environ.get("QWEN_MODEL", "Qwen/Qwen-Image-Edit-2511")
        self.pipe = QwenImageEditPlusPipeline.from_pretrained(model_id, torch_dtype=torch.bfloat16)
        if os.environ.get("OFFLOAD", "0") == "1":   # для GPU 48 ГБ
            self.pipe.enable_model_cpu_offload()
        else:                                        # A100/H100 80 ГБ
            self.pipe.to("cuda")
        self.pipe.set_progress_bar_config(disable=True)

    def edit(self, images, prompt, negative, steps, cfg, seed):
        out = self.pipe(
            image=images,
            prompt=prompt,
            negative_prompt=negative or " ",
            true_cfg_scale=cfg,
            num_inference_steps=steps,
            generator=self.torch.manual_seed(seed),
        )
        return out.images[0]


class KandinskyBackend(Backend):
    name = "kandinsky"

    def __init__(self):
        import torch  # type: ignore
        from diffusers import Kandinsky5I2IPipeline  # type: ignore

        self.torch = torch
        model_id = os.environ.get("KANDINSKY_MODEL", "kandinskylab/Kandinsky-5.0-I2I-Lite-sft-Diffusers")
        self.pipe = Kandinsky5I2IPipeline.from_pretrained(model_id)
        self.pipe.to(device="cuda", dtype=torch.bfloat16)
        if os.environ.get("OFFLOAD", "0") == "1":
            self.pipe.enable_model_cpu_offload()
        self.pipe.set_progress_bar_config(disable=True)

    def edit(self, images, prompt, negative, steps, cfg, seed):
        # Kandinsky I2I принимает одну картинку: при листе персонажа подаём склейку «фото | лист»
        img = images[0] if len(images) == 1 else side_by_side(images)
        out = self.pipe(
            image=img,
            prompt=prompt,
            negative_prompt=negative,
            num_inference_steps=steps,
            guidance_scale=cfg,
            height=1024,
            width=1024,
            generator=self.torch.Generator("cuda").manual_seed(seed),
        )
        return out.image[0] if hasattr(out, "image") else out.images[0]


class MockBackend(Backend):
    """Без GPU. Имитирует «стиль» фильтрами, чтобы проверить файлы, карточки и подсчёт."""

    name = "mock"

    def edit(self, images, prompt, negative, steps, cfg, seed):
        base = images[0].convert("RGB").resize((768, 768))
        variant = seed % 4
        if variant == 0:
            out = ImageOps.posterize(base, 3)
        elif variant == 1:
            out = base.filter(ImageFilter.CONTOUR).convert("RGB")
        elif variant == 2:
            out = ImageOps.solarize(base, 200)
        else:
            out = base.filter(ImageFilter.SMOOTH_MORE).filter(ImageFilter.EDGE_ENHANCE_MORE)
        return out


def side_by_side(images: list[Image.Image]) -> Image.Image:
    h = 1024
    parts = [im.convert("RGB").resize((int(im.width * h / im.height), h)) for im in images]
    canvas = Image.new("RGB", (sum(p.width for p in parts), h), "white")
    x = 0
    for p in parts:
        canvas.paste(p, (x, 0))
        x += p.width
    return canvas


def make_backend(name: str) -> Backend:
    return {"qwen": QwenBackend, "kandinsky": KandinskyBackend, "mock": MockBackend}[name]()


# ───────────── промпты ─────────────

def child_line(meta: dict) -> str:
    who = "boy" if meta.get("gender") == "boy" else "girl" if meta.get("gender") == "girl" else "child"
    return f"The child is a {meta.get('age', 5)}-year-old {who}. Appearance notes from the parent: {meta.get('description', '')}."


def sheet_prompt(style: dict, meta: dict) -> str:
    return (
        f"Character reference sheet of the child from the photo, drawn as {style['prompt']}. "
        "Four views on one plain light background: front view, three-quarter view, side profile, full body standing. "
        f"Same clothes in all views. {child_line(meta)} {STYLES['identity_clause']}"
    )


def scene_prompt(style: dict, scene: dict, meta: dict, with_sheet: bool) -> str:
    refs = (
        "Image 1 is a photo of the child, image 2 is the child's character sheet. Draw this same child. "
        if with_sheet
        else "The input image is a photo of the child. Draw this same child. "
    )
    return f"{refs}Scene: {scene['prompt']}. Style: {style['prompt']}. {child_line(meta)} {STYLES['identity_clause']}"


# ───────────── прогон ─────────────

def load_children(root: Path) -> list[tuple[str, Path, dict]]:
    out = []
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        photos = sorted(d.glob("photo_*_prepared.jpg")) or sorted(d.glob("photo_*"))
        photos = [p for p in photos if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
        if not photos:
            continue
        meta_file = d / "meta.json"
        meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
        out.append((d.name, photos[0], meta))
    return out


def generate(backend: Backend, children, styles, scenes, out: Path, params: dict, tag: str = "") -> list[dict]:
    rows = []
    for child_id, photo_path, meta in children:
        photo = Image.open(photo_path).convert("RGB")
        for style in styles:
            sheet = None
            if params["use_sheet"]:
                sheet_file = out / backend.name / child_id / f"sheet_{style['key']}{tag}.png"
                if not sheet_file.exists():
                    sheet_file.parent.mkdir(parents=True, exist_ok=True)
                    t0 = time.time()
                    img = backend.edit([photo], sheet_prompt(style, meta), STYLES["negative"], params["steps"], params["cfg"],
                                       seed_for(child_id, style["key"], "sheet"))
                    img.save(sheet_file)
                    print(f"  лист {child_id}/{style['key']} {time.time() - t0:.1f}s")
                sheet = Image.open(sheet_file).convert("RGB")
            for scene in scenes:
                name = f"{child_id}__{backend.name}__{style['key']}__{scene['id']}{tag}.png"
                path = out / backend.name / child_id / name
                if path.exists():
                    continue
                images = [photo, sheet] if sheet is not None else [photo]
                t0 = time.time()
                img = backend.edit(images, scene_prompt(style, scene, meta, sheet is not None), STYLES["negative"],
                                   params["steps"], params["cfg"], seed_for(child_id, style["key"], scene["id"]))
                dt = time.time() - t0
                img.save(path)
                row = {"child": child_id, "model": backend.name, "style": style["key"], "scene": scene["id"],
                       "file": str(path.relative_to(out)), "reference": str(photo_path), "seconds": round(dt, 1), **params, "tag": tag}
                rows.append(row)
                with open(out / "manifest.jsonl", "a") as f:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                print(f"  {name} {dt:.1f}s")
    return rows


def tune(backend: Backend, children, styles, out: Path) -> dict:
    """Подбор параметров по автоматической метрике сходства (ArcFace) на 3 трудных сценах."""
    from score import identity_scores  # локальный модуль

    grid = TUNE_GRID[backend.name]
    scenes = [s for s in SCENES if s["id"] in TUNE_SCENES]
    results = []
    for steps, cfg, use_sheet in itertools.product(grid["steps"], grid["cfg"], grid["use_sheet"]):
        params = {"steps": steps, "cfg": cfg, "use_sheet": use_sheet}
        tag = f"__t{steps}-{cfg}-{int(use_sheet)}"
        rows = generate(backend, children, styles, scenes, out, params, tag)
        sc = identity_scores(out, rows)
        results.append({**params, **sc})
        print(f"[tune] {params} → сходство {sc['mean_similarity']}, лицо найдено {sc['face_found_rate']}")
    best = max(results, key=lambda r: (r["mean_similarity"] or -1, r["face_found_rate"]))
    report = {"model": backend.name, "best": {k: best[k] for k in ("steps", "cfg", "use_sheet")}, "all": results}
    (out / f"best_params_{backend.name}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"[tune] лучшие параметры: {report['best']}")
    return report["best"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["qwen", "kandinsky", "mock"])
    ap.add_argument("--children", required=True, help="папка с подготовленными фото (вывод preprocess.py) и meta.json")
    ap.add_argument("--out", required=True)
    ap.add_argument("--styles", default="all", help="ключи через запятую")
    ap.add_argument("--scenes", default="all", help="id через запятую")
    ap.add_argument("--params", help="best_params_*.json после --tune")
    ap.add_argument("--tune", action="store_true", help="подбор параметров вместо полного прогона")
    a = ap.parse_args()

    styles = STYLES["styles"] if a.styles == "all" else [s for s in STYLES["styles"] if s["key"] in a.styles.split(",")]
    scenes = SCENES if a.scenes == "all" else [s for s in SCENES if s["id"] in a.scenes.split(",")]
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    children = load_children(Path(a.children))
    if not children:
        raise SystemExit("нет детей в --children")

    backend = make_backend(a.model)
    if a.tune:
        tune(backend, children, styles, out)
        return
    params = dict(DEFAULTS[a.model])
    if a.params:
        params.update(json.loads(Path(a.params).read_text())["best"])
    total = len(children) * len(styles) * len(scenes)
    print(f"{a.model}: {len(children)} дет. × {len(styles)} стил. × {len(scenes)} сцен = {total} иллюстраций, параметры {params}")
    generate(backend, children, styles, scenes, out, params)


if __name__ == "__main__":
    main()
