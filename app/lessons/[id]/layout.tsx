import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return pageMetadata({
    title: "レッスン詳細",
    description:
      "日本語シャドーイングのレッスン詳細。一文ずつ音声を聞き、声に出して発音を練習できます。",
    path: `/lessons/${id}`,
  });
}

export default function LessonDetailLayout({ children }: Props) {
  return children;
}
