// «Книга готовится…» (rev 13): раскрытая книга, из которой поднимаются звёздочки, и сменяющиеся строки.
// Без хуков — сменой строк занимается CSS (анимация), при prefers-reduced-motion — без движения, одна строка.
export function MagicLoader({ title = "Книга готовится…", lines, progress }: { title?: string; lines?: string[]; progress?: number }) {
  const ls = lines ?? ["Подбираем слова для сказки", "Раскрашиваем небо", "Ищем место для звёзд", "Пишем имя на обложке"];
  return (
    <div className="magic" role="status" aria-live="polite" data-magic-loader>
      <div className="magic__art" aria-hidden="true">
        <svg viewBox="0 0 160 110" width="160" height="110">
          <path className="magic__page magic__page--l" d="M80 92 C60 82 34 80 14 84 V28 C34 24 60 26 80 38 Z" />
          <path className="magic__page magic__page--r" d="M80 92 C100 82 126 80 146 84 V28 C126 24 100 26 80 38 Z" />
          <path className="magic__flip" d="M80 38 C96 28 116 24 138 26 V80 C116 78 96 82 80 92 Z" />
          <path d="M80 38 V92" stroke="currentColor" strokeWidth="2" opacity=".35" />
        </svg>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`magic__star magic__star--${i}`}>✦</span>
        ))}
      </div>
      <p className="magic__title">{title}</p>
      <div className="magic__lines">
        {ls.map((l, i) => (
          <span key={l} style={{ animationDelay: `${i * 2.2}s`, ["--n" as string]: ls.length }}>{l}</span>
        ))}
      </div>
      {progress !== undefined && (
        <div className="progress magic__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Готовность">
          <i style={{ width: `${Math.max(5, progress)}%` }} />
        </div>
      )}
    </div>
  );
}
