"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSupabase, getSessionUser } from "@/lib/supabase";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast, toastError } from "@/lib/toast";
import type { AgencyApplication } from "@/types";

/**
 * Lives outside `/dashboard/*` so middleware cookie checks cannot block navigation
 * when the Supabase session exists only in the browser (localStorage) — same pattern
 * as other marketing pages that still require login inside the page.
 */
export default function AgencyApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<AgencyApplication | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    (async () => {
      const authUser = await getSessionUser(client);
      if (!authUser) {
        router.push("/auth/login?redirectTo=/agency-application");
        return;
      }
      const user = authUser;

      const { data: profile } = await client
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "agency_admin" || profile?.role === "super_admin") {
        router.push("/admin");
        return;
      }

      const { data: app } = await client
        .from("agency_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (app) setExisting(app as unknown as AgencyApplication);
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase not configured");
      const authUser = await getSessionUser(client);
      if (!authUser) throw new Error("Not signed in");
      const user = authUser;

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);

      const { error } = await client.from("agency_applications").insert({
        user_id: user.id,
        proposed_name: name,
        proposed_slug: slug,
        phone,
        address,
        city,
        description: description || null,
        status: "pending",
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          toast.error(
            "Already pending",
            "You already have an application awaiting review."
          );
          return;
        }
        throw error;
      }

      toast.success(
        "Application submitted",
        "Only a SafeRide platform administrator can approve your request. We'll email you after review."
      );
      router.push("/dashboard");
    } catch (err) {
      toastError(err, "Could not submit application");
    } finally {
      setSubmitting(false);
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
      <h1 className="text-2xl font-bold text-navy-800 mb-2">
        Apply to list your agency
      </h1>
      <p className="text-sm text-navy-500 mb-6">
        Tell us about your transport business. After approval, you&apos;ll get
        access to the agency portal where you can manage buses, schedules,
        and bookings.
      </p>

      <div className="mb-8 flex gap-3 rounded-lg border border-primary-200 bg-primary-50/80 p-4 text-sm text-navy-700">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-primary-700"
          aria-hidden
        />
        <div>
          <p className="font-semibold text-navy-800">Super-admin review only</p>
          <p className="mt-1 leading-relaxed text-navy-600">
            Submitting this form does not create an agency account. A{" "}
            <strong className="font-medium text-navy-700">SafeRide super
            administrator</strong> must validate your application in our system.
            Other agencies or staff cannot approve you. When your request is
            accepted or declined, we&apos;ll notify you by email.
          </p>
        </div>
      </div>

      {existing && existing.status === "pending" && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy-800">
                Application pending review
              </p>
              <p className="text-xs text-navy-500">
                Submitted on {new Date(existing.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant="warning">PENDING</Badge>
          </div>
          <p className="text-sm text-navy-600 mt-3">
            Only a super administrator can approve or reject this request. We&apos;ll
            email you when it has been reviewed.
          </p>
        </Card>
      )}

      {existing && existing.status === "rejected" && (
        <Card className="mb-6 border-red-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-700">
              Previous application rejected
            </p>
            <Badge variant="danger">REJECTED</Badge>
          </div>
          {existing.rejection_reason && (
            <p className="text-sm text-navy-600 mt-2">
              Reason: {existing.rejection_reason}
            </p>
          )}
          <p className="text-sm text-navy-600 mt-3">
            You can submit a new application below addressing the feedback above.
          </p>
        </Card>
      )}

      {(!existing || existing.status === "rejected") && (
        <Card>
          <CardHeader>
            <CardTitle>Agency details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Agency name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Garantie Express"
            />
            <Input
              label="Contact phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+237 6XX XXX XXX"
            />
            <Input
              label="Head office address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
            <Input
              label="Head office city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="e.g. Douala"
            />
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1">
                About your agency (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-navy-300 bg-white text-navy-900 focus:outline-none focus:ring-2 focus:ring-primary-700"
                placeholder="Routes you operate, fleet size, years in business…"
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Submit application
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
