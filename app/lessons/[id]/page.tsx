"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { lessonById, UNCATEGORIZED_COURSE_ID } from "@/lib/store/selectors";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export default function LessonPlayerPage() {
  const params = useParams<{ id: string }>();
  const { state, ready } = useData();

  if (!ready) return <FullScreenLoading />;

  // Back to the lesson list of the course this lesson belongs to.
  const lesson = lessonById(state, params.id);
  const backHref = lesson
    ? `/courses/${lesson.course_id ?? UNCATEGORIZED_COURSE_ID}`
    : "/lessons";

  return (
    <AppShell>
      <div className="mb-4">
        <Link href={backHref} className="text-sm text-muted hover:text-fg">
          ← レッスン一覧
        </Link>
      </div>
      <LessonPlayer lessonId={params.id} />
    </AppShell>
  );
}
