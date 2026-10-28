#!/usr/bin/env bash
# Полный прогон теста на GPU-инстансе.
#
# Перед запуском положите фото и анкеты:
#   data/children/<id>/photo_1.jpg (+ photo_2, photo_3) и data/children/<id>/meta.json
#   meta.json: {"name": "Марк", "gender": "boy", "age": 5,
#               "description": "светло-русые волосы с чёлкой, голубые глаза, румяные щёки",
#               "hair_en": "light brown short hair with bangs"}
#
# MODELS="qwen kandinsky" (по умолчанию обе), MOCK=1 — сухой прогон без GPU.
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] && source .venv/bin/activate

MODELS=${MODELS:-"qwen kandinsky"}
[ "${MOCK:-0}" = "1" ] && MODELS="mock"
D=${DATA:-data}

echo "1/6 Проверка и подготовка фото"
for c in "$D"/children/*/; do
  id=$(basename "$c")
  python preprocess.py "$c" "$D/prepared/$id"
  cp "$c/meta.json" "$D/prepared/$id/"
done

echo "2/6 Синтетические «чужие» дети под каждого ребёнка"
for c in "$D"/children/*/; do
  id=$(basename "$c")
  python foils.py --like "$c/meta.json" --n 6 --out "$D/foils_raw/$id" --model "$([ "${MOCK:-0}" = 1 ] && echo mock || echo qwen)"
  for f in "$D"/foils_raw/$id/*/; do
    fid="foil_${id}_$(basename "$f" | sed 's/foil_//')"
    python preprocess.py "$f" "$D/foils_prepared/$fid" >/dev/null
    # лицо не нашлось (бывает на синтетике) — берём исходник без обработки
    ls "$D/foils_prepared/$fid"/photo_*_prepared.jpg >/dev/null 2>&1 || cp "$f/photo_1.jpg" "$D/foils_prepared/$fid/photo_1_prepared.jpg"
    cp "$f/meta.json" "$D/foils_prepared/$fid/"
  done
done

for m in $MODELS; do
  echo "3/6 [$m] Подбор параметров на 3 трудных сценах"
  python run.py --model "$m" --children "$D/prepared" --out "$D/tune" --tune
  P="$D/tune/best_params_$m.json"

  echo "4/6 [$m] Полный прогон: дети и «чужие»"
  python run.py --model "$m" --children "$D/prepared" --out "$D/results" --params "$P"
  python run.py --model "$m" --children "$D/foils_prepared" --out "$D/results" --params "$P"
done

echo "5/6 Автоматическая метрика сходства"
python score.py --identity "$D/results" --out "$D/report"

echo "6/6 Колоды для родителей"
for c in "$D"/children/*/; do
  id=$(basename "$c")
  python make_cards.py --results "$D/results" --foils-results "$D/results" --child "$id" --foils "foil_${id}_" --out "$D/cards"
done

echo
echo "Отправьте каждому родителю его $D/cards/deck_<id>.html, соберите answers_<id>.json в $D/answers/ и запустите:"
echo "  python score.py --keys $D/cards --answers $D/answers --out $D/report"
echo
echo "После теста: скачайте $D/report и $D/cards, затем удалите инстанс ВМЕСТЕ С ДИСКОМ — на нём фото детей."
