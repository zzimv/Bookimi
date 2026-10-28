# Сервер генерации на GPU

Отдельная виртуальная машина с видеокартой в Yandex Cloud. Сайт включает её по требованию
через Compute API и выключает после простоя (настройки — админка → Настройки → GPU-сервер).

## Создание машины (один раз)
1. Yandex Cloud → Compute Cloud → создать ВМ с GPU (A100 80 ГБ; для экономии — прерываемая).
   Образ: Ubuntu 22.04 с драйверами NVIDIA (из Marketplace «GPU-оптимизированный»). Диск 200 ГБ SSD.
2. Подключиться по SSH, скопировать папку `tools/gpu-server` и выполнить:
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
   pip install -r requirements.txt
   huggingface-cli download Qwen/Qwen-Image-Edit-2511
   huggingface-cli download Qwen/Qwen-Image
   huggingface-cli download kandinskylab/Kandinsky-5.0-I2I-Lite-sft-Diffusers
   ```
3. Автозапуск: `sudo cp bookimi-gpu.service /etc/systemd/system/ && sudo systemctl enable --now bookimi-gpu`
   (в файле сервиса укажите GPU_INFERENCE_TOKEN — длинную случайную строку).
4. Закрыть порт 8000 для всех, кроме IP основного VPS (группа безопасности).
5. Сервисный аккаунт с ролью `compute.operator` на эту ВМ → авторизованный ключ JSON.

## Переменные на основном сервере (.env)
```
GPU_SERVER_URL=http://<внутренний-или-белый-IP>:8000
GPU_INFERENCE_TOKEN=<та же строка>
GPU_INSTANCE_ID=<id ВМ>
YC_SA_KEY_JSON=<содержимое JSON-ключа одной строкой>
```
Затем в админке: Настройки → ИИ-провайдеры → Иллюстрации: «Qwen-Image-Edit на своём GPU».
