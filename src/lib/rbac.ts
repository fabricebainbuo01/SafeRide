"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "passenger" | "agency_admin" | "super_admin";

export interface UserProfileRow {
  role: AppRole;
  agency_id: string | null;
}

/**
 * Loads `public.users` role + agency_id for RBAC (profiles table equivalent).
 */
export async function fetchUserProfile(
  client: SupabaseClient,
  userId: string
): Promise<{ data: UserProfileRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("users")
    .select("role, agency_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error as Error };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return {
    data: {
      role: data.role as AppRole,
      agency_id: data.agency_id,
    },
    error: null,
  };
}

export function isSuperAdmin(profile: UserProfileRow | null): boolean {
  return profile?.role === "super_admin";
}

export function isAgencyAdmin(profile: UserProfileRow | null): boolean {
  return profile?.role === "agency_admin" && !!profile.agency_id;
}

export function canAccessSuperAdminRoutes(profile: UserProfileRow | null): boolean {
  return isSuperAdmin(profile);
}

export function canAccessAgencyAdminRoutes(profile: UserProfileRow | null): boolean {
  return isAgencyAdmin(profile);
}
