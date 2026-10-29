"use server";
import { redirect } from "next/navigation";
import { unsubscribe } from "@/lib/unsubscribe";

/** Отписка — только по нажатию кнопки (POST): почтовые сканеры, открывающие ссылки, не отпишут сами. */
export async function unsubscribeAction(f: FormData) {
  const t = String(f.get("t") ?? "");
  const r = await unsubscribe(t);
  redirect(`/otpiska?done=${r}`);
}
