"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requireSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, toastError } from "@/lib/toast";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-8rem)] flex items-center justify-center"><div className="text-sm text-navy-500">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = requireSupabase();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        toast.error("Sign-in failed", authError.message);
        return;
      }

      toast.success("Welcome back");
      router.push(redirectTo);
    } catch (err) {
      toastError(err, "Sign-in failed");
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <p className="text-sm text-navy-500 mt-1">
            Sign in to manage your bookings
          </p>
        </CardHeader>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            id="email"
            placeholder="you@example.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            id="password"
            placeholder="Your password"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-4 text-right">
          <Link
            href="/auth/forgot-password"
            className="text-xs text-primary-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div className="mt-4 text-center text-sm text-navy-500">
          Do not have an account?{" "}
          <Link
            href={`/auth/register${redirectTo !== "/dashboard" ? `?redirectTo=${redirectTo}` : ""}`}
            className="font-medium text-primary-700 hover:text-primary-800"
          >
            Register
          </Link>
        </div>
      </Card>
    </div>
  );
}
