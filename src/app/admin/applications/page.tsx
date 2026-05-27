"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast, toastError } from "@/lib/toast";
import type { AgencyApplication } from "@/types";

interface AppRow extends AgencyApplication {
  user?: { full_name: string; email: string | null; phone: string };
}

export default function AgencyApplicationsAdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reasonByApp, setReasonByApp] = useState<Record<string, string>>({});

  const fetchApplications = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    setLoading(true);
    try {
      const { data: apps, error: appsErr } = await client
        .from("agency_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (appsErr) throw appsErr;

      const rows = apps ?? [];
      if (rows.length === 0) {
        setApplications([]);
        return;
      }

      const userIds = [...new Set(rows.map((r) => r.user_id as string))];
      const { data: profiles, error: profilesErr } = await client
        .from("users")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      if (profilesErr) throw profilesErr;

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id as string, p])
      );

      const merged: AppRow[] = rows.map((app) => ({
        ...(app as unknown as AgencyApplication),
        user: profileMap.get(app.user_id as string),
      }));

      setApplications(merged);
    } catch (err) {
      toastError(err, "Couldn't load applications");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data: profile } = await client
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "super_admin") {
        toast.error("Super-admin access required");
        router.push("/dashboard");
        return;
      }
      setAuthChecked(true);
      fetchApplications();
    })();
  }, [router, fetchApplications]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase not configured");
      const { error } = await client.rpc("approve_agency_application", {
        application_id: id,
      });
      if (error) throw error;
      toast.success("Application approved", "The user is now an agency_admin.");
      fetchApplications();
    } catch (err) {
      toastError(err, "Approval failed");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = reasonByApp[id]?.trim();
    if (!reason) {
      toast.error("Please add a rejection reason");
      return;
    }
    setActingId(id);
    try {
      const client = getSupabase();
      if (!client) throw new Error("Supabase not configured");
      const { error } = await client
        .from("agency_applications")
        .update({
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Application rejected");
      fetchApplications();
    } catch (err) {
      toastError(err, "Rejection failed");
    } finally {
      setActingId(null);
    }
  };

  if (!authChecked) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar variant="super" />
      <div className="flex-1 overflow-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-navy-800 mb-2">
        Agency Applications
      </h1>
      <p className="text-sm text-navy-500 mb-6">
        Review and approve transport agencies that want to list on SafeRide.
      </p>

      {loading ? (
        <div className="animate-pulse-slow h-32 bg-navy-100" />
      ) : applications.length === 0 ? (
        <Card>
          <p className="text-sm text-navy-500 text-center">No applications yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <div className="flex items-center justify-between mb-3">
                <CardTitle>{app.proposed_name}</CardTitle>
                <Badge
                  variant={
                    app.status === "approved"
                      ? "success"
                      : app.status === "rejected"
                      ? "danger"
                      : "warning"
                  }
                >
                  {app.status.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-navy-600 mb-3">
                <div>
                  <p className="text-navy-400 text-xs">Applicant</p>
                  <p className="font-medium text-navy-800">
                    {app.user?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-navy-500">{app.user?.email}</p>
                </div>
                <div>
                  <p className="text-navy-400 text-xs">Contact</p>
                  <p className="font-medium text-navy-800">{app.phone}</p>
                </div>
                <div>
                  <p className="text-navy-400 text-xs">Address</p>
                  <p className="font-medium text-navy-800">
                    {app.address}, {app.city}
                  </p>
                </div>
                <div>
                  <p className="text-navy-400 text-xs">Submitted</p>
                  <p className="font-medium text-navy-800">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {app.description && (
                <div className="mb-4 p-3 bg-navy-50 border border-navy-100 text-sm text-navy-700">
                  {app.description}
                </div>
              )}

              {app.status === "pending" && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <input
                    type="text"
                    placeholder="Optional rejection reason"
                    value={reasonByApp[app.id] ?? ""}
                    onChange={(e) =>
                      setReasonByApp((prev) => ({ ...prev, [app.id]: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 text-sm border border-navy-300 bg-white"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(app.id)}
                      loading={actingId === app.id}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(app.id)}
                      loading={actingId === app.id}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              )}

              {app.status === "rejected" && app.rejection_reason && (
                <p className="text-sm text-red-700">Reason: {app.rejection_reason}</p>
              )}
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
