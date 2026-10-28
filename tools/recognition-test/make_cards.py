"""Колода карточек для слепой оценки — одна HTML-страница на родителя.

На каждую модель родитель видит 10 иллюстраций своего ребёнка (5 стилей × 2 сцены) и 5 иллюстраций
синтетических детей. Всё перемешано; модель, стиль и «свой/чужой» на странице не видны.
Ключ ответов хранится отдельно у организатора (answer_key_<id>.json) и в HTML не попадает.

Страница работает без интернета (картинки встроены), открывается на телефоне. В конце — кнопка
«Скачать ответы»: файл answers_<id>.json присылается организатору.

  python make_cards.py --results results/ --foils-results results/ --child mark --foils foil_ --out cards/
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import random
from collections import defaultdict
from pathlib import Path

from PIL import Image

TARGET_PER_MODEL = 10
FOILS_PER_MODEL = 5


def read_manifest(root: Path) -> list[dict]:
    rows = []
    f = root / "manifest.jsonl"
    if f.exists():
        for line in f.read_text().splitlines():
            r = json.loads(line)
            if not r.get("tag"):          # прогоны подбора параметров в колоду не идут
                r["_root"] = str(root)
                rows.append(r)
    return rows


def thumb_b64(path: Path, size: int = 640) -> str:
    im = Image.open(path).convert("RGB")
    im.thumbnail((size, size))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    return base64.b64encode(buf.getvalue()).decode()


def pick_targets(rows: list[dict], rnd: random.Random) -> list[dict]:
    """По 2 разные сцены на каждый стиль → 10 карточек на модель при 5 стилях."""
    by_style = defaultdict(list)
    for r in rows:
        by_style[r["style"]].append(r)
    picked = []
    per_style = max(1, TARGET_PER_MODEL // max(1, len(by_style)))
    for style, items in sorted(by_style.items()):
        rnd.shuffle(items)
        picked += items[:per_style]
    return picked[:TARGET_PER_MODEL]


PAGE = """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Узнаете ли вы ребёнка?</title>
<style>
:root{--f:#1e4d3b;--g:#c8952f;--p:#fcfbf7;--i:#1a2b24;--l:#d9e2dc}
*{box-sizing:border-box}body{margin:0;background:var(--p);color:var(--i);font:16px/1.5 system-ui,sans-serif}
main{max-width:560px;margin:0 auto;padding:16px}
h1{font-size:1.4rem;color:var(--f);margin:8px 0}
.card{display:none}.card.on{display:block}
.card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#eee}
.q{font-weight:700;margin:14px 0 8px}
.row{display:flex;gap:8px;flex-wrap:wrap}
button{min-height:52px;flex:1;border:0;border-radius:999px;font:700 1rem system-ui;cursor:pointer}
.yes{background:var(--f);color:#fff}.no{background:#fff;color:var(--f);box-shadow:inset 0 0 0 2px var(--f)}
.sim button{min-width:52px;flex:1;background:#fff;box-shadow:inset 0 0 0 2px var(--l);color:var(--i)}
.sim button[aria-pressed=true]{background:var(--g);box-shadow:none}
.bar{height:6px;background:var(--l);border-radius:3px;margin:8px 0 16px}.bar i{display:block;height:100%;background:var(--g);border-radius:3px}
.muted{color:#4d5f57;font-size:.9rem}
#done{display:none}
</style></head><body><main>
<h1>Узнаете ли вы ребёнка?</h1>
<p class="muted">Вы увидите __N__ рисунков. На некоторых — ваш ребёнок, на других — другие дети. Отвечайте сразу,
по первому впечатлению. Вернуться назад нельзя.</p>
<div class="bar"><i id="bar" style="width:0"></i></div>
__CARDS__
<section id="done">
<h1>Спасибо!</h1>
<p>Нажмите кнопку и отправьте файл организатору.</p>
<div class="row"><button class="yes" id="dl">Скачать ответы</button></div>
</section>
</main>
<script>
const KEY="answers___ID__",cards=[...document.querySelectorAll('.card')];let i=0;const ans={};
function load(){try{Object.assign(ans,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(ans))}catch(e){}}
function show(){cards.forEach((c,k)=>c.classList.toggle('on',k===i));document.getElementById('bar').style.width=(100*i/cards.length)+'%';
 if(i>=cards.length){document.getElementById('done').style.display='block'}}
load();while(i<cards.length&&ans[cards[i].dataset.id]&&ans[cards[i].dataset.id].done)i++;show();
cards.forEach(c=>{const id=c.dataset.id,sim=c.querySelector('.sim');
 c.querySelector('.yes').onclick=()=>{ans[id]={mine:true,t:Date.now()};save();sim.style.display='block';c.querySelector('.yn').style.display='none'};
 c.querySelector('.no').onclick=()=>{ans[id]={mine:false,done:true,t:Date.now()};save();i++;show()};
 sim.querySelectorAll('button').forEach(b=>b.onclick=()=>{ans[id].similarity=+b.dataset.v;ans[id].done=true;save();i++;show()});});
document.getElementById('dl').onclick=()=>{const blob=new Blob([JSON.stringify({deck:"__ID__",answers:ans},null,1)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='answers___ID__.json';a.click()};
</script></body></html>"""

CARD = """<section class="card" data-id="{id}">
<img src="data:image/jpeg;base64,{img}" alt="Рисунок {n}">
<div class="yn"><p class="q">Это ваш ребёнок?</p>
<div class="row"><button class="yes">Да</button><button class="no">Нет</button></div></div>
<div class="sim" style="display:none"><p class="q">Насколько похож? 1 — едва, 5 — одно лицо</p>
<div class="row">{sim}</div></div>
</section>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True, help="результаты run.py по детям")
    ap.add_argument("--foils-results", required=True, help="результаты run.py по синтетическим детям")
    ap.add_argument("--child", required=True, help="id ребёнка (имя папки)")
    ap.add_argument("--foils", default="foil_", help="префикс id синтетических детей")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    rnd = random.Random(f"{a.child}-{a.seed}")
    rows = read_manifest(Path(a.results))
    frows = [r for r in read_manifest(Path(a.foils_results)) if r["child"].startswith(a.foils)]
    models = sorted({r["model"] for r in rows if r["child"] == a.child})
    if not models:
        raise SystemExit(f"нет иллюстраций для {a.child}")

    deck = []
    for m in models:
        for r in pick_targets([r for r in rows if r["child"] == a.child and r["model"] == m], rnd):
            deck.append({**r, "mine": True})
        pool = [r for r in frows if r["model"] == m]
        rnd.shuffle(pool)
        for r in pool[:FOILS_PER_MODEL]:
            deck.append({**r, "mine": False})
    rnd.shuffle(deck)

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    key, cards = {}, []
    for n, r in enumerate(deck, 1):
        cid = f"c{rnd.randrange(16**6):06x}"
        key[cid] = {k: r[k] for k in ("child", "model", "style", "scene", "file", "mine")}
        img = thumb_b64(Path(r["_root"]) / r["file"])
        sim = "".join(f'<button data-v="{v}" aria-pressed="false">{v}</button>' for v in range(1, 6))
        cards.append(CARD.format(id=cid, img=img, n=n, sim=sim))
    page = PAGE.replace("__CARDS__", "\n".join(cards)).replace("__N__", str(len(deck))).replace("__ID__", html.escape(a.child))
    (out / f"deck_{a.child}.html").write_text(page)
    (out / f"answer_key_{a.child}.json").write_text(json.dumps({"deck": a.child, "cards": key}, ensure_ascii=False, indent=2))
    mine = sum(1 for r in deck if r["mine"])
    print(f"колода {a.child}: {len(deck)} карточек ({mine} своих, {len(deck) - mine} чужих), модели: {', '.join(models)}")


if __name__ == "__main__":
    main()
