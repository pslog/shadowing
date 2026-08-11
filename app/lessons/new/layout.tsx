import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.lessonNewTitle,
    description: m.meta.lessonNewDescription,
    path: "/lessons/new",
    locale,
  });
}

export default function NewLessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
