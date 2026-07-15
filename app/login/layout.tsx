import type { Metadata } from "next";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ログイン",
  description: "Shadowing JPにログインして、学習記録とストリークを保存します。",
  ...noIndexMetadata,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
