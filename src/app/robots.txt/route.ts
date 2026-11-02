import { robotsTxt } from "@/lib/seo";

// robots.txt — текстом (Clean-param не поддерживается MetadataRoute.Robots); Host устарел — главное зеркало в Вебмастере.
export const dynamic = "force-static";

export function GET() {
  return new Response(robotsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
