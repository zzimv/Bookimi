#!/usr/bin/env bash
# Подготовка GPU-инстанса в российском облаке (Selectel / Yandex Cloud / Immers и аналоги).
#
# Конфигурация:
#   Qwen-Image-Edit-2511 в bf16 без выгрузки — A100 80 ГБ или H100 80 ГБ.
#   На 48 ГБ (L40S, A6000) — запускать с OFFLOAD=1 (медленнее в 1,5–2 раза).
#   Kandinsky 5.0 I2I Lite (6B) — помещается на 48 ГБ, на 24 ГБ — с OFFLOAD=1.
#   Диск: 200 ГБ (веса ~120 ГБ). Образ: Ubuntu 22.04/24.04 с драйвером NVIDIA и CUDA 12.x.
#
# Запуск:  bash setup_gpu.sh
# Если huggingface.co медленный или недоступен — укажите зеркало: export HF_ENDPOINT=https://<зеркало>
set -euo pipefail
cd "$(dirname "$0")"

nvidia-smi || { echo "нет драйвера NVIDIA — выберите образ с CUDA"; exit 1; }

sudo apt-get update -y
sudo apt-get install -y python3-venv python3-dev git libgl1 libglib2.0-0

python3 -m venv .venv
source .venv/bin/activate
pip install -U pip wheel
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
# Пайплайны QwenImageEditPlus и Kandinsky5I2I — в свежих diffusers
pip install "git+https://github.com/huggingface/diffusers" transformers accelerate sentencepiece safetensors
pip install "opencv-python-headless<5" pillow numpy insightface onnxruntime-gpu huggingface_hub

# Скачиваем веса заранее, чтобы время генерации считалось честно
huggingface-cli download Qwen/Qwen-Image-Edit-2511
huggingface-cli download kandinskylab/Kandinsky-5.0-I2I-Lite-sft-Diffusers
huggingface-cli download Qwen/Qwen-Image            # для синтетических «чужих» детей (foils.py)

# Модель лиц для метрики сходства скачается при первом запуске score.py (~300 МБ)
python - <<'EOF'
import torch, diffusers
print("torch", torch.__version__, "cuda", torch.cuda.is_available(), torch.cuda.get_device_name(0))
print("diffusers", diffusers.__version__)
from diffusers import QwenImageEditPlusPipeline, Kandinsky5I2IPipeline  # проверка, что классы есть
print("pipelines ok")
EOF

echo "Готово. Дальше: bash run_all.sh"
