"use client";
// Кнопка «Моя книга» в шапке (rev 20): появляется, как только у покупателя есть книга, и возвращает к превью
// с любой страницы — каталога, оформления, кабинета. На странице самой книги не показывается.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readMyBook, type MyBook } from "@/lib/my-book";

export function MyBookLink() {
  const [b, setB] = useState<MyBook | null>(null);
  const path = usePathname();
  useEffect(() => {
    const upd = () => setB(readMyBook());
    upd();
    window.addEventListener("bookimi:mybook", upd);
    window.addEventListener("storage", upd);
    return () => {
      window.removeEventListener("bookimi:mybook", upd);
      window.removeEventListener("storage", upd);
    };
  }, []);
  if (!b || path === `/kniga/${b.id}`) return null;
  return (
    <Link href={`/kniga/${b.id}`} className="my-book" data-my-book title={`Вернуться к книге «${b.title}»`}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 18.3 4 17.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5-.7 1.5-1.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      <span className="my-book__label">Моя книга</span>
    </Link>
  );
}
