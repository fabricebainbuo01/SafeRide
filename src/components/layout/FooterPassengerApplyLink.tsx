"use client";

import { useEffect, useState } from "react";
import { getSupabase, getSessionUser } from "@/lib/supabase";

async function isPassengerRole(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  const authUser = await getSessionUser(client);
  if (!authUser) return false;
  const { data } = await client
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .maybeSingle();
  return data?.role === "passenger";
}

/**
 * Footer item shown only while the signed-in user is a passenger (not agency_admin / super_admin).
 */
export function FooterPassengerApplyLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setShow(false);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const ok = await isPassengerRole();
      if (!cancelled) setShow(ok);
    };

    void refresh();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!show) return null;

  return (
    <li>
      <a
        href="/agency-application"
        className="text-sm text-navy-400 hover:text-white transition-colors"
      >
        Apply to list your agency
      </a>
    </li>
  );
}
