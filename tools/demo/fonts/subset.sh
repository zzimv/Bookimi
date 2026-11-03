#!/bin/sh
# Шрифты демо-стенда: подмножества Nunito 800 и Manrope 400/700 из @fontsource (OFL) — только кириллица
# А–я/Ё/№ и базовая латиница с типографскими знаками («» — … ₽). build.mjs встраивает их в HTML (без Google Fonts).
# Пересобрать: pip install fonttools brotli && sh tools/demo/fonts/subset.sh
set -e
cd "$(dirname "$0")"
F=../../../node_modules/@fontsource
CYR="U+0401,U+0410-044F,U+0451,U+2116"
LAT="U+0020-007E,U+00A0,U+00AB,U+00BB,U+00B7,U+00D7,U+00A9,U+2010-2014,U+2018-201E,U+2026,U+2116,U+20BD,U+2212,U+2192,U+2190,U+2191,U+2193,U+00B0,U+2009,U+202F"
for spec in nunito:800 manrope:400 manrope:700; do
  p=${spec%:*}; w=${spec#*:}
  python3 -m fontTools.subset "$F/$p/files/$p-cyrillic-$w-normal.woff2" --unicodes="$CYR" --flavor=woff2 --layout-features='kern,liga' --output-file="$p-cyr-$w.woff2"
  python3 -m fontTools.subset "$F/$p/files/$p-latin-$w-normal.woff2" --unicodes="$LAT" --flavor=woff2 --layout-features='kern,liga' --output-file="$p-lat-$w.woff2"
done
# rev 19, «сказочная» вёрстка книги: Yeseva One 400 (имя и ключевые слова) и Lora 400 / 400 italic (текст книги) —
# OFL, полная кириллица. Латиница у книжных шрифтов — только цифры и знаки (буквы латиницы в книге — запасным serif).
PUN="U+0020-0040,U+005B-0060,U+007B-007E,U+00A0,U+00AB,U+00BB,U+00B7,U+2010-2014,U+2018-201E,U+2026,U+2116,U+2009,U+202F,U+2605,U+2726,U+2767"
for spec in yeseva-one:400-normal lora:400-normal lora:400-italic; do
  p=${spec%:*}; w=${spec#*:}; s=${w%-normal}
  python3 -m fontTools.subset "$F/$p/files/$p-cyrillic-$w.woff2" --unicodes="$CYR" --flavor=woff2 --layout-features='kern,liga' --output-file="$p-cyr-$s.woff2"
  python3 -m fontTools.subset "$F/$p/files/$p-latin-$w.woff2" --unicodes="$PUN" --flavor=woff2 --layout-features='kern,liga' --output-file="$p-lat-$s.woff2"
done
