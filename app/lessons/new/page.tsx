"use client";

import Link from "next/link";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { CreateLessonForm } from "@/components/lesson/CreateLessonForm";
import { isAdminProfile } from "@/lib/store/selectors";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { useI18n } from "@/components/i18n/useI18n";

export default function NewLessonPage() {
  const { profile, ready } = useRequireProfile();
  const { dictionary, href } = useI18n();
  const t = dictionary.lessonForm;
  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdminProfile(profile)) return <AdminOnlyNotice />;

  return (
    <AppShell>
      <div className="mb-5">
        <Link href={href("/courses")} className="text-sm text-muted hover:text-fg">
          {t.backToLessons}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t.newTitle}</h1>
        <p className="text-muted">{t.newBody}</p>
      </div>
      <CreateLessonForm />
    </AppShell>
  );
}
