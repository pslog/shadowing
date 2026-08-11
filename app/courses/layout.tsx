import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return pageMetadata({
    title: m.meta.coursesTitle,
    description: m.meta.coursesDescription,
    path: "/courses",
    locale,
  });
}

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
