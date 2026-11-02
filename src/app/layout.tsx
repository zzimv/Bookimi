import type { Metadata, Viewport } from "next";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";
import { Footer, Header, PromoBar } from "@/components/Layout";
import { CookieBanner } from "@/components/CookieBanner";
import { Vitals } from "@/components/Vitals";
import { og } from "@/lib/og";

const domain = process.env.DOMAIN ?? "bookimi.ru";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${domain}`),
  title: { default: "БУКИМИ — книга, где главный герой тот, кого вы любите", template: "%s — БУКИМИ" },
  description:
    "Персональная книга по фото: ребёнок, подросток, близкий взрослый или питомец — главный герой иллюстраций и текста. Бесплатное превью за 5 минут, PDF — 990 ₽, печатная книга — от 2 490 ₽.",
  // Общие OG (сайт, картинка) — без заголовка и адреса главной: у каждой страницы свои (og() в её metadata)
  ...og({}),
  // Иконки и манифест — файлы src/app/icon.svg, apple-icon.png, manifest.ts (Next подключает сам)
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e4d3b" },
    { media: "(prefers-color-scheme: dark)", color: "#0b120f" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Выбранная вручную тема — до первой отрисовки (без вспышки). "auto" — как в системе.
const THEME_SCRIPT = `try{var t=localStorage.getItem("bk_theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="auto" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <PromoBar />
        <Header />
        <main>{children}</main>
        <Footer />
        <CookieBanner metrikaId={process.env.YANDEX_METRIKA_ID} />
        <Vitals />
      </body>
    </html>
  );
}
