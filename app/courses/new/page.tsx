"use client";

import Link from "next/link";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { isAdminProfile } from "@/lib/store/selectors";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { AdminOnlyNotice } from "@/components/lesson/AdminOnlyNotice";
import { CreateCourseForm } from "@/components/lesson/CreateCourseForm";

export default function NewCoursePage() {
  const { profile, ready } = useRequireProfile();
  if (!ready || !profile) return <FullScreenLoading />;
  if (!isAdminProfile(profile)) return <AdminOnlyNotice />;

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/courses" className="text-sm text-muted hover:text-fg">
          ← コース一覧
        </Link>
        <h1 className="mt-1 text-2xl font-bold">新しいコースを作成</h1>
        <p className="text-muted">
          関連するレッスンをまとめるコースを作ります。作成後、レッスン編集でこのコースに割り当てられます。
        </p>
      </div>
      <CreateCourseForm />
    </AppShell>
  );
}
