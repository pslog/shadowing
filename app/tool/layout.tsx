import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.toolTitle,
    description: m.meta.toolDescription,
    path: "/tool",
    locale,
  });
}

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
