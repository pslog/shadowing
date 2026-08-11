"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { CreateCourseForm } from "@/components/lesson/CreateCourseForm";
import { FullScreenLoading } from "@/components/ui/loading";
import { useData } from "@/lib/store/DataProvider";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { courseBySlug, courseHref, isAdmin } from "@/lib/store/selectors";
import { useI18n } from "@/components/i18n/useI18n";

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  const { profile, ready } = useRequireProfile();
  const { state } = useData();
  const { dictionary, href } = useI18n();
  const t = dictionary.courseForm;

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdmin(state)) return <AdminOnlyNotice />;

  const course = courseBySlug(state, params.id);

  if (!course) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href={href("/courses")} className="text-sm text-muted hover:text-fg">
            {t.backToCourses}
          </Link>
          <h1 className="text-2xl font-bold">{t.notFound}</h1>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link
          href={href(courseHref(course))}
          className="text-sm text-muted hover:text-fg"
        >
          {t.backToCourse}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t.editTitle}</h1>
        <p className="text-muted">{t.editBody}</p>
      </div>
      <CreateCourseForm course={course} />
    </AppShell>
  );
}
