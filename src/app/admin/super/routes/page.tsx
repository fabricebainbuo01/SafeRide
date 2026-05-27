"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase, getSessionUser } from "@/lib/supabase";
import { fetchUserProfile, isSuperAdmin, type UserProfileRow } from "@/lib/rbac";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { toast, toastError } from "@/lib/toast";
import type { AgencyRouteRow } from "@/types";
import { formatCurrency } from "@/lib/utils";

type RouteRow = AgencyRouteRow & {
  agency?: { name: string } | { name: string }[] | null;
};

export default function SuperRoutesModerationPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;

    let q = client
      .from("agency_routes")
      .select(
        `*,
        agency:agencies(name),
        origin_city:cities!agency_routes_origin_city_id_fkey(id, name),
        destination_city:cities!agency_routes_destination_city_id_fkey(id, name)`
      )
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      q = q.eq("verification_status", "pending");
    }

    const { data, error } = await q;
    if (error) {
      toastError(error, "Couldn't load routes");
      return;
    }
    setRows((data ?? []) as RouteRow[]);
  }, [filter]);

  useEffect(() => {
    const signal = { cancelled: false };
    (async () => {
      const client = getSupabase();
      if (!client) {
        setReady(true);
        setLoading(false);
        return;
      }
      const authUser = await getSessionUser(client);
      if (signal.cancelled) return;
      if (!authUser) {
        router.replace("/auth/login");
        return;
      }
      const { data: p } = await fetchUserProfile(client, authUser.id);
      if (signal.cancelled) return;
      if (!isSuperAdmin(p)) {
        toast.error("Access denied", "Super admin only.");
        router.replace("/dashboard");
        return;
      }
      setProfile(p);
      setReady(true);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!ready || !profile) return;
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, profile, filter, load]);

  const verify = async (id: string) => {
    const client = getSupabase();
    if (!client) return;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    setActingId(id);
    const { error } = await client
      .from("agency_routes")
      .update({
        verification_status: "verified",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", id);
    setActingId(null);

    if (error) {
      toastError(error, "Couldn't approve route");
      return;
    }
    toast.success("Route verified", "Live on the public Routes explorer.");
    void load();
  };

  /**
   * Toggle the manual `is_featured` flag on a route. Only super-admins can
   * write this column (enforced server-side by `agency_routes_before_write`),
   * so this UI is the sanctioned path for paid-promotion management.
   */
  const toggleFeatured = async (row: RouteRow) => {
    const client = getSupabase();
    if (!client) return;

    const next = !row.is_featured;
    setActingId(row.id);
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_featured: next } : r))
    );
    const { error } = await client
      .from("agency_routes")
      .update({ is_featured: next })
      .eq("id", row.id);
    setActingId(null);

    if (error) {
      toastError(error, "Couldn't update featured");
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, is_featured: row.is_featured } : r
        )
      );
      return;
    }
    toast.success(next ? "Route featured" : "Route un-featured");
  };

  const reject = async (id: string) => {
    const reason = rejectReason.trim();
    if (reason.length < 4) {
      toast.error("Add a short reason", "Help agencies fix spam or bad data.");
      return;
    }
    const client = getSupabase();
    if (!client) return;
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return;

    setActingId(id);
    const { error } = await client
      .from("agency_routes")
      .update({
        verification_status: "rejected",
        rejection_reason: reason,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", id);
    setActingId(null);

    if (error) {
      toastError(error, "Couldn't reject route");
      return;
    }
    toast.success("Route rejected", "");
    setRejectId(null);
    setRejectReason("");
    void load();
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary-700" size={32} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar variant="super" />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-10 w-64 mb-6" />
          <LoadingSkeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar variant="super" />
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-800 mb-2">Route verification</h1>
        <p className="text-sm text-navy-500 mb-6 max-w-2xl">
          Approve listings after checking indicative fares and stop-over notes. Only verified,
          enabled routes appear on the public Routes page.
        </p>

        <div className="flex gap-2 mb-6">
          <Button
            type="button"
            size="sm"
            variant={filter === "pending" ? "primary" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending review
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "primary" : "outline"}
            onClick={() => setFilter("all")}
          >
            All listings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agency route submissions</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-navy-400">
                  <th className="py-2 pr-2">Agency</th>
                  <th className="py-2 pr-2">Route</th>
                  <th className="py-2 pr-2">Mode</th>
                  <th className="py-2 pr-2">Indicative</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Featured</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ag = r.agency;
                  const agencyName = Array.isArray(ag) ? ag[0]?.name : ag?.name ?? "—";
                  const o = Array.isArray(r.origin_city)
                    ? r.origin_city[0]?.name
                    : r.origin_city?.name;
                  const d = Array.isArray(r.destination_city)
                    ? r.destination_city[0]?.name
                    : r.destination_city?.name;

                  return (
                    <tr key={r.id} className="border-b border-navy-100 align-top">
                      <td className="py-3 pr-2 font-medium text-navy-800">{agencyName}</td>
                      <td className="py-3 pr-2">
                        <span className="font-medium">
                          {o ?? "—"} → {d ?? "—"}
                        </span>
                        {r.stop_over_notes?.trim() ? (
                          <p className="text-xs text-navy-500 mt-1 max-w-[220px]">
                            {r.stop_over_notes}
                          </p>
                        ) : null}
                        {r.verification_status === "rejected" && r.rejection_reason?.trim() ? (
                          <p className="text-xs text-red-600 mt-1">
                            Rejected: {r.rejection_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-2 capitalize">{r.route_kind}</td>
                      <td className="py-3 pr-2">
                        {r.indicative_price_xaf != null
                          ? formatCurrency(r.indicative_price_xaf)
                          : "—"}
                      </td>
                      <td className="py-3 pr-2">
                        <Badge
                          variant={
                            r.verification_status === "verified"
                              ? "success"
                              : r.verification_status === "pending"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {r.verification_status}
                        </Badge>
                        {!r.is_active ? (
                          <span className="block text-[10px] text-navy-400 mt-1">
                            disabled by agency
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-2">
                        <button
                          type="button"
                          onClick={() => void toggleFeatured(r)}
                          disabled={
                            actingId === r.id ||
                            r.verification_status !== "verified"
                          }
                          aria-pressed={r.is_featured}
                          aria-label={
                            r.is_featured
                              ? `Remove ${agencyName} from featured`
                              : `Promote ${agencyName} as featured`
                          }
                          title={
                            r.verification_status !== "verified"
                              ? "Verify the route first"
                              : r.is_featured
                              ? "Featured — click to unfeature"
                              : "Promote (paid visibility)"
                          }
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border transition-colors",
                            r.is_featured
                              ? "border-yellow-400 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                              : "border-navy-200 text-navy-500 hover:bg-navy-50",
                            "disabled:opacity-40 disabled:cursor-not-allowed"
                          )}
                        >
                          <Star
                            size={13}
                            className={cn(
                              r.is_featured
                                ? "fill-yellow-400 text-yellow-500"
                                : "text-navy-400"
                            )}
                          />
                          {r.is_featured ? "Featured" : "Off"}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        {r.verification_status === "pending" ? (
                          <div className="flex flex-col items-end gap-2">
                            {rejectId === r.id ? (
                              <div className="w-full max-w-[240px] space-y-2">
                                <textarea
                                  className="w-full border border-navy-200 px-2 py-1 text-xs"
                                  rows={2}
                                  placeholder="Reason for rejection…"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRejectId(null);
                                      setRejectReason("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    loading={actingId === r.id}
                                    className="border-red-300 text-red-700"
                                    onClick={() => void reject(r.id)}
                                  >
                                    Confirm reject
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 justify-end">
                                <Button
                                  size="sm"
                                  loading={actingId === r.id}
                                  onClick={() => void verify(r.id)}
                                >
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectId(r.id);
                                    setRejectReason("");
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : filter === "all" && r.verification_status !== "verified" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={actingId === r.id}
                            onClick={() => void verify(r.id)}
                          >
                            Approve now
                          </Button>
                        ) : (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-navy-400">
                      {filter === "pending"
                        ? "No routes awaiting review."
                        : "No route listings yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
