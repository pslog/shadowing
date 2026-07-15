import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/lib/store/DataProvider";
import { Aurora } from "@/components/layout/Aurora";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

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
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} - 日本語シャドーイング`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "shadowing",
    "日本語",
    "日本語シャドーイング",
    "発音練習",
    "会話練習",
    "tiếng Nhật",
    "luyện nói tiếng Nhật",
    "shadowing tiếng Nhật",
  ],
  authors: [{ name: "Shadowing JP" }],
  creator: "Shadowing JP",
  publisher: "Shadowing JP",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} - 日本語シャドーイング`,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - 日本語シャドーイング`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "education",
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
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: SITE_NAME,
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              url: getSiteUrl(),
              description: SITE_DESCRIPTION,
              inLanguage: ["ja", "vi"],
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        <Aurora />
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
