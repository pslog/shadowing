import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { courseSeoBySlug } from "@/lib/seo-content";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = await courseSeoBySlug(id);
  const detail = [course?.level, course?.topic].filter(Boolean).join(" / ");

  return pageMetadata({
    title: course ? `${course.title} - 日本語コース` : "コース詳細",
    description:
      course?.description ||
      (detail
        ? `${detail}の日本語シャドーイングコース。関連するレッスンを順番に聞いて、発音と会話表現を練習できます。`
        : "日本語シャドーイングのコース詳細。関連するレッスンを順番に聞いて、発音と会話表現を練習できます。"),
    path: `/courses/${id}`,
  });
}

export default function CourseDetailLayout({ children }: Props) {
  return children;
}
