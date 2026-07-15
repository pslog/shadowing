import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "進捗",
  description: "Shadowing JPの学習進捗、ストリーク、XP、ランキング。",
  path: "/progress",
});

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
