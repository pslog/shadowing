import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.loginTitle,
    description: m.meta.loginDescription,
    path: "/login",
    locale,
  });
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
