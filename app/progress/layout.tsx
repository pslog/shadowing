import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.progressTitle,
    description: m.meta.progressDescription,
    path: "/progress",
    locale,
  });
}

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
