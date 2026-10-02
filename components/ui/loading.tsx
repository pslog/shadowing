"use client";

import { useI18n } from "@/components/i18n/useI18n";
import { AppShell } from "@/components/layout/AppShell";

export function FullScreenLoading() {
  const { dictionary: m } = useI18n();

  return (
    <AppShell>
      <section aria-busy="true" aria-label={m.common.loading} className="min-h-[60vh]">
        <p role="status" className="mb-6 flex items-center gap-3 text-sm font-semibold text-muted">
          <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
          {m.common.loading}
        </p>
        <div aria-hidden="true" className="space-y-6">
          <div className="skeleton h-9 w-2/3 max-w-sm rounded-lg" />
          <div className="skeleton h-5 w-full max-w-xl rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-card p-5">
                <div className="skeleton h-28 rounded-xl" />
                <div className="skeleton mt-4 h-5 w-3/4 rounded" />
                <div className="skeleton mt-3 h-4 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
