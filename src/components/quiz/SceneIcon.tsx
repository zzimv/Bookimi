// Маленькие картинки к сценам анкеты (rev 13): свои простые рисунки в цветах сайта, без чужой графики.
export type SceneIconKind = "name" | "look" | "friends" | "occasion" | "book" | "details";

const ART: Record<SceneIconKind, React.ReactNode> = {
  // Звезда-именной значок
  name: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--gold-soft)" />
      <path d="M32 12l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L32 40.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="var(--gold)" />
      <path d="M26 31h12M28 35h8" stroke="var(--forest-deep)" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  // Зеркальце с искоркой
  look: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--sage)" />
      <ellipse cx="30" cy="28" rx="13" ry="15" fill="var(--surface)" stroke="var(--forest)" strokeWidth="3" />
      <path d="M30 43v10M24 53h12" stroke="var(--forest)" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 24q4-6 10-5" stroke="var(--gold)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M47 14l1.6 3.6 3.6 1.6-3.6 1.6L47 24.4l-1.6-3.6-3.6-1.6 3.6-1.6z" fill="var(--gold)" />
    </>
  ),
  // Двое держатся за руки
  friends: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--gold-soft)" />
      <circle cx="24" cy="23" r="6" fill="var(--forest)" />
      <circle cx="41" cy="25" r="5" fill="var(--gold)" />
      <path d="M15 47q1-15 9-15t9 15z" fill="var(--forest)" />
      <path d="M33 47q1-12 8-12t8 12z" fill="var(--gold)" />
      <path d="M30 40h6" stroke="var(--forest-deep)" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  // Подарок
  occasion: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--sage)" />
      <rect x="17" y="28" width="30" height="20" rx="3" fill="var(--gold)" />
      <rect x="15" y="22" width="34" height="8" rx="2.5" fill="var(--forest)" />
      <path d="M32 22v26" stroke="var(--surface)" strokeWidth="4" />
      <path d="M32 22q-10-9-12-2t12 2q10-9 12-2t-12 2" fill="none" stroke="var(--forest)" strokeWidth="2.6" strokeLinejoin="round" />
    </>
  ),
  // Раскрытая книга
  book: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--gold-soft)" />
      <path d="M32 46c-6-4-12-5-18-4V20c6-1 12 0 18 4z" fill="var(--surface)" stroke="var(--forest)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M32 46c6-4 12-5 18-4V20c-6-1-12 0-18 4z" fill="var(--surface)" stroke="var(--forest)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M45 10l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z" fill="var(--gold)" />
    </>
  ),
  // Палитра
  details: (
    <>
      <circle cx="32" cy="32" r="26" fill="var(--sage)" />
      <path d="M32 14c11 0 19 7 19 15 0 6-5 7-9 6-3-1-5 2-3 5 2 4-1 8-7 8-11 0-19-8-19-17s8-17 19-17z" fill="var(--surface)" stroke="var(--forest)" strokeWidth="2.6" />
      <circle cx="24" cy="26" r="3.2" fill="var(--gold)" />
      <circle cx="33" cy="22" r="3.2" fill="var(--forest)" />
      <circle cx="41" cy="27" r="3.2" fill="#d9534f" />
      <circle cx="23" cy="36" r="3.2" fill="#3e8ed0" />
    </>
  ),
};

export function SceneIcon({ kind }: { kind: SceneIconKind }) {
  return (
    <svg className="scene__icon" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" data-scene-icon={kind}>
      {ART[kind]}
    </svg>
  );
}
