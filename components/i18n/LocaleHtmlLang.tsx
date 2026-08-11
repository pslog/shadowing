"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/i18n/useI18n";

/**
 * The app tree is not segmented by locale on disk (`proxy.ts` rewrites
 * `/vi/...` → `/...`), so the root layout cannot know the locale at render
 * time without going fully dynamic. Sync `<html lang>` from the client
 * instead, which is what assistive tech and the browser's own language
 * heuristics read.
 */
export function LocaleHtmlLang() {
  const { localeTag } = useI18n();

  useEffect(() => {
    document.documentElement.lang = localeTag;
  }, [localeTag]);

  return null;
}
