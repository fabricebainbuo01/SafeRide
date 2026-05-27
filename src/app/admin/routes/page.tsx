"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toast, toastError } from "@/lib/toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import type { AgencyRouteRow, City } from "@/types";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const statusVariant: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  verified: "success",
  pending: "warning",
  rejected: "danger",
};

export default function AgencyRoutesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AgencyRouteRow[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingAgencyLink, setMissingAgencyLink] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [routeKind, setRouteKind] = useState<"bus" | "camrail">("bus");
  const [originCityId, setOriginCityId] = useState("");
  const [destinationCityId, setDestinationCityId] = useState("");
  const [stopOverNotes, setStopOverNotes] = useState("");
  const [indicativePrice, setIndicativePrice] = useState("");

  const fetchData = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setMissingAgencyLink(false);
      setLoading(false);
      return;
    }
    const {
      data: { user: authUser },
    } = await client.auth.getUser();
    if (!authUser) {
      router.push("/auth/login");
      return;
    }

    const { data: userData } = await client
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!userData?.agency_id) {
      setMissingAgencyLink(true);
      setRows([]);
      setCities([]);
      setLoading(false);
      return;
    }
    setMissingAgencyLink(false);
    const agencyId = userData.agency_id;

    const [routesRes, citiesRes] = await Promise.all([
      client
        .from("agency_routes")
        .select(
          `*,
          origin_city:cities!agency_routes_origin_city_id_fkey(id, name),
          destination_city:cities!agency_routes_destination_city_id_fkey(id, name)`
        )
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false }),
      client.from("cities").select("*").eq("is_active", true).order("name"),
    ]);

    if (routesRes.error) {
      if (
        routesRes.error.message?.includes("agency_routes") ||
        routesRes.error.code === "42P01"
      ) {
        toast.error(
          "Routes table not found",
          "Apply the latest Supabase migration (agency_routes), then reload."
        );
      } else {
        toastError(routesRes.error, "Couldn't load routes");
      }
    }
    if (citiesRes.error) toastError(citiesRes.error, "Couldn't load cities");

    if (routesRes.data) setRows(routesRes.data as unknown as AgencyRouteRow[]);
    if (citiesRes.data) setCities(citiesRes.data as unknown as City[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setRouteKind("bus");
    setOriginCityId("");
    setDestinationCityId("");
    setStopOverNotes("");
    setIndicativePrice("");
  };

  const handleCreate = async () => {
    const client = getSupabase();
    if (!client) return;
    const {
      data: { user: authUser },
    } = await client.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await client
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!userData?.agency_id) {
      toast.error("Not linked to an agency", "");
      return;
    }

    if (!originCityId || !destinationCityId) {
      toast.error("Select origin and destination", "");
      return;
    }
    if (originCityId === destinationCityId) {
      toast.error("Origin and destination must differ", "");
      return;
    }

    const priceNum =
      indicativePrice.trim() === ""
        ? null
        : parseInt(indicativePrice.replace(/\s/g, ""), 10);
    if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) {
      toast.error("Invalid indicative price", "");
      return;
    }

    const { error } = await client.from("agency_routes").insert({
      agency_id: userData.agency_id,
      origin_city_id: originCityId,
      destination_city_id: destinationCityId,
      route_kind: routeKind,
      stop_over_notes: stopOverNotes.trim() || null,
      indicative_price_xaf: priceNum,
    });

    if (error) {
      toastError(error, "Couldn't add route");
      return;
    }

    toast.success("Route submitted", "Moderators review before it goes live.");
    resetForm();
    setShowForm(false);
    void fetchData();
  };

  const toggleActive = async (row: AgencyRouteRow) => {
    const client = getSupabase();
    if (!client) return;
    const next = !row.is_active;
    const { error } = await client
      .from("agency_routes")
      .update({ is_active: next })
      .eq("id", row.id);
    if (error) {
      toastError(error, "Update failed");
      return;
    }
    toast.success(next ? "Route enabled" : "Route disabled", "");
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r))
    );
  };

  const removeRoute = async (row: AgencyRouteRow) => {
    if (
      row.verification_status === "verified" &&
      !confirm(
        "Delete this verified route? Consider disabling it instead unless it should disappear entirely."
      )
    ) {
      return;
    }
    if (
      row.verification_status !== "verified" &&
      !confirm("Delete this route listing?")
    ) {
      return;
    }
    const client = getSupabase();
    if (!client) return;
    const { error } = await client.from("agency_routes").delete().eq("id", row.id);
    if (error) {
      toastError(error, "Couldn't delete");
      return;
    }
    toast.success("Route removed", "");
    void fetchData();
  };

  const cityOptions = cities.map((c) => ({ value: c.id, label: c.name }));

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-8 w-48 mb-6" />
          <LoadingSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (missingAgencyLink) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <p className="text-navy-600">
            Your account is not linked to an agency. Complete onboarding or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Routes you serve</h1>
            <p className="text-sm text-navy-500 mt-1 max-w-xl">
              Add the origin–destination pairs your agency runs. SafeRide moderators verify
              pricing and stop-over details before routes appear on the public Routes page.
            </p>
          </div>
          <Button
            type="button"
            className="gap-2 shrink-0"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus size={16} />
            Add route
          </Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>New route</CardTitle>
              <p className="text-xs text-navy-400 font-normal mt-1">
                Submit accurate indicative fares and major stop-overs to speed up approval.
              </p>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Mode"
                options={[
                  { value: "bus", label: "Bus" },
                  { value: "camrail", label: "CAMRAIL" },
                ]}
                value={routeKind}
                onChange={(e) =>
                  setRouteKind(e.target.value === "camrail" ? "camrail" : "bus")
                }
              />
              <div />
              <Select
                label="From"
                options={cityOptions}
                placeholder="City"
                value={originCityId}
                onChange={(e) => setOriginCityId(e.target.value)}
              />
              <Select
                label="To"
                options={cityOptions}
                placeholder="City"
                value={destinationCityId}
                onChange={(e) => setDestinationCityId(e.target.value)}
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Major stops / notes (optional)
                </label>
                <textarea
                  className="w-full border border-navy-200 px-3 py-2 text-sm text-navy-800 min-h-[88px]"
                  placeholder="e.g. Via Obala, optional pickup points…"
                  value={stopOverNotes}
                  onChange={(e) => setStopOverNotes(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-navy-700 mb-1">
                  Indicative fare (XAF, optional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full border border-navy-200 px-3 py-2 text-sm text-navy-800"
                  placeholder="e.g. 5000"
                  value={indicativePrice}
                  onChange={(e) => setIndicativePrice(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button type="button" onClick={() => void handleCreate()}>
                Submit for review
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your listings</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-navy-400">
                  <th className="py-2 pr-2">Route</th>
                  <th className="py-2 pr-2">Mode</th>
                  <th className="py-2 pr-2">Indicative</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Public</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const o = Array.isArray(r.origin_city)
                    ? r.origin_city[0]?.name
                    : r.origin_city?.name;
                  const d = Array.isArray(r.destination_city)
                    ? r.destination_city[0]?.name
                    : r.destination_city?.name;
                  return (
                    <tr key={r.id} className="border-b border-navy-100 align-top">
                      <td className="py-3 pr-2">
                        <span className="font-medium text-navy-800">
                          {o ?? "—"} → {d ?? "—"}
                        </span>
                        {r.stop_over_notes?.trim() ? (
                          <p className="text-xs text-navy-500 mt-1 max-w-xs">
                            {r.stop_over_notes}
                          </p>
                        ) : null}
                        {r.verification_status === "rejected" && r.rejection_reason?.trim() ? (
                          <p className="text-xs text-red-600 mt-1 max-w-xs">
                            Reason: {r.rejection_reason}
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
                        <Badge variant={statusVariant[r.verification_status] ?? "default"}>
                          {r.verification_status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-2">
                        <Badge variant={r.is_active ? "success" : "danger"}>
                          {r.is_active ? "On" : "Off"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right space-x-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleActive(r)}
                        >
                          {r.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void removeRoute(r)}
                          className="text-red-700 border-red-200 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-navy-400">
                      No routes yet. Add the corridors your fleet serves.
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
