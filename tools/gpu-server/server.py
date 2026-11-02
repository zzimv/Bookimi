"""Сервер генерации иллюстраций на GPU (Yandex Cloud / Selectel / Immers).

Принимает задачи от воркера БУКИМИ: фото + лист персонажа + промпт → иллюстрация PNG.
Фото не сохраняются на диск и не покидают сервер — живут только в памяти на время запроса.

Запуск:
  pip install -r requirements.txt
  GPU_INFERENCE_TOKEN=... uvicorn server:app --host 0.0.0.0 --port 8000

Модели загружаются при первом запросе (или при старте, если PRELOAD=qwen,kandinsky).
"""
from __future__ import annotations

import base64
import io
import os
import threading
import time

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="bookimi-gpu")
TOKEN = os.environ.get("GPU_INFERENCE_TOKEN", "")
_lock = threading.Lock()  # одна генерация за раз на одну видеокарту
_pipes: dict[str, object] = {}


def auth(authorization: str = Header(default="")):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "unauthorized")


def load(name: str):
    if name in _pipes:
        return _pipes[name]
    import torch  # type: ignore

    offload = os.environ.get("OFFLOAD", "0") == "1"
    if name == "qwen":
        from diffusers import QwenImageEditPlusPipeline  # type: ignore

        pipe = QwenImageEditPlusPipeline.from_pretrained(os.environ.get("QWEN_MODEL", "Qwen/Qwen-Image-Edit-2511"), torch_dtype=torch.bfloat16)
    elif name == "qwen-t2i":
        from diffusers import DiffusionPipeline  # type: ignore

        pipe = DiffusionPipeline.from_pretrained(os.environ.get("QWEN_T2I_MODEL", "Qwen/Qwen-Image"), torch_dtype=torch.bfloat16)
    elif name == "kandinsky":
        from diffusers import Kandinsky5I2IPipeline  # type: ignore

        pipe = Kandinsky5I2IPipeline.from_pretrained(os.environ.get("KANDINSKY_MODEL", "kandinskylab/Kandinsky-5.0-I2I-Lite-sft-Diffusers"))
        pipe.to(device="cuda", dtype=torch.bfloat16)
    else:
        raise HTTPException(400, "unknown model")
    if name != "kandinsky":
        pipe.enable_model_cpu_offload() if offload else pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)
    _pipes[name] = pipe
    return pipe


class EditReq(BaseModel):
    model: str = "qwen"
    images: list[str] = Field(default_factory=list, max_length=6)
    prompt: str = Field(max_length=4000)
    negative: str = ""
    width: int | None = None
    height: int | None = None
    steps: int = Field(default=40, ge=10, le=80)
    cfg: float = 4.0
    seed: int = 0
    text2img: bool = False
    # Печатный размер (300 dpi): после генерации — увеличение Real-ESRGAN (если установлен) или Lanczos
    out_width: int | None = Field(default=None, le=6000)
    out_height: int | None = Field(default=None, le=6000)


@app.get("/health")
def health():
    import torch  # type: ignore

    return {"ok": torch.cuda.is_available(), "loaded": list(_pipes)}


@app.post("/v1/edit", dependencies=[Depends(auth)])
def edit(r: EditReq):
    import torch  # type: ignore
    from PIL import Image  # type: ignore

    imgs = [Image.open(io.BytesIO(base64.b64decode(b))).convert("RGB") for b in r.images]
    t0 = time.time()
    with _lock:
        if r.text2img or not imgs:
            pipe = load("qwen-t2i" if r.model == "qwen" else r.model)
            out = pipe(prompt=r.prompt, negative_prompt=r.negative or " ", width=r.width or 1024, height=r.height or 1024,
                       num_inference_steps=r.steps, true_cfg_scale=r.cfg, generator=torch.manual_seed(r.seed)).images[0]
        elif r.model == "kandinsky":
            pipe = load("kandinsky")
            src = imgs[0] if len(imgs) == 1 else side_by_side(imgs)
            res = pipe(image=src, prompt=r.prompt, negative_prompt=r.negative, num_inference_steps=r.steps, guidance_scale=r.cfg,
                       height=r.height or 1024, width=r.width or 1024, generator=torch.Generator("cuda").manual_seed(r.seed))
            out = res.image[0] if hasattr(res, "image") else res.images[0]
        else:
            pipe = load("qwen")
            out = pipe(image=imgs, prompt=r.prompt, negative_prompt=r.negative or " ", true_cfg_scale=r.cfg,
                       num_inference_steps=r.steps, generator=torch.manual_seed(r.seed)).images[0]
            if r.width and r.height and (out.width, out.height) != (r.width, r.height):
                out = cover_resize(out, r.width, r.height)
        if r.out_width and r.out_height and (out.width, out.height) != (r.out_width, r.out_height):
            out = upscale(out, r.out_width, r.out_height)
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return {"image": base64.b64encode(buf.getvalue()).decode(), "seconds": round(time.time() - t0, 2), "nsfw": 0.0}


_esrgan = None


def upscale(im, w, h):
    """Увеличение до печатного размера: Real-ESRGAN x4 (pip install realesrgan, веса RealESRGAN_x4plus.pth рядом),
    без него — Lanczos с лёгкой резкостью. Затем точная подгонка cover_resize."""
    global _esrgan
    from PIL import ImageFilter  # type: ignore
    try:
        if _esrgan is None:
            from realesrgan import RealESRGANer  # type: ignore
            from basicsr.archs.rrdbnet_arch import RRDBNet  # type: ignore
            net = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
            _esrgan = RealESRGANer(scale=4, model_path=os.environ.get("ESRGAN_WEIGHTS", "RealESRGAN_x4plus.pth"), model=net, half=True)
        import numpy as np  # type: ignore
        from PIL import Image  # type: ignore
        arr, _ = _esrgan.enhance(np.array(im)[:, :, ::-1], outscale=max(w / im.width, h / im.height))
        im = Image.fromarray(arr[:, :, ::-1])
    except Exception:
        scale = max(w / im.width, h / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), resample=3).filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    return cover_resize(im, w, h)


def side_by_side(images):
    from PIL import Image  # type: ignore

    h = 1024
    parts = [im.resize((int(im.width * h / im.height), h)) for im in images]
    canvas = Image.new("RGB", (sum(p.width for p in parts), h), "white")
    x = 0
    for p in parts:
        canvas.paste(p, (x, 0))
        x += p.width
    return canvas


def cover_resize(im, w, h):
    """Кадрирование «с запасом»: заполнить w×h без искажений."""
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)))
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


for m in [x for x in os.environ.get("PRELOAD", "").split(",") if x]:
    load(m)
