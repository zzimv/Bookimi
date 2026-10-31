"use client";
// Подсказка под полем имени, набранного латиницей: «Лучше написать имя по-русски — тогда мы склоним его правильно»
// и, если имя частое, кнопка «Написать: Анна» (покупатель подтверждает сам). Имя латиницей в книге остаётся как есть.
import { cyrillicSuggestion, isLatinName, LATIN_HINT, normalizeName } from "@/lib/names";

export function NameHint({ value, onFix }: { value: string | undefined; onFix: (v: string) => void }) {
  const v = normalizeName(value ?? "");
  if (!v || !isLatinName(v)) return null;
  const sug = cyrillicSuggestion(v);
  return (
    <small className="name-hint" data-name-hint>
      {LATIN_HINT}.{" "}
      {sug && (
        <button type="button" className="link-btn" onClick={() => onFix(sug)}>
          Написать «{sug}»
        </button>
      )}
    </small>
  );
}
