"use client";

// Browser Supabase client. Returns null when env vars are absent so the app
// keeps running in local-first mode. Once NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
// are set, swap the local store's read/write calls for these.

import type { SupabaseClient } from "@supabase/supabase-js";

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

export async function createClient() {
  if (!hasSupabaseEnv()) return null;
  clientPromise ??= import("@supabase/ssr").then(({ createBrowserClient }) =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );
  return clientPromise;
}
