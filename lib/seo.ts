import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  messages,
  withLocale,
} from "@/lib/i18n";

export const SITE_NAME = "Shadowing JP";
export const SITE_DESCRIPTION = messages[DEFAULT_LOCALE].meta.siteDescription;

const OG_LOCALE: Record<Locale, string> = {
  vi: "vi_VN",
  ja: "ja_JP",
};

/** `alternates.languages` map pointing at every locale variant of `path`. */
function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) out[locale] = withLocale(path, locale);
  out["x-default"] = withLocale(path, DEFAULT_LOCALE);
  return out;
}

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3335";
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/$/, "");
}

export function absoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

export function pageMetadata({
  title,
  description,
  path,
  locale = DEFAULT_LOCALE,
  noIndex = false,
}: {
  title: string;
  description: string;
  /** Locale-less path, e.g. `/courses`. Locale prefixes are added here. */
  path: string;
  locale?: Locale;
  noIndex?: boolean;
}): Metadata {
  const localizedPath = withLocale(path, locale);
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath,
      languages: languageAlternates(path),
    },
    openGraph: {
      title,
      description,
      url: localizedPath,
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
        },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export function privatePageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
  locale = DEFAULT_LOCALE,
}: {
  title: string;
  description?: string;
  path: string;
  locale?: Locale;
}): Metadata {
  return pageMetadata({
    title,
    description,
    path,
    locale,
    noIndex: true,
  });
}
