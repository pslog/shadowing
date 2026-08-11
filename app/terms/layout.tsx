import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestLocale } from "@/lib/seo-locale";

// Legal copy stays in English on purpose: it is the version submitted to the
// YouTube / TikTok / Facebook platform reviews.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Terms of Service",
    description: "Terms of Service for Shadowing JP.",
    path: "/terms",
    locale: await requestLocale(),
  });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
