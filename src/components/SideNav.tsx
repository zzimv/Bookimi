"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="side" aria-label="Разделы">
      {items.map((i) => {
        const active = i.href === path || (i.href !== items[0].href && path.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
