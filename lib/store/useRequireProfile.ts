"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useData } from "./DataProvider";

/** Redirects to /login when hydration is done and there is no profile. */
export function useRequireProfile() {
  const { state, ready } = useData();
  const router = useRouter();

  useEffect(() => {
    if (ready && !state.profile) router.replace("/login");
  }, [ready, state.profile, router]);

  return { profile: state.profile, ready };
}
