"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EditLessonForm } from "@/components/lesson/CreateLessonForm";
import { ReadingLessonEditForm } from "@/components/lesson/ReadingLessonEditForm";
import { SentenceTimingEditor } from "@/components/lesson/SentenceTimingEditor";
import { FullScreenLoading } from "@/components/ui/loading";
import { useData } from "@/lib/store/DataProvider";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import {
  isAdmin,
  lessonBySlug,
  lessonHref,
  sentencesForLesson,
} from "@/lib/store/selectors";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { useI18n } from "@/components/i18n/useI18n";

export default function EditLessonPage() {
  const params = useParams<{ id: string }>();
  const { profile, ready } = useRequireProfile();
  const { state } = useData();
  const { dictionary, href } = useI18n();
  const t = dictionary.lessonForm;

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdmin(state)) return <AdminOnlyNotice />;

  const lesson = lessonBySlug(state, params.id);
  const sentences = lesson ? sentencesForLesson(state, lesson.id) : [];

  if (!lesson) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href={href("/courses")} className="text-sm text-muted hover:text-fg">
            {t.backToLessons}
          </Link>
          <h1 className="text-2xl font-bold">{t.notFound}</h1>
          <p className="text-muted">{t.notFoundBody}</p>
        </div>
      </AppShell>
    );
  }

  const lessonWithSentences = { ...lesson, sentences };
  const isReadingLesson = lesson.topic === "読解";

  return (
    <AppShell>
      <div className="mb-5">
        <Link
          href={href(lessonHref(lesson))}
          className="text-sm text-muted hover:text-fg"
        >
          {t.backToLesson}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t.editTitle}</h1>
        <p className="text-muted">{t.editBody}</p>
      </div>
      {isReadingLesson ? (
        <ReadingLessonEditForm lesson={lessonWithSentences} />
      ) : (
        <EditLessonForm lesson={lessonWithSentences} />
      )}

      {!isReadingLesson && (
        <div className="mt-6">
          <SentenceTimingEditor lessonId={lesson.id} />
        </div>
      )}
    </AppShell>
  );
}
