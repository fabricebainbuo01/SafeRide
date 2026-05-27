"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requireSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, toastError } from "@/lib/toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const supabase = requireSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated", "You're now signed in.");
      router.push("/dashboard");
    } catch (err) {
      toastError(err, "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <p className="text-sm text-navy-500 mt-1">
            Make it at least 8 characters.
          </p>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
