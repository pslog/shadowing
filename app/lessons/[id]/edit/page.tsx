"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EditLessonForm } from "@/components/lesson/CreateLessonForm";
import { SentenceTimingEditor } from "@/components/lesson/SentenceTimingEditor";
import { FullScreenLoading } from "@/components/ui/loading";
import { useData } from "@/lib/store/DataProvider";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { isAdmin, lessonById, sentencesForLesson } from "@/lib/store/selectors";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";

export default function EditLessonPage() {
  const params = useParams<{ id: string }>();
  const { profile, ready } = useRequireProfile();
  const { state } = useData();

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdmin(state)) return <AdminOnlyNotice />;

  const lesson = lessonById(state, params.id);
  const sentences = sentencesForLesson(state, params.id);

  if (!lesson) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href="/courses" className="text-sm text-muted hover:text-fg">
            ← レッスン
          </Link>
          <h1 className="text-2xl font-bold">レッスンが見つかりません</h1>
          <p className="text-muted">削除されたか、URLが間違っている可能性があります。</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href={`/lessons/${lesson.id}`} className="text-sm text-muted hover:text-fg">
          ← レッスン詳細
        </Link>
        <h1 className="mt-1 text-2xl font-bold">レッスンを編集</h1>
        <p className="text-muted">タイトル、音声URL、スクリプト、メモを更新できます。</p>
      </div>
      <EditLessonForm lesson={{ ...lesson, sentences }} />

      <div className="mt-6">
        <SentenceTimingEditor lessonId={lesson.id} />
      </div>
    </AppShell>
  );
}
