import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";
import { requestMessages } from "@/lib/seo-locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await requestMessages();
  return privatePageMetadata({
    title: m.meta.dashboardTitle,
    description: m.meta.dashboardDescription,
    path: "/dashboard",
    locale,
  });
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
