import { NextResponse } from "next/server";
import { throttle } from "@/lib/api";
import { filterPvz } from "@/lib/pvz";
import { cdekCityCode, cdekPoints, hasCdek } from "@/lib/shipping";

// Пункты выдачи СДЭК города: ?city=Королёв&region=Московская обл.&code=<код СДЭК>&q=<улица или метро>.
// Без ключей СДЭК списка нет (source: "none") — покупатель вводит пункт вручную.
export async function GET(req: Request) {
  const t = await throttle("geo-pvz", 60, 60_000);
  if (t) return t;
  const sp = new URL(req.url).searchParams;
  const city = (sp.get("city") ?? "").slice(0, 80);
  const region = (sp.get("region") ?? "").slice(0, 80) || undefined;
  const q = (sp.get("q") ?? "").slice(0, 80);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 30));
  if (!city || !hasCdek()) return NextResponse.json({ points: [], total: 0, source: "none", cityCode: null });
  try {
    const code = Number(sp.get("code")) || (await cdekCityCode(city, region));
    if (!code) return NextResponse.json({ points: [], total: 0, source: "cdek", cityCode: null });
    const all = await cdekPoints(code);
    const found = filterPvz(all, q);
    return NextResponse.json(
      { points: found.slice(0, limit), total: found.length, source: "cdek", cityCode: code },
      { headers: { "Cache-Control": "public, max-age=900" } },
    );
  } catch (e) {
    console.error("[geo] pvz", (e as Error).message);
    return NextResponse.json({ points: [], total: 0, source: "none", cityCode: null });
  }
}
