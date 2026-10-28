"""Синтетические «чужие» дети для слепой оценки.

Родителю показывают иллюстрации его ребёнка вперемешку с иллюстрациями других детей того же
возраста и пола. Чтобы не использовать фото реальных чужих детей, эти «другие дети» генерируются
моделью: это несуществующие лица. Они проходят тот же конвейер (preprocess.py → run.py),
поэтому выглядят в тех же стилях и сценах.

Похожесть подбирается специально: тот же пол, возраст и похожие волосы — чтобы родитель
отличал своего ребёнка по лицу, а не по причёске.

  python foils.py --like children/mark/meta.json --n 6 --out foils/ --model qwen
  python foils.py --like children/mark/meta.json --n 6 --out foils/ --model mock
"""
from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw

FACE_VARIANTS = [
    "round face, small nose, wide-set eyes",
    "oval face, freckles across the nose, thin eyebrows",
    "square jaw, dimples, slightly protruding ears",
    "long face, straight nose, deep-set eyes",
    "heart-shaped face, upturned nose, full cheeks",
    "narrow face, big eyes, gap between front teeth",
    "chubby cheeks, button nose, thick eyebrows",
    "high cheekbones, small chin, almond-shaped eyes",
]
EYES = ["blue", "grey", "green", "light brown", "hazel"]


def describe(like: dict, i: int, rnd: random.Random) -> dict:
    gender = like.get("gender", "boy")
    who = "boy" if gender == "boy" else "girl"
    hair = like.get("hair_en", "light brown short hair with bangs")
    face = FACE_VARIANTS[i % len(FACE_VARIANTS)]
    eyes = rnd.choice(EYES)
    prompt = (
        f"Realistic natural photo portrait of a {like.get('age', 5)}-year-old {who}, {hair}, {eyes} eyes, {face}, "
        "plain casual t-shirt, soft daylight, blurred outdoor background, looking at the camera, head and shoulders, "
        "sharp focus, ordinary child, not a model"
    )
    return {"name": f"foil_{i:02d}", "gender": gender, "age": like.get("age", 5),
            "description": f"{hair}, {eyes} eyes, {face}", "synthetic": True, "prompt": prompt}


def gen_qwen(prompts: list[str], seeds: list[int]) -> list[Image.Image]:
    import torch  # type: ignore
    from diffusers import DiffusionPipeline  # type: ignore

    pipe = DiffusionPipeline.from_pretrained(os.environ.get("QWEN_T2I_MODEL", "Qwen/Qwen-Image"), torch_dtype=torch.bfloat16)
    pipe.enable_model_cpu_offload() if os.environ.get("OFFLOAD") == "1" else pipe.to("cuda")
    return [
        pipe(prompt=p, negative_prompt="cartoon, illustration, painting, adult, text, watermark", width=1024, height=1024,
             num_inference_steps=40, true_cfg_scale=4.0, generator=torch.manual_seed(s)).images[0]
        for p, s in zip(prompts, seeds)
    ]


def gen_mock(prompts: list[str], seeds: list[int]) -> list[Image.Image]:
    out = []
    for s in seeds:
        r = random.Random(s)
        im = Image.new("RGB", (1024, 1024), (r.randint(90, 160), r.randint(100, 150), r.randint(80, 140)))
        d = ImageDraw.Draw(im)
        skin = (240, r.randint(200, 215), r.randint(180, 195))
        cx, cy, w = 512, 470, r.randint(300, 360)
        d.ellipse([cx - w // 2, cy - w // 2 - 40, cx + w // 2, cy + w // 2 + 40], fill=skin)
        d.pieslice([cx - w // 2 - 10, cy - w // 2 - 60, cx + w // 2 + 10, cy + 40], 180, 360, fill=(170, 130, 80))
        for ex in (cx - 70, cx + 70):
            d.ellipse([ex - 18, cy - 10, ex + 18, cy + 16], fill=(80, 120, 160))
        d.arc([cx - 60, cy + 60, cx + 60, cy + 120], 20, 160, fill=(190, 80, 80), width=8)
        d.rectangle([cx - 260, 820, cx + 260, 1024], fill=(r.randint(0, 255), 60, 60))
        out.append(im)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--like", required=True, help="meta.json ребёнка, под которого подбираются «чужие»")
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="qwen", choices=["qwen", "mock"])
    a = ap.parse_args()

    like = json.loads(Path(a.like).read_text())
    rnd = random.Random(42)
    metas = [describe(like, i, rnd) for i in range(a.n)]
    seeds = [1000 + i for i in range(a.n)]
    images = (gen_qwen if a.model == "qwen" else gen_mock)([m["prompt"] for m in metas], seeds)
    for m, im in zip(metas, images):
        d = Path(a.out) / m["name"]
        d.mkdir(parents=True, exist_ok=True)
        im.save(d / "photo_1.jpg", quality=95)
        (d / "meta.json").write_text(json.dumps(m, ensure_ascii=False, indent=2))
        print(f"{m['name']}: {m['description']}")


if __name__ == "__main__":
    main()
