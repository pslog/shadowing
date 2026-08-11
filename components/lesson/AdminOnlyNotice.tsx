"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/components/i18n/useI18n";

/** Shown when a non-admin tries to reach a lesson create/edit page by URL. */
export function AdminOnlyNotice() {
  const { dictionary, href } = useI18n();
  const t = dictionary.adminOnly;

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-md)]">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--warning-soft)] text-[var(--warning)]">
          <Icon name="mic" size={22} />
        </div>
        <h1 className="text-xl font-extrabold">{t.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.body}</p>
        <Link href={href("/courses")} className={buttonClasses("primary", "md", "mt-5")}>
          {t.back}
        </Link>
      </div>
    </AppShell>
  );
}
