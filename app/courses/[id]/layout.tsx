import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";
import { courseSeoBySlug } from "@/lib/seo-content";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [course, { locale, m }] = await Promise.all([
    courseSeoBySlug(id),
    requestMessages(),
  ]);
  const detail = [course?.level, course?.topic].filter(Boolean).join(" / ");

  return pageMetadata({
    title: course
      ? m.meta.courseDetailTitle(course.title)
      : m.meta.courseDetailFallbackTitle,
    description:
      course?.description ||
      (detail
        ? m.meta.courseDetailDescription(detail)
        : m.meta.courseDetailFallbackDescription),
    path: `/courses/${id}`,
    locale,
  });
}

export default function CourseDetailLayout({ children }: Props) {
  return children;
}
