"use client";

import { useState } from "react";
import Link from "next/link";
import { requireSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, toastError } from "@/lib/toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your email", "We sent you a password reset link.");
    } catch (err) {
      toastError(err, "Could not send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Forgot your password?</CardTitle>
          <p className="text-sm text-navy-500 mt-1">
            We&apos;ll email you a secure link to set a new one.
          </p>
        </CardHeader>

        {sent ? (
          <div className="space-y-3 text-sm text-navy-600">
            <p>
              If an account exists for <strong>{email}</strong>, you&apos;ll
              get a reset link in the next minute or two.
            </p>
            <Link href="/auth/login" className="text-primary-700 hover:underline">
              Back to sign-in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              id="email"
              placeholder="you@example.com"
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
            <Link
              href="/auth/login"
              className="block text-center text-xs text-navy-500 hover:underline"
            >
              Back to sign-in
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
