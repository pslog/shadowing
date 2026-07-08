"use client";

import Link from "next/link";
import { useRequireProfile } from "@/lib/store/useRequireProfile";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenLoading } from "@/components/ui/loading";
import { CreateLessonForm } from "@/components/lesson/CreateLessonForm";

export default function NewLessonPage() {
  const { profile, ready } = useRequireProfile();
  if (!ready || !profile) return <FullScreenLoading />;

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/lessons" className="text-sm text-muted hover:text-fg">
          ← レッスン
        </Link>
        <h1 className="mt-1 text-2xl font-bold">新しいレッスンを作成</h1>
        <p className="text-muted">
          日本語スクリプトを入力してください。1行が1つの練習文になります。
        </p>
      </div>
      <CreateLessonForm />
    </AppShell>
  );
}
