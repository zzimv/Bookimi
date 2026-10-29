// Картинка для соцсетей (og:image) 1200×630 PNG: разворот-образец сюжета (тот же рендер, что /obrazec) +
// название и логотип. Только образец по слагу сюжета — ни имени, ни фото покупателя здесь нет.
//   /og           — главная и каталог
//   /og?s=<сюжет> — страница книги
import sharp from "sharp";
import { GET as obrazec } from "../obrazec/route";
import { plotBySlug } from "@/content/registry";
import { titleForCatalog } from "@/content/title";

const W = 1200;
const H = 630;
const HOME_SLUG = "novogodnee-puteshestvie-s-dedom-morozom";
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Перенос названия по словам: не больше 2 строк по ~30 символов. */
function wrap(t: string, max = 30): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of t.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > 2) return [out[0], out.slice(1).join(" ").slice(0, max - 1) + "…"];
  return out;
}

export async function GET(req: Request) {
  const s = new URL(req.url).searchParams.get("s") ?? "";
  const plot = plotBySlug(s) ?? plotBySlug(HOME_SLUG);
  const slug = plot?.slug ?? "";
  const svg = await obrazec(new Request(`https://x/obrazec?s=${encodeURIComponent(slug)}&i=1&w=1`)).text();
  const title = plot && s ? titleForCatalog(plot.title, plot.audience) : "Книга, где главный герой — тот, кого вы любите";
  const lines = wrap(title);
  const fs = lines.length > 1 ? 50 : 56;
  const top = H - 60 - lines.length * (fs + 8);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#143628" stop-opacity="0"/><stop offset="1" stop-color="#143628" stop-opacity=".92"/></linearGradient></defs>
  <rect x="0" y="${top - 90}" width="${W}" height="${H - top + 90}" fill="url(#g)"/>
  ${lines.map((l, i) => `<text x="56" y="${top + i * (fs + 8) + fs}" font-family="DejaVu Sans, Nunito, Arial, sans-serif" font-weight="700" font-size="${fs}" fill="#ffffff">${esc(l)}</text>`).join("")}
  <rect x="${W - 250}" y="36" width="214" height="64" rx="32" fill="#fcfbf7" fill-opacity=".94"/>
  <text x="${W - 143}" y="80" text-anchor="middle" font-family="DejaVu Sans, Nunito, Arial, sans-serif" font-weight="700" font-size="34" fill="#1e4d3b">букими<tspan fill="#a87a1c">.</tspan></text>
</svg>`;
  const png = await sharp(Buffer.from(svg))
    .resize(W, H, { fit: "cover", position: "centre" })
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
