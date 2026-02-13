import type { Metadata } from "next";
import "./globals.css";
import { getLocale, t } from "@/src/lib/i18n";

const locale = getLocale();

export const metadata: Metadata = {
  title: t("meta.title", undefined, locale),
  description: t("meta.description", undefined, locale),
  icons: {
    icon: "/spotify-insights-logo.svg",
    apple: "/spotify-insights-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={locale}>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
