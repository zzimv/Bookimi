"""Прогон теста узнаваемости на GPU-инстансе в РФ.

Использование:
  python run.py --model qwen --input data/ --out results/
  python run.py --model kandinsky --input data/ --out results/

data/<child_id>/photo_*.jpg + data/<child_id>/meta.json ({"gender": "girl", "age": 5, "description": "..."})
Модели загружаются из локальных весов (Apache 2.0 / лицензия Kandinsky), без внешних API.
"""
import argparse
import json
import time
from pathlib import Path


def load_model(name: str):
    if name == "qwen":
        from diffusers import QwenImageEditPipeline  # type: ignore
        import torch  # type: ignore
        pipe = QwenImageEditPipeline.from_pretrained("Qwen/Qwen-Image-Edit", torch_dtype=torch.bfloat16)
        return pipe.to("cuda")
    if name == "kandinsky":
        # Kandinsky 5.0 Image Lite: путь к весам указывается переменной KANDINSKY_WEIGHTS
        from kandinsky import get_image_pipeline  # type: ignore
        return get_image_pipeline()
    raise SystemExit(f"неизвестная модель {name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["qwen", "kandinsky"])
    ap.add_argument("--input", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cfg = json.loads(Path(__file__).with_name("scenes.json").read_text())
    pipe = load_model(args.model)
    out = Path(args.out) / args.model
    out.mkdir(parents=True, exist_ok=True)
    log = []

    from PIL import Image  # type: ignore

    for child in sorted(Path(args.input).iterdir()):
        if not child.is_dir():
            continue
        meta = json.loads((child / "meta.json").read_text())
        photo = Image.open(sorted(child.glob("photo_*"))[0]).convert("RGB")
        for style in cfg["styles"]:
            for scene in cfg["scenes"]:
                prompt = (
                    f"Children's book illustration, {style} style. {scene['prompt']}. "
                    f"Keep the child's face, hair and features identical to the reference photo. "
                    f"{meta.get('description', '')}"
                )
                t0 = time.time()
                img = pipe(image=photo, prompt=prompt, num_inference_steps=40).images[0]
                dt = time.time() - t0
                name = f"{child.name}_{style}_{scene['id']}.png"
                img.save(out / name)
                log.append({"child": child.name, "style": style, "scene": scene["id"], "seconds": round(dt, 1), "file": name})
                print(name, round(dt, 1))

    (out / "log.json").write_text(json.dumps(log, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
