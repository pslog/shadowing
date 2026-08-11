"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  DEFAULT_LOCALE,
  type Dictionary,
  type Locale,
  LOCALE_TAG,
  localeFromPathname,
  messages,
  stripLocale,
  withLocale,
} from "@/lib/i18n";

export function useI18n() {
  const pathname = usePathname();
  const locale = localeFromPathname(pathname);
  const dictionary: Dictionary = messages[locale] ?? messages[DEFAULT_LOCALE];

  // Stable identities: these end up in effect dependency arrays (see the
  // legacy-slug redirect on the course page), so a new closure per render
  // would re-run those effects forever.
  const href = useCallback((target: string) => withLocale(target, locale), [locale]);
  const switchHref = useCallback(
    (nextLocale: Locale) => withLocale(stripLocale(pathname || "/"), nextLocale),
    [pathname],
  );

  return useMemo(
    () => ({
      locale,
      localeTag: LOCALE_TAG[locale],
      dictionary,
      href,
      switchHref,
    }),
    [dictionary, href, locale, switchHref],
  );
}
