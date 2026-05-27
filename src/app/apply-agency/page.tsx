"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy URL — forwards to `/agency-application`. Prefer linking there from the footer.
 */
export default function ApplyAgencyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/agency-application");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm text-navy-600">Opening agency application…</p>
    </div>
  );
}
