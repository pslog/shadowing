import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.courseNewTitle,
    description: m.meta.courseNewDescription,
    path: "/courses/new",
    locale,
  });
}

export default function NewCourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
