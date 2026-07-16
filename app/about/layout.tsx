import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "紹介",
  description:
    "Shadowing JPの学習方針と作者紹介。日本語を学ぶコミュニティのために、非営利で毎日の小さな発話練習を支えます。",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
