import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "進捗",
  ...noIndexMetadata,
};

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
