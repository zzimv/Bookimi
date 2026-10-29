"use client";
// Выбор пункта выдачи СДЭК списком (без ключа карт): /api/geo/pvz, поиск по улице или метро,
// «Показать на карте» — Яндекс Карты по координатам пункта в новой вкладке (без данных покупателя).
// Без ключей СДЭК списка нет — поле для кода или адреса пункта вручную.
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { PVZ_TYPE_TITLE, pvzMapUrl, type Pvz } from "@/lib/pvz";

interface Res {
  points: Pvz[];
  total: number;
  source: "cdek" | "demo" | "none";
}

export function PvzPicker(props: {
  city: string;
  region?: string;
  cityCode?: number;
  value: { pvzCode: string; pvzAddress: string };
  onChange: (v: { pvzCode: string; pvzAddress: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [loading, setLoading] = useState(false);
  const [listOpen, setListOpen] = useState(!props.value.pvzCode);
  const seq = useRef(0);

  useEffect(() => {
    if (!props.city) {
      setRes(null);
      return;
    }
    const my = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ city: props.city, q });
      if (props.region) sp.set("region", props.region);
      if (props.cityCode) sp.set("code", String(props.cityCode));
      try {
        const r = await api<Res>(`/api/geo/pvz?${sp}`);
        if (my === seq.current) setRes(r);
      } catch {
        if (my === seq.current) setRes({ points: [], total: 0, source: "none" });
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [props.city, props.region, props.cityCode, q]);

  if (!props.city) return <p className="small muted pvz-note">Сначала выберите город — покажем пункты выдачи СДЭК рядом.</p>;

  if (res?.source === "none") {
    return (
      <label className="field">
        <span>Пункт выдачи СДЭК (код или адрес) <span className="req">*</span></span>
        <input className="input" value={props.value.pvzCode} onChange={(e) => props.onChange({ pvzCode: e.target.value, pvzAddress: "" })} />
        <small>Список пунктов сейчас недоступен — укажите пункт, мы сверим его перед отправкой.</small>
      </label>
    );
  }

  const selected = props.value.pvzCode ? res?.points.find((p) => p.code === props.value.pvzCode) : undefined;

  return (
    <div className="pvz">
      <span className="label">Пункт выдачи СДЭК <span className="req">*</span></span>
      {props.value.pvzCode && !listOpen ? (
        <div className="pvz-picked">
          <div>
            <b>{props.value.pvzAddress || props.value.pvzCode}</b>
            {selected && <span className="small muted">{[PVZ_TYPE_TITLE[selected.type], selected.workTime, selected.metro && `м. ${selected.metro}`].filter(Boolean).join(" · ")}</span>}
            {selected?.demo && <span className="badge badge--gold">демо-пункт</span>}
          </div>
          <button type="button" className="link-btn" onClick={() => setListOpen(true)}>Изменить</button>
        </div>
      ) : (
        <>
          <label className="field" style={{ marginBottom: 8 }}>
            <span className="small">Поиск по улице или метро</span>
            <input className="input" type="search" enterKeyHint="search" autoComplete="off" placeholder="Например, «Ленина» или «Мира 5»" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {loading && !res ? (
            <div className="spinner" />
          ) : res && res.points.length === 0 ? (
            <p className="small muted pvz-note">{q ? "По этой улице пунктов не нашли — попробуйте другое слово." : "В этом городе пока нет пунктов СДЭК — выберите курьера или Почту."}</p>
          ) : (
            <ul className="pvz-list" aria-label={`Пункты выдачи в городе ${props.city}`} aria-busy={loading}>
              {res?.points.map((p) => {
                const map = pvzMapUrl(p);
                const on = p.code === props.value.pvzCode;
                return (
                  <li key={p.code} className={on ? "is-on" : undefined}>
                    <button
                      type="button"
                      className="pvz-item"
                      aria-pressed={on}
                      onClick={() => {
                        props.onChange({ pvzCode: p.code, pvzAddress: p.address });
                        setListOpen(false);
                      }}
                    >
                      <span className="pvz-top">
                        <span className={p.type === "POSTAMAT" ? "badge badge--gold" : "badge"}>{PVZ_TYPE_TITLE[p.type]}</span>
                        {p.demo && <span className="badge badge--gold">демо-пункт</span>}
                      </span>
                      <b>{p.address}</b>
                      <span className="small muted">{[p.workTime, p.metro && `м. ${p.metro}`].filter(Boolean).join(" · ")}</span>
                    </button>
                    {map && (
                      <a className="small pvz-map" href={map} target="_blank" rel="noopener noreferrer">
                        Показать на карте
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {res && res.total > res.points.length && <p className="small muted pvz-note">Показаны {res.points.length} из {res.total} — уточните улицу.</p>}
        </>
      )}
    </div>
  );
}
