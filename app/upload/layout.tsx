import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Upload video đa nền tảng",
  description:
    "Trang admin để upload video lên YouTube, TikTok và Facebook Page.",
  path: "/upload",
});

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
