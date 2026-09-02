import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

/**
 * Server Component / Route Handler Supabase client.
 *
 * Writes to the cookie jar are intentionally handled by proxy.ts, where Next permits
 * response-cookie mutation. Server Components should use this client for read/auth
 * decisions only, and should call auth.getUser() rather than trusting unverified data.
 */
export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Session refresh persistence occurs in the Next proxy boundary.
      },
    },
  });
}

export async function getVerifiedCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
