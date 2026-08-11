import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.uploadTitle,
    description: m.meta.uploadDescription,
    path: "/upload",
    locale,
  });
}

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
