"use client";

import Link from "next/link";
import { useData } from "@/lib/store/DataProvider";
import {
  lessonStatus,
  lastAttemptAtForLesson,
  passedCountForLesson,
  sentencesForLesson,
  visibleLessons,
} from "@/lib/store/selectors";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { LessonCard } from "@/components/lesson/LessonCard";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default function LessonsPage() {
  const { state, ready } = useData();

  if (!ready) return <FullScreenLoading />;

  const lessons = visibleLessons(state);

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">レッスン</h1>
          <p className="text-muted">レッスンを選んでシャドーイングを練習しましょう。</p>
        </div>
        <Link href="/lessons/new" className={buttonClasses("primary")}>
          <Icon name="plus" size={16} />
          レッスン作成
        </Link>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l, i) => (
          <div key={l.id} style={{ ["--i" as string]: i }}>
            <LessonCard
              lesson={l}
              status={lessonStatus(state, l.id)}
              passed={passedCountForLesson(state, l.id)}
              total={sentencesForLesson(state, l.id).length}
              lastAttemptAt={lastAttemptAtForLesson(state, l.id)}
            />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
