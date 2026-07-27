import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "Tường xem trước video",
  description:
    "Trang admin để hiển thị một link video thành nhiều cửa sổ dọc.",
  path: "/tool",
});

export default function ToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
