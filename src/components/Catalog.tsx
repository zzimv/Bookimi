"use client";
import { useEffect, useRef, useState } from "react";

// Фильтры по возрасту, полу и поводу. Карточки отрисованы на сервере,
// здесь только скрываем/показываем — минимум JS на первом экране.
// Пол: все сюжеты подходят и мальчикам, и девочкам (поле gender в БД — задел).
const AGES = [
  { key: "all", label: "Любой возраст" },
  { key: "2-4", label: "2–4 года", min: 2, max: 4 },
  { key: "5-7", label: "5–7 лет", min: 5, max: 7 },
  { key: "8-9", label: "8–9 лет", min: 8, max: 9 },
];

export function CatalogFilters({ occasions }: { occasions: { slug: string; title: string }[] }) {
  const [age, setAge] = useState("all");
  const [occ, setOcc] = useState("all");
  const [gender, setGender] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current?.nextElementSibling;
    if (!grid) return;
    const a = AGES.find((x) => x.key === age);
    grid.querySelectorAll<HTMLElement>(".book").forEach((el) => {
      const min = Number(el.dataset.ageMin);
      const max = Number(el.dataset.ageMax);
      const okAge = !a || a.key === "all" || (min <= a.max! && max >= a.min!);
      // Сюжеты без привязки к поводу подходят к любому поводу
      const okOcc = occ === "all" || (el.dataset.occasions ?? "").split(" ").includes(occ) || el.dataset.occasion === "";
      el.hidden = !(okAge && okOcc);
    });
  }, [age, occ, gender]);

  return (
    <div ref={ref}>
      <div className="filters" role="group" aria-label="Возраст">
        {AGES.map((x) => (
          <button key={x.key} type="button" className="chip" aria-pressed={age === x.key} onClick={() => setAge(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="filters" role="group" aria-label="Пол и повод">
        {[
          { key: "all", label: "Для всех" },
          { key: "boy", label: "Мальчику" },
          { key: "girl", label: "Девочке" },
        ].map((x) => (
          <button key={x.key} type="button" className="chip" aria-pressed={gender === x.key} onClick={() => setGender(x.key)}>
            {x.label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={occ === "all"} onClick={() => setOcc("all")}>
          Любой повод
        </button>
        {occasions.map((o) => (
          <button key={o.slug} type="button" className="chip" aria-pressed={occ === o.slug} onClick={() => setOcc(o.slug)}>
            {o.title}
          </button>
        ))}
      </div>
    </div>
  );
}
