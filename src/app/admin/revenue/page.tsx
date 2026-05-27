"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { toastError } from "@/lib/toast";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";

interface RevenueData {
  totalRevenue: number;
  pendingRevenue: number;
  refundedRevenue: number;
  dailyRevenue: { date: string; amount: number }[];
  routeRevenue: { route: string; amount: number; count: number }[];
}

export default function RevenuePage() {
  const router = useRouter();
  const [revenueData, setRevenueData] = useState<RevenueData>({
    totalRevenue: 0,
    pendingRevenue: 0,
    refundedRevenue: 0,
    dailyRevenue: [],
    routeRevenue: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchRevenue = useCallback(async () => {
    const client = getSupabase();
    if (!client) {
      setLoading(false);
      return;
    }
    const { data: { user: authUser } } = await client.auth.getUser();
    if (!authUser) { router.push("/auth/login"); return; }

    const { data: userData } = await client
      .from("users")
      .select("agency_id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!userData?.agency_id) {
      setLoading(false);
      return;
    }

    type RevenueBookingRow = {
      amount: number;
      created_at: string;
      payment_status: "pending" | "paid" | "refunded";
      trip: {
        agency_id: string;
        origin_city: { name: string } | { name: string }[] | null;
        destination_city: { name: string } | { name: string }[] | null;
      } | null;
    };

    const { data: bookings, error } = await client
      .from("bookings")
      .select(
        "amount, created_at, payment_status, trip:trips!inner(agency_id, origin_city:cities!trips_origin_city_id_fkey(name), destination_city:cities!trips_destination_city_id_fkey(name))"
      )
      .eq("trip.agency_id", userData.agency_id);

    if (error) {
      toastError(error, "Couldn't load revenue");
      setLoading(false);
      return;
    }

    const rows = (bookings as unknown as RevenueBookingRow[]) ?? [];

    const paid = rows.filter((b) => b.payment_status === "paid");
    const totalRevenue = paid.reduce((s, b) => s + b.amount, 0);
    const pendingRevenue = rows
      .filter((b) => b.payment_status === "pending")
      .reduce((s, b) => s + b.amount, 0);
    const refundedRevenue = rows
      .filter((b) => b.payment_status === "refunded")
      .reduce((s, b) => s + b.amount, 0);

    const dailyMap: Record<string, number> = {};
    paid.forEach((b) => {
      const day = b.created_at.split("T")[0];
      dailyMap[day] = (dailyMap[day] || 0) + b.amount;
    });
    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const pickName = (v: { name: string } | { name: string }[] | null | undefined) => {
      if (!v) return undefined;
      return Array.isArray(v) ? v[0]?.name : v.name;
    };

    const routeMap: Record<string, { amount: number; count: number }> = {};
    paid.forEach((b) => {
      const o = pickName(b.trip?.origin_city) || "N/A";
      const d = pickName(b.trip?.destination_city) || "N/A";
      const route = `${o} - ${d}`;
      if (!routeMap[route]) routeMap[route] = { amount: 0, count: 0 };
      routeMap[route].amount += b.amount;
      routeMap[route].count += 1;
    });
    const routeRevenue = Object.entries(routeMap)
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.amount - a.amount);

    setRevenueData({ totalRevenue, pendingRevenue, refundedRevenue, dailyRevenue, routeRevenue });
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  if (loading) {
    return (
      <div className="flex">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(...revenueData.dailyRevenue.map((d) => d.amount), 1);

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex-1 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-navy-800 mb-6">Revenue</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 flex items-center justify-center">
              <DollarSign size={18} className="text-primary-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Collected Revenue</p>
              <p className="text-xl font-bold text-primary-700">
                {formatCurrency(revenueData.totalRevenue)}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Pending Payments</p>
              <p className="text-xl font-bold text-amber-700">
                {formatCurrency(revenueData.pendingRevenue)}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 flex items-center justify-center">
              <Calendar size={18} className="text-red-700" />
            </div>
            <div>
              <p className="text-xs text-navy-400">Refunded</p>
              <p className="text-xl font-bold text-red-700">
                {formatCurrency(revenueData.refundedRevenue)}
              </p>
            </div>
          </Card>
        </div>

        {/* Daily Revenue Chart (simple bar) */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Daily Revenue</CardTitle>
          </CardHeader>
          {revenueData.dailyRevenue.length === 0 ? (
            <p className="text-sm text-navy-400">No revenue data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-48">
              {revenueData.dailyRevenue.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-navy-500 font-medium">
                    {formatCurrency(d.amount)}
                  </span>
                  <div
                    className="w-full bg-primary-700 min-h-[4px]"
                    style={{ height: `${(d.amount / maxDaily) * 140}px` }}
                  />
                  <span className="text-xs text-navy-400">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Route Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Route</CardTitle>
          </CardHeader>
          {revenueData.routeRevenue.length === 0 ? (
            <p className="text-sm text-navy-400">No route data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-200">
                    <th className="text-left py-3 px-4 font-semibold text-navy-600">Route</th>
                    <th className="text-left py-3 px-4 font-semibold text-navy-600">Bookings</th>
                    <th className="text-left py-3 px-4 font-semibold text-navy-600">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.routeRevenue.map((r) => (
                    <tr key={r.route} className="border-b border-navy-100">
                      <td className="py-3 px-4 font-medium text-navy-800">{r.route}</td>
                      <td className="py-3 px-4 text-navy-600">{r.count}</td>
                      <td className="py-3 px-4 font-medium text-primary-700">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
