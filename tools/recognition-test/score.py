"""Подсчёт результатов теста узнаваемости.

1) Слепая оценка родителей (главный критерий):
   python score.py --keys cards/ --answers answers/ --out report/
   Модель проходит, если медианный родитель узнал своего ребёнка минимум на 8 из 10 иллюстраций
   этой модели и при этом «узнал» не больше 20% чужих (иначе он просто отвечает «да» на всё).

2) Автоматическая метрика сходства (для подбора параметров и быстрой проверки без родителей):
   python score.py --identity results/ --out report/
   Косинусное сходство лица ArcFace (insightface) между фото и иллюстрацией. На рисованных
   лицах детектор находит лицо не всегда — доля найденных лиц тоже показатель.
   Метрика вспомогательная: по ней сравнивают варианты между собой, решение — по оценке родителей.
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path

PASS_RECOGNITION = 0.8
MAX_FALSE_POSITIVE = 0.2

# ───────────── автоматическая метрика ─────────────

_face_app = None


def _arcface():
    global _face_app
    if _face_app is None:
        try:
            from insightface.app import FaceAnalysis  # type: ignore

            app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.3)  # порог ниже: рисованные лица
            _face_app = app
        except Exception:
            _face_app = False
    return _face_app


def _embedding(path: Path):
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    app = _arcface()
    img = cv2.imread(str(path))
    if app:
        faces = app.get(img)
        if not faces:
            return None, "arcface"
        f = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        return f.normed_embedding, "arcface"
    # Заглушка без insightface (например, в сухом прогоне): гистограмма цветов. Не мера сходства лиц!
    hist = cv2.calcHist([img], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3).flatten()
    return hist / (np.linalg.norm(hist) + 1e-9), "proxy"


def identity_scores(root: Path, rows: list[dict]) -> dict:
    import numpy as np  # type: ignore

    cache: dict[str, object] = {}
    sims, found, metric = [], 0, "arcface"
    for r in rows:
        ref = r["reference"]
        if ref not in cache:
            cache[ref], metric = _embedding(Path(ref))
        e_ref = cache[ref]
        e_img, metric = _embedding(root / r["file"])
        if e_ref is None or e_img is None:
            r["similarity"] = None
            continue
        found += 1
        s = float(np.dot(e_ref, e_img))
        r["similarity"] = round(s, 3)
        sims.append(s)
    return {
        "metric": metric,
        "mean_similarity": round(statistics.mean(sims), 3) if sims else None,
        "face_found_rate": round(found / len(rows), 2) if rows else 0,
        "n": len(rows),
    }


def identity_report(results: Path, out: Path):
    rows = [json.loads(l) for l in (results / "manifest.jsonl").read_text().splitlines()]
    rows = [r for r in rows if not r.get("tag") and not r["child"].startswith("foil_")]
    groups = defaultdict(list)
    for r in rows:
        groups[(r["model"], r["style"])].append(r)
    table = []
    for (model, style), items in sorted(groups.items()):
        sc = identity_scores(results, items)
        table.append({"model": model, "style": style, **sc})
    by_scene = defaultdict(list)
    for r in rows:
        if r.get("similarity") is not None:
            by_scene[(r["model"], r["scene"])].append(r["similarity"])
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "identity_by_style.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(table[0].keys()))
        w.writeheader()
        w.writerows(table)
    with open(out / "identity_by_scene.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["model", "scene", "mean_similarity", "n"])
        for (m, s), v in sorted(by_scene.items()):
            w.writerow([m, s, round(statistics.mean(v), 3), len(v)])
    for t in table:
        print(f"{t['model']:10} {t['style']:15} сходство {t['mean_similarity']}  лицо найдено {t['face_found_rate']:.0%}  ({t['metric']})")


# ───────────── оценка родителей ─────────────

def human_report(keys_dir: Path, answers_dir: Path, out: Path):
    keys = {json.loads(p.read_text())["deck"]: json.loads(p.read_text())["cards"] for p in keys_dir.glob("answer_key_*.json")}
    per_parent = defaultdict(lambda: defaultdict(lambda: {"hit": 0, "mine": 0, "fp": 0, "foil": 0, "sim": []}))
    per_style = defaultdict(lambda: {"hit": 0, "mine": 0, "sim": []})
    per_scene = defaultdict(lambda: {"hit": 0, "mine": 0})
    for p in answers_dir.glob("answers_*.json"):
        data = json.loads(p.read_text())
        key = keys.get(data["deck"])
        if not key:
            print(f"нет ключа для {p.name}")
            continue
        for cid, ans in data["answers"].items():
            if cid not in key or not ans.get("done"):
                continue
            k = key[cid]
            cell = per_parent[data["deck"]][k["model"]]
            if k["mine"]:
                cell["mine"] += 1
                per_style[(k["model"], k["style"])]["mine"] += 1
                per_scene[(k["model"], k["scene"])]["mine"] += 1
                if ans["mine"]:
                    cell["hit"] += 1
                    per_style[(k["model"], k["style"])]["hit"] += 1
                    per_scene[(k["model"], k["scene"])]["hit"] += 1
                    if "similarity" in ans:
                        cell["sim"].append(ans["similarity"])
                        per_style[(k["model"], k["style"])]["sim"].append(ans["similarity"])
            else:
                cell["foil"] += 1
                if ans["mine"]:
                    cell["fp"] += 1

    out.mkdir(parents=True, exist_ok=True)
    models = sorted({m for d in per_parent.values() for m in d})
    lines = ["# Тест узнаваемости — итоги", "", f"Родителей: {len(per_parent)}. Критерий: ≥ 8 из 10 узнанных и ≤ 20% ложных «да».", ""]
    lines += ["| Модель | Узнано (медиана по родителям) | Ложные «да» | Сходство 1–5 | Итог |", "|---|---|---|---|---|"]
    verdicts = {}
    for m in models:
        rec = [c["hit"] / c["mine"] for d in per_parent.values() if (c := d.get(m)) and c["mine"]]
        fp = [c["fp"] / c["foil"] for d in per_parent.values() if (c := d.get(m)) and c["foil"]]
        sims = [s for d in per_parent.values() if (c := d.get(m)) for s in c["sim"]]
        r_med = statistics.median(rec) if rec else 0
        fp_mean = statistics.mean(fp) if fp else 0
        ok = r_med >= PASS_RECOGNITION and fp_mean <= MAX_FALSE_POSITIVE
        verdicts[m] = ok
        lines.append(f"| {m} | {r_med:.0%} ({r_med * 10:.0f} из 10) | {fp_mean:.0%} | "
                     f"{statistics.mean(sims):.1f} | {'проходит' if ok else 'не проходит'} |" if sims else
                     f"| {m} | {r_med:.0%} | {fp_mean:.0%} | — | {'проходит' if ok else 'не проходит'} |")
    lines += ["", "## По стилям", "", "| Модель | Стиль | Узнано | Сходство |", "|---|---|---|---|"]
    for (m, s), c in sorted(per_style.items()):
        lines.append(f"| {m} | {s} | {c['hit']}/{c['mine']} | {statistics.mean(c['sim']):.1f} |" if c["sim"] else f"| {m} | {s} | {c['hit']}/{c['mine']} | — |")
    lines += ["", "## По сценам", "", "| Модель | Сцена | Узнано |", "|---|---|---|"]
    for (m, s), c in sorted(per_scene.items()):
        lines.append(f"| {m} | {s} | {c['hit']}/{c['mine']} |")
    lines += ["", "## Решение", ""]
    if any(verdicts.values()):
        best = [m for m, ok in verdicts.items() if ok]
        lines.append(f"Прошли: {', '.join(best)}. Модель по умолчанию — лучшая из прошедших; стили с узнаваемостью ниже 70% исключить.")
    else:
        lines.append("**Ни одна модель не прошла. Работа останавливается — результаты передаются владельцу.**")
    (out / "report.md").write_text("\n".join(lines))
    print("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", help="папка с answer_key_*.json")
    ap.add_argument("--answers", help="папка с answers_*.json")
    ap.add_argument("--identity", help="папка результатов run.py для автоматической метрики")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.identity:
        identity_report(Path(a.identity), Path(a.out))
    if a.keys and a.answers:
        human_report(Path(a.keys), Path(a.answers), Path(a.out))


if __name__ == "__main__":
    main()
