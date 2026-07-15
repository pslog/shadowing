import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "レッスン",
  description: "日本語シャドーイングのレッスンページです。",
  path: "/lessons",
});

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
