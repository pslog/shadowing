import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/lib/store/DataProvider";
import { Aurora } from "@/components/layout/Aurora";
import { GoogleAnalyticsRouteTracker } from "@/components/analytics/GoogleAnalytics";
import { LocaleHtmlLang } from "@/components/i18n/LocaleHtmlLang";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";
import { DEFAULT_LOCALE, LOCALE_TAG } from "@/lib/i18n";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-6T2YMDZRKX";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "500", "700"],
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  const title = `${SITE_NAME} - ${m.meta.homeTitle}`;

  return {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: title,
    template: `%s | ${SITE_NAME}`,
  },
  description: m.meta.siteDescription,
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
    canonical: `/${locale}`,
    languages: {
      vi: "/vi",
      ja: "/ja",
      "x-default": `/${DEFAULT_LOCALE}`,
    },
  },
  openGraph: {
    title,
    description: m.meta.siteDescription,
    url: `/${locale}`,
    siteName: SITE_NAME,
    locale: locale === "vi" ? "vi_VN" : "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: m.meta.siteDescription,
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) on notch devices
  themeColor: "#6360f2",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, m } = await requestMessages();

  return (
    <html
      lang={LOCALE_TAG[locale]}
      className={`${jakarta.variable} ${notoJp.variable} h-full`}
    >
      <head>
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </head>
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
              url: `${getSiteUrl()}/${locale}`,
              description: m.meta.siteDescription,
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
        <LocaleHtmlLang />
        <DataProvider>{children}</DataProvider>
        <GoogleAnalyticsRouteTracker />
      </body>
    </html>
  );
}
