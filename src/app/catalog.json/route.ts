import { catalogData } from "@/lib/geo";

export const revalidate = 600;

export async function GET() {
  return Response.json(await catalogData(), { headers: { "Cache-Control": "public, max-age=600" } });
}
