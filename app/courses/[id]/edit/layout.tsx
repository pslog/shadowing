import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return privatePageMetadata({
    title: "コース編集",
    description: "Shadowing JPのコース編集画面。",
    path: `/courses/${id}/edit`,
  });
}

export default function EditCourseLayout({ children }: Props) {
  return children;
}
