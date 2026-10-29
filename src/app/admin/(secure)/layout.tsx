import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSession, can, isDemo, PERMS, type Perm } from "@/lib/auth";
import { SideNav } from "@/components/SideNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Админка", robots: { index: false } };

const NAV: { href: string; label: string; perm: Perm }[] = [
  { href: "/admin", label: "Главная", perm: "dashboard" },
  { href: "/admin/dashboard", label: "Дашборд", perm: "dashboard" },
  { href: "/admin/zakazy", label: "Заказы", perm: "orders" },
  { href: "/admin/perevody", label: "Переводы", perm: "transfers" },
  { href: "/admin/podderzhka", label: "Поддержка", perm: "support" },
  { href: "/admin/triggery", label: "Триггеры", perm: "triggers" },
  { href: "/admin/promokody", label: "Промокоды", perm: "promo" },
  { href: "/admin/prazdniki", label: "Праздники", perm: "holidays" },
  { href: "/admin/otzyvy", label: "Отзывы", perm: "reviews" },
  { href: "/admin/seo", label: "SEO и блог", perm: "seo" },
  { href: "/admin/katalog", label: "Каталог и цены", perm: "catalog" },
  { href: "/admin/nastrojki", label: "Настройки", perm: "settings" },
  { href: "/admin/komanda", label: "Команда", perm: "users" },
  { href: "/admin/zhurnal", label: "Журнал", perm: "audit" },
];

const ROLE: Record<string, string> = { OWNER: "владелец", OPERATOR: "оператор", MARKETER: "маркетолог" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await adminSession();
  if (!s) redirect("/vhod?next=/admin");
  if (!s.mfaPassed && (s.user.totpEnabled || !isDemo())) redirect("/admin/2fa");
  void PERMS;
  return (
    <>
      <div className="admin-top">
        <div className="wrap">
          <span>Админка · {s.user.email ?? s.user.phone} · {ROLE[s.user.role]}</span>
          <Link href="/">На сайт</Link>
        </div>
      </div>
      {isDemo() && !s.mfaPassed && (
        <div className="demo-banner">Демо-режим: двухфакторная защита не включена. В рабочем режиме вход в админку — только с 2FA. <Link href="/admin/2fa">Настроить</Link></div>
      )}
      <div className="wrap cab">
        <SideNav items={NAV.filter((n) => can(s.user.role, n.perm)).map(({ href, label }) => ({ href, label }))} />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}
