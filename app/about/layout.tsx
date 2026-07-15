import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "紹介",
  description:
    "Shadowing JPの学習方針と作者紹介。音声を聞き、声に出し、毎日の小さな習慣で日本語を話せる状態に近づけます。",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
