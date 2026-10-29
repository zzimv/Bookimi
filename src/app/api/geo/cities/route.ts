import { NextResponse } from "next/server";
import { err, throttle } from "@/lib/api";
import { cityLabel } from "@/lib/cities";
import { suggestCities } from "@/lib/shipping";

// Подсказки города по 2+ буквам: офлайн-список + СДЭК (если есть ключи). Персональных данных нет — кэшируется.
export async function GET(req: Request) {
  const t = await throttle("geo", 120, 60_000);
  if (t) return t;
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  if (q.trim().length < 1) return NextResponse.json({ cities: [], source: "offline" });
  try {
    const r = await suggestCities(q, 10);
    return NextResponse.json(
      { cities: r.cities.map((c) => ({ ...c, label: cityLabel(c) })), source: r.source },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return err("Не удалось найти город", 500);
  }
}
