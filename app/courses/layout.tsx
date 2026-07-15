import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "コース",
  description:
    "日本語シャドーイングのコース一覧。日常会話、仕事、旅行など幅広いテーマを一文ずつ聞いて発音練習できます。",
  path: "/courses",
});

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
