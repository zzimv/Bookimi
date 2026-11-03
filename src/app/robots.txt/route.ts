import { robotsTxt } from "@/lib/seo";
import { botNoticeText } from "@/lib/bot-notice";
import { getSeller } from "@/lib/settings";

// robots.txt — текстом (Clean-param не поддерживается MetadataRoute.Robots); Host устарел — главное зеркало в Вебмастере.
// rev 19: в начале — комментарием обращение к сборщикам и агентам с контактами из настроек продавца (раз в час).
export const revalidate = 3600;

export async function GET() {
  const domain = process.env.DOMAIN ?? "bookimi.ru";
  const seller = await getSeller().catch(() => null);
  const notice = botNoticeText({ email: seller?.email, phone: seller?.phone, site: `https://${domain}` });
  return new Response(robotsTxt(domain, notice), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
