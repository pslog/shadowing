import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Tool kiểm tra video channel",
  description:
    "Trang admin để tải danh sách video public từ một channel YouTube và kiểm tra player trực tiếp.",
  path: "/tool",
});

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
