"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  Loader2,
  Users,
  DollarSign,
  Bus,
  TicketCheck,
  Radio,
} from "lucide-react";
import { getSupabase, getSessionUser } from "@/lib/supabase";
import {
  fetchUserProfile,
  isAgencyAdmin,
  isSuperAdmin,
  type UserProfileRow,
} from "@/lib/rbac";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSkeleton } from "@/components/ui/Loading";
import { formatCurrency } from "@/lib/utils";
import { toast, toastError } from "@/lib/toast";

interface FeedRow {
  id: string;
  created_at: string;
  booking_code: string;
  passenger_name: string;
  seat_number: number;
  payment_status: string;
  route: string;
}

function localTodayYmd(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function AgencyCommandCenterPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [occupancyPct, setOccupancyPct] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [totalOccupied, setTotalOccupied] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [activeFleet, setActiveFleet] = useState(0);
  const [feed, setFeed] = useState<FeedRow[]>([]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedRefresh = useCallback((fn: () => void | Promise<void>) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void fn();
    }, 350);
  }, []);

  const loadStats = useCallback(async (aid: string) => {
    const client = getSupabase();
    if (!client) return;

    const todayStr = localTodayYmd();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const [tripsRes, revenueRes, fleetRes] = await Promise.all([
      client
        .from("trips")
        .select("id, available_seats, status, bus:buses(capacity)")
        .eq("agency_id", aid)
        .eq("departure_date", todayStr)
        .in("status", ["scheduled", "boarding", "departed", "arrived"]),
      client
        .from("bookings")
        .select("amount, trip:trips!inner(agency_id)")
        .eq("trip.agency_id", aid)
        .eq("payment_status", "paid")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      client
        .from("buses")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", aid)
        .eq("is_active", true),
    ]);

    let capSum = 0;
    let occSum = 0;
    tripsRes.data?.forEach((t) => {
      const bus = t.bus as { capacity: number } | { capacity: number }[] | null;
      const capRaw = Array.isArray(bus) ? bus[0]?.capacity : bus?.capacity;
      const cap = capRaw != null ? Number(capRaw) : 0;
      const avail = Number(t.available_seats);
      if (!cap) return;
      const occupied = Math.min(cap, Math.max(0, cap - avail));
      capSum += cap;
      occSum += occupied;
    });

    const pct =
      capSum > 0 ? Math.round((occSum / capSum) * 1000) / 10 : 0;
    setTotalCapacity(capSum);
    setTotalOccupied(occSum);
    setOccupancyPct(pct);

    const rev =
      revenueRes.data?.reduce((s, b) => s + (Number(b.amount) || 0), 0) ?? 0;
    setTodayRevenue(rev);
    setActiveFleet(fleetRes.count ?? 0);

    if (tripsRes.error) toastError(tripsRes.error, "Couldn't load trips");
    if (revenueRes.error) toastError(revenueRes.error, "Couldn't load revenue");
    if (fleetRes.error) toastError(fleetRes.error, "Couldn't load fleet");
  }, []);

  const loadFeed = useCallback(async (aid: string) => {
    const client = getSupabase();
    if (!client) return;
    const { data, error } = await client
      .from("bookings")
      .select(
        `id, created_at, booking_code, passenger_name, seat_number, payment_status,
        trip:trips!inner(
          agency_id,
          origin_city:cities!trips_origin_city_id_fkey(name),
          destination_city:cities!trips_destination_city_id_fkey(name)
        )`
      )
      .eq("trip.agency_id", aid)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      toastError(error, "Couldn't load validation feed");
      return;
    }

    const rows: FeedRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const trip = r.trip as
        | {
            origin_city?: { name: string } | { name: string }[];
            destination_city?: { name: string } | { name: string }[];
          }
        | undefined;
      const o = trip?.origin_city;
      const d = trip?.destination_city;
      const on = Array.isArray(o) ? o[0]?.name : o?.name ?? "?";
      const dn = Array.isArray(d) ? d[0]?.name : d?.name ?? "?";
      return {
        id: r.id as string,
        created_at: r.created_at as string,
        booking_code: r.booking_code as string,
        passenger_name: r.passenger_name as string,
        seat_number: r.seat_number as number,
        payment_status: r.payment_status as string,
        route: `${on} → ${dn}`,
      };
    });
    setFeed(rows);
  }, []);

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
      const { data: p, error: pe } = await fetchUserProfile(client, authUser.id);
      if (signal.cancelled) return;
      if (pe) {
        toastError(pe, "Couldn't verify access");
        router.replace("/dashboard");
        return;
      }

      if (isSuperAdmin(p) && !isAgencyAdmin(p)) {
        toast.message("Open this page as an agency account", "Redirecting to the super dashboard.");
        router.replace("/admin/super");
        return;
      }

      if (!isAgencyAdmin(p)) {
        toast.error("Access denied", "Agency admin only.");
        router.replace("/dashboard");
        return;
      }

      const aid = p!.agency_id!;
      setProfile(p);
      setAgencyId(aid);

      const { data: ag } = await client
        .from("agencies")
        .select("name")
        .eq("id", aid)
        .maybeSingle();
      if (!signal.cancelled && ag?.name) setAgencyName(ag.name);

      setReady(true);
      await Promise.all([loadStats(aid), loadFeed(aid)]);
      if (!signal.cancelled) setLoading(false);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [router, loadStats, loadFeed]);

  useEffect(() => {
    if (!ready || !agencyId || !profile) return;
    const client = getSupabase();
    if (!client) return;

    const ch = client
      .channel(`agency-command-${agencyId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        async (payload) => {
          const tripId = payload.new.trip_id as string;
          const { data: trip } = await client
            .from("trips")
            .select("agency_id")
            .eq("id", tripId)
            .maybeSingle();
          if (trip?.agency_id !== agencyId) return;

          const bookingId = payload.new.id as string;
          const { data: row, error } = await client
            .from("bookings")
            .select(
              `id, created_at, booking_code, passenger_name, seat_number, payment_status,
              trip:trips!inner(
                agency_id,
                origin_city:cities!trips_origin_city_id_fkey(name),
                destination_city:cities!trips_destination_city_id_fkey(name)
              )`
            )
            .eq("id", bookingId)
            .maybeSingle();

          if (error || !row) {
            debouncedRefresh(() => loadFeed(agencyId));
            return;
          }

          const r = row as unknown as Record<string, unknown>;
          const tripData = r.trip as
            | {
                origin_city?: { name: string } | { name: string }[];
                destination_city?: { name: string } | { name: string }[];
              }
            | undefined;
          const o = tripData?.origin_city;
          const d = tripData?.destination_city;
          const on = Array.isArray(o) ? o[0]?.name : o?.name ?? "?";
          const dn = Array.isArray(d) ? d[0]?.name : d?.name ?? "?";
          const fr: FeedRow = {
            id: r.id as string,
            created_at: r.created_at as string,
            booking_code: r.booking_code as string,
            passenger_name: r.passenger_name as string,
            seat_number: r.seat_number as number,
            payment_status: r.payment_status as string,
            route: `${on} → ${dn}`,
          };

          setFeed((prev) => {
            const next = [fr, ...prev.filter((x) => x.id !== fr.id)];
            return next.slice(0, 40);
          });
          debouncedRefresh(() => loadStats(agencyId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `agency_id=eq.${agencyId}`,
        },
        () => {
          debouncedRefresh(() => loadStats(agencyId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        () => {
          debouncedRefresh(() => loadFeed(agencyId));
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(ch);
    };
  }, [
    ready,
    agencyId,
    profile,
    loadStats,
    loadFeed,
    debouncedRefresh,
  ]);

  const radialData = useMemo(
    () => [{ name: "occ", value: Math.min(100, occupancyPct), fill: "#059669" }],
    [occupancyPct]
  );

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
        <AdminSidebar />
        <div className="flex-1 p-8">
          <LoadingSkeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline gap-3 mb-2">
          <h1 className="text-2xl font-bold text-navy-800">Command center</h1>
          {agencyName && (
            <Badge variant="info">{agencyName}</Badge>
          )}
        </div>
        <p className="text-sm text-navy-500 mb-8 flex items-center gap-2">
          <Radio size={14} className="text-primary-600" />
          Live metrics for today&apos;s operations — stats refresh from Supabase
          Realtime on <code className="text-navy-600">bookings</code> and{" "}
          <code className="text-navy-600">trips</code>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="flex items-start gap-4">
              <div className="w-28 h-28 shrink-0 min-w-0 min-h-[7rem]">
                <ResponsiveContainer width={112} height={112}>
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={6} background />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-navy-800 font-semibold">
                  <Users size={18} className="text-primary-700 shrink-0" />
                  Bus occupancy (today)
                </div>
                <p className="text-3xl font-bold text-navy-800 mt-1">
                  {occupancyPct}%
                </p>
                <p className="text-xs text-navy-400 mt-1">
                  {totalOccupied} / {totalCapacity} seats across scheduled trips
                </p>
                <div className="mt-3 h-2 w-full rounded-full bg-navy-100 overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, occupancyPct)}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-100 flex items-center justify-center rounded">
                <DollarSign className="text-primary-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">Today&apos;s revenue (paid)</p>
                <p className="text-2xl font-bold text-navy-800">
                  {formatCurrency(todayRevenue)}
                </p>
              </div>
            </div>
            <p className="text-xs text-navy-400">
              Bookings with payment_status paid created today (your timezone).
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-action-100 flex items-center justify-center rounded">
                <Bus className="text-action-700" size={20} />
              </div>
              <div>
                <p className="text-xs text-navy-400">Fleet available</p>
                <p className="text-2xl font-bold text-navy-800">{activeFleet}</p>
              </div>
            </div>
            <p className="text-xs text-navy-400">
              Active buses in your fleet (proxy for deployable capacity).
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TicketCheck className="text-primary-700" size={22} />
              <CardTitle>Live ticket validation</CardTitle>
            </div>
            <p className="text-xs text-navy-400 font-normal mt-1">
              New seat bookings for your agency appear instantly (
              <code className="text-navy-600">postgres_changes</code> on{" "}
              <code className="text-navy-600">bookings</code>).
            </p>
          </CardHeader>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 text-left text-navy-400">
                  <th className="py-2 pr-2">Time</th>
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Route</th>
                  <th className="py-2 pr-2">Passenger</th>
                  <th className="py-2 pr-2">Seat</th>
                  <th className="py-2">Payment</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((r) => (
                  <tr key={r.id} className="border-b border-navy-100">
                    <td className="py-2 pr-2 whitespace-nowrap text-navy-600">
                      {new Date(r.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">{r.booking_code}</td>
                    <td className="py-2 pr-2 max-w-[200px]">{r.route}</td>
                    <td className="py-2 pr-2">{r.passenger_name}</td>
                    <td className="py-2 pr-2">{r.seat_number}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          r.payment_status === "paid"
                            ? "success"
                            : r.payment_status === "pending"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {r.payment_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {feed.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-navy-400">
                      No bookings yet — new tickets will show here live.
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
