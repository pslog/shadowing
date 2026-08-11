import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.courseEditTitle,
    description: m.meta.courseEditDescription,
    path: `/courses/${id}/edit`,
    locale,
  });
}

export default function EditCourseLayout({ children }: Props) {
  return children;
}
