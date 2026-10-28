import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookFlow } from "@/components/book/BookFlow";
import { ownBook } from "@/lib/api";
import { cfg } from "@/lib/settings";
import { AnswersV2, heroAge } from "@/lib/quiz";
import { dedicationText } from "@/lib/gen/text";
import { moodsFor } from "@/content/moods";

export const metadata: Metadata = { title: "Ваша книга", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) notFound();
  const flags = await cfg("flags");
  const a = AnswersV2.safeParse(own.book.params);
  const limits = await cfg("limits");
  const moods = a.success ? moodsFor(a.data.audience, heroAge(a.data)).map((m) => ({ id: m.id, title: m.title, oneLine: m.oneLine })) : [];
  return (
    <BookFlow
      bookId={id}
      photoEnabled={flags.photoUploadEnabled}
      printEnabled={flags.printEnabled}
      extras={a.success ? a.data.extras.map((e) => ({ role: e.role, name: e.name })) : []}
      dedication={a.success ? dedicationText(a.data) : ""}
      moods={moods}
      moodChangesPreview={limits.moodChangesPreview}
    />
  );
}
