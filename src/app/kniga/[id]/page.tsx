import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookFlow } from "@/components/book/BookFlow";
import { ownBook } from "@/lib/api";
import { cfg } from "@/lib/settings";
import { Answers } from "@/lib/quiz";
import { dedicationText } from "@/lib/gen/text";

export const metadata: Metadata = { title: "Ваша книга", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const own = await ownBook(id);
  if (!own) notFound();
  const flags = await cfg("flags");
  const a = Answers.safeParse(own.book.params);
  return (
    <BookFlow
      bookId={id}
      photoEnabled={flags.photoUploadEnabled}
      printEnabled={flags.printEnabled}
      extras={a.success ? a.data.extras.map((e) => ({ role: e.role, name: e.name })) : []}
      dedication={a.success ? dedicationText(a.data) : ""}
    />
  );
}
