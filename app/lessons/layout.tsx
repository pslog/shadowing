import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "レッスン",
  description: "日本語シャドーイングのレッスンページです。",
  ...noIndexMetadata,
};

export default function LessonsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
