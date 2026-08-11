"use client";

import { useI18n } from "@/components/i18n/useI18n";

export function FullScreenLoading() {
  const { dictionary: m } = useI18n();

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <span className="text-sm">{m.common.loading}</span>
      </div>
    </div>
  );
}
