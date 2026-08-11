import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return pageMetadata({
    title: m.meta.aboutTitle,
    description: m.meta.aboutDescription,
    path: "/about",
    locale,
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
