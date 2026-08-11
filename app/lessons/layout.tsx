import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.lessonsTitle,
    description: m.meta.lessonsDescription,
    path: "/lessons",
    locale,
  });
}

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
