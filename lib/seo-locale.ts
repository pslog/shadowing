import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  type Dictionary,
  type Locale,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isLocale,
  messages,
} from "@/lib/i18n";

/**
 * Locale for the current request, as stamped on the rewrite by `proxy.ts`.
 * Falls back to the cookie (set by the same proxy) and then the default, so a
 * direct hit that skipped the matcher still renders something sensible.
 *
 * Reading request state makes the caller dynamic — that is unavoidable while
 * the app tree has no `[locale]` segment.
 */
export async function requestLocale(): Promise<Locale> {
  const headerLocale = (await headers()).get(LOCALE_HEADER);
  if (isLocale(headerLocale)) return headerLocale;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

export async function requestMessages(): Promise<{
  locale: Locale;
  m: Dictionary;
}> {
  const locale = await requestLocale();
  return { locale, m: messages[locale] ?? messages[DEFAULT_LOCALE] };
}
