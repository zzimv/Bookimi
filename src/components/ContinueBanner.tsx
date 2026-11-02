"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ContinueBanner() {
  const [b, setB] = useState<{ id: string; status: string; title: string } | null>(null);
  useEffect(() => {
    fetch("/api/continue").then((r) => r.json()).then((j) => setB(j.book)).catch(() => {});
  }, []);
  if (!b) return null;
  return (
    <div className="wrap" style={{ marginTop: 16 }}>
      <div className="muted-panel continue-banner" data-continue>
        <span className="continue-banner__text">Ваша книга «{b.title}» ждёт: {b.status === "PREVIEW_READY" ? "превью готово" : "можно продолжить"}.</span>
        <Link className="btn btn--primary btn--sm continue-banner__btn" href={`/kniga/${b.id}`}>Продолжить</Link>
      </div>
    </div>
  );
}
