import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "コース作成",
  description: "Shadowing JPのコース作成画面。",
  path: "/courses/new",
});

export default function NewCourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
