import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "レッスン編集",
  ...noIndexMetadata,
};

export default function EditLessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
