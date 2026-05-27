"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setState("error");
      setMessage("Authentication is not configured.");
      return;
    }

    const error = params.get("error_description") || params.get("error");
    if (error) {
      setState("error");
      setMessage(decodeURIComponent(error));
      return;
    }

    // Supabase auto-detects the session in the URL hash on import; we just
    // need to wait a tick for it to settle, then route the user.
    (async () => {
      const { data } = await client.auth.getSession();
      if (data.session) {
        setState("ok");
        const redirect = params.get("redirectTo") || "/dashboard";
        router.replace(redirect);
      } else {
        setState("ok");
        router.replace("/auth/login");
      }
    })();
  }, [params, router]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        {state === "working" && (
          <>
            <h1 className="text-lg font-semibold text-navy-800 mb-2">
              Confirming your email…
            </h1>
            <p className="text-sm text-navy-500">Just a moment.</p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-lg font-semibold text-red-700 mb-2">
              Confirmation failed
            </h1>
            <p className="text-sm text-navy-600 mb-4">{message}</p>
            <Link href="/auth/login" className="text-primary-700 hover:underline text-sm">
              Try signing in
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
