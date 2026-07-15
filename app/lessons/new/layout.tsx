import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "レッスン作成",
  ...noIndexMetadata,
};

export default function NewLessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
