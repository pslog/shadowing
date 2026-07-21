import type { Metadata } from "next";

export const SITE_NAME = "Shadowing JP";
export const SITE_DESCRIPTION =
  "シャドーイングで「話せる」日本語へ。一文ずつ声に出して会話の反射を鍛え、毎日少しずつ習慣に。仲間と高め合う非営利の日本語学習コミュニティです。";

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
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "ja_JP",
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
}: {
  title: string;
  description?: string;
  path: string;
}): Metadata {
  return pageMetadata({
    title,
    description,
    path,
    noIndex: true,
  });
}
