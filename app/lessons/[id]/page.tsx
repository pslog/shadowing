"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/lib/store/DataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export default function LessonPlayerPage() {
  const params = useParams<{ id: string }>();
  const { ready } = useData();

  if (!ready) return <FullScreenLoading />;

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/lessons" className="text-sm text-muted hover:text-fg">
          ← レッスン
        </Link>
      </div>
      <LessonPlayer lessonId={params.id} />
    </AppShell>
  );
}
