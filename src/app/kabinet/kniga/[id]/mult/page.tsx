import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ownBook } from "@/lib/api";
import { db } from "@/lib/db";
import { hasConsent } from "@/lib/consent";
import { OWN_VOICE_FORMAT, OWN_VOICE_GUIDE, OWN_VOICE_PROCESSING, VOICE_CONSENT_TEXT, VOICE_LIMITS } from "@/lib/cartoon-guide";
import type { Cue } from "@/lib/gen/cartoon-script";
import { OwnVoice } from "./OwnVoice";

export const metadata: Metadata = { title: "Озвучить своим голосом", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own || !own.user) notFound();
  const c = await db.cartoon.findUnique({ where: { bookId: id } });
  const title = (own.book.text as { title?: string } | null)?.title ?? "Книга";
  if (!c?.ownVoicePaid) {
    return (
      <div className="panel">
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Озвучить своим голосом</h1>
        <p>Эта возможность — дополнение к «Оживлению книги». Добавить её можно на странице книги.</p>
        <Link className="btn btn--primary btn--sm" href={`/kabinet/kniga/${id}`}>К книге</Link>
      </div>
    );
  }
  const cues = ((c.script as { cues?: Cue[] } | null)?.cues ?? []) as Cue[];
  const consent = await hasConsent("VOICE", { userId: own.user.id });
  return (
    <>
      <p className="small"><Link href={`/kabinet/kniga/${id}`}>← {title}</Link></p>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Озвучить своим голосом</h1>
      <p>Озвучьте ролик сами — {cues.length || 14} коротких реплик, на всё уйдёт минут десять. Сцены подстроятся под ваш голос.</p>

      <div className="panel">
        <b>С чего начать</b>
        <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
          {OWN_VOICE_GUIDE.map((g) => (
            <li key={g.title}>
              <b>{g.title}.</b> {g.text}
            </li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <b>Требования к записи</b>
        <ul style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 6 }}>
          {OWN_VOICE_FORMAT.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <p className="small muted" style={{ marginTop: 10 }}>{OWN_VOICE_PROCESSING}</p>
      </div>

      {cues.length ? (
        <OwnVoice
          bookId={id}
          cues={cues}
          consentText={VOICE_CONSENT_TEXT}
          initialConsent={consent}
          initialRecorded={(c.voiceCues ?? {}) as Record<string, { sec: number; warnings: string[] }>}
          buildsLeft={c.ownBuildsLeft}
          maxTotalSec={VOICE_LIMITS.maxTotalSec}
          purgeDays={VOICE_LIMITS.purgeDays}
          busy={c.status === "QUEUED" || c.status === "RENDERING"}
        />
      ) : (
        <div className="muted-panel" style={{ marginTop: 16 }}>Сценарий появится, когда соберётся первый ролик с диктором — обычно через несколько минут после готовности книги.</div>
      )}
    </>
  );
}
