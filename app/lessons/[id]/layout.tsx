import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { lessonSeoBySlug } from "@/lib/seo-content";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lesson = await lessonSeoBySlug(id);
  const description = [
    lesson?.firstSentence?.ja_text,
    lesson?.firstSentence?.vi_translation,
  ]
    .filter(Boolean)
    .join(" - ");

  return pageMetadata({
    title: lesson
      ? `${lesson.title} - 日本語シャドーイング練習`
      : "レッスン詳細",
    description:
      description ||
      "日本語シャドーイングのレッスン詳細。一文ずつ音声を聞き、声に出して発音を練習できます。",
    path: `/lessons/${id}`,
  });
}

export default function LessonDetailLayout({ children }: Props) {
  return children;
}
