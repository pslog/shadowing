import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = privatePageMetadata({
  title: "管理",
  description: "Shadowing JPの管理画面。",
  path: "/admin/users",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
