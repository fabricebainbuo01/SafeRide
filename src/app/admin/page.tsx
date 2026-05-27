"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, getSessionUser } from "@/lib/supabase";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardTitle } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import { toastError } from "@/lib/toast";
import { Bus, Calendar, Ticket, DollarSign, MapPin } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeTrips: 0,
    totalBookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async (signal: { cancelled: boolean }) => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }

    const authUser = await getSessionUser(client);
    if (signal.cancelled) return;
    if (!authUser) {
      router.push("/auth/login");
      setLoading(false);
      return;
    }

    const { data: profile } = await client
      .from("users")
      .select("role, agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (signal.cancelled) return;
    if (!profile || profile.role !== "agency_admin" || !profile.agency_id) {
      router.push("/dashboard");
      setLoading(false);
      return;
    }

    const agencyId = profile.agency_id as string;

    const [busesRes, tripsRes, paidRes] = await Promise.all([
      client
        .from("buses")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      client
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("is_active", true),
      client
        .from("bookings")
        .select("amount, trip:trips!inner(agency_id)")
        .eq("payment_status", "paid")
        .eq("trip.agency_id", agencyId),
    ]);

    if (signal.cancelled) return;

    if (busesRes.error) toastError(busesRes.error, "Couldn't load fleet count");
    if (tripsRes.error) toastError(tripsRes.error, "Couldn't load trip count");
    if (paidRes.error) toastError(paidRes.error, "Couldn't load revenue");

    const revenue =
      paidRes.data?.reduce(
        (sum: number, b: { amount: number }) => sum + (b.amount ?? 0),
        0
      ) ?? 0;

    setStats({
      totalBuses: busesRes.count ?? 0,
      activeTrips: tripsRes.count ?? 0,
      totalBookings: paidRes.data?.length ?? 0,
      revenue,
    });
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadAll(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadAll]);

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-800 mb-6">
          Agency Overview
        </h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-action-100 flex items-center justify-center">
              <Bus size={18} className="text-action-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Total Buses</p>
              <p className="text-lg font-bold text-navy-800">
                {stats.totalBuses}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 flex items-center justify-center">
              <Calendar size={18} className="text-primary-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Active Trips</p>
              <p className="text-lg font-bold text-navy-800">
                {stats.activeTrips}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navy-100 flex items-center justify-center">
              <Ticket size={18} className="text-navy-600" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Paid Bookings</p>
              <p className="text-lg font-bold text-navy-800">
                {stats.totalBookings}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 flex items-center justify-center">
              <DollarSign size={18} className="text-primary-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Revenue</p>
              <p className="text-lg font-bold text-navy-800">
                {formatCurrency(stats.revenue)}
              </p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card hover className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/routes")}>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={18} className="text-primary-700 shrink-0" />
              Routes you serve
            </CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Publish origin–destination pairs for moderator review before they appear publicly.
            </p>
          </Card>
          <Card hover className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/fleet")}>
            <CardTitle>Manage Fleet</CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Add, edit, or deactivate buses in your fleet.
            </p>
          </Card>
          <Card hover className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/schedules")}>
            <CardTitle>Schedule Trips</CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Create and manage departure schedules.
            </p>
          </Card>
          <Card hover className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/bookings")}>
            <CardTitle>View Bookings</CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Check in passengers and manage bookings.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
