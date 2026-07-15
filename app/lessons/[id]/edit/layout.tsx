import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return privatePageMetadata({
    title: "レッスン編集",
    description: "Shadowing JPのレッスン編集画面。",
    path: `/lessons/${id}/edit`,
  });
}

export default function EditLessonLayout({ children }: Props) {
  return children;
}
