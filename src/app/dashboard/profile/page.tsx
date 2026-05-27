"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, toastError } from "@/lib/toast";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push("/auth/login?redirectTo=/dashboard/profile");
        return;
      }
      const { data: profile } = await client
        .from("users")
        .select("full_name, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setEmail(profile.email ?? user.email ?? "");
      } else {
        setEmail(user.email ?? "");
      }
      setLoading(false);
    })();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase not configured");
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await client
        .from("users")
        .update({ full_name: fullName, phone, email })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (err) {
      toastError(err, "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="animate-pulse-slow h-48 bg-navy-100" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/dashboard" className="text-xs text-navy-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-navy-800 mt-2 mb-1">My Profile</h1>
      <p className="text-sm text-navy-500 mb-6">
        Update your name and contact details.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <Link
          href="/auth/forgot-password"
          className="inline-block text-sm text-primary-700 hover:underline"
        >
          Change password
        </Link>
      </Card>
    </div>
  );
}
