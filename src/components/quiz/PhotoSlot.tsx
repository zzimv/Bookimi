"use client";
// Фото героя на первом шаге анкеты: согласия (один раз, перед первой загрузкой) → загрузка → обработка на сервере →
// портрет «голова и плечи» с подсказками качества; несколько людей в кадре — выбор нужного лица.
import Link from "next/link";
import { useRef, useState } from "react";
import { api, goal } from "@/lib/client";
import type { AudienceKey } from "@/content/profiles";

export interface PhotoView {
  id: string;
  slot: string;
  url: string;
  originalUrl: string | null;
  faces: { x: number; y: number; w: number; h: number }[];
  chosen: number;
  verdict: "ok" | "warn" | "reject";
  hints: string[];
  codes: string[];
  hair?: string;
  fur?: string;
}

export interface ConsentState {
  pd: boolean;
  photo: boolean;
  group: boolean;
}

/** Вторая галочка — по аудитории (для питомца и взрослого — без слов о ребёнке). */
export const PHOTO_CONSENT_LABEL: Record<AudienceKey, React.ReactNode> = {
  CHILD: <>Даю <Link href="/soglasie/foto" target="_blank">согласие на обработку фото ребёнка</Link> как его законный представитель</>,
  TEEN: <>Даю <Link href="/soglasie/foto" target="_blank">согласие на обработку фото</Link> героя как его законный представитель (или это моё фото и мне есть 18)</>,
  ADULT: <>Загружаю своё фото или фото людей, которые согласны на это, — <Link href="/soglasie/foto" target="_blank">согласие на обработку фото</Link></>,
  PET: <>Загружаю фото своего питомца; если в кадре есть люди — они согласны (<Link href="/soglasie/foto" target="_blank">согласие на обработку фото</Link>)</>,
};

/** Главная подсказка к фото (решение владелицы, rev 07) — всегда первая. */
export const PHOTO_BEST = "Лучше всего — фото в анфас, с улыбкой, чтобы были хорошо видны глаза.";

export const PHOTO_TIPS: Record<AudienceKey, string> = {
  CHILD: `${PHOTO_BEST} Лицо крупно, хороший свет, без солнцезащитных очков. Сразу проверим и обрежем до портрета.`,
  TEEN: `${PHOTO_BEST} Лицо крупно, хороший свет, без других людей в кадре.`,
  ADULT: `${PHOTO_BEST} Лицо крупно, хороший свет. Фото других героев — в их карточках.`,
  PET: "Лучше всего — мордочка в анфас, чтобы были хорошо видны глаза. Крупно, при дневном свете; хорошо, если виден окрас.",
};

/** Согласия перед первой загрузкой: две отдельные неотмеченные галочки (ПДн + фото), для фото детей группы — третья. */
export function ConsentGate({ audience, consent, needGroup, onDone }: { audience: AudienceKey; consent: ConsentState; needGroup?: boolean; onDone: (c: ConsentState) => void }) {
  const [pd, setPd] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [group, setGroup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needPhoto = !consent.photo;
  const ready = (consent.pd || pd) && (!needPhoto || photo) && (!needGroup || consent.group || group);
  return (
    <div className="panel consent-panel consent-gate" data-consent-gate>
      <p className="small muted">
        {needPhoto ? "Перед первой загрузкой — согласия, один раз на всю анкету. Фото нужно только для иллюстраций: без идентификации личности, хранится в России; если книгу не создадите — удалим через сутки, иначе через 7 дней." : "Фото других детей — только с согласия их родителей. Можно и без фото: пара слов о внешности."}
      </p>
      {!consent.pd && (
        <label className="check">
          <input type="checkbox" name="consent-pd" checked={pd} onChange={(e) => setPd(e.target.checked)} />
          <span>Даю <Link href="/soglasie/pd" target="_blank">согласие на обработку персональных данных</Link></span>
        </label>
      )}
      {needPhoto && (
        <label className="check">
          <input type="checkbox" name="consent-photo" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
          <span>{PHOTO_CONSENT_LABEL[audience]}</span>
        </label>
      )}
      {needGroup && !consent.group && (
        <label className="check">
          <input type="checkbox" name="consent-group" checked={group} onChange={(e) => setGroup(e.target.checked)} />
          <span>Родители детей, чьи фото я загружаю, разрешили использовать их для этой книги</span>
        </label>
      )}
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={!ready || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            onDone(await api<ConsentState>("/api/draft/consent", { pd: true, photo: true, ...(needGroup ? { group: true } : {}) }));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Продолжить к загрузке
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function PhotoSlot(props: {
  slot: "main" | "extra" | "member";
  kind: "human" | "pet";
  adult?: boolean;
  audience: AudienceKey;
  ids: string[];
  max: number;
  views: Record<string, PhotoView>;
  consent: ConsentState;
  onConsent: (c: ConsentState) => void;
  onAdd: (v: PhotoView) => void;
  onRemove: (id: string) => void;
  onUpdate: (v: PhotoView) => void;
  /** Подсказка «по фото похоже…» — покупатель подтверждает сам. */
  suggest?: (v: PhotoView) => React.ReactNode;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const needGroup = props.slot === "member";
  const gated = !props.consent.photo || !props.consent.pd || (needGroup && !props.consent.group);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    for (const f of Array.from(files).slice(0, props.max - props.ids.length)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("slot", props.slot);
      fd.append("kind", props.kind);
      if (props.adult) fd.append("adult", "1");
      try {
        props.onAdd(await api<PhotoView>("/api/draft/photos", fd));
        goal("photo_upload");
      } catch (e) {
        setError((e as Error).message);
      }
    }
    setBusy(false);
    if (file.current) file.current.value = "";
  }

  async function pickFace(v: PhotoView, face: number) {
    setBusy(true);
    try {
      props.onUpdate(await api<PhotoView>("/api/draft/photos", { id: v.id, face }, "PATCH"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (gated) return <ConsentGate audience={props.audience} consent={props.consent} needGroup={needGroup} onDone={props.onConsent} />;
  const views = props.ids.map((id) => props.views[id]).filter(Boolean);
  return (
    <div className={`photo-slot ${props.compact ? "photo-slot--compact" : ""}`} data-photo-slot={props.slot}>
      {views.map((v) => (
        <div className="photo-done" key={v.id} data-photo={v.id} data-verdict={v.verdict}>
          <div className="photo-done__img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.url} alt="Обработанное фото: портрет" width={120} height={120} />
            <button type="button" aria-label="Удалить фото" onClick={async () => { await api(`/api/draft/photos?photo=${v.id}`, undefined, "DELETE").catch(() => {}); props.onRemove(v.id); }}>×</button>
          </div>
          <div className="photo-done__info">
            <b className={v.verdict === "ok" ? "ok" : "warnline"}>{v.verdict === "ok" ? "✓ Фото подходит" : "Фото принято, но есть замечания"}</b>
            {v.hints.length > 0 && <ul className="small photo-hints">{v.hints.map((h) => <li key={h}>{h}</li>)}</ul>}
            {props.suggest?.(v)}
          </div>
          {v.faces.length > 1 && v.originalUrl && (
            <div className="face-picker">
              <p className="small"><b>Кто герой?</b> Нажмите на нужное лицо — обрежем фото по нему.</p>
              <div className="face-picker__img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.originalUrl} alt="Исходное фото" />
                {v.faces.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    className="face-box"
                    aria-pressed={v.chosen === i}
                    aria-label={`Лицо ${i + 1}`}
                    disabled={busy}
                    style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
                    onClick={() => pickFace(v, i)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {props.ids.length < props.max && (
        <label className={`drop ${props.compact ? "drop--sm" : ""}`}>
          <input ref={file} type="file" name={`photo-${props.slot}`} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple={props.max - props.ids.length > 1} hidden onChange={(e) => upload(e.target.files)} />
          <b>{busy ? "Обрабатываем фото…" : props.ids.length ? "Ещё фото" : "Выбрать фото"}</b>
          {!props.compact && <small className="muted">{PHOTO_TIPS[props.audience]} JPG, PNG, WebP, HEIC до 15 МБ.</small>}
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
