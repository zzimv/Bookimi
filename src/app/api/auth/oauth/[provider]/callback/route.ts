import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { anonId, attachAnonHeroes, createSession, isStaffRole } from "@/lib/auth";
import { exchangeCode, oauthCredentials, oauthProvider } from "@/lib/oauth";
import { checkFirstName } from "@/lib/first-name";
import { hmac } from "@/lib/crypto";

// Возврат от провайдера: сверяем state, меняем код на профиль, находим или создаём покупателя по почте.
// Сотрудники так не входят (только код + 2FA). Нет телефона, а он обязателен, — вход состоялся, телефон спросим
// на /vhod?oauth=phone (вместе с «Как к вам обращаться»). Согласие на ПДн — как при входе по коду (форма спросит).
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = (() => {
    try {
      return JSON.parse(jar.get("bk_oauth")?.value ?? "null") as { p: string; state: string; verifier: string; next: string } | null;
    } catch {
      return null;
    }
  })();
  jar.delete({ name: "bk_oauth", path: "/api/auth/oauth" });
  const back = (q: string) => Response.redirect(new URL(`/vhod?${q}`, url).toString(), 302);
  const p = oauthProvider(provider);
  const cred = p && oauthCredentials(p);
  if (!p || !cred || !saved || saved.p !== p.key || saved.state !== url.searchParams.get("state")) return back("oauth=error");
  const code = url.searchParams.get("code");
  if (!code) return back("oauth=cancel");
  const profile = await exchangeCode(p, { ...cred, code, redirectUri: `https://${process.env.DOMAIN ?? url.host}/api/auth/oauth/${p.key}/callback`, codeVerifier: saved.verifier, deviceId: url.searchParams.get("device_id") ?? undefined }).catch(() => null);
  if (!profile) return back("oauth=error");
  if (!profile.email) return back("oauth=noemail");
  let user = await db.user.findUnique({ where: { email: profile.email } });
  if (user && (isStaffRole(user.role) || user.deletedAt)) return back("oauth=staff");
  const firstName = checkFirstName(profile.firstName ?? "") || null;
  if (!user) {
    const phoneFree = profile.phone ? !(await db.user.findUnique({ where: { phone: profile.phone }, select: { id: true } })) : false;
    user = await db.user.create({ data: { email: profile.email, phone: phoneFree ? profile.phone : null, firstName, referralCode: hmac(`ref:${profile.email}:${Date.now()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 7).toUpperCase() } });
  } else if (!user.firstName && firstName) {
    user = await db.user.update({ where: { id: user.id }, data: { firstName } });
  }
  await createSession(user.id, user.role);
  // Книги и черновики этого браузера — в аккаунт (как после входа по коду)
  const anon = await anonId();
  await db.book.updateMany({ where: { anonId: anon, userId: null }, data: { userId: user.id } });
  await db.quizDraft.updateMany({ where: { anonId: anon, userId: null }, data: { userId: user.id } });
  if (anon !== "no-anon") await attachAnonHeroes(anon, user.id); // герои — тоже в аккаунт («Мои герои», дни рождения)
  if (!user.phone) return back(`oauth=phone&next=${encodeURIComponent(saved.next || "/kabinet")}`);
  return Response.redirect(new URL(saved.next || "/kabinet", url).toString(), 302);
}
