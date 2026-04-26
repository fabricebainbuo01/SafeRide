"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardTitle } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import type { User } from "@/types";
import { Bus, Calendar, Ticket, DollarSign } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalBuses: 0,
    activeTrips: 0,
    totalBookings: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      router.push("/auth/login");
      return;
    }
    const { data } = await supabase
      .from("users")
      .select("*, agency:agencies(id)")
      .eq("id", authUser.id)
      .single();
    if (data) {
      const u = data as unknown as User & { agency: { id: string } | null };
      setUser(data as unknown as User);
      if (u.role !== "agency_admin" || !u.agency) {
        router.push("/dashboard");
        return;
      }
    }
  }, [router]);

  const fetchStats = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .single();

    if (!userData?.agency_id) return;
    const agencyId = userData.agency_id;

    const [busesRes, tripsRes, bookingsRes] = await Promise.all([
      supabase
        .from("buses")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("is_active", true),
      supabase
        .from("bookings")
        .select("amount")
        .eq("payment_status", "paid")
        .in(
          "trip_id",
          (
            await supabase
              .from("trips")
              .select("id")
              .eq("agency_id", agencyId)
          ).data?.map((t: { id: string }) => t.id) || []
        ),
    ]);

    const revenue =
      bookingsRes.data?.reduce(
        (sum: number, b: { amount: number }) => sum + b.amount,
        0
      ) || 0;

    setStats({
      totalBuses: busesRes.count || 0,
      activeTrips: tripsRes.count || 0,
      totalBookings: bookingsRes.data?.length || 0,
      revenue,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
    fetchStats();
  }, [fetchUser, fetchStats]);

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
              <p className="text-xs text-navy-400">Total Bookings</p>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/fleet")}>
            <CardTitle>Manage Fleet</CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Add, edit, or deactivate buses in your fleet.
            </p>
          </Card>
          <Card className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/schedules")}>
            <CardTitle>Schedule Trips</CardTitle>
            <p className="text-sm text-navy-500 mt-2">
              Create and manage departure schedules.
            </p>
          </Card>
          <Card className="hover:border-primary-700 transition-colors cursor-pointer" onClick={() => router.push("/admin/bookings")}>
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
