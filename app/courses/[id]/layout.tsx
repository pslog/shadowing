import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return pageMetadata({
    title: "コース詳細",
    description:
      "日本語シャドーイングのコース詳細。関連するレッスンを順番に聞いて、発音と会話表現を練習できます。",
    path: `/courses/${id}`,
  });
}

export default function CourseDetailLayout({ children }: Props) {
  return children;
}
