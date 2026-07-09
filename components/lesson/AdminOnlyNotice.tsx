"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** Shown when a non-admin tries to reach a lesson create/edit page by URL. */
export function AdminOnlyNotice() {
  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-md)]">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--warning-soft)] text-[var(--warning)]">
          <Icon name="mic" size={22} />
        </div>
        <h1 className="text-xl font-extrabold">管理者専用ページです</h1>
        <p className="mt-2 text-sm text-muted">
          レッスンの作成・編集は管理者のみ行えます。
        </p>
        <Link href="/courses" className={buttonClasses("primary", "md", "mt-5")}>
          レッスン一覧へ戻る
        </Link>
      </div>
    </AppShell>
  );
}
