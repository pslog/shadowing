import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "コース作成",
  ...noIndexMetadata,
};

export default function NewCourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
