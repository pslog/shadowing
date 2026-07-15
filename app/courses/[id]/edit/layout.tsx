import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "コース編集",
  ...noIndexMetadata,
};

export default function EditCourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
