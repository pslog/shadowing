import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "管理",
  ...noIndexMetadata,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
