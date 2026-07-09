import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/lib/store/DataProvider";
import { Aurora } from "@/components/layout/Aurora";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoJp = Noto_Sans_JP({
  variable: "--font-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Shadowing JP - IT日本語シャドーイング",
  description:
    "IT業務で使う日本語を一文ずつ発音練習。ストリーク、XP、レベル、デイリーミッションで継続できます。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) on notch devices
  themeColor: "#6360f2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${jakarta.variable} ${notoJp.variable} h-full`}>
      <body className="min-h-full">
        <Aurora />
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
