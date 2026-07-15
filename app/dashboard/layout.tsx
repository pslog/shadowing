import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ダッシュボード",
  ...noIndexMetadata,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
