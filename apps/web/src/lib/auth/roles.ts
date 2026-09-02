import { isRole, type Role } from "@/lib/domain";

export function roleFromClaims(claims: Record<string, unknown> | null | undefined): Role | null {
  const appMetadata = claims?.app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") {
    return null;
  }

  const role = (appMetadata as Record<string, unknown>).role;
  return isRole(role) ? role : null;
}

/**
 * UI routing convenience only. Database RLS and verified server-side token checks
 * remain the authorization authority once Supabase is connected.
 */
export function roleLandingPath(role: Role) {
  return role === "driver" ? "/driver" : role === "dispatcher" ? "/dispatch" : "/admin";
}
