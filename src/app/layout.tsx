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

const domain = process.env.DOMAIN ?? "bookimi.ru";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${domain}`),
  title: { default: "БУКИМИ — сказка, где ваш ребёнок главный герой", template: "%s — БУКИМИ" },
  description:
    "Персональная детская книга по фото ребёнка: его лицо на иллюстрациях, имя в тексте, посвящение от вас. Бесплатное превью за 5 минут, PDF — 990 ₽, печатная книга — от 2 490 ₽.",
  openGraph: { type: "website", locale: "ru_RU", siteName: "БУКИМИ" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#1e4d3b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
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
