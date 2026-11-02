import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { authorizeUrl, oauthCredentials, oauthProvider, pkceChallenge } from "@/lib/oauth";

// Начало входа через VK ID / Яндекс ID / Mail.ru / Google: state и PKCE — в httpOnly-cookie на 10 минут, затем на
// страницу провайдера. Провайдер не настроен (нет ключей в окружении) — 404: по умолчанию вход только по коду.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = oauthProvider(provider);
  const cred = p && oauthCredentials(p);
  if (!p || !cred || process.env.OAUTH_DISABLED === "1") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "";
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const redirectUri = `https://${process.env.DOMAIN ?? url.host}/api/auth/oauth/${p.key}/callback`;
  (await cookies()).set("bk_oauth", JSON.stringify({ p: p.key, state, verifier, next: next.startsWith("/") && !next.startsWith("//") ? next : "" }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/oauth",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(p, { clientId: cred.clientId, redirectUri, state, codeChallenge: await pkceChallenge(verifier) }), 302);
}
