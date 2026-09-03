"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig, isSupabaseConfigured } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null | undefined;

export { isSupabaseConfigured };

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  if (browserClient === undefined) {
    browserClient = createBrowserClient(config.url, config.publishableKey);
  }

  return browserClient;
}
