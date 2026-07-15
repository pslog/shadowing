import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "レッスン作成",
  description: "Shadowing JPのレッスン作成画面。",
  path: "/lessons/new",
});

export default function NewLessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
