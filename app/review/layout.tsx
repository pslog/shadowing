import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "単語帳",
  description: "保存した単語をフラッシュカードで復習する、あなたの単語帳。",
  path: "/review",
});

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
