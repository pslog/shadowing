import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isLocale,
} from "@/lib/i18n";

const PUBLIC_FILE = /\.[^/]+$/;

function preferredLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  return isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const [maybeLocale, ...rest] = pathname.split("/").filter(Boolean);

  if (isLocale(maybeLocale)) {
    if (
      ((rest[0] === "courses" || rest[0] === "lessons") &&
        rest[1] &&
        rest[1] !== "new")
    ) {
      const headers = new Headers(request.headers);
      headers.set(LOCALE_HEADER, maybeLocale);
      const response = NextResponse.next({ request: { headers } });
      response.cookies.set(LOCALE_COOKIE, maybeLocale, {
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
        sameSite: "lax",
      });
      return response;
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/${rest.join("/")}`;
    if (rewriteUrl.pathname === "/") rewriteUrl.pathname = "/";

    // The app tree has no [locale] segment, so the locale only survives the
    // rewrite as a request header — that is what generateMetadata reads.
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, maybeLocale);

    const response = NextResponse.rewrite(rewriteUrl, { request: { headers } });
    response.cookies.set(LOCALE_COOKIE, maybeLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|opengraph-image|twitter-image|icon.png|apple-icon.png).*)",
  ],
};
