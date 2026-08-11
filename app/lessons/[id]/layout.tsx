import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";
import { lessonSeoBySlug } from "@/lib/seo-content";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [lesson, { locale, m }] = await Promise.all([
    lessonSeoBySlug(id),
    requestMessages(),
  ]);
  const description = [
    lesson?.firstSentence?.ja_text,
    lesson?.firstSentence?.vi_translation,
  ]
    .filter(Boolean)
    .join(" - ");

  return pageMetadata({
    title: lesson
      ? m.meta.lessonDetailTitle(lesson.title)
      : m.meta.lessonDetailFallbackTitle,
    description: description || m.meta.lessonDetailFallbackDescription,
    path: `/lessons/${id}`,
    locale,
  });
}

export default function LessonDetailLayout({ children }: Props) {
  return children;
}
