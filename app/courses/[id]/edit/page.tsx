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

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  const { profile, ready } = useRequireProfile();
  const { state } = useData();

  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdmin(state)) return <AdminOnlyNotice />;

  const course = courseBySlug(state, params.id);

  if (!course) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link href="/courses" className="text-sm text-muted hover:text-fg">
            コース一覧へ
          </Link>
          <h1 className="text-2xl font-bold">コースが見つかりません</h1>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href={courseHref(course)} className="text-sm text-muted hover:text-fg">
          コース詳細へ
        </Link>
        <h1 className="mt-1 text-2xl font-bold">コース編集</h1>
        <p className="text-muted">コース名、説明、レベル、カバー画像を更新できます。</p>
      </div>
      <CreateCourseForm course={course} />
    </AppShell>
  );
}
