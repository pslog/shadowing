import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.reviewTitle,
    description: m.meta.reviewDescription,
    path: "/review",
    locale,
  });
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
