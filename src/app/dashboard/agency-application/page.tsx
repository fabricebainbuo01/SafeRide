"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old URL — agency form now lives at `/agency-application` (outside middleware). */
export default function LegacyDashboardAgencyApplicationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/agency-application");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-navy-600">
      Opening application…
    </div>
  );
}
