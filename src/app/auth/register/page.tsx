"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requireSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, toastError } from "@/lib/toast";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = requireSupabase();

      // The public.users profile is created automatically by the
      // on_auth_user_created trigger using this metadata. No client-side
      // INSERT is needed (and wouldn't work anyway when email confirmation
      // is on, since signUp returns no session).
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            phone,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        toast.error("Registration failed", authError.message);
        return;
      }

      if (!authData.session) {
        setNeedsConfirmation(true);
        toast.success(
          "Check your email",
          "We sent a confirmation link. Confirm to finish signing up."
        );
      } else {
        toast.success("Welcome to SafeRide");
        router.push("/dashboard");
      }
    } catch (err) {
      toastError(err, "Registration failed");
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-navy-800 mb-2">
            Check your email
          </h1>
          <p className="text-sm text-navy-600 mb-4">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            verify your account, then sign in.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-sm text-primary-700 font-medium hover:underline"
          >
            Go to sign-in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <p className="text-sm text-navy-500 mt-1">
            Register as a passenger. After you sign in, you&apos;ll see{" "}
            <strong className="text-navy-600">Apply to list your agency</strong>{" "}
            on your dashboard and in the footer while your account is a passenger.
          </p>
        </CardHeader>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            id="name"
            placeholder="John Doe"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            id="phone"
            placeholder="+237 6XX XXX XXX"
            required
          />
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
            placeholder="Min 8 characters"
            required
            minLength={8}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-navy-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary-700 hover:text-primary-800"
          >
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}
