"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-6T2YMDZRKX";

export function GoogleAnalyticsRouteTracker() {
  const pathname = usePathname();
  const didTrackInitialPageView = useRef(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
    if (!didTrackInitialPageView.current) {
      didTrackInitialPageView.current = true;
      return;
    }

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
