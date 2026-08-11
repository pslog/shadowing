import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestLocale } from "@/lib/seo-locale";

// Legal copy stays in English on purpose: it is the version submitted to the
// YouTube / TikTok / Facebook platform reviews.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Privacy Policy",
    description: "Privacy Policy for Shadowing JP.",
    path: "/privacy",
    locale: await requestLocale(),
  });
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
