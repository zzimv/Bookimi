import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SideNav } from "@/components/SideNav";
import "./kabinet.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Личный кабинет", robots: { index: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/vhod?next=/kabinet");
  return (
    <div className="wrap cab">
      <SideNav
        items={[
          { href: "/kabinet", label: "Мои книги" },
          { href: "/kabinet/zakazy", label: "Заказы" },
          { href: "/kabinet/geroi", label: "Мои герои" },
          { href: "/kabinet/drug", label: "Приведи друга" },
          { href: "/kabinet/uvedomleniya", label: "Уведомления" },
          { href: "/kabinet/dannye", label: "Мои данные" },
          { href: "/kabinet/podderzhka", label: "Поддержка" },
        ]}
      />
      <div>{children}</div>
    </div>
  );
}
